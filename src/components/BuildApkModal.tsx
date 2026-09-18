import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  FileCode2, 
  FolderArchive, 
  ExternalLink, 
  ShieldCheck, 
  Smartphone, 
  Terminal,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { BUILD_APK_YML_CONTENT } from '../utils/buildApkWorkflow';
import { exportAndSaveFile, downloadRemoteFileBlob } from '../utils/fileDownloader';

interface BuildApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  hologramMode?: boolean;
  pinkMode?: boolean;
  onToast: (msg: string) => void;
}

export const BuildApkModal: React.FC<BuildApkModalProps> = ({
  isOpen,
  onClose,
  hologramMode = false,
  pinkMode = false,
  onToast
}) => {
  const [copied, setCopied] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDownloadingYaml, setIsDownloadingYaml] = useState(false);
  const [activeTab, setActiveTab] = useState<'yaml' | 'guide'>('yaml');

  if (!isOpen) return null;

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(BUILD_APK_YML_CONTENT);
      setCopied(true);
      onToast("📋 Seluruh isi skrip build-apk.yml berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback manual textarea copy
      const textarea = document.createElement('textarea');
      textarea.value = BUILD_APK_YML_CONTENT;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      onToast("📋 Seluruh isi skrip build-apk.yml berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDownloadYaml = async () => {
    setIsDownloadingYaml(true);
    try {
      const res = await exportAndSaveFile({
        filename: 'build-apk.yml',
        content: BUILD_APK_YML_CONTENT,
        mimeType: 'text/yaml;charset=utf-8;',
        title: 'GitHub Actions build-apk.yml',
        description: 'Alur kerja build APK Android SRC MASNGUD'
      });
      onToast(res.message);
    } catch (err: any) {
      onToast(`❌ Gagal mengunduh: ${err.message}`);
    } finally {
      setIsDownloadingYaml(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    onToast("⏳ Memproses pengunduhan paket ZIP proyek...");
    try {
      const res = await downloadRemoteFileBlob(
        '/apkv2.0.zip',
        'srcmasngud-kasir-v3.0.zip',
        'application/zip'
      );
      onToast(res.message);
    } catch (err: any) {
      onToast(`❌ Gagal mengunduh ZIP: ${err.message}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          hologramMode
            ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
            : (pinkMode 
                ? 'bg-pink-50/95 border-pink-200 text-pink-950'
                : 'bg-white border-slate-200 text-slate-900')
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 flex items-center justify-between border-b ${
          hologramMode ? 'border-zinc-800 bg-zinc-900/60' : 'border-slate-200 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold border border-amber-500/25">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                <span>Pusat Unduh APK &amp; build-apk.yml</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-extrabold border border-emerald-500/30">v3.0</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Unduh ZIP proyek atau salin skrip alur kerja otomatis GitHub Actions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Banner */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-100 dark:border-zinc-800/80">
          {/* Action 1: Unduh ZIP */}
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
            className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white flex items-center gap-3 shadow-md transition-all active:scale-[0.98] cursor-pointer text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <FolderArchive className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span>{isDownloadingZip ? 'Memproses...' : 'Unduh ZIP Proyek'}</span>
                <Download className="w-3.5 h-3.5" />
              </div>
              <p className="text-[10px] text-indigo-100 leading-tight mt-0.5">
                Seluruh kode sumber terbaru, Capacitor &amp; folder Android (11.7 MB)
              </p>
            </div>
          </button>

          {/* Action 2: Unduh build-apk.yml */}
          <button
            type="button"
            onClick={handleDownloadYaml}
            disabled={isDownloadingYaml}
            className="p-3 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white flex items-center gap-3 shadow-md transition-all active:scale-[0.98] cursor-pointer text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <FileCode2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span>{isDownloadingYaml ? 'Menyimpan...' : 'Unduh build-apk.yml'}</span>
                <Download className="w-3.5 h-3.5" />
              </div>
              <p className="text-[10px] text-amber-100 leading-tight mt-0.5">
                Disimpan langsung ke HP/PC via sistem file browser aman
              </p>
            </div>
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 px-4 pt-2 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('yaml')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'yaml'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Isi Skrip build-apk.yml</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'guide'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Petunjuk Pasang di GitHub</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-grow space-y-3 max-h-[50vh]">
          {activeTab === 'yaml' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-amber-500" />
                  <span>.github/workflows/build-apk.yml</span>
                </span>
                <button
                  type="button"
                  onClick={handleCopyYaml}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    copied 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-800 hover:bg-slate-900 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin!' : 'Salin Seluruh Skrip (1-Klik)'}</span>
                </button>
              </div>

              {/* Code Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-slate-100 font-mono text-[11px] p-3 leading-relaxed max-h-72 overflow-y-auto select-all">
                <pre className="whitespace-pre">{BUILD_APK_YML_CONTENT}</pre>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 space-y-2">
                <div className="font-extrabold flex items-center gap-2 text-indigo-800">
                  <Sparkles className="w-4 h-4" />
                  <span>3 Langkah Mudah Menggunakan GitHub Actions untuk Jadi APK:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px]">
                  <li>
                    <strong>Upload Berkas Proyek:</strong> Ekstrak atau upload berkas ZIP proyek ke repositori GitHub Anda.
                  </li>
                  <li>
                    <strong>Buat File Alur Kerja:</strong> Di repositori GitHub, buat berkas baru dengan path persis: <code className="bg-indigo-100 px-1 py-0.5 rounded font-mono font-bold">.github/workflows/build-apk.yml</code>, lalu tempel (paste) skrip di atas.
                  </li>
                  <li>
                    <strong>APK Selesai Otomatis:</strong> Buka tab <strong>Actions</strong> di GitHub, klik alur kerja tersebut. Dalam 2-4 menit APK otomatis jadi dan bisa diunduh di bagian <strong>Artifacts</strong> (<code className="bg-indigo-100 px-1 py-0.5 rounded font-mono">srcmasngud-kasir-v3.0.apk</code>).
                  </li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 text-[11px]">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Opsi Ekspor Resmi dari Google AI Studio:</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                  Anda juga dapat mengekspor repositori secara langsung dengan mengklik menu opsi (ikon titik tiga atau tombol Share/Export) di pojok kanan atas tampilan Google AI Studio, lalu memilih <strong>Download as ZIP</strong> atau <strong>Export to GitHub</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-3.5 sm:p-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          hologramMode ? 'border-zinc-800 bg-zinc-900/50' : 'border-slate-100 bg-slate-50'
        }`}>
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Semua file telah diperbarui dengan fitur sembunyikan riwayat nota harian.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ml-auto"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
