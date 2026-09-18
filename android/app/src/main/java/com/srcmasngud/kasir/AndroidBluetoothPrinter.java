package com.srcmasngud.kasir;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

public class AndroidBluetoothPrinter {
    private static final String TAG = "AndroidBtPrinter";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");
    private static final int PERMISSION_REQ_CODE = 9021;

    private final Activity activity;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket currentSocket;
    private OutputStream currentOutputStream;
    private String connectedDeviceName = "";
    private String connectedDeviceAddress = "";

    public AndroidBluetoothPrinter(Activity activity) {
        this.activity = activity;
        try {
            this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        } catch (Exception e) {
            Log.e(TAG, "BluetoothAdapter error", e);
        }
    }

    private boolean checkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // Android 12+
            int connectPerm = ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_CONNECT);
            int scanPerm = ContextCompat.checkSelfPermission(activity, Manifest.permission.BLUETOOTH_SCAN);
            if (connectPerm != PackageManager.PERMISSION_GRANTED || scanPerm != PackageManager.PERMISSION_GRANTED) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        ActivityCompat.requestPermissions(activity,
                                new String[]{Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN},
                                PERMISSION_REQ_CODE);
                    }
                });
                return false;
            }
        } else {
            int locPerm = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION);
            if (locPerm != PackageManager.PERMISSION_GRANTED) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        ActivityCompat.requestPermissions(activity,
                                new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION},
                                PERMISSION_REQ_CODE);
                    }
                });
                return false;
            }
        }
        return true;
    }

    @JavascriptInterface
    public void openBluetoothSettings() {
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to open bluetooth settings", e);
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "openBluetoothSettings error", e);
        }
    }

    @JavascriptInterface
    public void openAppSettings() {
        try {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        Uri uri = Uri.fromParts("package", activity.getPackageName(), null);
                        intent.setData(uri);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(intent);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to open app settings", e);
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "openAppSettings error", e);
        }
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return bluetoothAdapter != null;
    }

    @JavascriptInterface
    public boolean isEnabled() {
        if (bluetoothAdapter == null) return false;
        try {
            return bluetoothAdapter.isEnabled();
        } catch (SecurityException se) {
            checkPermissions();
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public void requestPermissions() {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                checkPermissions();
            }
        });
    }

    @JavascriptInterface
    public String getPairedDevices() {
        JSONObject result = new JSONObject();
        JSONArray deviceList = new JSONArray();

        if (bluetoothAdapter == null) {
            try {
                result.put("success", false);
                result.put("error", "Perangkat ini tidak memiliki modul Bluetooth.");
                result.put("devices", deviceList);
            } catch (Exception ignored) {}
            return result.toString();
        }

        if (!checkPermissions()) {
            try {
                result.put("success", false);
                result.put("needsPermission", true);
                result.put("error", "Izin Bluetooth Android belum aktif. Silakan izinkan saat pop-up muncul di layar HP Anda.");
                result.put("devices", deviceList);
            } catch (Exception ignored) {}
            return result.toString();
        }

        try {
            if (!bluetoothAdapter.isEnabled()) {
                result.put("success", false);
                result.put("error", "Bluetooth di HP sedang mati. Silakan hidupkan Bluetooth Anda.");
                result.put("devices", deviceList);
                return result.toString();
            }

            Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();
            if (bondedDevices != null) {
                for (BluetoothDevice device : bondedDevices) {
                    JSONObject dev = new JSONObject();
                    String name = device.getName();
                    if (name == null || name.trim().isEmpty()) {
                        name = "Perangkat Bluetooth (" + device.getAddress() + ")";
                    }
                    dev.put("name", name);
                    dev.put("address", device.getAddress());
                    dev.put("type", device.getType());
                    deviceList.put(dev);
                }
            }

            result.put("success", true);
            result.put("devices", deviceList);
        } catch (SecurityException se) {
            try {
                result.put("success", false);
                result.put("needsPermission", true);
                result.put("error", "Izin akses Bluetooth ditolak sistem Android.");
                result.put("devices", deviceList);
            } catch (Exception ignored) {}
        } catch (Exception e) {
            try {
                result.put("success", false);
                result.put("error", e.getMessage());
                result.put("devices", deviceList);
            } catch (Exception ignored) {}
        }

        return result.toString();
    }

    @JavascriptInterface
    public synchronized String connect(String macAddress) {
        JSONObject res = new JSONObject();
        if (bluetoothAdapter == null) {
            try {
                res.put("success", false);
                res.put("error", "Bluetooth tidak tersedia di HP.");
            } catch (Exception ignored) {}
            return res.toString();
        }

        if (!checkPermissions()) {
            try {
                res.put("success", false);
                res.put("error", "Izin Bluetooth belum aktif di HP.");
            } catch (Exception ignored) {}
            return res.toString();
        }

        cleanup();

        try {
            bluetoothAdapter.cancelDiscovery();
            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(macAddress);
            if (device == null) {
                res.put("success", false);
                res.put("error", "Perangkat dengan MAC " + macAddress + " tidak ditemukan.");
                return res.toString();
            }

            BluetoothSocket socket = null;
            Exception lastError = null;
            final BluetoothDevice finalDevice = device;

            ExecutorService executor = Executors.newSingleThreadExecutor();

            // Percobaan 1: Insecure RFCOMM Socket dengan SPP UUID (standar printer thermal)
            try {
                Log.d(TAG, "Attempting Insecure SPP UUID with 2500ms timeout...");
                final BluetoothSocket s1 = finalDevice.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                Future<Boolean> f1 = executor.submit(new Callable<Boolean>() {
                    @Override
                    public Boolean call() throws Exception {
                        s1.connect();
                        return true;
                    }
                });
                f1.get(2500, TimeUnit.MILLISECONDS);
                socket = s1;
                Log.d(TAG, "Successfully connected via Insecure SPP UUID!");
            } catch (Exception e1) {
                lastError = e1;
                Log.w(TAG, "Insecure SPP UUID failed or timed out: " + e1.getMessage());
            }

            // Percobaan 2 (jika percobaan 1 gagal): Reflection Insecure Channel 1
            if (socket == null) {
                try {
                    Log.d(TAG, "Attempting reflection channel 1 with 2000ms timeout...");
                    Method m = finalDevice.getClass().getMethod("createInsecureRfcommSocket", new Class[]{int.class});
                    final BluetoothSocket s2 = (BluetoothSocket) m.invoke(finalDevice, 1);
                    Future<Boolean> f2 = executor.submit(new Callable<Boolean>() {
                        @Override
                        public Boolean call() throws Exception {
                            s2.connect();
                            return true;
                        }
                    });
                    f2.get(2000, TimeUnit.MILLISECONDS);
                    socket = s2;
                    Log.d(TAG, "Successfully connected via reflection channel 1!");
                } catch (Exception e2) {
                    lastError = e2;
                    Log.w(TAG, "Reflection channel 1 failed or timed out: " + e2.getMessage());
                }
            }

            executor.shutdownNow();

            if (socket == null) {
                cleanup();
                res.put("success", false);
                res.put("error", "Printer tidak merespons atau sedang offline: " + (lastError != null ? lastError.getMessage() : "Timeout"));
                return res.toString();
            }

            currentSocket = socket;
            currentOutputStream = socket.getOutputStream();
            connectedDeviceName = device.getName();
            if (connectedDeviceName == null || connectedDeviceName.isEmpty()) {
                connectedDeviceName = "Printer Thermal (" + macAddress + ")";
            }
            connectedDeviceAddress = macAddress;

            res.put("success", true);
            res.put("name", connectedDeviceName);
            res.put("address", connectedDeviceAddress);
        } catch (SecurityException se) {
            try {
                res.put("success", false);
                res.put("error", "Izin keamanan Bluetooth Android ditolak.");
            } catch (Exception ignored) {}
        } catch (Exception e) {
            cleanup();
            try {
                res.put("success", false);
                res.put("error", e.getMessage());
            } catch (Exception ignored) {}
        }

        return res.toString();
    }

    @JavascriptInterface
    public synchronized boolean isConnected() {
        return currentSocket != null && currentSocket.isConnected() && currentOutputStream != null;
    }

    @JavascriptInterface
    public String getConnectedDeviceName() {
        return isConnected() ? connectedDeviceName : "";
    }

    @JavascriptInterface
    public String getConnectedDeviceAddress() {
        return isConnected() ? connectedDeviceAddress : "";
    }

    @JavascriptInterface
    public synchronized void disconnect() {
        cleanup();
    }

    @JavascriptInterface
    public synchronized String printRawBase64(String base64Data) {
        JSONObject res = new JSONObject();
        if (!isConnected()) {
            try {
                res.put("success", false);
                res.put("error", "Printer belum terhubung.");
            } catch (Exception ignored) {}
            return res.toString();
        }

        try {
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            currentOutputStream.write(bytes);
            currentOutputStream.flush();
            res.put("success", true);
        } catch (Exception e) {
            Log.e(TAG, "Error writing raw bytes to printer", e);
            try {
                res.put("success", false);
                res.put("error", "Terputus saat mencetak: " + e.getMessage());
            } catch (Exception ignored) {}
        }

        return res.toString();
    }

    @JavascriptInterface
    public synchronized String printText(String text) {
        JSONObject res = new JSONObject();
        if (!isConnected()) {
            try {
                res.put("success", false);
                res.put("error", "Printer belum terhubung.");
            } catch (Exception ignored) {}
            return res.toString();
        }

        try {
            byte[] bytes = text.getBytes("GBK"); // GBK/CP437 umum digunakan printer POS
            currentOutputStream.write(bytes);
            currentOutputStream.flush();
            res.put("success", true);
        } catch (Exception e) {
            try {
                res.put("success", false);
                res.put("error", "Gagal mencetak teks: " + e.getMessage());
            } catch (Exception ignored) {}
        }

        return res.toString();
    }

    public synchronized void cleanup() {
        try {
            if (currentOutputStream != null) {
                currentOutputStream.close();
            }
        } catch (Exception ignored) {}
        try {
            if (currentSocket != null) {
                currentSocket.close();
            }
        } catch (Exception ignored) {}
        currentOutputStream = null;
        currentSocket = null;
        connectedDeviceName = "";
        connectedDeviceAddress = "";
    }
}
