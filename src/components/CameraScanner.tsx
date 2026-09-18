import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onScanSuccess, onClose }: CameraScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = "html5-qrcode-scanner-element";

  const onScanSuccessRef = useRef(onScanSuccess);
  const lastScanRef = useRef<{ text: string; time: number } | null>(null);
  
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    let isMounted = true;
    
    const timer = setTimeout(() => {
      if (!isMounted) return;
      
      try {
        const html5Qrcode = new Html5Qrcode(elementId);
        scannerRef.current = html5Qrcode;
        
        html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const minSize = Math.min(width, height);
              const qrboxSize = Math.floor(minSize * 0.75);
              return {
                width: qrboxSize,
                height: Math.floor(qrboxSize * 0.55), // rectangular focus for typical barcodes
              };
            }
          },
          (decodedText) => {
            const now = Date.now();
            const lastScan = lastScanRef.current;
            
            // Ignore same barcode scanned within 1.5 seconds
            if (lastScan && lastScan.text === decodedText && (now - lastScan.time) < 1500) {
              return;
            }
            
            // Enforce a small safety cool-down of 400ms even for different barcodes to avoid rapid stutter reads
            if (lastScan && (now - lastScan.time) < 400) {
              return;
            }
            
            lastScanRef.current = { text: decodedText, time: now };
            onScanSuccessRef.current(decodedText);
            playBeep();
          },
          () => {
            // Silently ignore frame scan failures
          }
        ).then(() => {
          if (isMounted) setIsInitializing(false);
        }).catch((err) => {
          console.error("Failed to start scanner:", err);
          if (isMounted) {
            setError("Gagal mengakses kamera. Mohon pastikan izin akses kamera diberikan dan kamera tidak sedang dipakai oleh aplikasi lain.");
            setIsInitializing(false);
          }
        });
      } catch (err: any) {
        console.error("Camera initialize error:", err);
        if (isMounted) {
          setError("Gagal menginisialisasi modul kamera: " + (err?.message || err));
          setIsInitializing(false);
        }
      }
    }, 400);

    const playBeep = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 1100;
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.08);
      } catch (e) {
        // user interaction or browser policy may block audio initially
      }
    };

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current && scannerRef.current.isScanning) {
        const scannerInstance = scannerRef.current;
        scannerInstance.stop().catch(err => {
          console.error("Clean-up error stopping scanner:", err);
        });
      }
    };
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-700/50 rounded-xl p-4 overflow-hidden shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-violet-400">
          <Camera className="w-4 h-4 animate-pulse" />
          <h4 className="text-xs font-semibold text-slate-200">Kamera HP Scanner Aktif</h4>
        </div>
        <button
          onClick={onClose}
          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
        >
          Tutup
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2.5 bg-rose-950/40 border border-rose-900/40 p-3 rounded-lg text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">Gagal Membuka Kamera</p>
            <p className="leading-relaxed text-[11px]">{error}</p>
            <p className="text-[10px] text-slate-400 pt-1 border-t border-rose-950/50">
              * Jika berjalan di dalam Iframe AI Studio, silakan klik tombol <b>Buka di Tab Baru</b> di pojok kanan atas layar agar browser dapat meloloskan izin hardware kamera Anda.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative bg-slate-950 rounded-lg overflow-hidden min-h-[180px] flex items-center justify-center">
          {isInitializing && (
            <div className="absolute inset-x-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 gap-1.5 p-4">
              <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
              <p className="text-[11px] text-slate-400">Menghubungkan sensor kamera...</p>
            </div>
          )}
          <div id={elementId} className="w-full h-full max-w-sm rounded" />
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-400 text-center leading-normal">
        Arahkan barcode / QR Code produk ke dalam petak fokus kamera di atas.
      </div>
    </div>
  );
}
