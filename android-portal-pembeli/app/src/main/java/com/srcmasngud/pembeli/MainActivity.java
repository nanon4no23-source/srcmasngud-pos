package com.srcmasngud.pembeli;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {
    private static final String TAG = "PortalPembeli";
    private static final int CAMERA_PERMISSION_REQUEST = 101;
    private static final int FILE_CHOOSER_REQUEST = 102;

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private LinearLayout layoutOffline;
    private ProgressBar progressBar;
    private Button btnRetry;

    private PermissionRequest pendingPermissionRequest;
    private ValueCallback<Uri[]> fileUploadCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        initViews();
        setupWebView();
        setupBackDispatcher();
        setupSwipeRefresh();

        checkCameraPermission();
        loadPortalStore();
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        layoutOffline = findViewById(R.id.layoutOffline);
        progressBar = findViewById(R.id.progressBar);
        btnRetry = findViewById(R.id.btnRetry);

        btnRetry.setOnClickListener(v -> {
            if (isNetworkAvailable()) {
                layoutOffline.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                webView.reload();
            } else {
                Toast.makeText(this, "Internet belum tersedia, silakan coba lagi.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm != null) {
            NetworkInfo netInfo = cm.getActiveNetworkInfo();
            return netInfo != null && netInfo.isConnected();
        }
        return false;
    }

    private void loadPortalStore() {
        String portalUrl = getString(R.string.portal_url);
        if (isNetworkAvailable()) {
            layoutOffline.setVisibility(View.GONE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(portalUrl);
        } else {
            layoutOffline.setVisibility(View.VISIBLE);
            webView.setVisibility(View.GONE);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Bersihkan User-Agent agar responsif dan kompatibel
        String rawUa = settings.getUserAgentString();
        if (rawUa != null) {
            String cleanUa = rawUa.replace("; wv", "").replaceAll("Version\\/[0-9.]+\\s*", "") + " SRCPembeliApp/1.0";
            settings.setUserAgentString(cleanUa);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cookieManager.setAcceptThirdPartyCookies(webView, true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);
                    if (!isNetworkAvailable()) {
                        layoutOffline.setVisibility(View.VISIBLE);
                        webView.setVisibility(View.GONE);
                    }
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                return handleUrlScheme(uri);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                return handleUrlScheme(uri);
            }

            private boolean handleUrlScheme(Uri uri) {
                if (uri == null) return false;
                String scheme = uri.getScheme();
                String host = uri.getHost();

                // 1. WhatsApp Redirection (Pesanan Checkout via WA)
                if ("whatsapp".equalsIgnoreCase(scheme) || (host != null && host.contains("wa.me"))) {
                    try {
                        Intent waIntent = new Intent(Intent.ACTION_VIEW, uri);
                        waIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(waIntent);
                        return true;
                    } catch (ActivityNotFoundException e) {
                        Toast.makeText(MainActivity.this, "Aplikasi WhatsApp tidak ditemukan di HP Anda.", Toast.LENGTH_LONG).show();
                        return true;
                    }
                }

                // 2. Telepon & Email
                if ("tel".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(intent);
                        return true;
                    } catch (Exception ignored) {}
                }

                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            // Grant HTML5 Camera permissions for Barcode & QR Scanner
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                            if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                    == PackageManager.PERMISSION_GRANTED) {
                                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                            } else {
                                pendingPermissionRequest = request;
                                ActivityCompat.requestPermissions(MainActivity.this,
                                        new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                            }
                            return;
                        }
                    }
                    request.deny();
                });
            }

            // File Chooser for Photo Picker (Gallery)
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Pilih Foto Gambar"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileUploadCallback = null;
                    return false;
                }
            }
        });
    }

    private void setupSwipeRefresh() {
        // Nonaktifkan SwipeRefresh agar pengguna leluasa scrolling katalog dan form pembayaran tanpa reload tidak sengaja
        swipeRefresh.setEnabled(false);
        swipeRefresh.setColorSchemeResources(R.color.primary_red);
    }

    private void checkCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (pendingPermissionRequest != null) {
                    pendingPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    pendingPermissionRequest = null;
                }
            } else {
                if (pendingPermissionRequest != null) {
                    pendingPermissionRequest.deny();
                    pendingPermissionRequest = null;
                }
                Toast.makeText(this, "Izin kamera diperlukan untuk memindai kartu member.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                Uri dataUri = data.getData();
                if (dataUri != null) {
                    results = new Uri[]{dataUri};
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    private void setupBackDispatcher() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null) {
                    // Cek apakah ada modal atau state di React yang menangani back
                    webView.evaluateJavascript(
                        "(function() { if (typeof window.handleAndroidHardwareBack === 'function') { return window.handleAndroidHardwareBack(); } return false; })()",
                        value -> {
                            boolean handled = "true".equals(value) || "\"true\"".equals(value);
                            if (!handled) {
                                if (webView.canGoBack()) {
                                    webView.goBack();
                                } else {
                                    finish();
                                }
                            }
                        }
                    );
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
