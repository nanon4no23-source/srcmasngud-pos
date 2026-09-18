import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, RotateCcw, ShieldCheck, FileText, Calendar, Edit3, Check, Save, Trash2 } from 'lucide-react';
import { Pelanggan, ConfigStruk } from '../types';
import { DebtItem } from '../App';

interface DebtAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  debtor: Pelanggan;
  debts: DebtItem[];
  totalAmount: number;
  config: ConfigStruk;
  hologramMode: boolean;
  onSave?: (debtorId: string, agreement: {
    dueDate: string;
    additionalWitness: string;
    customTerms: string;
    signatureImg?: string;
    signedAt: string;
  }) => void;
  onDelete?: (debtorId: string) => void;
}

export default function DebtAgreementModal({
  isOpen,
  onClose,
  debtor,
  debts,
  totalAmount,
  config,
  hologramMode,
  onSave,
  onDelete
}: DebtAgreementModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // Set default due date: 1 month from now
  const [dueDate, setDueDate] = useState('');
  const [additionalWitness, setAdditionalWitness] = useState('');
  const [customTerms, setCustomTerms] = useState('');

  // Load initial saved agreement if any when opening the modal or debtor changes
  useEffect(() => {
    if (isOpen && debtor) {
      setConfirmDelete(false);
      if (debtor.perjanjianUtang) {
        setDueDate(debtor.perjanjianUtang.dueDate);
        setAdditionalWitness(debtor.perjanjianUtang.additionalWitness);
        setCustomTerms(debtor.perjanjianUtang.customTerms);
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setDueDate(`${year}-${month}-${day}`);
        setAdditionalWitness('');
        setCustomTerms('Kedua belah pihak setuju bahwa pembayaran dapat dicicil maupun langsung lunas sebelum batas jatuh tempo.');
      }
    }
  }, [isOpen, debtor]);

  // Load signature image to canvas if it already exists
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (debtor.perjanjianUtang?.signatureImg) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            setHasSignature(true);
          };
          img.src = debtor.perjanjianUtang.signatureImg;
        } else {
          setHasSignature(false);
        }
      }
    }
  }, [isOpen, debtor, canvasRef.current]);

  // Disable body scroll when modal is open
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

  // Handle Canvas Drawing (Mouse + Touch)
  const getCoordinates = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    // Check if Touch Event
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Adapt for canvas resolution scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent scrolling on mobile touch
    if (e.cancelable) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep Navy Ink color
    
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get signature data URL
    const signatureImg = canvas.toDataURL('image/png');
    const todayStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedDueDate = formatDateIndo(dueDate);

    // Format all debt lines as HTML list items
    const debtDetailsHtml = debts.map(d => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #475569;">${d.date || '-'}</td>
        <td style="padding: 8px; font-size: 11px; font-weight: bold; color: #1E293B;">${d.isTrx ? 'Otomatis Belanja' : 'Pencatatan Manual'}</td>
        <td style="padding: 8px; font-size: 11px; color: #334155;">${d.description.replace('[UTANG MANUAL] ', '')}</td>
        <td style="padding: 8px; font-size: 11px; font-weight: bold; font-family: monospace; text-align: right; color: #E11D48;">Rp ${d.amount.toLocaleString('id-ID')}</td>
      </tr>
    `).join('');

    const shopName = config.namaToko.toUpperCase();
    const shopAddress = config.alamatToko || "KASIR SRC MASNGUD PREMIUM SYSTEM";

    // Setup window for legal layout printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Popup blocker menghalangi pencetakan. Harap aktifkan popup browser.");
      return;
    }

    const html = `
      <html>
        <head>
          <title>Surat Perjanjian Utang - ${debtor.nama}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { background: white; color: black; -webkit-print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            body {
              font-family: 'Times New Roman', Times, serif, system-ui;
              line-height: 1.6;
              color: #1a1a1a;
              padding: 24px;
              background-color: #ffffff;
              max-width: 800px;
              margin: 0 auto;
            }
            .header-title {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
              text-decoration: underline;
            }
            .header-subtitle {
              text-align: center;
              font-size: 11px;
              font-style: italic;
              color: #555555;
              margin-bottom: 25px;
            }
            .section-party {
              margin-bottom: 12px;
            }
            .party-title {
              font-weight: bold;
              font-size: 13px;
              margin-bottom: 4px;
            }
            .party-details {
              margin-left: 20px;
              font-size: 13px;
              margin-bottom: 10px;
            }
            .party-details table {
              width: 100%;
            }
            .party-details td {
              padding: 2px 0;
              vertical-align: top;
            }
            .clause {
              font-size: 13px;
              text-align: justify;
              margin-bottom: 12px;
            }
            .table-debts {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            .table-debts th {
              background-color: #F1F5F9;
              border: 1px solid #CBD5E1;
              padding: 6px;
              font-size: 11px;
              font-weight: bold;
              text-align: left;
            }
            .table-debts td {
              border: 1px solid #E2E8F0;
              padding: 6px;
              font-size: 11px;
            }
            .footer-signature {
              margin-top: 40px;
              width: 100%;
              border-spacing: 0;
              page-break-inside: avoid;
            }
            .signature-cell {
              width: 50%;
              text-align: center;
              font-size: 13px;
              vertical-align: top;
            }
            .signature-box {
              height: 100px;
              position: relative;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 10px auto;
            }
            .signature-box img {
              max-height: 85px;
              max-width: 180px;
              object-fit: contain;
            }
            .line-decoration {
              border-top: 2px double #1E293B;
              margin: 8px 0 20px 0;
            }
            .print-btn-float {
              position: fixed;
              bottom: 20px;
              right: 20px;
              background-color: #EA580C;
              color: white;
              padding: 10px 18px;
              border-radius: 9999px;
              border: none;
              font-weight: bold;
              cursor: pointer;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
              font-family: sans-serif;
              font-size: 12px;
              z-index: 99999;
              display: flex;
              align-items: center;
              gap: 8px;
            }
          </style>
        </head>
        <body>
          <button class="print-btn-float no-print" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Cetak Dokumen Perjanjian
          </button>

          <div style="text-align: center;">
            <span style="font-size: 20px; font-weight: 850; letter-spacing: 0.5px; font-family: sans-serif;">${shopName}</span><br />
            <span style="font-size: 11px; font-family: sans-serif; color: #475569;">${shopAddress}</span>
          </div>
          <div class="line-decoration"></div>

          <div class="header-title">SURAT PERNYATAAN AKUAN UTANG & PERJANJIAN</div>
          <div class="header-subtitle">Nomor Perjanjian: SPUP/${new Date().getFullYear()}/${debtor.id.slice(0,6).toUpperCase()}</div>

          <div class="clause">
            Pada hari ini, <strong>${todayStr}</strong>, kami yang bertanda tangan di bawah ini secara sadar, tanpa paksaan maupun tekanan dari pihak manapun, menyatakan bersepakat penuh atas perjanjian piutang dagang berikut:
          </div>

          <div class="section-party">
            <div class="party-title">PIHAK PERTAMA (Pemberi Utang / Kreditur)</div>
            <div class="party-details">
              <table>
                <tr><td style="width: 120px;">Nama Toko</td><td style="width: 15px;">:</td><td><strong>${config.namaToko}</strong></td></tr>
                <tr><td>Alamat Usaha</td><td>:</td><td>${shopAddress}</td></tr>
                <tr><td>Status Hubungan</td><td>:</td><td>Mitra Niaga Konsumsi / Penyedia Retail</td></tr>
              </table>
            </div>
          </div>

          <div class="section-party">
            <div class="party-title">PIHAK KEDUA (Penerima Utang / Debitur / Penghutang)</div>
            <div class="party-details">
              <table>
                <tr><td style="width: 120px;">Nama Pelanggan</td><td style="width: 15px;">:</td><td><strong>${debtor.nama}</strong></td></tr>
                <tr><td>No. Telepon / HP</td><td>:</td><td>${debtor.telepon || '-'}</td></tr>
                <tr><td>ID Anggota</td><td>:</td><td><code style="background-color: #f1f1f1; padding: 2px 5px; font-size: 11px; border-radius: 4px;">${debtor.id}</code></td></tr>
              </table>
            </div>
          </div>

          <div class="clause">
            Dengan ini, menerangkan secara sungguh-sungguh bahwa <strong>PIHAK KEDUA</strong> mengakui dengan sah telah berhutang kepada <strong>PIHAK PERTAMA</strong> dengan rincian akumulasi bon belanja berikut:
          </div>

          <table class="table-debts">
            <thead>
              <tr>
                <th style="width: 18%;">Tanggal Bon</th>
                <th style="width: 25%;">Asal Catatan</th>
                <th>Keterangan Deskripsi Hutang</th>
                <th style="width: 23%; text-align: right;">Sisa Tagihan (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${debtDetailsHtml}
              <tr style="background-color: #F8FAFC; font-weight: bold;">
                <td colspan="3" style="text-align: right; padding: 8px; font-size: 12px; font-family: serif;">TOTAL KEWAJIBAN PIUTANG:</td>
                <td style="text-align: right; padding: 8px; font-size: 13px; font-family: monospace; color: #E11D48;">Rp ${totalAmount.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>

          <div class="clause">
            Adapun pelunasan utang dan syarat penyelesaian telah disepakati bersama oleh Kedua Belah Pihak sebagai berikut:
          </div>

          <div style="font-size: 13px; margin-left: 15px; margin-bottom: 12px; text-align: justify;">
            <ol style="margin-top: 5px; margin-bottom: 5px; padding-left: 20px;">
              <li style="margin-bottom: 6px;">
                <strong>Tenggat Waktu:</strong> PIHAK KEDUA sanggup dan mengikat diri secara mutlak untuk melunasi seluruh kewajiban di atas selambat-lambatnya pada tanggal <strong>${formattedDueDate}</strong>.
              </li>
              <li style="margin-bottom: 6px;">
                <strong>Cara Pembayaran:</strong> ${customTerms || 'Pembayaran dapat diangsur secara fleksibel atau langsung diselesaikan penuh sesuai kesepakatan mufakat.'}
              </li>
              ${additionalWitness ? `
              <li style="margin-bottom: 6px;">
                <strong>Saksi Tambahan:</strong> Perjanjian disaksikan dan didampingi langsung oleh Pihak Ketiga: <strong>${additionalWitness}</strong>.
              </li>` : ''}
              <li style="margin-bottom: 6px;">
                <strong>Pelanggaran Kesepakatan:</strong> Apabila tanggal jatuh tempo yang disetujui terlampaui tanpa ada niat baik pelunasan, PIHAK PERTAMA memegang hak penuh untuk melakukan tindakan administrasi, pembekuan poin/loyalty akun member, pendataan eksternal, atau cara penagihan kekeluargaan yang sah secara hukum.
              </li>
            </ol>
          </div>

          <div class="clause" style="margin-top: 15px;">
            Surat pernyataan ini dibuat dan ditandatangani dengan sadar, jujur, serta penuh tanggung jawab moral dan hukum oleh Kedua Belah Pihak untuk dipergunakan sebagaimana mestinya.
          </div>

          <table class="footer-signature">
            <tr>
              <td class="signature-cell">
                <br />
                PIHAK PERTAMA,<br />
                Pemberi Utang (Pemilik Toko)<br />
                <div class="signature-box" style="font-family: sans-serif; font-size: 15px; font-weight: bold; border-bottom: 1px dotted #999; width: 140px; margin: 25px auto 5px auto; padding-bottom: 13px; text-align: center;">
                  ( ${config.namaToko} )
                </div>
                <span>Ttd &amp; Cap Toko</span>
              </td>
              <td class="signature-cell">
                <br />
                PIHAK KEDUA,<br />
                Penerima Utang (Debitur / Penghutang)<br />
                <div class="signature-box" style="margin-top: 10px; margin-bottom: 5px;">
                  ${hasSignature ? `<img src="${signatureImg}" alt="Tanda Tangan Penghutang" />` : `<div style="border-bottom: 1px dashed #999; width: 140px; height: 50px; margin-top: 30px;"></div>`}
                </div>
                <div style="font-weight: bold; text-decoration: underline;">( ${debtor.nama} )</div>
                <span>Tanda Tangan Asli Penghutang</span>
              </td>
            </tr>
          </table>
          
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-[99999] overflow-y-auto animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-2xl border flex flex-col max-h-[92vh] shadow-2xl transition-all scale-in duration-150 ${
          hologramMode ? 'bg-[#0f0f12] border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          hologramMode ? 'border-zinc-850' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${hologramMode ? 'bg-orange-950/20 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-left font-sans">
              <h4 className="font-extrabold text-sm sm:text-base uppercase tracking-wider">Surat Perjanjian Piutang</h4>
              <p className={`text-[10px] ${hologramMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                Buat kesepakatan tertulis sah disertai tanda tangan digital penghutang.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:rotate-90 transition-all cursor-pointer ${
              hologramMode ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto scrollbar-thin space-y-5 text-left">
          
          {/* Quick Info */}
          <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs ${
            hologramMode ? 'bg-zinc-950/40 border-zinc-850' : 'bg-slate-50/70 border-slate-250/50'
          }`}>
            <div className="text-left space-y-0.5">
              <span className={`text-[9px] uppercase font-bold tracking-wider ${hologramMode ? 'text-zinc-500' : 'text-slate-450'}`}>Penerima Utang (Debitur)</span>
              <h5 className="font-extrabold text-xs text-orange-600">{debtor.nama}</h5>
              <p className={`text-[10px] ${hologramMode ? 'text-zinc-450' : 'text-slate-500'}`}>No. Kontak: {debtor.telepon || 'Bukan Member Aktif'}</p>
            </div>
            <div className="sm:text-right flex flex-col justify-center">
              <span className={`text-[9px] uppercase font-bold tracking-wider ${hologramMode ? 'text-zinc-500' : 'text-slate-450'}`}>Total Kewajiban Utang</span>
              <span className="text-lg font-black text-rose-600">Rp {totalAmount.toLocaleString('id-ID')}</span>
              <span className={`text-[9px] font-bold ${hologramMode ? 'text-zinc-500' : 'text-slate-400'}`}>{debts.length} Bon Belanja Terdaftar</span>
            </div>
          </div>

          {/* Form Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                hologramMode ? 'text-zinc-450' : 'text-slate-600'
              }`}>
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span>Batas Tanggal Jatuh Tempo</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full text-xs px-3 py-2 focus:outline-none focus:ring-1 rounded-lg font-semibold ${
                  hologramMode 
                    ? 'bg-[#141416] border border-zinc-805 text-white focus:bg-[#1a1a1c] focus:ring-orange-500' 
                    : 'bg-slate-50 border border-slate-205 focus:bg-white focus:ring-orange-500 font-sans'
                }`}
              />
            </div>

            {/* Additional Witness */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                hologramMode ? 'text-zinc-450' : 'text-slate-600'
              }`}>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Pihak Ketiga / Saksi (Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="Nama Saksi (contoh: Ketua RT / Keluarga)"
                value={additionalWitness}
                onChange={(e) => setAdditionalWitness(e.target.value)}
                className={`w-full text-xs px-3 py-2 focus:outline-none focus:ring-1 rounded-lg font-medium ${
                  hologramMode 
                    ? 'bg-[#141416] border border-zinc-805 text-white placeholder-zinc-700 focus:bg-[#1a1a1c] focus:ring-orange-500' 
                    : 'bg-slate-50 border border-slate-205 focus:bg-white focus:ring-orange-500'
                }`}
              />
            </div>
          </div>

          {/* Custom Terms */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
              hologramMode ? 'text-zinc-450' : 'text-slate-600'
            }`}>
              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Syarat Tambahan / Ketentuan Angsuran</span>
            </label>
            <textarea
              rows={2}
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              placeholder="Tuliskan syarat cicilan, diskon pelunasan cepat, atau ketentuan khusus mufakat di sini..."
              className={`w-full text-xs px-3 py-2 focus:outline-none focus:ring-1 rounded-lg font-medium resize-none ${
                hologramMode 
                  ? 'bg-[#141416] border border-zinc-805 text-white placeholder-zinc-700 focus:bg-[#1a1a1c] focus:ring-orange-500' 
                  : 'bg-slate-50 border border-slate-205 focus:bg-white focus:ring-orange-500'
              }`}
            />
          </div>

          {/* Signature Canvas Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                hologramMode ? 'text-zinc-455' : 'text-slate-600'
              }`}>
                ✍️ Tanda Tangan Digital Pihak Kedua (Penghutang)
              </label>
              {hasSignature && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  className={`text-[10px] font-bold flex items-center gap-1 transition-colors px-2 py-0.5 rounded-lg font-sans border cursor-pointer ${
                    hologramMode 
                      ? 'bg-rose-950/10 border-rose-900/40 text-rose-400 hover:bg-rose-900/30' 
                      : 'bg-rose-50 border-rose-220 text-rose-600 hover:bg-rose-100'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Bersihkan Coretan</span>
                </button>
              )}
            </div>

            <div className={`relative border-2 border-dashed rounded-xl overflow-hidden p-1 flex flex-col items-center justify-center transition-colors ${
              hologramMode 
                ? 'bg-zinc-950 border-zinc-800 focus-within:border-indigo-500' 
                : 'bg-slate-50/50 border-slate-200 focus-within:border-orange-500'
            }`}>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[140px] bg-white rounded-lg cursor-crosshair touch-none"
                style={{ imageRendering: 'auto' }}
              />
              
              {!hasSignature && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center p-4">
                  <div className="p-2.5 bg-slate-100/80 text-slate-500 rounded-full mb-1">
                    <Edit3 className="w-5 h-5 animate-pulse" />
                  </div>
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest text-[10px]">TULIS TANDA TANGAN DISINI</span>
                  <span className="text-[9px] text-slate-400/95">Gunakan jari tangan Anda pada layar, atau gerakkan kursor mouse</span>
                </div>
              )}
              
              {hasSignature && (
                <div className="absolute bottom-2.5 right-2.5 bg-emerald-50 text-emerald-600 font-black text-[9px] py-0.5 px-2 rounded-full flex items-center gap-1.5 pointer-events-none shadow-xs border border-emerald-200 uppercase tracking-wider animate-bounce">
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                  Tercatat
                </div>
              )}
            </div>
          </div>

          {debtor.perjanjianUtang && (
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs ${
              hologramMode ? 'bg-emerald-950/20 border-emerald-900/30' : 'bg-emerald-50/70 border-emerald-250/50'
            }`}>
              <div className="text-left space-y-0.5">
                <span className={`text-[9px] uppercase font-bold tracking-wider flex items-center gap-1 ${hologramMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  📜 Perjanjian Tersimpan Aktif
                </span>
                <p className={`text-[10px] font-medium font-sans ${hologramMode ? 'text-zinc-400' : 'text-slate-600'}`}>
                  Disimpan dengan tanda tangan digital pada {debtor.perjanjianUtang.signedAt}.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-250 cursor-pointer transition-colors"
                  >
                    Hapus Data Simpanan
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete?.(debtor.id);
                        setConfirmDelete(false);
                        clearCanvas();
                      }}
                      className="px-2 py-1 text-[9px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors cursor-pointer"
                    >
                      Ya, Hapus
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:text-slate-600 rounded cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-400/90 leading-normal bg-orange-50/30 border border-orange-100 p-3 rounded-xl flex items-start gap-2 select-none">
            <span className="text-sm">💡</span>
            <p>
              <strong>Tips Cetak Bagus:</strong> Setelan orientasi dan ukuran kertas akan disesuaikan otomatis ke ukuran <strong>A4 Portrait (Tegak)</strong> pada menu print browser Anda. Anda juga dapat memilih opsi <em>Save to PDF</em> di browser untuk menyimpan salinan tanda tangan ini secara digital.
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className={`p-4 border-t flex flex-col sm:flex-row gap-3 bg-slate-50/40 shrink-0 ${
          hologramMode ? 'border-zinc-850 bg-zinc-950/20' : 'border-slate-100 bg-slate-50/40'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className={`w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer font-sans ${
              hologramMode 
                ? 'bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white hover:bg-zinc-800' 
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 shadow-xs'
            }`}
          >
            Tutup / Batal
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (!onSave) return;
              
              let signatureImg: string | undefined = undefined;
              if (hasSignature && canvasRef.current) {
                signatureImg = canvasRef.current.toDataURL('image/png');
              }
              
              const signedAt = new Date().toLocaleString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
              
              onSave(debtor.id, {
                dueDate,
                additionalWitness,
                customTerms,
                signatureImg,
                signedAt
              });
            }}
            className={`w-full sm:w-auto px-4 py-2 text-xs font-black rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer font-sans text-white bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Perjanjian</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className={`w-full sm:flex-1 py-1.5 px-3 text-xs font-black rounded-xl transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer font-sans bg-gradient-to-r ${
              hasSignature
                ? 'from-orange-600 to-amber-600 text-white hover:opacity-95 hover:shadow-lg'
                : 'from-orange-500/80 to-amber-500/80 text-white hover:from-orange-600 hover:to-amber-600'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>
              {hasSignature 
                ? "Cetak Surat Perjanjian + Tanda Tangan" 
                : "Cetak Perjanjian (Saja / Kosong)"
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
