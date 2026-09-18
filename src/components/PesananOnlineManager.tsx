import React, { useState, useMemo } from 'react';
import { PesananOnline, ItemBarang, DetailItemPesananOnline, ConfigStruk, PromoBanner } from '../types';
import { 
  ShoppingBag, CheckCircle2, Clock, Truck, Store, XCircle, 
  MessageCircle, Printer, Share2, AlertCircle, Eye, ChevronRight,
  Filter, Search, QrCode, Copy, Check, Edit3, Trash2, Plus, Minus, X, PackageX,
  Image as ImageIcon, Upload, Sparkles, Power, Tag, ArrowUpRight
} from 'lucide-react';

interface PesananOnlineManagerProps {
  orders: PesananOnline[];
  barang?: ItemBarang[];
  onUpdateStatus: (orderId: string, status: PesananOnline['status'], alasanBatal?: string) => void;
  onUpdateOrder?: (updatedOrder: PesananOnline) => void;
  onDeleteOrder?: (orderId: string) => void;
  onDeleteCompletedOrCancelledOrders?: () => void;
  onCompleteAndDeductStock: (order: PesananOnline) => void;
  onOpenCustomerPreview: () => void;
  hologramMode?: boolean;
  storeName?: string;
  waNumber?: string;
  hideCustomerPortal?: boolean;
  config?: ConfigStruk;
  onUpdateConfig?: (key: keyof ConfigStruk, value: any) => void;
}

