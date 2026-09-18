import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Copy, AppWindow } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    (this as any).setState({ errorInfo });
  }

  private handleResetApp = () => {
    if (confirm("Apakah Anda yakin ingin mengatur ulang data aplikasi? Ini akan menghapus data kasir di peramban ini untuk memperbaiki error.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  private handleCopyToClipboard = () => {
    if (!this.state.error) return;
    const errorText = `Error: ${this.state.error.message}\nStack: ${this.state.error.stack}\nComponent Stack: ${(this.state.errorInfo as any)?.componentStack || ''}`;
    navigator.clipboard.writeText(errorText);
    alert("Detail error telah disalin ke papan klip! 📋");
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans select-none antialiased text-slate-100">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
            {/* Background design accents */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-red-600/10 blur-3xl rounded-full" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />

            <div className="relative text-center space-y-4">
              <div className="inline-flex p-3.5 bg-red-950/50 border border-red-800/40 rounded-2xl text-red-500">
                <AlertTriangle className="w-10 h-10 animate-bounce" />
              </div>
              
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">SRC MASNGUD Mengalami Kendala</h2>
                <p className="text-xs text-slate-400">Terjadi kesalahan sistem saat memuat aplikasi di HP Anda.</p>
              </div>

              {/* Error Detail Display */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-left space-y-2">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest block font-mono">Pesan Kesalahan (Error Code):</span>
                <p className="text-xs font-mono text-red-300 break-words leading-relaxed select-all">
                  {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Kesalahan tidak diketahui'}
                </p>
                {this.state.error?.stack && (
                  <div className="mt-2 pt-2 border-t border-slate-900 text-[10px] max-h-36 overflow-y-auto font-mono text-slate-500 whitespace-pre-wrap break-all leading-normal">
                    {this.state.error.stack}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={this.handleResetApp}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs rounded-2xl transition-all cursor-pointer shadow-lg shadow-red-950/20"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset & Mulai Baru</span>
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs rounded-2xl transition-all cursor-pointer"
                >
                  <AppWindow className="w-4 h-4" />
                  <span>Muat Ulang Laman</span>
                </button>
              </div>

              <div className="flex justify-between items-center pt-2 text-[11px] text-slate-400 border-t border-slate-800/50">
                <span>Ingin melaporkan bug ini?</span>
                <button
                  onClick={this.handleCopyToClipboard}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-all font-semibold font-mono cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Salin Detail Error</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
