// src/utils/fileDownloader.ts
// Solusi penyimpanan & unduh file untuk Android APK (Capacitor/WebView) & Web Browser

export interface ExportFileOptions {
  filename: string;
  content: string;
  mimeType: string;
  title?: string;
  description?: string;
}

export interface ExportResult {
  success: boolean;
  method: 'android_native' | 'web_share' | 'web_download' | 'error';
  message: string;
  savedPath?: string;
}

/**
 * Mengonversi string UTF-8 ke Base64 dengan aman (mendukung emoji & karakter Indonesia)
 */
function toBase64Utf8(str: string): string {
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch {
    return btoa(unescape(encodeURIComponent(str)));
  }
}

let lastExportedFile: ExportFileOptions | null = null;

export function getLastExportedFile(): ExportFileOptions | null {
  return lastExportedFile;
}

/**
 * Menyimpan atau mengekspor file secara universal:
 * 1. Di APK Android: Langsung disimpan ke folder Download/SRC_MASNGUD/ di memori HP via AndroidFileManager
 *    dan membuka menu share (WhatsApp, Drive, Pengelola File).
 * 2. Di Mobile Browser / WebView: Membuka dialog Share bawaan Android/iOS (Web Share API) agar bisa disimpan ke File/Drive/WA.
 * 3. Di Desktop Browser (Chrome/Firefox/Edge): Unduh otomatis via Blob link.
 */
export async function exportAndSaveFile(options: ExportFileOptions): Promise<ExportResult> {
  lastExportedFile = options;
  const { filename, content, mimeType, title, description } = options;

  // 1. Prioritas 1: Jika berjalan di dalam APK Android dengan AndroidFileManager bridge
  const androidFileManager = (window as any).AndroidFileManager;
  if (androidFileManager && typeof androidFileManager.saveAndShareFile === 'function') {
    try {
      const base64Data = toBase64Utf8(content);
      const resJson = androidFileManager.saveAndShareFile(filename, base64Data, mimeType);
      
      try {
        const parsed = JSON.parse(resJson);
        if (parsed.success) {
          return {
            success: true,
            method: 'android_native',
            message: `📁 Berhasil! File tersimpan di folder Download HP (${filename})`,
            savedPath: parsed.path || `Download/SRC_MASNGUD/${filename}`
          };
        }
      } catch {
        // Fallback jika return bukan JSON valid
      }

      return {
        success: true,
        method: 'android_native',
        message: `📁 File ${filename} berhasil disimpan ke folder Download HP!`
      };
    } catch (err) {
      console.warn('AndroidFileManager error, mencoba metode fallback:', err);
    }
  }

  // 2. Prioritas 2: Web Share API (didukung penuh oleh Android WebView modern & Chrome Android)
  // Ini memungkinkan pengguna menyimpan file ke "Download", "Google Drive", atau kirim ke "WhatsApp"
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });

      if (typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true) {
        await navigator.share({
          files: [file],
          title: title || filename,
          text: description || `Data ekspor ${filename} dari aplikasi SRC MASNGUD.`
        });

        return {
          success: true,
          method: 'web_share',
          message: `📁 File ${filename} siap disimpan atau dibagikan!`
        };
      }
    } catch (shareErr: any) {
      // Jika pengguna membatalkan dialog share (AbortError), jangan anggap error fatal
      if (shareErr && shareErr.name === 'AbortError') {
        return {
          success: true,
          method: 'web_share',
          message: `Menu penyimpanan file ${filename} dibuka.`
        };
      }
      console.warn('Web Share API gagal, beralih ke download link browser:', shareErr);
    }
  }

  // 3. Prioritas 3: Download Browser Standar (Komputer / Desktop Chrome / Firefox)
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }, 3000);

    return {
      success: true,
      method: 'web_download',
      message: `📥 File ${filename} berhasil diunduh!`
    };
  } catch (err: any) {
    console.error('Download browser gagal:', err);
    return {
      success: false,
      method: 'error',
      message: `Gagal mengunduh: ${err?.message || String(err)}`
    };
  }
}

/**
 * Mengunduh berkas biner/statis dari URL server menggunakan Blob di memori browser.
 * Sangat ampuh untuk iframe sandbox atau browser HP yang memblokir link download biasa.
 */
export async function downloadRemoteFileBlob(
  url: string, 
  filename: string, 
  mimeType: string = 'application/octet-stream'
): Promise<ExportResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Gagal mengambil berkas dari server (Kode: ${response.status})`);
    }

    const blob = await response.blob();
    const finalBlob = new Blob([blob], { type: mimeType });

    // 1. Jika di Android native APK via AndroidFileManager
    const androidFileManager = (window as any).AndroidFileManager;
    if (androidFileManager && typeof androidFileManager.saveAndShareFile === 'function') {
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(finalBlob);
      });
      androidFileManager.saveAndShareFile(filename, base64Data, mimeType);
      return {
        success: true,
        method: 'android_native',
        message: `📁 Berkas ${filename} berhasil disimpan ke folder Download HP!`
      };
    }

    // 2. Web Share API jika didukung (Mobile / WebView)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        const file = new File([finalBlob], filename, { type: mimeType });
        if (typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true) {
          await navigator.share({
            files: [file],
            title: filename,
            text: `Berkas unduhan ${filename} SRC MASNGUD`
          });
          return {
            success: true,
            method: 'web_share',
            message: `📁 Berkas ${filename} siap disimpan atau dibagikan!`
          };
        }
      } catch (shareErr: any) {
        if (shareErr && shareErr.name === 'AbortError') {
          return {
            success: true,
            method: 'web_share',
            message: `Menu penyimpanan berkas dibuka.`
          };
        }
      }
    }

    // 3. Fallback Web Blob URL Download
    const blobUrl = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 6000);

    return {
      success: true,
      method: 'web_download',
      message: `📥 Berkas ${filename} berhasil diproses dan diunduh!`
    };
  } catch (err: any) {
    console.warn('downloadRemoteFileBlob gagal, mencoba membuka tautan langsung:', err);
    try {
      window.open(url, '_blank');
      return {
        success: true,
        method: 'web_download',
        message: `Membuka unduhan ${filename} di tab baru.`
      };
    } catch {
      return {
        success: false,
        method: 'error',
        message: `Gagal mengunduh berkas: ${err?.message || 'Koneksi terputus'}`
      };
    }
  }
}