// Helper to compress uploaded promo banner image
const compressPromoImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxW = 1200;
        const maxH = 600;

        if (width > maxW) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        }
        if (height > maxH) {
          width = Math.round((width * maxH) / height);
          height = maxH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Gagal memuat gambar promo'));
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const PesananOnlineManager: React.FC<PesananOnlineManagerProps> = ({
  orders,
  barang = [],
  onUpdateStatus,
  onUpdateOrder,
  onDeleteOrder,
  onDeleteCompletedOrCancelledOrders,
  onCompleteAndDeductStock,
  onOpenCustomerPreview,
  hologramMode = false,
  storeName = 'Toko SRC MASNGUD',
  waNumber = '',
  hideCustomerPortal = false,
  config,
  onUpdateConfig
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [cancelReasonModal, setCancelReasonModal] = useState<{ id: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // State for SRC Masngud Branded Delete Order Confirmation Modal
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    type: 'single' | 'bulk';
    orderId?: string;
    buyerName?: string;
    count?: number;
  } | null>(null);

  // State for Promo Banner Management
  const [isPromoBannerModalOpen, setIsPromoBannerModalOpen] = useState(false);
  const [isCompressingBanner, setIsCompressingBanner] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({
    judul: '',
    deskripsi: '',
    imageUrl: '',
    linkKategori: 'Semua',
    linkProductId: '',
    linkProductName: '',
    aktif: true
  });

  // State for Target Special Product Search in Promo Banner
  const [searchTargetProductQuery, setSearchTargetProductQuery] = useState('');
  const [isTargetProductDropdownOpen, setIsTargetProductDropdownOpen] = useState(false);

  // Filtered products for Target Product picker
  const filteredTargetProducts = useMemo(() => {
    if (!searchTargetProductQuery.trim()) return barang.slice(0, 15);
    const q = searchTargetProductQuery.toLowerCase();
    return barang.filter(b => 
      b.nama.toLowerCase().includes(q) || 
      (b.barcode && b.barcode.toLowerCase().includes(q)) ||
      (b.kategori && b.kategori.toLowerCase().includes(q))
    ).slice(0, 25);
  }, [barang, searchTargetProductQuery]);

  // State for Editing Order Items (When Items are Out of Stock)
  const [editingOrder, setEditingOrder] = useState<PesananOnline | null>(null);
  const [searchAddItemQuery, setSearchAddItemQuery] = useState('');
  const [showAddItemSelector, setShowAddItemSelector] = useState(false);

  // Available product categories for link filter
  const categoryOptions = useMemo(() => {
    const cats = Array.from(new Set(barang.map(b => b.kategori || 'Lainnya').filter(Boolean)));
    return ['Semua', ...cats];
  }, [barang]);

  // Current Banners List
  const promoBannersList: PromoBanner[] = useMemo(() => {
    return Array.isArray(config?.promoBanners) ? config.promoBanners : [];
  }, [config?.promoBanners]);

  const activePromoCount = promoBannersList.filter(b => b.aktif).length;

  // Handle Save / Add / Update Promo Banner
  const handleSavePromoBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoForm.imageUrl) {
      alert('Silakan pilih / unggah foto banner promo terlebih dahulu!');
      return;
    }
    if (!onUpdateConfig) return;

    let updatedList = [...promoBannersList];
    if (editingPromoId) {
      // Update existing
      updatedList = updatedList.map(item => item.id === editingPromoId ? {
        ...item,
        judul: promoForm.judul.trim() || 'Promo Spesial Toko',
        deskripsi: promoForm.deskripsi.trim(),
        imageUrl: promoForm.imageUrl,
        linkKategori: promoForm.linkKategori,
        linkProductId: promoForm.linkProductId,
        linkProductName: promoForm.linkProductName,
        aktif: promoForm.aktif
      } : item);
    } else {
      // Add new
      const newBanner: PromoBanner = {
        id: 'prm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        judul: promoForm.judul.trim() || 'Promo Spesial Toko',
        deskripsi: promoForm.deskripsi.trim(),
        imageUrl: promoForm.imageUrl,
        linkKategori: promoForm.linkKategori,
        linkProductId: promoForm.linkProductId,
        linkProductName: promoForm.linkProductName,
        aktif: true,
        tanggalDibuat: new Date().toLocaleDateString('id-ID')
      };
      updatedList = [newBanner, ...updatedList];
    }

    onUpdateConfig('promoBanners', updatedList);
    resetPromoForm();
  };

  const resetPromoForm = () => {
    setEditingPromoId(null);
    setSearchTargetProductQuery('');
    setIsTargetProductDropdownOpen(false);
    setPromoForm({
      judul: '',
      deskripsi: '',
      imageUrl: '',
      linkKategori: 'Semua',
      linkProductId: '',
      linkProductName: '',
      aktif: true
    });
  };

  const handleEditPromoClick = (b: PromoBanner) => {
    setEditingPromoId(b.id);
    setSearchTargetProductQuery('');
    setIsTargetProductDropdownOpen(false);
    setPromoForm({
      judul: b.judul || '',
      deskripsi: b.deskripsi || '',
      imageUrl: b.imageUrl || '',
      linkKategori: b.linkKategori || 'Semua',
      linkProductId: b.linkProductId || '',
      linkProductName: b.linkProductName || '',
      aktif: b.aktif
    });
  };

  const handleTogglePromoActive = (promoId: string) => {
    if (!onUpdateConfig) return;
    const updated = promoBannersList.map(b => b.id === promoId ? { ...b, aktif: !b.aktif } : b);
    onUpdateConfig('promoBanners', updated);
  };

  const handleDeletePromo = (promoId: string) => {
    if (!onUpdateConfig) return;
    if (confirm('Yakin ingin menghapus banner promo ini?')) {
      const updated = promoBannersList.filter(b => b.id !== promoId);
      onUpdateConfig('promoBanners', updated);
      if (editingPromoId === promoId) resetPromoForm();
    }
  };

  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  // Filtered orders
  const filteredOrders = orders.filter(o => {
    const matchStatus = filterStatus === 'Semua' || o.status === filterStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      o.id.toLowerCase().includes(q) || 
      o.namaPembeli.toLowerCase().includes(q) || 
      o.teleponPembeli.includes(q);
    return matchStatus && matchSearch;
  });

  // Status Counts
  const counts = {
    total: orders.length,
    menunggu: orders.filter(o => o.status === 'Menunggu Konfirmasi').length,
    diproses: orders.filter(o => o.status === 'Diproses').length,
    siap: orders.filter(o => o.status === 'Siap Diambil/Dikirim').length,
    selesai: orders.filter(o => o.status === 'Selesai').length,
    dibatalkan: orders.filter(o => o.status === 'Dibatalkan').length,
  };

  const completedAndCancelledCount = counts.selesai + counts.dibatalkan;

  // Generate WA Contact Link for Buyer
  const getBuyerWaUrl = (order: PesananOnline, customText?: string) => {
    const cleanNum = order.teleponPembeli.replace(/[^0-9]/g, '');
    let formatted = cleanNum;
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);

    const defaultMsg = `Halo Kak ${order.namaPembeli}, kami dari ${storeName} mengenai pesanan online Kakak (${order.id})...`;
    return `https://wa.me/${formatted}?text=${encodeURIComponent(customText || defaultMsg)}`;
  };

  // Helper for pricing calculation matching Kasir POS multiSatuan & Grosir logic
  const calcOnlineItemPriceAndSubtotal = (prod: ItemBarang, qty: number, unitId?: string) => {
    if (unitId && prod.multiSatuan) {
      const u = prod.multiSatuan.find(x => x.id === unitId);
      if (u) {
        return { unitPrice: u.hargaJual, subtotal: Math.round(qty * u.hargaJual) };
      }
    }
    if (prod.multiSatuan && prod.multiSatuan.length > 0) {
      const sortedUnits = [...prod.multiSatuan].sort((a, b) => b.isiPcs - a.isiPcs);
      let tempQty = qty;
      let autoSubtotal = 0;
      for (const u of sortedUnits) {
        if (tempQty >= u.isiPcs) {
          const numUnits = Math.floor(tempQty / u.isiPcs);
          autoSubtotal += numUnits * u.hargaJual;
          tempQty = tempQty % u.isiPcs;
        }
      }
      if (tempQty > 0) {
        autoSubtotal += tempQty * prod.jual;
      }
      const finalSubtotal = Math.round(autoSubtotal);
      const unitPrice = qty > 0 ? Math.round((finalSubtotal / qty) * 100) / 100 : prod.jual;
      return { unitPrice, subtotal: finalSubtotal };
    }
    return { unitPrice: prod.jual, subtotal: Math.round(qty * prod.jual) };
  };

  const copyOnlineStoreLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'pembeli');
      navigator.clipboard.writeText(url.toString());
    } catch (e) {
      navigator.clipboard.writeText(window.location.origin + '?mode=pembeli');
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* TOP BANNER & ACTION HEADER */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
        hologramMode ? 'bg-[#121212] border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-600 text-white rounded-2xl font-black shadow-3xs shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                YUK BELANJA ONLINE
              </span>
              {counts.menunggu > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-bounce">
                  🔥 {counts.menunggu} Pesanan Baru!
                </span>
              )}
            </div>
            <h2 className="text-base font-black tracking-tight mt-0.5">
              Kelola Pesanan Online Pembeli
            </h2>
            <p className="text-xs text-slate-500">
              Terima pesanan online dari pembeli sekitar toko dan selesaikan dengan otomatis potong stok.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setIsPromoBannerModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs active:scale-95"
            title="Unggah Foto Banner Promo untuk Tampilan Belanja Pembeli"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Kelola Banner Promo</span>
            {activePromoCount > 0 && (
              <span className="bg-slate-950 text-amber-300 text-[10px] font-black px-1.5 py-0.2 rounded-full ml-0.5">
                {activePromoCount}
              </span>
            )}
          </button>

          {!hideCustomerPortal && (
            <button
              type="button"
              onClick={onOpenCustomerPreview}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs active:scale-95"
            >
              <Eye className="w-4 h-4" />
              <span>Buka Portal Belanja Pembeli</span>
            </button>
          )}

          <button
            type="button"
            onClick={copyOnlineStoreLink}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              copiedLink 
                ? 'bg-emerald-600 text-white border-emerald-600' 
                : hologramMode ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Tersalin!' : 'Salin Link Toko'}</span>
          </button>
        </div>
      </div>

      {/* QUICK STATUS METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <button
          type="button"
          onClick={() => setFilterStatus('Menunggu Konfirmasi')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Menunggu Konfirmasi'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600">
            <Clock className="w-4 h-4" />
            <span className="text-lg font-black">{counts.menunggu}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Menunggu</p>
          <p className="text-[10px] text-slate-400 truncate">Baru masuk</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('Diproses')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Diproses'
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-400/20'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-lg font-black">{counts.diproses}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Diproses</p>
          <p className="text-[10px] text-slate-400 truncate">Disiapkan</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('Siap Diambil/Dikirim')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Siap Diambil/Dikirim'
              ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-400/20'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600">
            <Truck className="w-4 h-4" />
            <span className="text-lg font-black">{counts.siap}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Siap Antar</p>
          <p className="text-[10px] text-slate-400 truncate">Siap kirim</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('Selesai')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Selesai'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-lg font-black">{counts.selesai}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Selesai</p>
          <p className="text-[10px] text-slate-400 truncate">Selesai sukses</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('Dibatalkan')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Dibatalkan'
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600">
            <XCircle className="w-4 h-4" />
            <span className="text-lg font-black">{counts.dibatalkan}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Dibatalkan</p>
          <p className="text-[10px] text-slate-400 truncate">Pesanan batal</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('Semua')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'Semua'
              ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-400/20 dark:bg-zinc-800'
              : hologramMode ? 'bg-[#161616] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-700 dark:text-zinc-200">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-lg font-black">{counts.total}</span>
          </div>
          <p className="text-xs font-extrabold mt-1 text-slate-800 dark:text-zinc-200 truncate">Semua Pesanan</p>
          <p className="text-[10px] text-slate-400 truncate">Total tercatat</p>
        </button>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className={`p-3 rounded-2xl border space-y-3 ${
        hologramMode ? 'bg-[#121212] border-zinc-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {['Semua', 'Menunggu Konfirmasi', 'Diproses', 'Siap Diambil/Dikirim', 'Selesai', 'Dibatalkan'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-3xs'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{st}</span>
                {st === 'Semua' && <span className="text-[10px] opacity-75">({counts.total})</span>}
                {st === 'Menunggu Konfirmasi' && counts.menunggu > 0 && <span className="bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">{counts.menunggu}</span>}
                {st === 'Diproses' && counts.diproses > 0 && <span className="bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">{counts.diproses}</span>}
                {st === 'Siap Diambil/Dikirim' && counts.siap > 0 && <span className="bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">{counts.siap}</span>}
                {st === 'Selesai' && counts.selesai > 0 && <span className="bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">{counts.selesai}</span>}
                {st === 'Dibatalkan' && counts.dibatalkan > 0 && <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">{counts.dibatalkan}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {completedAndCancelledCount > 0 && onDeleteCompletedOrCancelledOrders && (
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmModal({
                    type: 'bulk',
                    count: completedAndCancelledCount
                  });
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs shrink-0 active:scale-95"
                title="Hapus semua pesanan online dengan status Selesai & Dibatalkan"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Hapus Selesai &amp; Dibatalkan ({completedAndCancelledCount})</span>
              </button>
            )}

            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama / HP / ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border focus:outline-none ${
                  hologramMode 
                    ? 'bg-zinc-900 border-zinc-700 text-white' 
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ORDERS LIST */}
      {filteredOrders.length === 0 ? (
        <div className={`p-8 rounded-2xl border text-center my-4 space-y-2 ${
          hologramMode ? 'bg-[#121212] border-zinc-800 text-zinc-400' : 'bg-white border-slate-200 text-slate-500'
        }`}>
          <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-700" />
          <p className="text-xs font-bold">Belum Ada Pesanan Online ({filterStatus})</p>
          <p className="text-[11px] text-slate-400">
            Pesanan dari pembeli via portal online My AYO SRC akan langsung muncul di sini secara real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            // Badge styles
            let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
            if (order.status === 'Menunggu Konfirmasi') badgeClass = 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse';
            if (order.status === 'Diproses') badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
            if (order.status === 'Siap Diambil/Dikirim') badgeClass = 'bg-purple-100 text-purple-800 border-purple-300';
            if (order.status === 'Selesai') badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
            if (order.status === 'Dibatalkan') badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';

            return (
              <div 
                key={order.id}
                className={`p-4 rounded-2xl border shadow-xs space-y-3.5 transition-all ${
                  hologramMode ? 'bg-[#151515] border-zinc-800 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {/* CARD HEADER */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-red-600 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">
                      {order.id}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {order.waktu}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${badgeClass}`}>
                      {order.status}
                    </span>
                    <a
                      href={getBuyerWaUrl(order)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Hubungi Pembeli via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  </div>
                </div>

                {/* BUYER DETAILS & DELIV INFO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1 bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <p className="font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <span>👤 {order.namaPembeli}</span>
                      <span className="font-mono text-slate-500 font-normal">({order.teleponPembeli})</span>
                    </p>
                    <p className="text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                      {order.tipePengiriman === 'Pesan Antar' ? <Truck className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Store className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      <span>Tipe: <strong>{order.tipePengiriman}</strong></span>
                    </p>
                    {order.alamatPembeli && (
                      <p className="text-slate-600 dark:text-zinc-400 leading-snug pt-1 border-t border-slate-200/50 dark:border-zinc-800">
                        📍 <strong>Alamat:</strong> {order.alamatPembeli}
                      </p>
                    )}
                    {order.catatan && (
                      <p className="text-amber-700 dark:text-amber-400 font-medium italic">
                        📝 Catatan: "{order.catatan}"
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                      <p className="text-slate-500 font-bold">Metode Pembayaran:</p>
                      <p className="font-extrabold text-slate-800 dark:text-zinc-200">{order.metodePembayaran}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 dark:border-zinc-800 flex items-center justify-between">
                      <span className="text-slate-500 font-bold">Total Bayar:</span>
                      <span className="text-base font-black text-red-600">{formatRp(order.totalBayar)}</span>
                    </div>
                  </div>
                </div>

                {/* ITEMS BREAKDOWN TABLE */}
                <div className="bg-slate-50/70 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-slate-200/70 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Daftar Barang Yang Dipesan ({order.items.length})
                  </p>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-800 dark:text-zinc-200">{it.nama}</p>
                          <p className="text-[10px] text-slate-400">
                            {formatRp(it.jual)} / {it.satuanNama || 'Pcs'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-extrabold text-slate-800 dark:text-zinc-200">x{it.qty} {it.satuanNama || 'Pcs'}</p>
                          <p className="font-black text-slate-900 dark:text-white">{formatRp(it.subtotal)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CASHIER ACTION BUTTONS */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  {order.status !== 'Selesai' && order.status !== 'Dibatalkan' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrder(JSON.parse(JSON.stringify(order)));
                        setSearchAddItemQuery('');
                        setShowAddItemSelector(false);
                      }}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Ubah barang pesanan jika ada stok kosong atau diganti"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Ubah Pesanan (Barang Kosong)</span>
                    </button>
                  )}

                  {order.status === 'Menunggu Konfirmasi' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'Diproses')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-3xs flex items-center gap-1 active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Terima &amp; Proses Pesanan</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCancelReasonModal({ id: order.id })}
                        className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak Pesanan</span>
                      </button>
                    </>
                  )}

                  {order.status === 'Diproses' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(order.id, 'Siap Diambil/Dikirim')}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-3xs flex items-center gap-1 active:scale-95"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Tandai Siap Diambil / Dikirim</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onCompleteAndDeductStock(order)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-3xs flex items-center gap-1 active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Selesaikan &amp; Potong Stok POS</span>
                      </button>
                    </>
                  )}

                  {order.status === 'Siap Diambil/Dikirim' && (
                    <button
                      type="button"
                      onClick={() => onCompleteAndDeductStock(order)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-3xs flex items-center gap-1.5 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Selesaikan &amp; Potong Stok POS (Cetak Struk)</span>
                    </button>
                  )}

                  {order.status === 'Selesai' && (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Telah Selesai &amp; Masuk Laporan Kasir
                    </span>
                  )}

                  {onDeleteOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmModal({
                          type: 'single',
                          orderId: order.id,
                          buyerName: order.namaPembeli
                        });
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="Hapus pesanan ini dari daftar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Hapus Pesanan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT ORDER MODAL (IF ITEMS ARE OUT OF STOCK) */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-zinc-800">
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-amber-500 text-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-950/10 rounded-xl">
                  <PackageX className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-950">
                    Ubah Pesanan Online ({editingOrder.id})
                  </h3>
                  <p className="text-[11px] text-slate-900/80 font-medium">
                    Pembeli: <strong>{editingOrder.namaPembeli}</strong> • Modifikasi jika stok kosong / ganti barang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 rounded-full bg-slate-950/10 hover:bg-slate-950/20 text-slate-950 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL BODY */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 bg-slate-50 dark:bg-zinc-950">
              {/* ORDER ITEMS LIST */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Daftar Barang Pesanan ({editingOrder.items.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddItemSelector(true)}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-3xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Barang Pengganti</span>
                  </button>
                </div>

                {editingOrder.items.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-rose-300 bg-rose-50/50 rounded-2xl space-y-1">
                    <p className="text-xs font-extrabold text-rose-700">Semua barang telah dihapus dari pesanan!</p>
                    <p className="text-[11px] text-rose-500">
                      Jika pesanan ini kosong seluruhnya, Anda bisa membatalkan pesanan ini secara langsung.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editingOrder.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 shadow-3xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-xs text-slate-800 dark:text-zinc-100 truncate">
                            {it.nama}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Harga: {formatRp(it.jual)} / {it.satuanNama || 'Pcs'}
                          </p>
                        </div>

                        {/* QUANTITY ADJUSTER */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-slate-50 dark:bg-zinc-800">
                            <button
                              type="button"
                              onClick={() => {
                                const newQty = it.qty - 1;
                                let updated = [...editingOrder.items];
                                if (newQty <= 0) {
                                  updated.splice(idx, 1);
                                } else {
                                  const prod = barang.find(b => b.id === it.itemId || b.kode === it.kode);
                                  if (prod) {
                                    const { unitPrice, subtotal } = calcOnlineItemPriceAndSubtotal(prod, newQty, it.unitId);
                                    updated[idx] = { ...it, qty: newQty, jual: unitPrice, subtotal };
                                  } else {
                                    updated[idx] = { ...it, qty: newQty, subtotal: newQty * it.jual };
                                  }
                                }
                                const newTotalHarga = updated.reduce((acc, i) => acc + i.subtotal, 0);
                                setEditingOrder({
                                  ...editingOrder,
                                  items: updated,
                                  totalHarga: newTotalHarga,
                                  totalBayar: newTotalHarga + (editingOrder.ongkir || 0)
                                });
                              }}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 text-xs font-black text-slate-800 dark:text-zinc-100">
                              {it.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const newQty = it.qty + 1;
                                let updated = [...editingOrder.items];
                                const prod = barang.find(b => b.id === it.itemId || b.kode === it.kode);
                                if (prod) {
                                  const { unitPrice, subtotal } = calcOnlineItemPriceAndSubtotal(prod, newQty, it.unitId);
                                  updated[idx] = { ...it, qty: newQty, jual: unitPrice, subtotal };
                                } else {
                                  updated[idx] = { ...it, qty: newQty, subtotal: newQty * it.jual };
                                }
                                const newTotalHarga = updated.reduce((acc, i) => acc + i.subtotal, 0);
                                setEditingOrder({
                                  ...editingOrder,
                                  items: updated,
                                  totalHarga: newTotalHarga,
                                  totalBayar: newTotalHarga + (editingOrder.ongkir || 0)
                                });
                              }}
                              className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-black text-xs text-red-600 min-w-[70px] text-right">
                            {formatRp(it.subtotal)}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              let updated = [...editingOrder.items];
                              updated.splice(idx, 1);
                              const newTotalHarga = updated.reduce((acc, i) => acc + i.subtotal, 0);
                              setEditingOrder({
                                ...editingOrder,
                                items: updated,
                                totalHarga: newTotalHarga,
                                totalBayar: newTotalHarga + (editingOrder.ongkir || 0)
                              });
                            }}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer border border-rose-200"
                            title="Hapus barang (stok kosong)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SELECT REPLACEMENT ITEM MODAL / DROPDOWN */}
              {showAddItemSelector && (
                <div className="bg-white dark:bg-zinc-900 border-2 border-red-500 rounded-2xl p-3 shadow-lg space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-red-600" />
                      Pilih Barang Tambahan / Pengganti dari Stok POS
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddItemSelector(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Cari nama barang atau kode barcode..."
                    value={searchAddItemQuery}
                    onChange={(e) => setSearchAddItemQuery(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-800 dark:text-zinc-100"
                    autoFocus
                  />

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 pr-1">
                    {barang
                      .filter(b => {
                        if (!searchAddItemQuery.trim()) return true;
                        const q = searchAddItemQuery.toLowerCase().trim();
                        return b.nama.toLowerCase().includes(q) || b.kode.toLowerCase().includes(q);
                      })
                      .slice(0, 15)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            const existingIdx = editingOrder.items.findIndex(it => it.itemId === b.id || it.kode === b.kode);
                            let updated = [...editingOrder.items];
                            if (existingIdx !== -1) {
                              const curr = updated[existingIdx];
                              const newQty = curr.qty + 1;
                              const { unitPrice, subtotal } = calcOnlineItemPriceAndSubtotal(b, newQty, curr.unitId);
                              updated[existingIdx] = { ...curr, qty: newQty, jual: unitPrice, subtotal };
                            } else {
                              const { unitPrice, subtotal } = calcOnlineItemPriceAndSubtotal(b, 1);
                              updated.push({
                                itemId: b.id,
                                nama: b.nama,
                                kode: b.kode,
                                qty: 1,
                                jual: unitPrice,
                                subtotal,
                                satuanNama: b.satuanBesarNama || 'Pcs'
                              });
                            }
                            const newTotalHarga = updated.reduce((acc, i) => acc + i.subtotal, 0);
                            setEditingOrder({
                              ...editingOrder,
                              items: updated,
                              totalHarga: newTotalHarga,
                              totalBayar: newTotalHarga + (editingOrder.ongkir || 0)
                            });
                            setShowAddItemSelector(false);
                            setSearchAddItemQuery('');
                          }}
                          className="w-full p-2 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-zinc-200">{b.nama}</p>
                            <p className="text-[10px] text-slate-400">Kode: {b.kode} • Stok: {b.stok}</p>
                          </div>
                          <span className="font-black text-red-600 shrink-0">{formatRp(b.jual)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* NOTES / REASON FOR EDIT */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-500">
                  Catatan Toko / Alasan Perubahan Barang
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Minyak Goreng Bimoli 2L stok habis, diganti Sania 2L atas persetujuan pembeli..."
                  value={editingOrder.catatan || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, catatan: e.target.value })}
                  className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 dark:text-zinc-100"
                />
              </div>

              {/* ORDER SUMMARY TOTALS */}
              <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Subtotal Barang ({editingOrder.items.reduce((acc, i) => acc + i.qty, 0)} Pcs):</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {formatRp(editingOrder.items.reduce((acc, i) => acc + i.subtotal, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                  <span>Ongkos Kirim ({editingOrder.tipePengiriman}):</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={editingOrder.ongkir || 0}
                      onChange={(e) => {
                        const newOngkir = Number(e.target.value) || 0;
                        const subt = editingOrder.items.reduce((acc, i) => acc + i.subtotal, 0);
                        setEditingOrder({
                          ...editingOrder,
                          ongkir: newOngkir,
                          totalBayar: subt + newOngkir
                        });
                      }}
                      className="w-20 p-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-right font-bold text-xs"
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center text-sm font-black">
                  <span className="text-slate-800 dark:text-zinc-100">Total Bayar Baru:</span>
                  <span className="text-red-600 text-base font-black">
                    {formatRp(editingOrder.items.reduce((acc, i) => acc + i.subtotal, 0) + (editingOrder.ongkir || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    const finalSubt = editingOrder.items.reduce((acc, i) => acc + i.subtotal, 0);
                    const finalOrder: PesananOnline = {
                      ...editingOrder,
                      totalHarga: finalSubt,
                      totalBayar: finalSubt + (editingOrder.ongkir || 0)
                    };
                    if (onUpdateOrder) onUpdateOrder(finalOrder);

                    // Open WA message to notify buyer
                    const itemsText = finalOrder.items.map(it => `• ${it.nama} (${it.qty} ${it.satuanNama || 'Pcs'}) = ${formatRp(it.subtotal)}`).join('\n');
                    const waMsg = `Halo Kak ${finalOrder.namaPembeli}, pesanan online Kakak (*${finalOrder.id}*) telah disesuaikan oleh kasir toko karena persediaan/stok barang:\n\n*Daftar Barang Pesanan Terbaru:*\n${itemsText}\n\n*Ongkir:* ${formatRp(finalOrder.ongkir)}\n*Total Bayar Terbaru:* ${formatRp(finalOrder.totalBayar)}\n${finalOrder.catatan ? `*Catatan Toko:* ${finalOrder.catatan}\n` : ''}\nMohon konfirmasinya ya Kak. Terima kasih! 🙏`;
                    const cleanNum = finalOrder.teleponPembeli.replace(/[^0-9]/g, '');
                    let formattedNum = cleanNum;
                    if (formattedNum.startsWith('0')) formattedNum = '62' + formattedNum.slice(1);
                    window.open(`https://wa.me/${formattedNum}?text=${encodeURIComponent(waMsg)}`, '_blank');

                    setEditingOrder(null);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Simpan &amp; Info Pembeli via WA</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const finalSubt = editingOrder.items.reduce((acc, i) => acc + i.subtotal, 0);
                    const finalOrder: PesananOnline = {
                      ...editingOrder,
                      totalHarga: finalSubt,
                      totalBayar: finalSubt + (editingOrder.ongkir || 0)
                    };
                    if (onUpdateOrder) onUpdateOrder(finalOrder);
                    setEditingOrder(null);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL REASON MODAL */}
      {cancelReasonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-slate-800">
              Alasan Penolakan / Pembatalan
            </h3>
            <textarea
              rows={3}
              placeholder="Contoh: Stok barang habis / Alamat di luar jangkauan..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelReasonModal(null)}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateStatus(cancelReasonModal.id, 'Dibatalkan', cancelReason);
                  setCancelReasonModal(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl cursor-pointer shadow-3xs"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMO BANNER MANAGEMENT MODAL */}
      {isPromoBannerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 sm:p-6 max-w-2xl w-full max-h-[90vh] flex flex-col space-y-4 shadow-2xl border border-slate-100 dark:border-zinc-800">
            
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-sm">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <span>Kelola Banner Promo Toko Online</span>
                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      {activePromoCount} Promo Aktif
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Unggah foto poster/banner promo yang nantinya langsung dapat dilihat oleh pelanggan di portal belanja online.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPromoBannerModalOpen(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="overflow-y-auto space-y-6 pr-1 flex-1">
              
              {/* FORM UNGGAH / EDIT PROMO */}
              <form onSubmit={handleSavePromoBanner} className="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-4">
                <div className="flex items-center justify-between border-b pb-2 border-slate-200 dark:border-zinc-700">
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{editingPromoId ? 'Edit Banner Promo' : 'Unggah Banner Promo Baru'}</span>
                  </h4>
                  {editingPromoId && (
                    <button
                      type="button"
                      onClick={resetPromoForm}
                      className="text-[11px] text-red-600 dark:text-red-400 font-bold hover:underline cursor-pointer"
                    >
                      + Buat Banner Baru
                    </button>
                  )}
                </div>

                {/* IMAGE UPLOAD & PREVIEW */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-200 mb-1.5">
                    Foto / Poster Banner Promo <span className="text-red-500">*</span>
                  </label>

                  {promoForm.imageUrl ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/60 bg-slate-900 group shadow-md">
                      <img
                        src={promoForm.imageUrl}
                        alt="Promo Preview"
                        className="w-full h-44 object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs cursor-pointer shadow-sm flex items-center gap-1">
                          <Upload className="w-4 h-4" />
                          <span>Ganti Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  setIsCompressingBanner(true);
                                  const compressed = await compressPromoImage(file);
                                  setPromoForm(prev => ({ ...prev, imageUrl: compressed }));
                                } catch (err) {
                                  alert('Gagal memuat gambar promo');
                                } finally {
                                  setIsCompressingBanner(false);
                                }
                              }
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setPromoForm(prev => ({ ...prev, imageUrl: '' }))}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs cursor-pointer shadow-sm flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Hapus Foto</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all">
                      {isCompressingBanner ? (
                        <div className="space-y-2 py-2">
                          <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
                          <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">Optimasikan foto promo...</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300 rounded-2xl mb-2">
                            <Upload className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-black text-slate-800 dark:text-zinc-200 block">
                            Klik atau Geser Foto Poster Promo di Sini
                          </span>
                          <span className="text-[11px] text-slate-400 mt-0.5">
                            Format JPG, PNG, WebP (Ukuran direkomendasikan lanskap 2:1 atau 16:9)
                          </span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setIsCompressingBanner(true);
                              const compressed = await compressPromoImage(file);
                              setPromoForm(prev => ({ ...prev, imageUrl: compressed }));
                            } catch (err) {
                              alert('Gagal memuat gambar promo');
                            } finally {
                              setIsCompressingBanner(false);
                            }
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* FORM INPUTS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-200 mb-1">
                      Judul Promo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Diskon Sembako Berkah Jumat"
                      value={promoForm.judul}
                      onChange={(e) => setPromoForm({ ...promoForm, judul: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-200 mb-1">
                      Target Produk Spesial (Cari &amp; Pilih Langsung)
                    </label>

                    {promoForm.linkProductId ? (
                      <div className="flex items-center justify-between p-2 px-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-extrabold text-slate-900 dark:text-zinc-100 block truncate">
                            🎯 {promoForm.linkProductName || barang.find(b => b.id === promoForm.linkProductId)?.nama || 'Produk Terpilih'}
                          </span>
                          {(() => {
                            const selectedProd = barang.find(b => b.id === promoForm.linkProductId);
                            return selectedProd ? (
                              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-bold block">
                                {formatRp(selectedProd.jual)} • Stok: {selectedProd.stok} • Kat: {selectedProd.kategori || 'Umum'}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPromoForm(prev => ({
                              ...prev,
                              linkProductId: '',
                              linkProductName: ''
                            }));
                            setSearchTargetProductQuery('');
                          }}
                          className="px-2 py-1 bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 rounded-lg text-[10px] font-black cursor-pointer transition-colors shrink-0"
                        >
                          Ganti Produk
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Ketik nama produk / barcode di sini..."
                            value={searchTargetProductQuery}
                            onFocus={() => setIsTargetProductDropdownOpen(true)}
                            onChange={(e) => {
                              setSearchTargetProductQuery(e.target.value);
                              setIsTargetProductDropdownOpen(true);
                            }}
                            className="w-full pl-8 pr-8 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          {searchTargetProductQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchTargetProductQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {isTargetProductDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
                            <div className="p-2 bg-slate-50 dark:bg-zinc-800 text-[10px] font-extrabold text-slate-500 dark:text-zinc-400 flex items-center justify-between">
                              <span>Pilih Produk (Hasil Cari: {filteredTargetProducts.length})</span>
                              <button
                                type="button"
                                onClick={() => setIsTargetProductDropdownOpen(false)}
                                className="text-amber-600 hover:underline cursor-pointer"
                              >
                                Tutup [X]
                              </button>
                            </div>

                            {filteredTargetProducts.length === 0 ? (
                              <div className="p-3 text-center text-xs text-slate-400">
                                Tidak ada produk cocok dengan "{searchTargetProductQuery}"
                              </div>
                            ) : (
                              filteredTargetProducts.map(prod => (
                                <button
                                  key={prod.id}
                                  type="button"
                                  onClick={() => {
                                    setPromoForm(prev => ({
                                      ...prev,
                                      linkProductId: prod.id,
                                      linkProductName: prod.nama,
                                      linkKategori: prod.kategori || prev.linkKategori
                                    }));
                                    setIsTargetProductDropdownOpen(false);
                                    setSearchTargetProductQuery('');
                                  }}
                                  className="w-full text-left p-2.5 hover:bg-amber-50 dark:hover:bg-zinc-800/80 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-extrabold text-xs text-slate-800 dark:text-zinc-100 truncate">
                                      {prod.nama}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                                      {prod.barcode ? `[${prod.barcode}] ` : ''}Kat: {prod.kategori || 'Umum'}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="font-black text-xs text-amber-600 dark:text-amber-400">
                                      {formatRp(prod.jual)}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                      Stok: {prod.stok}
                                    </div>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-200 mb-1">
                      Filter Kategori Produk
                    </label>
                    <select
                      value={promoForm.linkKategori}
                      onChange={(e) => setPromoForm({ ...promoForm, linkKategori: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-extrabold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="Semua">Semua Produk (Tanpa Filter)</option>
                      {categoryOptions.filter(c => c !== 'Semua').map(cat => (
                        <option key={cat} value={cat}>
                          Filter ke Kategori: {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-zinc-200 mb-1">
                      Deskripsi / Keterangan Promo
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Beli minyak goreng Sania 2L dapatkan ekstra 100 Poin Member!"
                      value={promoForm.deskripsi}
                      onChange={(e) => setPromoForm({ ...promoForm, deskripsi: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={promoForm.aktif}
                      onChange={(e) => setPromoForm({ ...promoForm, aktif: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-200">
                      Tampilkan Promo Ini di Toko Online (Aktif)
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    {editingPromoId && (
                      <button
                        type="button"
                        onClick={resetPromoForm}
                        className="px-3 py-2 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-300"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isCompressingBanner}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-3xs active:scale-95 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{editingPromoId ? 'Simpan Perubahan' : 'Simpan Promo'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* LIST OF CURRENT PROMO BANNERS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-zinc-300 tracking-wider">
                    Daftar Banner Promo Toko ({promoBannersList.length})
                  </h4>
                  {!hideCustomerPortal && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsPromoBannerModalOpen(false);
                        onOpenCustomerPreview();
                      }}
                      className="text-xs font-extrabold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lihat Tampilan Pembeli</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {promoBannersList.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700 p-4">
                    <ImageIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600 dark:text-zinc-400">
                      Belum ada banner promo yang diunggah.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Silakan unggah foto banner promo pertama toko Anda menggunakan formulir di atas.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {promoBannersList.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded-2xl border p-3 space-y-2 relative transition-all ${
                          b.aktif 
                            ? 'bg-white dark:bg-zinc-900 border-amber-300/80 dark:border-amber-500/40 shadow-xs' 
                            : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 opacity-60'
                        }`}
                      >
                        <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900 border border-slate-200 dark:border-zinc-700">
                          <img
                            src={b.imageUrl}
                            alt={b.judul}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full ${
                              b.aktif 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-700 text-slate-300'
                            }`}>
                              {b.aktif ? '● Aktif' : 'Non-aktif'}
                            </span>
                            {b.linkKategori && b.linkKategori !== 'Semua' && (
                              <span className="text-[9.5px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {b.linkKategori}
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h5 className="font-extrabold text-xs text-slate-800 dark:text-zinc-100 line-clamp-1">
                            {b.judul}
                          </h5>
                          {b.deskripsi && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                              {b.deskripsi}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleTogglePromoActive(b.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                              b.aktif
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                                : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-300'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{b.aktif ? 'Matikan' : 'Aktifkan'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditPromoClick(b)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer"
                              title="Edit Banner Promo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePromo(b.id)}
                              className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Banner Promo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPromoBannerModalOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
              >
                Selesai
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS PESANAN ONLINE (BRANDING TOKO SRC MASNGUD) */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden max-w-md w-full shadow-2xl border border-slate-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
            
            {/* BRANDING HEADER TOKO SRC MASNGUD */}
            <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-4 sm:p-5 relative shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white text-red-700 flex items-center justify-center font-black text-base shadow-md border border-white/30 shrink-0">
                    SRC
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-black text-sm text-white tracking-wide">
                        {storeName || 'TOKO SRC MASNGUD'}
                      </h3>
                      <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase shadow-2xs">
                        MY AYO SRC
                      </span>
                    </div>
                    <p className="text-[11px] text-red-100 font-semibold mt-0.5">
                      Konfirmasi Hapus Pesanan Online
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal(null)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL CONTENT BODY */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3.5 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-2xl text-rose-900 dark:text-rose-200">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-rose-900 dark:text-rose-200 uppercase tracking-wide">
                    {deleteConfirmModal.type === 'bulk' 
                      ? `Bersihkan ${deleteConfirmModal.count} Pesanan Selesai & Dibatalkan`
                      : `Hapus Pesanan ${deleteConfirmModal.orderId}`}
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">
                    {deleteConfirmModal.type === 'bulk'
                      ? `Apakah Anda yakin ingin menghapus ${deleteConfirmModal.count} pesanan online berstatus Selesai dan Dibatalkan? Tindakan ini membersihkan riwayat agar tampilan rapi & hemat memori.`
                      : `Apakah Anda yakin ingin menghapus pesanan online dari ${deleteConfirmModal.buyerName || 'Pelanggan'}? Data pesanan ini akan dihapus permanen.`}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 text-[11px] text-slate-600 dark:text-zinc-300 space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-500 dark:text-zinc-400">Toko SRC:</span>
                  <span className="font-black text-slate-800 dark:text-zinc-100">{storeName || 'TOKO SRC MASNGUD'}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="text-slate-500 dark:text-zinc-400">Tipe Penghapusan:</span>
                  <span className="font-extrabold text-rose-600 dark:text-rose-400">
                    {deleteConfirmModal.type === 'bulk' ? 'Pembersihan Riwayat Selesai & Batal' : 'Hapus 1 Pesanan'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 pt-1.5 border-t border-slate-200/60 dark:border-zinc-700/60 font-semibold">
                  *Pesanan yang dihapus tidak dapat dipulihkan kembali.
                </p>
              </div>

              {/* MODAL BUTTONS */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteConfirmModal.type === 'bulk' && onDeleteCompletedOrCancelledOrders) {
                      onDeleteCompletedOrCancelledOrders();
                    } else if (deleteConfirmModal.type === 'single' && deleteConfirmModal.orderId && onDeleteOrder) {
                      onDeleteOrder(deleteConfirmModal.orderId);
                    }
                    setDeleteConfirmModal(null);
                  }}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus Sekarang</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
