import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Printer, 
  Award, 
  ShoppingBag, 
  Calendar, 
  CreditCard, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  Target, 
  History, 
  FileText, 
  Edit3, 
  Activity, 
  Coins
} from 'lucide-react';
import { Pelanggan, Transaksi, ConfigStruk } from '../types';
import { parseDebtsFromNotes } from '../App';

function parseTransactionDate(trx: Transaksi): Date {
  if (trx.timestamp) return new Date(trx.timestamp);
  if (!trx.waktu) return new Date();
  
  // Split on whitespace or commas; clean any control characters like Left-to-Right marks (\u200E) or Right-to-Left marks (\u200F)
  const cleanedWaktu = trx.waktu.replace(/[\u200E\u200F]/g, '');
  
  let day = 1;
  let month = 0;
  let year = new Date().getFullYear();
  let isParsed = false;

  // Check if the date format is numeric with slashes, dashes, or dots: e.g. "11/07/2026" or "11-07-2026" or "11.07.2026"
  // Usually formatted in id-ID locale as DD/MM/YYYY or D/M/YYYY
  const numericDateMatch = cleanedWaktu.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (numericDateMatch) {
    day = parseInt(numericDateMatch[1], 10);
    month = parseInt(numericDateMatch[2], 10) - 1; // 0-indexed month
    year = parseInt(numericDateMatch[3], 10);
    isParsed = true;
  }

  const parts = cleanedWaktu.split(/[\s,]+/);

  if (!isParsed) {
    if (parts.length >= 3) {
      day = parseInt(parts[0], 10) || 1;
      const monthStr = parts[1].toLowerCase();
      
      const indMonths = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];
      const engMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      
      let mIdx = indMonths.findIndex(m => monthStr.startsWith(m));
      if (mIdx === -1) {
        mIdx = engMonths.findIndex(m => monthStr.startsWith(m));
      }
      if (mIdx !== -1) {
        month = mIdx;
      }
      
      year = parseInt(parts[2], 10) || year;
    } else {
      const d = new Date(cleanedWaktu);
      if (!isNaN(d.getTime())) return d;
    }
  }
  
  let h = 0, mi = 0, s = 0;
  // Find a part that looks like time: containing a colon (:) or having multiple dots (.) separating numbers.
  const timePart = parts.find(p => {
    return /^\d+[:.]\d+[:.]\d+$/.test(p) || p.includes(':') || p.split('.').length >= 3;
  });

  if (timePart) {
    const tParts = timePart.split(/[:.]+/);
    h = parseInt(tParts[0], 10) || 0;
    mi = parseInt(tParts[1], 10) || 0;
    s = parseInt(tParts[2], 10) || 0;
  }
  
  return new Date(year, month, day, h, mi, s);
}

interface MemberDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Pelanggan | null;
  transactions: Transaksi[];
  hologramMode: boolean;
  config: ConfigStruk;
  onPrintCard: (p: Pelanggan) => void;
  onOpenEdit: (p: Pelanggan) => void;
}

