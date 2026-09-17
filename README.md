# SRC MASNGUD POS - Kasir Pintar Toko Kelontong & Minimarket

Aplikasi Kasir Pintar Modern SRC Masngud berbasis Web & Android Native (Capacitor), dengan dukungan printer thermal Bluetooth (ESC/POS 58mm/80mm), pemindai barcode kamera & USB laser, serta sinkronisasi Cloud Firestore.

---

## 🚀 Cara Otomatis Build APK di GitHub (GitHub Actions)

Proyek ini sudah dilengkapi dengan alur otomatisasi **GitHub Actions** (`.github/workflows/build-apk.yml`).

### Langkah-langkah:
1. **Upload / Push** semua file proyek ini ke repositori GitHub Anda (di branch `main` atau `master`).
2. Begitu di-push, buka tab **"Actions"** di repositori GitHub Anda.
3. Anda akan melihat proses pekerjaan bernama **"Build Android APK (SRC MASNGUD)"** sedang berjalan.
4. Tunggu sekitar 2-3 menit hingga tanda centang hijau (Success) muncul.
5. Klik pada hasil build tersebut, scroll ke bawah ke bagian **"Artifacts"**.
6. Klik **`srcmasngud-kasir-apk`** untuk langsung mengunduh file **`srcmasngud-kasir-v1.0.apk`**!
7. Kirim file APK tersebut ke HP Android Anda dan pasang (install).

---

## 🖨️ Fitur Bluetooth Printer Native di APK
- Menggunakan driver Java Native `AndroidBluetoothPrinter.java` yang terhubung langsung ke WebView Capacitor (`window.AndroidPrinter`).
- Mendukung koneksi socket RFCOMM Insecure & Secure SPP UUID (`00001101-0000-1000-8000-00805F9B34FB`) dengan multi-fallback channel 1-3.
- Kompatibel dengan semua printer thermal Bluetooth mini 58mm/80mm: **MPT-II, POS-58, Goojprt, Panda, RPP02, Zjiang, Eppos**, dll.

---

## 💻 Jalankan di Komputer Lokal (Development)

```bash
# 1. Install dependencies
npm install

# 2. Jalankan server lokal
npm run dev

# 3. Build & sinkronkan ke proyek Android
npm run build
npx cap sync android
```
