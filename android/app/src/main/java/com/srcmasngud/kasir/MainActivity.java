package com.srcmasngud.kasir;

import android.os.Bundle;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private AndroidBluetoothPrinter bluetoothPrinter;
    private AndroidFileManager fileManager;
    private OnBackPressedCallback backPressedCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupPrinterBridge();
        setupBackButtonDispatcher();
        setupOAuthAndWebView();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupPrinterBridge();
        setupOAuthAndWebView();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupPrinterBridge();
        setupOAuthAndWebView();
    }

    private void triggerDefaultBack() {
        if (backPressedCallback != null) {
            backPressedCallback.setEnabled(false);
        }
        finish();
    }

    private void setupBackButtonDispatcher() {
        backPressedCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    WebView webView = null;
                    if (bridge != null) {
                        webView = bridge.getWebView();
                    }
                    if (webView == null && getBridge() != null) {
                        webView = getBridge().getWebView();
                    }
                    if (webView != null) {
                        webView.evaluateJavascript(
                            "(function() { if (typeof window.handleAndroidHardwareBack === 'function') { return window.handleAndroidHardwareBack(); } return false; })()",
                            new ValueCallback<String>() {
                                @Override
                                public void onReceiveValue(String value) {
                                    boolean handled = "true".equals(value) || "\"true\"".equals(value);
                                    if (!handled) {
                                        // If not handled by React (e.g. user pressed back on home screen), exit/finish
                                        triggerDefaultBack();
                                    }
                                }
                            }
                        );
                        return;
                    }
                } catch (Exception e) {
                    Log.e(TAG, "handleOnBackPressed error", e);
                }
                triggerDefaultBack();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
    }

    private synchronized void setupPrinterBridge() {
        try {
            if (bluetoothPrinter == null) {
                bluetoothPrinter = new AndroidBluetoothPrinter(this);
            }
            if (fileManager == null) {
                fileManager = new AndroidFileManager(this);
            }
            WebView webView = null;
            if (this.bridge != null) {
                webView = this.bridge.getWebView();
            }
            if (webView == null && getBridge() != null) {
                webView = getBridge().getWebView();
            }
            if (webView != null) {
                final WebView finalWebView = webView;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            finalWebView.addJavascriptInterface(bluetoothPrinter, "AndroidPrinter");
                            finalWebView.addJavascriptInterface(fileManager, "AndroidFileManager");
                            Log.d(TAG, "AndroidPrinter & AndroidFileManager attached to WebView");
                        } catch (Exception e) {
                            Log.e(TAG, "Failed to attach javascript interfaces", e);
                        }
                    }
                });
            } else {
                Log.w(TAG, "WebView is null, will retry in onResume/onStart");
            }
        } catch (Throwable t) {
            Log.e(TAG, "setupPrinterBridge error", t);
        }
    }

    private synchronized void setupOAuthAndWebView() {
        try {
            WebView webView = null;
            if (this.bridge != null) {
                webView = this.bridge.getWebView();
            }
            if (webView == null && getBridge() != null) {
                webView = getBridge().getWebView();
            }
            if (webView != null) {
                final WebView mainWebView = webView;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            android.webkit.WebSettings settings = mainWebView.getSettings();
                            settings.setJavaScriptCanOpenWindowsAutomatically(true);
                            settings.setSupportMultipleWindows(true);
                            settings.setDomStorageEnabled(true);
                            settings.setDatabaseEnabled(true);

                            // Strip '; wv' and 'Version/4.0' from User-Agent so Google allows sign-in
                            String rawUa = settings.getUserAgentString();
                            final String cleanUa = (rawUa != null)
                                ? rawUa.replace("; wv", "").replaceAll("Version\\/[0-9.]+\\s*", "")
                                : null;
                            if (cleanUa != null) {
                                settings.setUserAgentString(cleanUa);
                            }

                            android.webkit.CookieManager cookieManager = android.webkit.CookieManager.getInstance();
                            cookieManager.setAcceptCookie(true);
                            cookieManager.setAcceptThirdPartyCookies(mainWebView, true);

                            mainWebView.setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(bridge) {
                                @Override
                                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                                    try {
                                        final android.app.Dialog popupDialog = new android.app.Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_Light_NoActionBar_Fullscreen);
                                        
                                        android.widget.LinearLayout container = new android.widget.LinearLayout(MainActivity.this);
                                        container.setOrientation(android.widget.LinearLayout.VERTICAL);
                                        container.setLayoutParams(new android.view.ViewGroup.LayoutParams(
                                            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
                                            android.view.ViewGroup.LayoutParams.MATCH_PARENT
                                        ));

                                        android.widget.RelativeLayout topBar = new android.widget.RelativeLayout(MainActivity.this);
                                        topBar.setBackgroundColor(0xFF1E293B);
                                        topBar.setPadding(32, 24, 32, 24);

                                        android.widget.TextView titleView = new android.widget.TextView(MainActivity.this);
                                        titleView.setText("Login Google / Drive");
                                        titleView.setTextColor(0xFFFFFFFF);
                                        titleView.setTextSize(16);
                                        android.widget.RelativeLayout.LayoutParams titleParams = new android.widget.RelativeLayout.LayoutParams(
                                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT,
                                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT
                                        );
                                        titleParams.addRule(android.widget.RelativeLayout.ALIGN_PARENT_LEFT);
                                        titleParams.addRule(android.widget.RelativeLayout.CENTER_VERTICAL);
                                        topBar.addView(titleView, titleParams);

                                        android.widget.Button closeBtn = new android.widget.Button(MainActivity.this);
                                        closeBtn.setText("Tutup ✕");
                                        closeBtn.setTextColor(0xFFFFFFFF);
                                        closeBtn.setBackgroundColor(0xFFDC2626);
                                        closeBtn.setPadding(24, 12, 24, 12);
                                        closeBtn.setTextSize(13);
                                        closeBtn.setOnClickListener(new android.view.View.OnClickListener() {
                                            @Override
                                            public void onClick(android.view.View v) {
                                                try {
                                                    popupDialog.dismiss();
                                                } catch (Exception ignored) {}
                                            }
                                        });
                                        android.widget.RelativeLayout.LayoutParams btnParams = new android.widget.RelativeLayout.LayoutParams(
                                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT,
                                            android.widget.RelativeLayout.LayoutParams.WRAP_CONTENT
                                        );
                                        btnParams.addRule(android.widget.RelativeLayout.ALIGN_PARENT_RIGHT);
                                        btnParams.addRule(android.widget.RelativeLayout.CENTER_VERTICAL);
                                        topBar.addView(closeBtn, btnParams);

                                        container.addView(topBar, new android.widget.LinearLayout.LayoutParams(
                                            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                                            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
                                        ));

                                        final WebView popupView = new WebView(MainActivity.this);
                                        popupView.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
                                            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                                            0,
                                            1.0f
                                        ));
                                        android.webkit.WebSettings popupSettings = popupView.getSettings();
                                        popupSettings.setJavaScriptEnabled(true);
                                        popupSettings.setDomStorageEnabled(true);
                                        popupSettings.setDatabaseEnabled(true);
                                        popupSettings.setSupportMultipleWindows(true);
                                        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                                        if (cleanUa != null) {
                                            popupSettings.setUserAgentString(cleanUa);
                                        }

                                        android.webkit.CookieManager.getInstance().setAcceptCookie(true);
                                        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(popupView, true);

                                        popupView.setWebChromeClient(new android.webkit.WebChromeClient() {
                                            @Override
                                            public void onCloseWindow(WebView window) {
                                                try {
                                                    popupDialog.dismiss();
                                                } catch (Exception ignored) {}
                                            }
                                        });

                                        popupView.setWebViewClient(new android.webkit.WebViewClient() {
                                            @Override
                                            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                                                return false;
                                            }
                                        });

                                        container.addView(popupView);
                                        popupDialog.setContentView(container);
                                        popupDialog.show();

                                        android.webkit.WebView.WebViewTransport transport = (android.webkit.WebView.WebViewTransport) resultMsg.obj;
                                        transport.setWebView(popupView);
                                        resultMsg.sendToTarget();
                                        return true;
                                    } catch (Exception ex) {
                                        Log.e(TAG, "onCreateWindow popup error", ex);
                                        return false;
                                    }
                                }
                            });
                        } catch (Exception e) {
                            Log.e(TAG, "setupOAuthAndWebView error", e);
                        }
                    }
                });
            }
        } catch (Throwable t) {
            Log.e(TAG, "setupOAuthAndWebView outer error", t);
        }
    }

    @Override
    public void onDestroy() {
        if (bluetoothPrinter != null) {
            bluetoothPrinter.cleanup();
        }
        super.onDestroy();
    }
}