export default function MemberDetailModal({
  isOpen,
  onClose,
  member,
  transactions,
  hologramMode,
  config,
  onPrintCard,
  onOpenEdit
}: MemberDetailModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'transactions'>('overview');
  const [expandedTrxId, setExpandedTrxId] = useState<string | null>(null);

  // Disable scroll behind modal
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !member) return null;

  // Filter transactions belonging to this member and sort with newest first
  const memberTransactions = useMemo(() => {
    const filtered = transactions.filter(t => t.pelangganId === member.id);
    return [...filtered].sort((a, b) => {
      const timeA = a.timestamp || parseTransactionDate(a).getTime();
      const timeB = b.timestamp || parseTransactionDate(b).getTime();
      return timeB - timeA;
    });
  }, [transactions, member]);

  // Aggregate stats
  const totalSpent = member.totalBelanja || 0;
  const visitCount = memberTransactions.length;
  const averageSpent = visitCount > 0 ? Math.round(totalSpent / visitCount) : 0;

  // Debts and Credit Limits calculations
  const currentDebts = useMemo(() => {
    return parseDebtsFromNotes(member.catatan || '');
  }, [member]);

  const totalDebt = useMemo(() => {
    return currentDebts.reduce((sum, d) => sum + d.amount, 0);
  }, [currentDebts]);

  const limitKredit = member.limitKredit ?? 500000;
  const debtPercentage = Math.min(100, Math.round((totalDebt / limitKredit) * 100)) || 0;

  // Tier calculations
  const tierInfo = useMemo(() => {
    const value = totalSpent;
    let label = 'BRONZE';
    let nextLabel = 'SILVER';
    let minVal = 0;
    let maxVal = 750000;
    let color = hologramMode ? 'text-orange-400' : 'text-orange-700';
    let bgColor = hologramMode ? 'bg-orange-950/20 border-orange-900/30' : 'bg-orange-50 border-orange-200';
    let barColor = 'bg-orange-500';

    if (value >= 5000000) {
      label = 'PLATINUM';
      nextLabel = 'MAX LEVEL';
      minVal = 5000000;
      maxVal = 5000000;
      color = hologramMode ? 'text-cyan-400' : 'text-cyan-800';
      bgColor = hologramMode ? 'bg-cyan-950/40 border-cyan-800/40' : 'bg-cyan-50 border-cyan-200';
      barColor = 'bg-cyan-500';
    } else if (value >= 2000000) {
      label = 'GOLD';
      nextLabel = 'PLATINUM';
      minVal = 2000000;
      maxVal = 5000000;
      color = hologramMode ? 'text-amber-400' : 'text-amber-800';
      bgColor = hologramMode ? 'bg-amber-950/40 border-amber-900/40' : 'bg-amber-50 border-amber-205';
      barColor = 'bg-amber-500';
    } else if (value >= 750000) {
      label = 'SILVER';
      nextLabel = 'GOLD';
      minVal = 750000;
      maxVal = 2000000;
      color = hologramMode ? 'text-zinc-300' : 'text-slate-700';
      bgColor = hologramMode ? 'bg-zinc-800/40 border-zinc-700/40' : 'bg-slate-100 border-slate-200';
      barColor = 'bg-slate-400';
    }

    const progress = maxVal === minVal ? 100 : Math.min(100, Math.round(((value - minVal) / (maxVal - minVal)) * 100));
    const nextRemaining = Math.max(0, maxVal - value);

    return { label, nextLabel, progress, nextRemaining, maxVal, color, bgColor, barColor };
  }, [totalSpent, hologramMode]);

  // Aggregate favorite products
  const favoriteProducts = useMemo(() => {
    const counts: Record<string, { name: string; qty: number; count: number; subtotal: number }> = {};
    memberTransactions.forEach(t => {
      t.items.forEach(item => {
        if (!counts[item.nama]) {
          counts[item.nama] = { name: item.nama, qty: 0, count: 0, subtotal: 0 };
        }
        counts[item.nama].qty += item.qty;
        counts[item.nama].count += 1;
        counts[item.nama].subtotal += item.subtotal;
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [memberTransactions]);

  const maxFavoriteQty = favoriteProducts.length > 0 ? favoriteProducts[0].qty : 1;

  // Print member profile report
  const handlePrintMemberReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup blocker menghalangi pencetakan. Harap aktifkan popup browser.");
      return;
    }

    const titleStr = `LAPORAN AKTIVITAS MEMBER - ${member.nama.toUpperCase()}`;
    const reportHtml = `
      <html>
      <head>
        <title>${titleStr}</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.4; color: black; padding: 20px; width: 72mm; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 15px; }
          .title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
          .divider { border-top: 1px dashed black; margin: 8px 0; }
          .stat-row { display: flex; justify-content: space-between; margin: 4px 0; }
          .stat-label { font-weight: bold; }
          .section-title { font-weight: bold; text-align: center; margin: 15px 0 5px 0; text-transform: uppercase; }
          .item-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SRC MASNGUD</div>
          <div style="font-size: 10px;">LAPORAN RINGKASAN MEMBER</div>
          <div style="font-size: 9px; margin-top: 2px;">${new Date().toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        <div class="divider"></div>
        
        <div class="stat-row"><span class="stat-label">ID Member:</span><span>${member.id}</span></div>
        <div class="stat-row"><span class="stat-label">Nama:</span><span>${member.nama}</span></div>
        <div class="stat-row"><span class="stat-label">HP:</span><span>${member.telepon}</span></div>
        <div class="stat-row"><span class="stat-label">Tgl Daftar:</span><span>${member.tanggalDaftar}</span></div>
        <div class="stat-row"><span class="stat-label">Status Tier:</span><span>${tierInfo.label}</span></div>
        
        <div class="divider"></div>
        <div class="section-title">METRIK LOYALITAS</div>
        <div class="divider"></div>
        
        <div class="stat-row"><span class="stat-label">Saldo Poin:</span><span>${member.poin} Pts</span></div>
        <div class="stat-row"><span class="stat-label">Total Belanja:</span><span>Rp ${totalSpent.toLocaleString('id-ID')}</span></div>
        <div class="stat-row"><span class="stat-label">Frekuensi:</span><span>${visitCount}x Belanja</span></div>
        <div class="stat-row"><span class="stat-label">Rata-rata Nota:</span><span>Rp ${averageSpent.toLocaleString('id-ID')}</span></div>
        
        ${favoriteProducts.length > 0 ? `
          <div class="divider"></div>
          <div class="section-title">PRODUK TERFAVORIT</div>
          <div class="divider"></div>
          ${favoriteProducts.map(p => `
            <div class="item-row">
              <span style="max-width: 50mm; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">* ${p.name}</span>
              <span>${p.qty} unit</span>
            </div>
          `).join('')}
        ` : ''}

        ${memberTransactions.length > 0 ? `
          <div class="divider"></div>
          <div class="section-title">RIWAYAT NOTA TERAKHIR</div>
          <div class="divider"></div>
          ${memberTransactions.slice(0, 5).map(t => `
            <div class="item-row">
              <span>${t.waktu.split(',')[0]}</span>
              <span>Rp ${t.total.toLocaleString('id-ID')}</span>
            </div>
          `).join('')}
        ` : ''}

        <div class="divider"></div>
        <div class="footer">
          Terima Kasih atas Kesetiaan Anda!<br>
          -- Mitra Setia Toko Kami --
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  return (
    <div className={`fixed inset-0 z-[110] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200 ${
      hologramMode ? 'bg-black/85' : 'bg-slate-900/60'
    }`}>
      <div className={`w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden transform animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] border-2 ${
        hologramMode 
          ? 'bg-[#0a0a0d] border-zinc-800 text-white shadow-[0_0_50px_rgba(16,185,129,0.1)]' 
          : 'bg-white border-slate-200'
      }`}>
        
        {/* Header section */}
        <div className={`px-6 py-4.5 border-b flex items-center justify-between shrink-0 ${
          hologramMode ? 'border-zinc-850 bg-zinc-950/40' : 'bg-slate-50 border-slate-100'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl shrink-0 ${
              hologramMode ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className={`text-base font-black uppercase tracking-wider font-sans ${hologramMode ? 'text-zinc-100' : 'text-slate-800'}`}>
                Dashboard Analisis &amp; Detail Member
              </h3>
              <p className={`text-[10px] font-medium ${hologramMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                Analisis mendalam profil belanja member <strong className={hologramMode ? 'text-emerald-400' : 'text-emerald-600'}>{member.nama}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              hologramMode ? 'hover:bg-zinc-900 text-zinc-400 hover:text-white' : 'hover:bg-slate-150 text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member profile highlight bar */}
        <div className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b shrink-0 ${
          hologramMode ? 'border-zinc-850 bg-zinc-950/20' : 'bg-slate-50/50 border-slate-100'
        }`}>
          <div className="text-left space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold font-sans ${hologramMode ? 'text-white' : 'text-slate-900'}`}>{member.nama}</span>
              <span className={`text-[9.5px] font-bold border py-0.5 px-2 rounded font-mono ${
                hologramMode ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                ID: {member.id}
              </span>
              <span className={`text-[10.5px] px-2 py-0.5 rounded-full border uppercase tracking-wider font-extrabold font-sans select-none ${tierInfo.bgColor} ${tierInfo.color}`}>
                🏆 {tierInfo.label}
              </span>
            </div>
            <p className={`text-[11px] font-mono ${hologramMode ? 'text-zinc-450' : 'text-slate-500'}`}>
              📞 {member.telepon} • ⏱️ Terdaftar sejak {member.tanggalDaftar}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => {
                onClose();
                onOpenEdit(member);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                hologramMode 
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200' 
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-250 shadow-xs'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profil</span>
            </button>
            <button
              onClick={() => onPrintCard(member)}
              className={`px-3 py-1.5 text-xs font-black rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                hologramMode 
                  ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200' 
                  : 'bg-white hover:bg-slate-50 text-red-650 border-slate-250 shadow-xs'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Kartu Member</span>
            </button>
            <button
              onClick={handlePrintMemberReport}
              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-white shadow-sm ${
                hologramMode 
                  ? 'bg-[#10b981] hover:bg-[#059669]' 
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className={`px-6 py-2 border-b flex shrink-0 ${
          hologramMode ? 'border-zinc-850 bg-zinc-950/10' : 'bg-slate-50/20 border-slate-100'
        }`}>
          <div className="flex gap-2.5">
            <button
              onClick={() => setActiveSubTab('overview')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all relative cursor-pointer font-sans ${
                activeSubTab === 'overview'
                  ? hologramMode 
                    ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/40' 
                    : 'text-red-700 bg-red-50 border border-red-200'
                  : hologramMode 
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/50' 
                    : 'text-slate-500 hover:text-slate-850 hover:bg-slate-100'
              }`}
            >
              Ringkasan &amp; Analisis Profil
            </button>
            <button
              onClick={() => setActiveSubTab('transactions')}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all relative cursor-pointer font-sans ${
                activeSubTab === 'transactions'
                  ? hologramMode 
                    ? 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/40' 
                    : 'text-red-700 bg-red-50 border border-red-200'
                  : hologramMode 
                    ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/50' 
                    : 'text-slate-500 hover:text-slate-850 hover:bg-slate-100'
              }`}
            >
              Riwayat Nota Belanja ({memberTransactions.length})
            </button>
          </div>
        </div>

        {/* Main Content scrollable area */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          {activeSubTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Stats bento layout */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Total Belanja */}
                <div className={`p-4 rounded-2xl text-left border ${
                  hologramMode ? 'bg-[#101014] border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[9px] uppercase font-bold tracking-widest block ${
                    hologramMode ? 'text-zinc-500' : 'text-slate-400'
                  }`}>Total Belanja</span>
                  <span className={`text-sm md:text-base font-black leading-none block mt-1 font-mono ${
                    hologramMode ? 'text-emerald-400' : 'text-slate-900'
                  }`}>
                    Rp {totalSpent.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-[9.5px] font-medium block mt-1 ${hologramMode ? 'text-zinc-550' : 'text-slate-400'}`}>
                    Akumulasi belanja member
                  </span>
                </div>

                {/* Total Kunjungan */}
                <div className={`p-4 rounded-2xl text-left border ${
                  hologramMode ? 'bg-[#101014] border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[9px] uppercase font-bold tracking-widest block ${
                    hologramMode ? 'text-zinc-550' : 'text-slate-400'
                  }`}>Jumlah Transaksi</span>
                  <span className="text-sm md:text-base font-black leading-none block mt-1 font-mono text-indigo-500">
                    {visitCount} <span className="text-[10px] font-normal font-sans">kali</span>
                  </span>
                  <span className={`text-[9.5px] font-medium block mt-1 ${hologramMode ? 'text-zinc-550' : 'text-slate-400'}`}>
                    Total kunjungan tercatat
                  </span>
                </div>

                {/* Rata-rata Belanja */}
                <div className={`p-4 rounded-2xl text-left border ${
                  hologramMode ? 'bg-[#101014] border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[9px] uppercase font-bold tracking-widest block ${
                    hologramMode ? 'text-zinc-550' : 'text-slate-400'
                  }`}>Rata-Rata Keranjang</span>
                  <span className="text-sm md:text-base font-black leading-none block mt-1 font-mono text-amber-500">
                    Rp {averageSpent.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-[9.5px] font-medium block mt-1 ${hologramMode ? 'text-zinc-550' : 'text-slate-400'}`}>
                    Rerata spend per transaksi
                  </span>
                </div>

                {/* Loyalty Poin */}
                <div className={`p-4 rounded-2xl text-left border ${
                  hologramMode ? 'bg-[#101014] border-zinc-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className={`text-[9px] uppercase font-bold tracking-widest block ${
                    hologramMode ? 'text-zinc-550' : 'text-slate-400'
                  }`}>Poin Loyalitas</span>
                  <span className="text-sm md:text-base font-black leading-none block mt-1 font-mono text-teal-400">
                    {member.poin} <span className="text-[10px] font-normal font-sans">Pts</span>
                  </span>
                  <span className={`text-[9.5px] font-medium block mt-1 ${hologramMode ? 'text-zinc-550' : 'text-slate-400'}`}>
                    Saldo poin aktif saat ini
                  </span>
                </div>

              </div>

              {/* Progress Card Tier */}
              <div className={`p-5 rounded-2xl text-left border ${
                hologramMode ? 'bg-[#111116] border-zinc-800' : 'bg-slate-50 border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                      <Target className="w-4 h-4 text-emerald-500" />
                      <span>Progres Naik Kelas Tingkat Reward</span>
                    </h4>
                    <p className={`text-[10.5px] ${hologramMode ? 'text-zinc-450' : 'text-slate-500'}`}>
                      Kumpulkan transaksi belanja lebih banyak untuk menikmati kualifikasi program loyalitas premium
                    </p>
                  </div>
                  <span className={`text-[10.5px] font-black font-mono py-0.5 px-2 rounded-full border ${tierInfo.bgColor} ${tierInfo.color}`}>
                    PROGRES: {tierInfo.progress}%
                  </span>
                </div>

                {/* Progress Bar Container */}
                <div className={`h-3.5 w-full rounded-full relative overflow-hidden p-[2px] ${
                  hologramMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-slate-200/80 border border-slate-300/40'
                }`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${tierInfo.barColor}`} 
                    style={{ width: `${tierInfo.progress}%` }} 
                  />
                </div>

                {/* Limits Markers */}
                <div className="flex justify-between items-center text-[9.5px] font-bold font-mono mt-2 text-slate-400">
                  <span>BRONZE (Rp 0)</span>
                  <span>SILVER (Rp 750rb)</span>
                  <span>GOLD (Rp 2jt)</span>
                  <span>PLATINUM (Rp 5jt+)</span>
                </div>

                {/* Next Tier target summary */}
                {tierInfo.nextLabel !== 'MAX LEVEL' ? (
                  <div className={`mt-4 p-3 rounded-xl border text-[11px] font-sans ${
                    hologramMode 
                      ? 'bg-zinc-950/60 border-zinc-850 text-zinc-300' 
                      : 'bg-emerald-50/40 border-emerald-100 text-slate-700'
                  }`}>
                    🚀 Belanja tambahan sebesar <strong className="text-emerald-500">Rp {tierInfo.nextRemaining.toLocaleString('id-ID')}</strong> lagi untuk meningkatkan keanggotaan ke tier <strong className="text-indigo-500">{tierInfo.nextLabel}</strong>!
                  </div>
                ) : (
                  <div className={`mt-4 p-3 rounded-xl border text-[11px] font-sans ${
                    hologramMode 
                      ? 'bg-zinc-950/60 border-zinc-850 text-emerald-400' 
                      : 'bg-cyan-50/40 border-cyan-100 text-cyan-800'
                  }`}>
                    🏆 Selamat! Akun member ini telah mencapai tingkat reward tertinggi (<strong className="uppercase">{tierInfo.label} MEMBER</strong>). Nikmati pelayanan VIP toko!
                  </div>
                )}
              </div>

              {/* Kebijakan Kredit & Batas Limit Piutang */}
              <div className={`p-5 rounded-2xl text-left border ${
                hologramMode ? 'bg-[#111116] border-zinc-800' : 'bg-slate-50 border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-rose-500" />
                      <span>Status Limit Kredit &amp; Piutang Aktif</span>
                    </h4>
                    <p className={`text-[10.5px] ${hologramMode ? 'text-zinc-450' : 'text-slate-500'}`}>
                      Akumulasi tagihan piutang dan sisa limit berhutang belanja di toko
                    </p>
                  </div>
                  <span className={`text-[10.5px] font-black font-mono py-0.5 px-2 rounded-full border ${
                    debtPercentage >= 90
                      ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                      : debtPercentage >= 50
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  }`}>
                    PENGGUNAAN: {debtPercentage}%
                  </span>
                </div>

                {/* Progress Bar Kredit */}
                <div className={`h-3.5 w-full rounded-full relative overflow-hidden p-[2px] ${
                  hologramMode ? 'bg-zinc-900 border border-zinc-800' : 'bg-slate-200/80 border border-slate-300/40'
                }`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      debtPercentage >= 90
                        ? 'bg-gradient-to-r from-red-500 to-rose-600'
                        : debtPercentage >= 50
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : 'bg-gradient-to-r from-teal-400 to-emerald-500'
                    }`} 
                    style={{ width: `${debtPercentage}%` }} 
                  />
                </div>

                {/* Limit values */}
                <div className="flex justify-between items-center text-[10px] font-bold font-mono mt-2 text-slate-400">
                  <span>UTANG: Rp {totalDebt.toLocaleString('id-ID')}</span>
                  <span>SISA LIMIT: Rp {Math.max(0, limitKredit - totalDebt).toLocaleString('id-ID')}</span>
                  <span>LIMIT: Rp {limitKredit.toLocaleString('id-ID')}</span>
                </div>

                {/* Status indicator alerts */}
                <div className="mt-4 flex flex-col gap-2">
                  <div className={`p-3 rounded-xl border text-[11px] font-sans ${
                    totalDebt >= limitKredit
                      ? 'bg-red-50/50 border-red-100 text-red-800'
                      : totalDebt > 0
                        ? 'bg-amber-50/50 border-amber-100 text-amber-800'
                        : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                  }`}>
                    {totalDebt >= limitKredit ? (
                      <p className="flex items-start gap-1.5">
                        <span className="shrink-0 text-xs">🚨</span>
                        <span><strong>BLOKIR HUTANG BARU:</strong> Akumulasi piutang pelanggan ini <strong>(Rp {totalDebt.toLocaleString('id-ID')})</strong> telah mencapai atau melebihi batas limit kredit <strong>(Rp {limitKredit.toLocaleString('id-ID')})</strong>. Transaksi kasir dengan opsi utang baru akan ditolak demi keamanan keuangan toko.</span>
                      </p>
                    ) : totalDebt > 0 ? (
                      <p className="flex items-start gap-1.5">
                        <span className="shrink-0 text-xs">⚠️</span>
                        <span><strong>UTANG BERJALAN:</strong> Member ini memiliki piutang aktif sebesar <strong>Rp {totalDebt.toLocaleString('id-ID')}</strong> dengan sisa limit belanja utang sebesar <strong>Rp {(limitKredit - totalDebt).toLocaleString('id-ID')}</strong>.</span>
                      </p>
                    ) : (
                      <p className="flex items-start gap-1.5">
                        <span className="shrink-0 text-xs">🟢</span>
                        <span><strong>LIMIT BERSIH:</strong> Member tidak memiliki utang aktif. Diperbolehkan berutang penuh hingga <strong>Rp {limitKredit.toLocaleString('id-ID')}</strong> dengan kebijakan pembayaran yang fleksibel.</span>
                      </p>
                    )}
                  </div>

                  {/* Cigarette debt policy indicator */}
                  <div className={`p-2.5 px-3 rounded-lg border text-[10.5px] font-medium font-sans flex items-center justify-between ${
                    member.bolehHutangRokok
                      ? 'bg-emerald-50/20 border-emerald-100/50 text-emerald-800'
                      : 'bg-rose-50/20 border-rose-100/50 text-rose-800'
                  }`}>
                    <span>Status Izin Hutang Kategori Rokok:</span>
                    <strong className="uppercase font-extrabold">
                      {member.bolehHutangRokok ? '🟢 DIIZINKAN' : '🔴 DILARANG'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Top Products section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-left flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-500 animate-pulse" />
                  <span>5 Produk Terfavorit &amp; Paling Sering Dibeli</span>
                </h4>

                {favoriteProducts.length === 0 ? (
                  <div className={`p-8 border border-dashed rounded-2xl text-center text-xs ${
                    hologramMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
                  }`}>
                    Belum ada data transaksi yang mencatat pembelian barang dari member ini.
                  </div>
                ) : (
                  <div className={`p-4.5 rounded-2xl border text-left space-y-4 ${
                    hologramMode ? 'bg-[#101014] border-zinc-800' : 'bg-white border-slate-200'
                  }`}>
                    {favoriteProducts.map((p, idx) => {
                      const percentage = Math.max(5, Math.round((p.qty / maxFavoriteQty) * 100));
                      return (
                        <div key={idx} className="space-y-1.5 font-sans">
                          <div className="flex justify-between text-xs font-bold items-center">
                            <span className={hologramMode ? 'text-zinc-200' : 'text-slate-800'}>
                              {idx + 1}. {p.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              Dibeli: <strong className={hologramMode ? 'text-emerald-400' : 'text-slate-700'}>{p.qty}</strong> unit ({p.count}x Nota)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`h-2 flex-grow rounded-full overflow-hidden ${
                              hologramMode ? 'bg-zinc-900' : 'bg-slate-100'
                            }`}>
                              <div 
                                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold font-mono text-teal-500 shrink-0 min-w-[55px] text-right">
                              Rp {p.subtotal.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Catatan Member */}
              {member.catatan && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-left flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-500" />
                    <span>Catatan Profil &amp; Riwayat Utang</span>
                  </h4>
                  <div className={`p-4 rounded-xl text-left border text-xs italic ${
                    hologramMode ? 'bg-zinc-950/60 border-zinc-850 text-zinc-300' : 'bg-amber-50/20 border-amber-100 text-slate-600'
                  }`}>
                    📝 {member.catatan}
                  </div>
                </div>
              )}

            </div>
          )}

          {activeSubTab === 'transactions' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-left">
              <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                <span>Daftar Transaksi Kasir Terkait ({memberTransactions.length} Nota)</span>
              </h4>

              {memberTransactions.length === 0 ? (
                <div className={`p-12 border border-dashed rounded-2xl text-center text-xs ${
                  hologramMode ? 'border-zinc-800 text-zinc-500' : 'border-slate-200 text-slate-400'
                }`}>
                  Tidak ada catatan nota penjualan kasir atas nama member ini di database.
                </div>
              ) : (
                <div className="space-y-3">
                  {memberTransactions.map((t) => {
                    const isExpanded = expandedTrxId === t.id;
                    const itemsCount = t.items.reduce((sum, item) => sum + item.qty, 0);

                    return (
                      <div 
                        key={t.id} 
                        className={`border rounded-2xl overflow-hidden transition-all ${
                          hologramMode 
                            ? 'bg-[#101014] border-zinc-800 hover:border-zinc-750' 
                            : 'bg-white border-slate-200 hover:border-slate-350 shadow-xs'
                        }`}
                      >
                        {/* Transaction Row Summary header */}
                        <div 
                          onClick={() => setExpandedTrxId(isExpanded ? null : t.id)}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="space-y-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-black font-mono ${
                                hologramMode ? 'text-zinc-100' : 'text-slate-800'
                              }`}>{t.id}</span>
                              <span className="text-[10px] text-slate-400 font-mono">📅 {t.waktu}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-slate-400 font-medium">
                              <span>Items: <strong className={hologramMode ? 'text-zinc-200' : 'text-slate-700'}>{itemsCount}</strong> unit</span>
                              <span>•</span>
                              <span>Bayar: {t.metodePembayaran || 'Tunai'}</span>
                              {t.poinDitukar && t.poinDitukar > 0 ? (
                                <>
                                  <span>•</span>
                                  <span className="text-red-500 font-bold">Tukar {t.poinDitukar} Pts</span>
                                </>
                              ) : null}
                              {t.poinDidapat && t.poinDidapat > 0 ? (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-500 font-bold">+{t.poinDidapat} Pts</span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t sm:border-t-0 pt-2 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <span className={`text-xs uppercase font-bold block ${hologramMode ? 'text-zinc-500' : 'text-slate-400'}`}>Total Belanja</span>
                              <span className={`text-sm font-black font-mono ${hologramMode ? 'text-emerald-400' : 'text-slate-800'}`}>
                                Rp {t.total.toLocaleString('id-ID')}
                              </span>
                            </div>
                            <div className={`p-1 rounded-lg ${
                              hologramMode ? 'bg-zinc-900 border border-zinc-800 text-zinc-400' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <div className={`p-4 border-t text-left space-y-3.5 animate-in slide-in-from-top-1 duration-150 ${
                            hologramMode ? 'border-zinc-850 bg-zinc-950/40' : 'bg-slate-50/40 border-slate-100'
                          }`}>
                            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Rincian Barang Belanja:</h5>
                            <div className="divide-y divide-dashed divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white/50">
                              {t.items.map((item, index) => {
                                return (
                                  <div key={index} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                                    <div className="space-y-0.5 text-left">
                                      <span className={`font-bold block ${hologramMode ? 'text-zinc-200' : 'text-slate-800'}`}>
                                        {item.nama}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Rp {item.jual.toLocaleString('id-ID')} x {item.qty}
                                      </span>
                                    </div>
                                    <span className="font-extrabold font-mono text-slate-700">
                                      Rp {item.subtotal.toLocaleString('id-ID')}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Receipt re-print row action */}
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  // Open printed receipt popup
                                  const printWindow = window.open('', '_blank');
                                  if (printWindow) {
                                    // Let's assume a simplified receipt printing view for reprint
                                    let receiptHtml = `
                                      <html>
                                      <head>
                                        <title>SALINAN NOTA - ${t.id}</title>
                                        <style>
                                          body { font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.3; color: black; padding: 10px; width: 58mm; margin: 0; }
                                          .center { text-align: center; }
                                          .right { text-align: right; }
                                          .bold { font-weight: bold; }
                                          .divider { border-top: 1px dashed black; margin: 5px 0; }
                                          table { width: 100%; border-collapse: collapse; }
                                          td { padding: 2px 0; vertical-align: top; }
                                        </style>
                                      </head>
                                      <body>
                                        <div class="center bold">SALINAN NOTA</div>
                                        <div class="center bold">${config.namaToko.toUpperCase()}</div>
                                        <div class="center" style="font-size: 9px;">${config.alamatToko || ''}</div>
                                        <div class="divider"></div>
                                        <div>Nota: ${t.id}</div>
                                        <div>Waktu: ${t.waktu}</div>
                                        <div>Kasir: ${t.kasir || 'Kasir Toko'}</div>
                                        <div>Member: ${t.pelangganNama || '-'}</div>
                                        <div class="divider"></div>
                                        <table>
                                          ${t.items.map(item => `
                                            <tr>
                                              <td colspan="2" class="bold">${item.nama}</td>
                                            </tr>
                                            <tr>
                                              <td>${item.qty} x ${item.jual.toLocaleString('id-ID')}</td>
                                              <td class="right">${item.subtotal.toLocaleString('id-ID')}</td>
                                            </tr>
                                          `).join('')}
                                        </table>
                                        <div class="divider"></div>
                                        <table>
                                          <tr><td class="bold">TOTAL BELANJA</td><td class="right bold">Rp ${t.total.toLocaleString('id-ID')}</td></tr>
                                          <tr><td>BAYAR</td><td class="right">Rp ${t.bayar.toLocaleString('id-ID')}</td></tr>
                                          <tr><td>KEMBALI</td><td class="right">Rp ${t.kembalian.toLocaleString('id-ID')}</td></tr>
                                          ${t.poinDidapat ? `<tr><td>POIN DIDAPAT</td><td class="right">+${t.poinDidapat} Pts</td></tr>` : ''}
                                          ${t.poinDitukar ? `<tr><td>POIN DITUKAR</td><td class="right">-${t.poinDitukar} Pts</td></tr>` : ''}
                                        </table>
                                        <div class="divider"></div>
                                        <div class="center" style="font-size: 9px; margin-top: 10px;">-- CETAKAN ULANG NOTA --</div>
                                        <script>window.onload = function() { window.print(); window.close(); }</script>
                                      </body>
                                      </html>
                                    `;
                                    printWindow.document.write(receiptHtml);
                                    printWindow.document.close();
                                  }
                                }}
                                className={`px-2.5 py-1.5 text-[10.5px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                  hologramMode 
                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-xs'
                                }`}
                              >
                                <Printer className="w-3 h-3" />
                                <span>Cetak Salinan Nota</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Action footer */}
        <div className={`px-6 py-4.5 border-t flex justify-end shrink-0 ${
          hologramMode ? 'border-zinc-850 bg-zinc-950/40' : 'bg-slate-50 border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 hover:scale-[1.01] active:scale-95 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer uppercase tracking-wider font-sans border ${
              hologramMode 
                ? 'bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white shadow-none' 
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
            }`}
          >
            Selesai 👍
          </button>
        </div>

      </div>
    </div>
  );
}
