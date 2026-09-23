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
    private Thread currentWatcherThread;
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

    private BluetoothSocket tryConnectSocket(BluetoothSocket socket, String description, int timeoutMs) {
        if (socket == null) return null;
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Log.d(TAG, "Mencoba koneksi printer via " + description + " (timeout " + timeoutMs + "ms)...");
            Future<Boolean> future = executor.submit(new Callable<Boolean>() {
                @Override
                public Boolean call() throws Exception {
                    socket.connect();
                    return true;
                }
            });
            future.get(timeoutMs, TimeUnit.MILLISECONDS);
            Log.d(TAG, "Berhasil terhubung ke printer via " + description + "!");
            return socket;
        } catch (Exception e) {
            Log.w(TAG, description + " gagal (" + e.getClass().getSimpleName() + "): " + e.getMessage());
            try {
                socket.close();
            } catch (Exception ignored) {}
            try {
                Thread.sleep(200);
            } catch (Exception ignored) {}
            return null;
        } finally {
            try {
                executor.shutdownNow();
            } catch (Exception ignored) {}
        }
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

        // Jika sudah terhubung ke perangkat ini dan socket aktif, langsung kembalikan sukses
        if (isConnected() && macAddress != null && macAddress.equalsIgnoreCase(connectedDeviceAddress)) {
            try {
                res.put("success", true);
                res.put("name", connectedDeviceName);
                res.put("address", connectedDeviceAddress);
                return res.toString();
            } catch (Exception ignored) {}
        }

        cleanup();
        try {
            Thread.sleep(200);
        } catch (Exception ignored) {}

        try {
            bluetoothAdapter.cancelDiscovery();
            try {
                Thread.sleep(200);
            } catch (Exception ignored) {}

            BluetoothDevice device = bluetoothAdapter.getRemoteDevice(macAddress);
            if (device == null) {
                res.put("success", false);
                res.put("error", "Perangkat Bluetooth dengan MAC " + macAddress + " tidak ditemukan.");
                return res.toString();
            }

            BluetoothSocket socket = null;

            // METODE 1: Standar Android Secure SPP UUID (Wajib untuk perangkat yang sudah disandingkan dengan PIN 0000/1234)
            if (socket == null) {
                try {
                    BluetoothSocket s = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket = tryConnectSocket(s, "Secure SPP UUID (Standar Resmi)", 6000);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal membuat Secure SPP socket: " + e.getMessage());
                }
            }

            // METODE 2: Direct Channel 1 Secure (Melewati pencarian SDP yang sering gagal/timeout pada printer thermal)
            if (socket == null) {
                try {
                    Method m = device.getClass().getMethod("createRfcommSocket", new Class[]{int.class});
                    BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
                    socket = tryConnectSocket(s, "Direct Secure Channel 1 (Bypass SDP)", 5000);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal membuat Direct Channel 1 socket: " + e.getMessage());
                }
            }

            // METODE 3: Standar Insecure SPP UUID (Untuk printer / ROM yang tidak mendukung enkripsi link)
            if (socket == null) {
                try {
                    BluetoothSocket s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    socket = tryConnectSocket(s, "Insecure SPP UUID", 5000);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal membuat Insecure SPP socket: " + e.getMessage());
                }
            }

            // METODE 4: Direct Channel 1 Insecure
            if (socket == null) {
                try {
                    Method m = device.getClass().getMethod("createInsecureRfcommSocket", new Class[]{int.class});
                    BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
                    socket = tryConnectSocket(s, "Direct Insecure Channel 1", 5000);
                } catch (Exception e) {
                    Log.w(TAG, "Gagal membuat Direct Insecure Channel 1 socket: " + e.getMessage());
                }
            }

            // METODE 5: Fallback Channel 2 dan 3 (untuk printer dual-mode BLE / Classic terbaru)
            if (socket == null) {
                for (int ch = 2; ch <= 3; ch++) {
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", new Class[]{int.class});
                        BluetoothSocket s = (BluetoothSocket) m.invoke(device, ch);
                        socket = tryConnectSocket(s, "Fallback Channel " + ch, 4000);
                        if (socket != null) break;
                    } catch (Exception ignored) {}
                }
            }

            if (socket == null) {
                cleanup();
                res.put("success", false);
                res.put("error", "Printer tidak merespons setelah 5 metode koneksi. Pastikan printer menyala, dekat dengan HP, dan tidak sedang tersambung ke HP atau aplikasi lain.");
                return res.toString();
            }

            currentSocket = socket;
            currentOutputStream = socket.getOutputStream();
            connectedDeviceName = device.getName();
            if (connectedDeviceName == null || connectedDeviceName.isEmpty()) {
                connectedDeviceName = "Printer Thermal (" + macAddress + ")";
            }
            connectedDeviceAddress = macAddress;

            // Kirim perintah inisialisasi ESC @ (0x1B, 0x40) agar printer aktif dan tidak idle sleep
            try {
                currentOutputStream.write(new byte[]{0x1B, 0x40});
                currentOutputStream.flush();
                Log.d(TAG, "Printer berhasil diinisialisasi dengan ESC @");
            } catch (Exception ex) {
                Log.w(TAG, "Inisialisasi ESC @ gagal: " + ex.getMessage());
            }

            // Mulai background thread untuk memantau status pemutusan printer secara real-time
            startConnectionWatcher();

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

    private synchronized void startConnectionWatcher() {
        if (currentSocket == null) return;
        final BluetoothSocket socketToWatch = currentSocket;
        
        // Stop any old thread if still alive
        if (currentWatcherThread != null && currentWatcherThread.isAlive()) {
            try {
                currentWatcherThread.interrupt();
            } catch (Exception ignored) {}
        }

        currentWatcherThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    java.io.InputStream in = socketToWatch.getInputStream();
                    byte[] buffer = new byte[64];
                    while (!Thread.currentThread().isInterrupted() && socketToWatch.isConnected() && currentSocket == socketToWatch) {
                        int read = in.read(buffer);
                        if (read == -1) {
                            Log.d(TAG, "Socket input stream closed by remote device (-1)");
                            break;
                        }
                    }
                } catch (Exception e) {
                    Log.d(TAG, "Connection watcher disconnected: " + e.getMessage());
                } finally {
                    synchronized (AndroidBluetoothPrinter.this) {
                        if (currentSocket == socketToWatch) {
                            Log.d(TAG, "Printer fisik terputus, membersihkan status socket...");
                            cleanup();
                        }
                    }
                }
            }
        }, "BtPrinterWatcher");
        currentWatcherThread.setDaemon(true);
        currentWatcherThread.start();
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
            int chunkSize = 256;
            for (int i = 0; i < bytes.length; i += chunkSize) {
                int len = Math.min(chunkSize, bytes.length - i);
                currentOutputStream.write(bytes, i, len);
                currentOutputStream.flush();
                if (bytes.length > chunkSize) {
                    try { Thread.sleep(15); } catch (Exception ignored) {}
                }
            }
            res.put("success", true);
        } catch (Exception e) {
            Log.e(TAG, "Error writing raw bytes to printer", e);
            cleanup();
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
            int chunkSize = 256;
            for (int i = 0; i < bytes.length; i += chunkSize) {
                int len = Math.min(chunkSize, bytes.length - i);
                currentOutputStream.write(bytes, i, len);
                currentOutputStream.flush();
                if (bytes.length > chunkSize) {
                    try { Thread.sleep(15); } catch (Exception ignored) {}
                }
            }
            res.put("success", true);
        } catch (Exception e) {
            Log.e(TAG, "Error writing text bytes to printer", e);
            cleanup();
            try {
                res.put("success", false);
                res.put("error", "Gagal mencetak teks: " + e.getMessage());
            } catch (Exception ignored) {}
        }

        return res.toString();
    }

    public synchronized void cleanup() {
        if (currentWatcherThread != null && currentWatcherThread.isAlive()) {
            try {
                currentWatcherThread.interrupt();
            } catch (Exception ignored) {}
        }
        currentWatcherThread = null;

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
