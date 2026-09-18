package com.srcmasngud.kasir;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class AndroidFileManager {
    private static final String TAG = "AndroidFileManager";
    private final Activity activity;

    public AndroidFileManager(Activity activity) {
        this.activity = activity;
    }

    private void showToast(final String message) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Log.e(TAG, "Failed to show toast", e);
                }
            }
        });
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public String saveFile(final String filename, final String base64Data, final String mimeType) {
        try {
            byte[] data;
            try {
                data = Base64.decode(base64Data, Base64.DEFAULT);
            } catch (Exception e) {
                data = base64Data.getBytes(StandardCharsets.UTF_8);
            }

            String effectiveMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "application/octet-stream";

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, effectiveMime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SRC_MASNGUD");

                Uri uri = activity.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri != null) {
                    OutputStream os = activity.getContentResolver().openOutputStream(uri);
                    if (os != null) {
                        os.write(data);
                        os.flush();
                        os.close();
                        showToast("📁 File berhasil disimpan di folder Download/SRC_MASNGUD/" + filename);
                        return "{\"success\":true,\"path\":\"Download/SRC_MASNGUD/" + filename + "\"}";
                    }
                }
            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File appDir = new File(downloadsDir, "SRC_MASNGUD");
                if (!appDir.exists()) {
                    appDir.mkdirs();
                }
                File outFile = new File(appDir, filename);
                FileOutputStream fos = new FileOutputStream(outFile);
                fos.write(data);
                fos.flush();
                fos.close();
                MediaScannerConnection.scanFile(activity, new String[]{outFile.getAbsolutePath()}, null, null);
                showToast("📁 File berhasil disimpan di folder Download/SRC_MASNGUD/" + filename);
                return "{\"success\":true,\"path\":\"" + outFile.getAbsolutePath() + "\"}";
            }
        } catch (Exception e) {
            Log.e(TAG, "saveFile error", e);
            showToast("❌ Gagal menyimpan file: " + e.getMessage());
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
        return "{\"success\":false,\"error\":\"Gagal menginisialisasi penyimpanan\"}";
    }

    @JavascriptInterface
    public String shareFile(final String filename, final String base64Data, final String mimeType) {
        try {
            byte[] data;
            try {
                data = Base64.decode(base64Data, Base64.DEFAULT);
            } catch (Exception e) {
                data = base64Data.getBytes(StandardCharsets.UTF_8);
            }

            File cacheDir = new File(activity.getCacheDir(), "shared_exports");
            if (!cacheDir.exists()) {
                cacheDir.mkdirs();
            }
            File cacheFile = new File(cacheDir, filename);
            FileOutputStream fos = new FileOutputStream(cacheFile);
            fos.write(data);
            fos.flush();
            fos.close();

            final Uri fileUri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", cacheFile);
            final String effectiveMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "*/*";

            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType(effectiveMime);
                        intent.putExtra(Intent.EXTRA_STREAM, fileUri);
                        intent.putExtra(Intent.EXTRA_SUBJECT, filename);
                        intent.putExtra(Intent.EXTRA_TEXT, "Data ekspor dari SRC MASNGUD: " + filename);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(intent, "Simpan / Kirim File (" + filename + ")");
                        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(chooser);
                    } catch (Exception ex) {
                        Log.e(TAG, "Failed to launch share chooser", ex);
                        showToast("Gagal membuka menu bagikan: " + ex.getMessage());
                    }
                }
            });

            return "{\"success\":true,\"shared\":true}";
        } catch (Exception e) {
            Log.e(TAG, "shareFile error", e);
            return "{\"success\":false,\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    @JavascriptInterface
    public String saveAndShareFile(final String filename, final String base64Data, final String mimeType) {
        // Simpan langsung ke Download folder
        saveFile(filename, base64Data, mimeType);
        // Tampilkan dialog pilihan (Simpan ke Drive / WhatsApp / Salin ke Pengelola File)
        return shareFile(filename, base64Data, mimeType);
    }
}
