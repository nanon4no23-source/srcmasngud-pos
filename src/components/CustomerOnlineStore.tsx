import React, { useState, useMemo, useEffect } from 'react';
import { ItemBarang, ConfigStruk, PesananOnline, DetailItemPesananOnline, Pelanggan } from '../types';
import { 
  ShoppingBag, Search, X, Plus, Minus, Truck, Store, 
  CheckCircle2, AlertCircle, MessageCircle, Trash2,
  ChevronRight, ChevronLeft, QrCode, CreditCard, DollarSign, Send, Info,
  User, UserCheck, Key, LogOut, ShieldCheck, Award,
  Camera, Copy, Check, Sparkles, Tag, ArrowRight, ArrowUp, Loader2, Cloud
} from 'lucide-react';
import CameraScanner from './CameraScanner';
import { prepareSearchIndex, searchProductsByPrefix } from '../utils/searchHelper';
import { 
  resolveStoreId, 
  listenToStoreForBuyer, 
  submitBuyerOrder, 
  registerBuyerMember, 
  searchMemberInCloud,
  normalizePhone
} from '../utils/firestoreSync';
import { matchMemberBarcode, getEan8Digits, getEan13Digits } from '../utils/printHelper';

// Helper to format clean display ID Member (e.g. MBR-001)
export const formatDisplayMemberId = (p: Pelanggan): string => {
  if (!p || !p.id) return 'MBR-000';
  if (p.id.toUpperCase().startsWith('MBR-')) return p.id.toUpperCase();
  if (p.id.startsWith('pel-')) {
    const numericPart = p.id.replace(/[^0-9]/g, '');
    const shortCode = numericPart ? numericPart.slice(-4) : '001';
    return `MBR-${shortCode}`;
  }
  return `MBR-${p.id.toUpperCase()}`;
};

interface CustomerOnlineStoreProps {
  barang: ItemBarang[];
  pelanggan?: Pelanggan[];
  config: ConfigStruk;
  onPlaceOrder: (order: PesananOnline) => void;
  onRegisterMember?: (newMember: Pelanggan) => void;
  onCloseStore?: () => void;
  isOwnerView?: boolean;
  existingOrders?: PesananOnline[];
  storeId?: string;
}

export const CustomerOnlineStore: React.FC<CustomerOnlineStoreProps> = ({
  barang: initialBarang,
  pelanggan: initialPelanggan = [],
  config: initialConfig,
  onPlaceOrder,
  onRegisterMember,
  onCloseStore,
  isOwnerView = false,
  existingOrders = [],
  storeId,
}) => {
  const activeStoreId = useMemo(() => storeId || resolveStoreId(), [storeId]);
  const [cloudBarang, setCloudBarang] = useState<ItemBarang[]>(initialBarang);
  const [cloudPelanggan, setCloudPelanggan] = useState<Pelanggan[]>(initialPelanggan);
  const [cloudConfig, setCloudConfig] = useState<ConfigStruk>(initialConfig);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isSearchingCloudMember, setIsSearchingCloudMember] = useState<boolean>(false);

  // Real-time Cloud Firestore Listener for public customer online store
  useEffect(() => {
    if (!activeStoreId) return;
    const unsub = listenToStoreForBuyer(activeStoreId, {
      onBarang: (items) => {
        if (items && items.length > 0) {
          setCloudBarang(items);
        }
        setIsCloudConnected(true);
      },
      onPelanggan: (members) => {
        if (members && members.length > 0) {
          setCloudPelanggan(members);
        }
        setIsCloudConnected(true);
      },
      onSettings: (data) => {
        if (data?.config) {
          setCloudConfig(prev => ({ ...prev, ...data.config }));
        }
      }
    });
    return () => unsub();
  }, [activeStoreId]);

  useEffect(() => {
    if (initialBarang && initialBarang.length > 0 && cloudBarang.length === 0) {
      setCloudBarang(initialBarang);
    }
  }, [initialBarang]);

  useEffect(() => {
    if (initialPelanggan && initialPelanggan.length > 0 && cloudPelanggan.length === 0) {
      setCloudPelanggan(initialPelanggan);
    }
  }, [initialPelanggan]);

  const barang = cloudBarang.length > 0 ? cloudBarang : initialBarang;
  const pelanggan = cloudPelanggan.length > 0 ? cloudPelanggan : initialPelanggan;
  const config = cloudConfig || initialConfig;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  // Member Login Session State
  const [loggedInMember, setLoggedInMember] = useState<Pelanggan | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('src_online_member_session');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return null;
  });

  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(() => !loggedInMember);
  const [memberModalTab, setMemberModalTab] = useState<'login' | 'register'>('login');
  const [memberInput, setMemberInput] = useState('');
  const [regNama, setRegNama] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [memberLoginError, setMemberLoginError] = useState<string | null>(null);

  // New states for Member ID features
  const [isDigitalCardOpen, setIsDigitalCardOpen] = useState(false);
  const [isMemberCardScannerOpen, setIsMemberCardScannerOpen] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState(false);

  // States for Online Store Promo Banner Carousel
  const activePromoBanners = useMemo(() => {
    return Array.isArray(config?.promoBanners) ? config.promoBanners.filter(b => b.aktif && b.imageUrl) : [];
  }, [config?.promoBanners]);

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [selectedPromoModal, setSelectedPromoModal] = useState<any>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // Helper to handle banner navigation & direct checkout
  const handleNavigateToPromoProduct = (banner: any, autoCheckout = false) => {
    if (!banner) return;

    // Target specific product if specified
    if (banner.linkProductId) {
      const targetProd = barang.find(b => b.id === banner.linkProductId);
      if (targetProd) {
        setSelectedCategory('Semua');
        setSearchQuery('');
        setSelectedPromoModal(null);

        // Auto add 1 unit if cart currently empty for this item
        const existingQty = cartItems[targetProd.id]?.qty || 0;
        if (existingQty === 0) {
          updateCartQty(targetProd.id, 1);
        }

        if (autoCheckout) {
          setIsCartOpen(true);
        }

        setHighlightedProductId(targetProd.id);

        setTimeout(() => {
          const el = document.getElementById(`product-card-${targetProd.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 120);

        setTimeout(() => {
          setHighlightedProductId(null);
        }, 4000);

        return;
      }
    }

    // Fallback category filter
    if (banner.linkKategori && banner.linkKategori !== 'Semua') {
      setSelectedCategory(banner.linkKategori);
    } else {
      setSelectedCategory('Semua');
    }
    setSelectedPromoModal(null);

    if (autoCheckout) {
      setIsCartOpen(true);
    }

    const searchEl = document.getElementById('online-search-input');
    if (searchEl) {
      searchEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll & Back Button Handling State
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Smooth scroll to top header function (robust cross-browser support for Chrome/Mobile)
  const scrollToTopHeader = () => {
    // 1. Try scrollIntoView on top header element
    const topEl = document.getElementById('store-header-top');
    if (topEl) {
      topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // 2. Try window.scrollTo smooth
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, 0);
    }
    // 3. Fallback direct scroll position assignment for mobile Chrome / WebKit
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };

  // Monitor scroll position to show floating "Ke Top Header" button
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setShowScrollTop(scrollPos > 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Auto-rotate promo banners every 4.5s
  useEffect(() => {
    if (activePromoBanners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex(prev => (prev + 1) % activePromoBanners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activePromoBanners.length]);

  // Sync Customer details with logged in member
  useEffect(() => {
    if (loggedInMember) {
      setCustomerName(loggedInMember.nama);
      setCustomerPhone(loggedInMember.telepon);
    }
  }, [loggedInMember]);

  // Keep loggedInMember point balance & info updated when pelanggan prop changes
  useEffect(() => {
    if (loggedInMember) {
      const fresh = pelanggan.find(p => p.id === loggedInMember.id);
      if (fresh && (fresh.poin !== loggedInMember.poin || fresh.nama !== loggedInMember.nama || fresh.telepon !== loggedInMember.telepon)) {
        setLoggedInMember(fresh);
        localStorage.setItem('src_online_member_session', JSON.stringify(fresh));
      }
    }
  }, [pelanggan]);

  // Helper function to normalize phone numbers (e.g. 0812... vs 62812... vs 812...)
  const normalizePhone = (phoneStr: string) => {
    let clean = (phoneStr || '').replace(/[^0-9]/g, '');
    if (clean.startsWith('62')) clean = '0' + clean.slice(2);
    else if (clean.startsWith('8')) clean = '0' + clean;
    return clean;
  };

  // Helper function to search for member in database by Barcode, Phone, ID, or Name
  const findMember = (query: string): Pelanggan | null => {
    if (!query || !query.trim()) return null;
    const q = query.trim();
    const qLow = q.toLowerCase();
    const cleanQ = qLow.replace(/[^a-z0-9]/g, '');
    const cleanQueryPhone = normalizePhone(q);

    // 0. Match by Barcode / QR Code (EAN-8 / EAN-13 / matchMemberBarcode)
    let match = pelanggan.find(p => {
      const pId = p.id || '';
      if (matchMemberBarcode(pId, q)) return true;
      if (getEan8Digits(pId) === q || (cleanQ && getEan8Digits(pId) === cleanQ)) return true;
      if (getEan13Digits(pId) === q || (cleanQ && getEan13Digits(pId) === cleanQ)) return true;
      return false;
    });
    if (match) return match;

    // 1. Match by Member ID (exact, lowercase, display formatted ID, or clean alphanumeric)
    match = pelanggan.find(p => {
      const pIdLow = (p.id || '').toLowerCase();
      const pIdClean = pIdLow.replace(/[^a-z0-9]/g, '');
      const displayId = formatDisplayMemberId(p).toLowerCase();
      const displayClean = displayId.replace(/[^a-z0-9]/g, '');

      return pIdLow === qLow || 
             (cleanQ && pIdClean === cleanQ) || 
             displayId === qLow ||
             (cleanQ && displayClean === cleanQ);
    });
    if (match) return match;

    // 2. Match by Phone Number (normalized exact - ONLY if both query and member phone have >= 8 digits)
    if (cleanQueryPhone.length >= 8) {
      match = pelanggan.find(p => {
        const pPhoneNorm = normalizePhone(p.telepon || '');
        return pPhoneNorm.length >= 8 && (
          pPhoneNorm === cleanQueryPhone || 
          pPhoneNorm.endsWith(cleanQueryPhone) || 
          cleanQueryPhone.endsWith(pPhoneNorm)
        );
      });
      if (match) return match;
    }

    // 3. Match by Name (case insensitive exact or substring, ONLY if query is not purely numeric and has >= 3 chars)
    if (qLow.length >= 3 && !/^\d+$/.test(cleanQ)) {
      match = pelanggan.find(p => {
        const pNameLow = (p.nama || '').toLowerCase().trim();
        return pNameLow === qLow || pNameLow.includes(qLow);
      });
      if (match) return match;
    }

    return null;
  };

  const handleMemberLoginSubmit = async (e?: React.FormEvent, selectedMember?: Pelanggan) => {
    if (e) e.preventDefault();
    let target = selectedMember || findMember(memberInput);

    if (!target && memberInput.trim()) {
      setIsSearchingCloudMember(true);
      try {
        target = await searchMemberInCloud(activeStoreId, memberInput);
        if (target) {
          setCloudPelanggan(prev => {
            if (!prev.some(p => p.id === target!.id)) {
              return [...prev, target!];
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('Error searching member in cloud:', err);
      } finally {
        setIsSearchingCloudMember(false);
      }
    }

    if (target) {
      setLoggedInMember(target);
      setCustomerName(target.nama);
      setCustomerPhone(target.telepon);
      localStorage.setItem('src_online_member_session', JSON.stringify(target));
      setIsMemberModalOpen(false);
      setMemberLoginError(null);
      setMemberInput('');
    } else {
      setMemberLoginError(`Nomor HP / ID / Barcode / Nama "${memberInput}" tidak ditemukan di data toko. Silakan gunakan tab "Daftar Member Baru" untuk membuat akun.`);
    }
  };

  const handleRegisterMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameStr = regNama.trim();
    const phoneStr = regPhone.trim();

    if (!nameStr) {
      setMemberLoginError('Sebutkan nama lengkap Anda!');
      return;
    }
    if (!phoneStr) {
      setMemberLoginError('Sebutkan nomor HP / WhatsApp aktif Anda!');
      return;
    }

    // If phone number or name already exists in member database, log them in directly
    const existing = findMember(phoneStr) || findMember(nameStr);
    if (existing) {
      setLoggedInMember(existing);
      setCustomerName(existing.nama);
      setCustomerPhone(existing.telepon);
      localStorage.setItem('src_online_member_session', JSON.stringify(existing));
      setIsMemberModalOpen(false);
      setMemberLoginError(null);
      setRegNama('');
      setRegPhone('');
      setMemberInput('');
      return;
    }

    const newMember: Pelanggan = {
      id: `pel-${Date.now()}`,
      nama: nameStr,
      telepon: phoneStr,
      poin: 0,
      totalBelanja: 0,
      tanggalDaftar: new Date().toISOString().split('T')[0],
      catatan: 'Daftar lewat Belanja Online',
      bolehHutangRokok: false,
      limitKredit: 500000,
    };

    setLoggedInMember(newMember);
    setCustomerName(newMember.nama);
    setCustomerPhone(newMember.telepon);
    localStorage.setItem('src_online_member_session', JSON.stringify(newMember));
    setCloudPelanggan(prev => [...prev.filter(p => p.id !== newMember.id), newMember]);

    if (onRegisterMember) {
      onRegisterMember(newMember);
    }
    // Directly persist to cloud Firestore
    registerBuyerMember(activeStoreId, newMember);

    setIsMemberModalOpen(false);
    setMemberLoginError(null);
    setRegNama('');
    setRegPhone('');
    setMemberInput('');
  };

  const handleMemberLogout = () => {
    setLoggedInMember(null);
    localStorage.removeItem('src_online_member_session');
    setCustomerName('');
    setCustomerPhone('');
    setCartItems({});
    setCustomerAddress('');
    setOrderNotes('');
    setPlacedOrder(null);
    setIsMemberModalOpen(true);
  };
  
  // Cart state: map of productId -> { qty, selectedUnitId }
  const [cartItems, setCartItems] = useState<{
    [productId: string]: {
      qty: number;
      selectedUnitId?: string; // ID of MultiSatuanItem if chosen, or undefined for base unit
    };
  }>({});

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'Ambil di Toko' | 'Pesan Antar'>('Pesan Antar');
  const [paymentMethod, setPaymentMethod] = useState<'COD (Bayar di Tempat)' | 'QRIS' | 'Transfer Bank'>('COD (Bayar di Tempat)');
  
  // Customer details form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  
  // Order completed modal state
  const [placedOrder, setPlacedOrder] = useState<PesananOnline | null>(null);

  const isStoreOpen = config.tokoOnlineAktif !== false; // Default true unless explicitly closed
  const minOrder = config.minOrderDelivery || 0;
  const deliveryFee = deliveryType === 'Pesan Antar' ? (config.ongkirDelivery || 5000) : 0;

  // Categories list
  const categories = useMemo(() => {
    const setCat = new Set<string>();
    setCat.add('Semua');
    barang.forEach(b => {
      if (b.kategori) setCat.add(b.kategori);
    });
    return Array.from(setCat);
  }, [barang]);

  // Handle Mobile / Browser Back Button (popstate) safely
  useEffect(() => {
    const isAnyModalOpen = isCartOpen || !!selectedPromoModal || isDigitalCardOpen || isMemberCardScannerOpen || isMemberModalOpen;

    if (isAnyModalOpen) {
      try {
        window.history.pushState({ modalOpen: true }, '');
      } catch (e) {}
    }

    const handlePopState = () => {
      // 1. Close open modal first if active
      if (isCartOpen) { setIsCartOpen(false); return; }
      if (selectedPromoModal) { setSelectedPromoModal(null); return; }
      if (isDigitalCardOpen) { setIsDigitalCardOpen(false); return; }
      if (isMemberCardScannerOpen) { setIsMemberCardScannerOpen(false); return; }
      if (isMemberModalOpen) { setIsMemberModalOpen(false); return; }

      // 2. If scrolled down deep in products list -> scroll back up to top header
      if (window.scrollY > 120) {
        scrollToTopHeader();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isCartOpen,
    selectedPromoModal,
    isDigitalCardOpen,
    isMemberCardScannerOpen,
    isMemberModalOpen
  ]);

  // Pre-indexed search cache for online catalog
  const searchIndex = useMemo(() => {
    return prepareSearchIndex(barang.filter(p => p.stok > 0));
  }, [barang]);

  // Filtered product catalog prioritizing prefix of words
  const filteredProducts = useMemo(() => {
    let pool: ItemBarang[];
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      pool = barang.filter(p => p.stok > 0);
    } else {
      pool = searchProductsByPrefix(searchIndex, q, 100);
    }

    if (selectedCategory === 'Semua') return pool;
    return pool.filter(p => p.kategori === selectedCategory);
  }, [barang, searchIndex, searchQuery, selectedCategory]);

  // Handle Qty Changes
  const updateCartQty = (productId: string, delta: number, unitId?: string) => {
    setCartItems(prev => {
      const current = prev[productId] || { qty: 0, selectedUnitId: unitId };
      const newQty = Math.max(0, current.qty + delta);
      
      const updated = { ...prev };
      if (newQty === 0) {
        delete updated[productId];
      } else {
        updated[productId] = { qty: newQty, selectedUnitId: unitId ?? current.selectedUnitId };
      }
      return updated;
    });
  };

  // Compute Cart Item Details
  const cartDetails = useMemo(() => {
    const list: {
      product: ItemBarang;
      qty: number;
      unitName: string;
      unitPrice: number;
      originalUnitPrice: number;
      subtotal: number;
      unitId?: string;
      pricingLabel?: string;
    }[] = [];

    (Object.entries(cartItems) as [string, { qty: number; selectedUnitId?: string }][]).forEach(([pId, info]) => {
      const prod = barang.find(b => b.id === pId);
      if (!prod) return;

      let unitName = 'Pcs';
      let unitPrice = prod.jual;
      let originalUnitPrice = prod.jual;
      let pricingLabel: string | undefined = undefined;
      let subtotal = Math.round(info.qty * prod.jual);

      if (info.selectedUnitId && prod.multiSatuan) {
        const foundUnit = prod.multiSatuan.find(u => u.id === info.selectedUnitId);
        if (foundUnit) {
          unitName = foundUnit.namaSatuan;
          unitPrice = foundUnit.hargaJual;
          originalUnitPrice = foundUnit.hargaJual;
          subtotal = Math.round(info.qty * unitPrice);
        }
      } else {
        if (prod.multiSatuan && prod.multiSatuan.length > 0) {
          // Automatic multi-satuan calculation for base unit Pcs (matching Kasir POS logic)
          const sortedUnits = [...prod.multiSatuan].sort((a, b) => b.isiPcs - a.isiPcs);
          let tempQty = info.qty;
          let calculatedSubtotal = 0;
          const parts: string[] = [];

          for (const u of sortedUnits) {
            if (tempQty >= u.isiPcs) {
              const numUnits = Math.floor(tempQty / u.isiPcs);
              calculatedSubtotal += numUnits * u.hargaJual;
              tempQty = tempQty % u.isiPcs;
              parts.push(`${numUnits} ${u.namaSatuan}`);
            }
          }
          if (tempQty > 0) {
            calculatedSubtotal += tempQty * prod.jual;
            parts.push(`${tempQty} Pcs`);
          }

          if (parts.length > 0 && calculatedSubtotal < info.qty * prod.jual) {
            subtotal = Math.round(calculatedSubtotal);
            unitPrice = info.qty > 0 ? Math.round((subtotal / info.qty) * 100) / 100 : prod.jual;
            pricingLabel = `Harga Multi-Satuan (${parts.join(' + ')})`;
          } else {
            subtotal = Math.round(info.qty * prod.jual);
            unitPrice = prod.jual;
          }
        }
      }

      list.push({
        product: prod,
        qty: info.qty,
        unitName,
        unitPrice,
        originalUnitPrice,
        subtotal,
        unitId: info.selectedUnitId,
        pricingLabel
      });
    });

    return list;
  }, [cartItems, barang]);

  const cartSubtotal = useMemo(() => {
    return cartDetails.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cartDetails]);

  const totalItemCount = useMemo(() => {
    return cartDetails.reduce((sum, item) => sum + item.qty, 0);
  }, [cartDetails]);

  const grandTotal = cartSubtotal + deliveryFee;

  // Format rupiah helper
  const formatRp = (num: number) => `Rp ${num.toLocaleString('id-ID')}`;

  // Handle Submit Order
  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (cartDetails.length === 0) {
      alert('Keranjang belanja Anda masih kosong!');
      return;
    }

    const finalName = (customerName || loggedInMember?.nama || '').trim();
    const finalPhone = (customerPhone || loggedInMember?.telepon || '').trim();

    if (!finalName || !finalPhone) {
      alert('Silakan lengkapi Nama dan Nomor WhatsApp Anda.');
      return;
    }

    if (deliveryType === 'Pesan Antar' && !customerAddress.trim()) {
      alert('Silakan tuliskan Alamat Pengiriman Anda secara lengkap.');
      return;
    }

    if (deliveryType === 'Pesan Antar' && minOrder > 0 && cartSubtotal < minOrder) {
      alert(`Minimal pesanan untuk Pesan Antar adalah ${formatRp(minOrder)}`);
      return;
    }

    // Build order items payload
    const itemsPayload: DetailItemPesananOnline[] = cartDetails.map(c => ({
      itemId: c.product.id,
      nama: c.product.nama,
      kode: c.product.kode,
      qty: c.qty,
      jual: c.unitPrice,
      subtotal: c.subtotal,
      satuanNama: c.unitName,
      unitId: c.unitId
    }));

    const orderId = `ORD-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const newOrder: PesananOnline = {
      id: orderId,
      waktu: new Date().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
      timestamp: Date.now(),
      namaPembeli: finalName,
      teleponPembeli: finalPhone,
      alamatPembeli: deliveryType === 'Pesan Antar' ? customerAddress.trim() : undefined,
      tipePengiriman: deliveryType,
      catatan: orderNotes.trim() || undefined,
      items: itemsPayload,
      totalHarga: cartSubtotal,
      ongkir: deliveryFee,
      totalBayar: grandTotal,
      metodePembayaran: paymentMethod,
      status: 'Menunggu Konfirmasi'
    };

    onPlaceOrder(newOrder);
    setPlacedOrder(newOrder);

    // Directly push order to Firestore Cloud database so Cashier APK receives it instantly
    submitBuyerOrder(activeStoreId, newOrder);

    if (typeof window !== 'undefined') {
      try {
        const savedIdsStr = localStorage.getItem('src_online_placed_order_ids');
        const savedIds: string[] = savedIdsStr ? JSON.parse(savedIdsStr) : [];
        if (!savedIds.includes(newOrder.id)) {
          savedIds.unshift(newOrder.id);
          localStorage.setItem('src_online_placed_order_ids', JSON.stringify(savedIds));
        }

        const savedFullStr = localStorage.getItem('src_online_placed_orders_full');
        const savedFull: PesananOnline[] = savedFullStr ? JSON.parse(savedFullStr) : [];
        if (!savedFull.some(o => o.id === newOrder.id)) {
          savedFull.unshift(newOrder);
          localStorage.setItem('src_online_placed_orders_full', JSON.stringify(savedFull));
        }
      } catch (e) {}
    }

    setIsCartOpen(false);
    setCartItems({});
  };

  // Generate WhatsApp Message Link for Customer
  const getWhatsAppMessageUrl = (order: PesananOnline) => {
    const waNumber = config.nomorWaToko || config.karyawan1 || '';
    const cleanNumber = waNumber.replace(/[^0-9]/g, '');
    let formattedPhone = cleanNumber;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    const itemText = order.items.map(i => `• ${i.nama} (${i.qty} ${i.satuanNama || 'Pcs'}) - ${formatRp(i.subtotal)}`).join('\n');
    
    const message = 
`*PESANAN YUK BELANJA ONLINE*
*No. Pesanan:* ${order.id}
*Tgl:* ${order.waktu}

*Data Pembeli:*
👤 Nama: ${order.namaPembeli}
📞 No. WA: ${order.teleponPembeli}
🚚 Pengiriman: ${order.tipePengiriman}
${order.alamatPembeli ? `📍 Alamat: ${order.alamatPembeli}\n` : ''}${order.catatan ? `📝 Catatan: ${order.catatan}\n` : ''}
*Rincian Barang:*
${itemText}

💰 Subtotal: ${formatRp(order.totalHarga)}
🚚 Ongkir: ${formatRp(order.ongkir)}
*TOTAL BAYAR: ${formatRp(order.totalBayar)}*
💳 Pembayaran: ${order.metodePembayaran}

Mohon diproses ya Kak, Terima Kasih! 🙏`;

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans antialiased">
      {/* HEADER STORE BRANDING & PROMO BANNERS - SCROLLABLE UPWARDS */}
      <header id="store-header-top" className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-red-700 font-black text-[10px] px-2 py-0.5 rounded tracking-wider uppercase shadow-3xs">
                  Yuk Belanja Online
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isStoreOpen ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'bg-rose-950 text-rose-200 border border-rose-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isStoreOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  {isStoreOpen ? 'Toko Buka' : 'Toko Tutup'}
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight mt-0.5 leading-tight">
                {config.namaToko || 'Toko Kelontong SRC'}
              </h1>
              <p className="text-xs text-red-100 opacity-90 truncate max-w-xs">
                {config.alamatToko || 'Belanja Praktis & Hemat Dekat Rumah'}
              </p>
            </div>
          </div>

          {isOwnerView && (
            <div className="bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[10px] font-bold text-white text-right hidden sm:block">
              <span>Preview Pembeli</span>
            </div>
          )}
        </div>

        {/* MEMBER ACCOUNT HEADER BAR (KOLOM PELANGGAN) */}
        <div className="bg-slate-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          {loggedInMember ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 shadow-3xs">
                <UserCheck className="w-3 h-3" /> Member SRC
              </span>
              <span className="bg-red-950 text-red-300 border border-red-500/40 font-black px-2 py-0.5 rounded-md text-[10px]">
                🆔 {formatDisplayMemberId(loggedInMember)}
              </span>
              <span className="font-extrabold text-white flex items-center gap-1">
                <span>{loggedInMember.nama}</span>
              </span>
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-400/30 text-[10px] font-black flex items-center gap-1">
                <Award className="w-3 h-3 text-amber-400" /> {loggedInMember.poin || 0} Poin
              </span>
              <button
                type="button"
                onClick={() => setIsDigitalCardOpen(true)}
                className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-[10px] rounded-lg shadow-3xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <CreditCard className="w-3 h-3" />
                <span>Kartu Member</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <Key className="w-3.5 h-3.5" /> Silakan Login ID Member / No. HP
              </span>
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                (Ketik ID Member atau Scan Kartu untuk kumpulkan poin)
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => loggedInMember ? handleMemberLogout() : setIsMemberModalOpen(true)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-white/10"
            >
              {loggedInMember ? (
                <>
                  <LogOut className="w-3 h-3 text-rose-300" />
                  <span>Log Out</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3 h-3 text-amber-300" />
                  <span>Login Member</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* INTERACTIVE PROMO BANNER CAROUSEL / SLIDER */}
        {activePromoBanners.length > 0 && (
          <div className="bg-gradient-to-b from-red-950/90 to-red-900/40 border-t border-b border-red-500/30 px-3 py-3 text-white">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>PROMO &amp; PENAWARAN SPESIAL TOKO</span>
                </span>
                {activePromoBanners.length > 1 && (
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-200">
                    <span>{currentBannerIndex + 1} / {activePromoBanners.length}</span>
                  </div>
                )}
              </div>

              {/* SLIDER CARD CONTAINER */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-white/20 shadow-xl group">
                {activePromoBanners.map((banner, idx) => {
                  if (idx !== currentBannerIndex) return null;
                  return (
                    <div key={banner.id} className="relative aspect-[21/9] sm:aspect-[21/8] w-full overflow-hidden">
                      <img
                        src={banner.imageUrl}
                        alt={banner.judul}
                        onClick={() => setSelectedPromoModal(banner)}
                        className="w-full h-full object-cover cursor-pointer hover:scale-102 transition-transform duration-300"
                      />
                      
                      {/* GRADIENT OVERLAY */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

                      {/* BANNER CONTENT CAPTION */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-left flex items-end justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {banner.linkKategori && banner.linkKategori !== 'Semua' && (
                            <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1 shadow-3xs">
                              🏷️ {banner.linkKategori}
                            </span>
                          )}
                          <h4 
                            onClick={() => setSelectedPromoModal(banner)}
                            className="text-xs sm:text-sm font-black text-white tracking-tight line-clamp-1 cursor-pointer hover:text-amber-300 transition-colors"
                          >
                            {banner.judul}
                          </h4>
                          {banner.deskripsi && (
                            <p className="text-[10.5px] sm:text-xs text-slate-200 line-clamp-1 opacity-90 mt-0.5">
                              {banner.deskripsi}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleNavigateToPromoProduct(banner, false)}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Lihat Produk Promo"
                          >
                            <span>Lihat Produk</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleNavigateToPromoProduct(banner, true)}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="Langsung Masukkan Keranjang & Checkout"
                          >
                            <span>Langsung Checkout</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPromoModal(banner)}
                            className="px-2 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Perbesar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* PREV / NEXT NAV BUTTONS */}
                {activePromoBanners.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentBannerIndex((prev) => (prev - 1 + activePromoBanners.length) % activePromoBanners.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentBannerIndex((prev) => (prev + 1) % activePromoBanners.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* DOT INDICATORS */}
              {activePromoBanners.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  {activePromoBanners.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setCurrentBannerIndex(i)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        i === currentBannerIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROMO / GREETING BANNER */}
        {config.deskripsiTokoOnline && (
          <div className="bg-red-900/40 border-t border-red-500/20 px-4 py-1.5 text-center text-xs font-medium text-red-100">
            📢 {config.deskripsiTokoOnline}
          </div>
        )}
      </header>

      {/* SEARCH & CATEGORY FILTERS - COMPACT STICKY AT TOP */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 py-2.5 text-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              id="online-search-input"
              type="text"
              placeholder="Cari kebutuhan rumah, sembako, jajanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* CATEGORY PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-red-600 text-white shadow-3xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN STORE CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">

        {/* CLOSED STORE ALERT */}
        {!isStoreOpen && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl flex items-center gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Toko Online Saat Ini Sedang Tutup</p>
              <p className="text-[11px] opacity-80">Anda tetap dapat melihat katalog produk, tetapi pemesanan sementara dinonaktifkan.</p>
            </div>
          </div>
        )}

        {/* PRODUCTS CATALOG GRID */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Katalog Produk ({filteredProducts.length})
            </h2>
            {selectedCategory !== 'Semua' && (
              <span className="text-[11px] font-bold text-red-600">
                Kategori: {selectedCategory}
              </span>
            )}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 my-4 space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-600">Produk tidak ditemukan</p>
              <p className="text-[11px] text-slate-400">Coba kata kunci pencarian atau kategori lain.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map((prod) => {
                const cartInfo = cartItems[prod.id];
                const currentQty = cartInfo?.qty || 0;
                const hasMultiSatuan = prod.multiSatuan && prod.multiSatuan.length > 0;
                const selectedUnitId = cartInfo?.selectedUnitId;

                // Price display calculation
                let activePrice = prod.jual;
                let activeUnitName = 'Pcs';
                let activeIsWholesale = false;

                if (selectedUnitId && prod.multiSatuan) {
                  const u = prod.multiSatuan.find(x => x.id === selectedUnitId);
                  if (u) {
                    activePrice = u.hargaJual;
                    activeUnitName = u.namaSatuan;
                  }
                } else {
                  if (prod.multiSatuan && prod.multiSatuan.length > 0 && currentQty > 0) {
                    const sortedUnits = [...prod.multiSatuan].sort((a, b) => b.isiPcs - a.isiPcs);
                    let tempQty = currentQty;
                    let calculatedSubtotal = 0;
                    for (const u of sortedUnits) {
                      if (tempQty >= u.isiPcs) {
                        const numUnits = Math.floor(tempQty / u.isiPcs);
                        calculatedSubtotal += numUnits * u.hargaJual;
                        tempQty = tempQty % u.isiPcs;
                      }
                    }
                    if (tempQty > 0) {
                      calculatedSubtotal += tempQty * prod.jual;
                    }
                    if (calculatedSubtotal < currentQty * prod.jual) {
                      activePrice = Math.round((calculatedSubtotal / currentQty) * 100) / 100;
                      activeIsWholesale = true;
                    }
                  }
                }

                const isHighlighted = highlightedProductId === prod.id;

                return (
                  <div 
                    id={`product-card-${prod.id}`}
                    key={prod.id}
                    className={`bg-white border rounded-2xl p-3 transition-all flex flex-col justify-between scroll-mt-28 ${
                      isHighlighted
                        ? 'border-amber-500 ring-4 ring-amber-400 shadow-2xl bg-amber-50/50 scale-[1.02] animate-pulse'
                        : 'border-slate-200/90 shadow-xs hover:shadow-md'
                    }`}
                  >
                    <div>
                      {/* CATEGORY & STOCK BADGE */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 truncate max-w-[90px]">
                          {prod.kategori || 'Sembako'}
                        </span>
                        <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Tersedia
                        </span>
                      </div>

                      {/* PRODUCT PHOTO IF AVAILABLE */}
                      {prod.foto ? (
                        <div 
                          onClick={() => setZoomedImage({ url: prod.foto!, title: prod.nama })}
                          className="w-full h-20 mb-2 rounded-lg overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center p-1 cursor-pointer group"
                          title="Klik untuk memperbesar foto kemasan"
                        >
                          <img 
                            src={prod.foto} 
                            alt={prod.nama} 
                            className="max-h-full max-w-full object-contain rounded group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : null}

                      {/* PRODUCT NAME */}
                      <h3 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug mb-1">
                        {prod.nama}
                      </h3>

                      {/* MULTI SATUAN SELECTOR IF AVAILABLE */}
                      {hasMultiSatuan && (
                        <div className="mb-2">
                          <select
                            value={selectedUnitId || ''}
                            onChange={(e) => {
                              const val = e.target.value || undefined;
                              updateCartQty(prod.id, 0, val);
                            }}
                            className="w-full text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-700 focus:outline-none"
                          >
                            <option value="">Eceran (Pcs) - {formatRp(prod.jual)}</option>
                            {prod.multiSatuan!.map(unit => (
                              <option key={unit.id} value={unit.id}>
                                {unit.namaSatuan} (isi {unit.isiPcs}) - {formatRp(unit.hargaJual)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* PRICE & WHOLESALE PROMO BADGES */}
                      <div className="my-1.5 space-y-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          {activeIsWholesale ? (
                            <>
                              <span className="text-sm font-black text-emerald-600">
                                {formatRp(activePrice)}
                              </span>
                              <span className="text-[10px] text-slate-400 line-through font-medium">
                                {formatRp(prod.jual)}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-black text-red-600">
                              {formatRp(activePrice)}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium ml-0.5">
                            / {activeUnitName}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ADD TO CART ACTION BUTTON */}
                    <div className="pt-2 border-t border-slate-100">
                      {currentQty === 0 ? (
                        <button
                          type="button"
                          disabled={!isStoreOpen}
                          onClick={() => updateCartQty(prod.id, 1, selectedUnitId)}
                          className={`w-full py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                            isStoreOpen
                              ? 'bg-red-600 text-white hover:bg-red-700 shadow-3xs'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Beli</span>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateCartQty(prod.id, -1, selectedUnitId)}
                            className="w-7 h-7 rounded-lg bg-white border border-red-200 text-red-600 flex items-center justify-center font-black active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-black text-red-700 px-2">
                            {currentQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(prod.id, 1, selectedUnitId)}
                            className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-black active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* FLOATING ACTION BUTTONS AT BOTTOM RIGHT (POJOK KANAN BAWAH) */}
      <div className={`fixed right-4 z-40 flex flex-col items-end gap-2.5 transition-all duration-300 ${cartDetails.length > 0 && !isCartOpen ? 'bottom-22' : 'bottom-5'}`}>
        {/* FLOATING "KEMBALI KE ATAS" BUTTON WHEN SCROLLED DOWN */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTopHeader}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xl border-2 border-white/90 font-black text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-90 hover:scale-105"
            title="Kembali ke Atas / Header Toko"
          >
            <ArrowUp className="w-4 h-4 stroke-[3]" />
            <span>Kembali ke Atas</span>
          </button>
        )}
      </div>

      {/* FLOATING CART BAR (WHEN ITEMS IN CART) */}
      {cartDetails.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="relative bg-red-600 text-white p-2 rounded-xl font-black">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-white text-red-600 text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-extrabold border border-red-600">
                  {totalItemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Keranjang Belanja
                </p>
                <p className="text-sm font-black text-white">
                  {formatRp(cartSubtotal)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-3 py-2 rounded-xl">
              <span>Lanjut Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* CART & CHECKOUT DRAWER MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            
            {/* MODAL HEADER */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-red-600" />
                <h3 className="font-extrabold text-sm text-slate-800">
                  Keranjang &amp; Checkout Pesanan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODAL CONTENT FORM */}
            <form onSubmit={handleSubmitOrder} className="overflow-y-auto p-4 space-y-4 flex-1">
              
              {/* ITEM LIST SUMMARY */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Ringkasan Belanja ({cartDetails.length} barang)
                </h4>
                <div className="divide-y divide-slate-100 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2 max-h-48 overflow-y-auto">
                  {cartDetails.map((item) => (
                    <div key={`${item.product.id}-${item.unitId || 'base'}`} className="py-2 px-1 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{item.product.nama}</p>
                        {item.pricingLabel ? (
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatRp(item.originalUnitPrice)}
                            </span>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                              {item.pricingLabel}: {formatRp(item.unitPrice)} / {item.unitName}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400">
                            {formatRp(item.unitPrice)} / {item.unitName}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, -1, item.unitId)}
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 rounded-l-lg font-black"
                          >
                            -
                          </button>
                          <span className="px-2 font-black text-slate-800">{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.product.id, 1, item.unitId)}
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 rounded-r-lg font-black"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-black text-slate-900 min-w-[70px] text-right">
                          {formatRp(item.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FULFILLMENT METHOD */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Metode Pengambilan / Pengiriman
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('Pesan Antar')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      deliveryType === 'Pesan Antar'
                        ? 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Truck className={`w-4 h-4 ${deliveryType === 'Pesan Antar' ? 'text-red-600' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        {config.ongkirDelivery ? formatRp(config.ongkirDelivery) : 'Rp 5.000'}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-extrabold">Pesan Antar (Delivery)</p>
                      <p className="text-[10px] text-slate-500">Diantar langsung ke alamat Anda</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('Ambil di Toko')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      deliveryType === 'Ambil di Toko'
                        ? 'bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Store className={`w-4 h-4 ${deliveryType === 'Ambil di Toko' ? 'text-red-600' : 'text-slate-400'}`} />
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Gratis
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-extrabold">Ambil Mandiri di Toko</p>
                      <p className="text-[10px] text-slate-500">Siap dalam ~15 menit</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* CUSTOMER INFO INPUTS */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Data Pembeli (Member Terdaftar)
                </h4>

                {loggedInMember ? (
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-extrabold text-emerald-900">
                          Member Terverifikasi: {loggedInMember.nama}
                        </p>
                        <p className="text-[10px] text-emerald-700">
                          HP: {loggedInMember.telepon} • Poin: {loggedInMember.poin || 0} Poin
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleMemberLogout}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-3xs"
                    >
                      <LogOut className="w-3 h-3" />
                      Log Out
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-amber-800 font-bold">
                        Belum masuk akun member
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMemberModalOpen(true)}
                      className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      Login Member
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Lengkap <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      readOnly={Boolean(loggedInMember)}
                      placeholder="Contoh: Pak Budi / Bu Ani"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none ${
                        loggedInMember 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-red-500'
                      }`}
                    />
                    {loggedInMember && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Sesuai data akun member terdaftar.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nomor WhatsApp / HP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      readOnly={Boolean(loggedInMember)}
                      placeholder="Contoh: 081234567890"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none ${
                        loggedInMember 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-2 focus:ring-red-500'
                      }`}
                    />
                    {loggedInMember && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Sesuai nomor HP member terdaftar.</p>
                    )}
                  </div>

                  {deliveryType === 'Pesan Antar' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Alamat Pengiriman Lengkap <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Contoh: Jalan Merdeka No. 12, RT 02/05 (Rumah cat hijau pagar hitam)"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Catatan Tambahan (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Tolong pilihkan buah yang segar / titip di warung depan"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              </div>

              {/* PAYMENT METHOD */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Metode Pembayaran
                </h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'COD (Bayar di Tempat)', icon: DollarSign, label: 'COD (Tunai)' },
                    { id: 'QRIS', icon: QrCode, label: 'QRIS Toko' },
                    { id: 'Transfer Bank', icon: CreditCard, label: 'Transfer' },
                  ].map((pay) => {
                    const IconComp = pay.icon;
                    const isSelected = paymentMethod === pay.id;
                    return (
                      <button
                        key={pay.id}
                        type="button"
                        onClick={() => setPaymentMethod(pay.id as any)}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 shadow-3xs font-extrabold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                        <span className="text-[11px]">{pay.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PAYMENT TOTAL BREAKDOWN */}
              <div className="bg-slate-100 p-3 rounded-2xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Barang:</span>
                  <span className="font-bold">{formatRp(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Ongkos Kirim ({deliveryType}):</span>
                  <span className="font-bold">{formatRp(deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-slate-900 pt-1.5 border-t border-slate-200 text-sm font-black">
                  <span>TOTAL BAYAR:</span>
                  <span className="text-red-600">{formatRp(grandTotal)}</span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Pesanan Ke Toko</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ORDER PLACED SUCCESS MODAL */}
      {placedOrder && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                Pesanan Berhasil Dikirim!
              </h3>
              <p className="text-xs text-slate-500">
                No. Pesanan: <span className="font-mono font-bold text-red-600">{placedOrder.id}</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Pembeli:</span>
                <span className="font-bold text-slate-800">{placedOrder.namaPembeli} ({placedOrder.teleponPembeli})</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pengiriman:</span>
                <span className="font-bold text-slate-800">{placedOrder.tipePengiriman}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Bayar:</span>
                <span className="font-black text-red-600">{formatRp(placedOrder.totalBayar)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Metode Pembayaran:</span>
                <span className="font-bold text-slate-800">{placedOrder.metodePembayaran}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 text-left flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Silakan klik tombol di bawah untuk langsung mengonfirmasi pesanan Anda ke WhatsApp Kasir Toko SRC!
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={getWhatsAppMessageUrl(placedOrder)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Kirim Konfirmasi via WhatsApp Toko</span>
              </a>

              <button
                type="button"
                onClick={() => setPlacedOrder(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Selesai / Belanja Lagi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER VERIFICATION MODAL */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[210] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-left relative overflow-hidden">
            
            {/* CLOSE BUTTON (ONLY IF ALREADY LOGGED IN AS MEMBER) */}
            {loggedInMember && (
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  {config.namaToko || 'TOKO SRC'}
                </span>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Belanja Online Member
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-1">
                  Scan barcode / QR kartu member fisik Anda menggunakan kamera untuk keamanan akun terjamin, atau buat akun member baru.
                </p>
              </div>
            </div>

            {/* TAB SELECTOR: LOGIN VS REGISTER */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMemberModalTab('login');
                  setMemberLoginError(null);
                }}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  memberModalTab === 'login'
                    ? 'bg-white text-red-600 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>🔑 Masuk Member</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemberModalTab('register');
                  setMemberLoginError(null);
                  if (memberInput) {
                    if (/^\d+$/.test(memberInput.replace(/[^0-9]/g, ''))) {
                      setRegPhone(memberInput);
                    } else {
                      setRegNama(memberInput);
                    }
                  }
                }}
                className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  memberModalTab === 'register'
                    ? 'bg-white text-red-600 shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>📝 Daftar Member Baru</span>
              </button>
            </div>

            {/* ERROR MESSAGE */}
            {memberLoginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="font-semibold">{memberLoginError}</p>
                </div>
                {memberModalTab === 'login' && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMemberModalTab('register');
                        if (/^\d+$/.test(memberInput.replace(/[^0-9]/g, ''))) {
                          setRegPhone(memberInput);
                        } else {
                          setRegNama(memberInput);
                        }
                        setMemberLoginError(null);
                      }}
                      className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[11px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Daftar Akun Member Baru Sekarang</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: LOGIN (KAMERA SCAN BARCODE KARTU FISIK UNTUK PRIVASI & KEAMANAN) */}
            {memberModalTab === 'login' ? (
              <div className="space-y-4">
                {/* CLOUD CONNECTION STATUS BADGE */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-red-600" />
                    <span>Database Cloud Toko</span>
                  </span>
                  <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Tersambung
                  </span>
                </div>

                {/* CAMERA SCANNER */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                  <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                      Verifikasi Scan Fisik / QR Kartu
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Arahkan kamera ke Barcode atau QR Code pada Kartu Member fisik Anda untuk masuk dan cek poin belanja.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMemberLoginError(null);
                      setIsMemberCardScannerOpen(true);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-extrabold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Camera className="w-5 h-5 text-white animate-pulse" />
                    <span>Nyalakan Kamera &amp; Scan Barcode Member</span>
                  </button>
                </div>

                {/* PRIVACY PROTECTION BADGE */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-left text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>Privasi Member Terlindungi:</strong> Kolom pencarian publik dinonaktifkan demi menjaga kerahasiaan nomor WhatsApp dan data pribadi pelanggan. Akses login hanya dapat dibuka dengan memindai kartu fisik asli milik Anda.
                  </p>
                </div>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMemberModalTab('register');
                      setMemberLoginError(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Belum punya kartu member? <span className="text-red-600 font-extrabold underline">Daftar Akun Baru</span>
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: REGISTER NEW MEMBER */
              <form onSubmit={handleRegisterMemberSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                    Nama Lengkap Pembeli <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={regNama}
                      onChange={(e) => setRegNama(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                    Nomor HP / WhatsApp Aktif <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 081234567890"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>Daftar &amp; Langsung Belanja Online</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 1. DIGITAL MEMBER CARD MODAL */}
      {isDigitalCardOpen && loggedInMember && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4 text-center relative overflow-hidden border border-slate-100">
            <button
              type="button"
              onClick={() => setIsDigitalCardOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* CARD VIP BADGE */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-zinc-900 to-red-950 text-white shadow-xl relative overflow-hidden border border-amber-500/30 text-left space-y-4">
              <div className="absolute top-0 right-0 p-8 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-amber-400 uppercase block">
                    KARTU MEMBER VIP DIGITAL
                  </span>
                  <h3 className="font-extrabold text-sm text-white tracking-tight">
                    {config.namaToko || 'TOKO SRC MASNGUD'}
                  </h3>
                </div>
                <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-400/30">
                  <Award className="w-5 h-5 text-amber-400" />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                  Nama Member Terdaftar
                </span>
                <h4 className="text-base font-black text-amber-200 tracking-wide mt-0.5">
                  {loggedInMember.nama}
                </h4>
                <p className="text-xs text-slate-300 font-mono mt-0.5">
                  📱 {loggedInMember.telepon || '-'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">
                    ID Member
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-black font-mono text-sm text-white tracking-wider bg-white/10 px-2 py-0.5 rounded border border-white/20">
                      {formatDisplayMemberId(loggedInMember)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formatDisplayMemberId(loggedInMember));
                        setCopiedMemberId(true);
                        setTimeout(() => setCopiedMemberId(false), 2000);
                      }}
                      className="p-1 hover:bg-white/20 rounded text-amber-300 transition-colors cursor-pointer"
                      title="Salin ID Member"
                    >
                      {copiedMemberId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-400 uppercase font-extrabold block">
                    Poin Belanja
                  </span>
                  <span className="text-sm font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-lg border border-amber-400/30 inline-block mt-0.5">
                    ⭐ {loggedInMember.poin || 0} Poin
                  </span>
                </div>
              </div>
            </div>

            {/* BARCODE / QR CODE DISPLAY FOR POS SCANNING */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-center">
              <span className="text-[11px] font-black text-slate-700 block uppercase tracking-wider">
                Barcode / QR Kartu Member
              </span>
              <p className="text-[10px] text-slate-500">
                Tunjukkan ke Kasir Toko SRC saat bertransaksi langsung untuk langsung scan &amp; kumpulkan poin!
              </p>
              
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-inner inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(loggedInMember.id)}`}
                  alt="Member QR Code"
                  className="w-36 h-36 mx-auto"
                />
              </div>

              <span className="font-mono text-xs font-extrabold text-slate-800 block">
                {loggedInMember.id}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDigitalCardOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs transition-all cursor-pointer"
            >
              Tutup Kartu Digital
            </button>
          </div>
        </div>
      )}

      {/* 2. CAMERA SCANNER MODAL FOR PHYSICAL MEMBER CARDS */}
      {isMemberCardScannerOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[260] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-5 w-full max-w-sm text-center space-y-3 relative shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-red-600" />
                <span>Scan Barcode Kartu Member</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsMemberCardScannerOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Arahkan kamera ke Barcode atau QR Code pada Kartu Member fisik/digital Anda:
            </p>

            <div className="overflow-hidden rounded-2xl border-2 border-dashed border-red-300 bg-slate-950 min-h-[220px]">
              <CameraScanner
                onScanSuccess={async (code) => {
                  setIsMemberCardScannerOpen(false);
                  const cleanCode = (code || '').trim();
                  if (!cleanCode) return;

                  let matched = findMember(cleanCode);
                  if (!matched) {
                    setIsSearchingCloudMember(true);
                    try {
                      matched = await searchMemberInCloud(activeStoreId, cleanCode);
                      if (matched) {
                        setCloudPelanggan(prev => {
                          if (!prev.some(p => p.id === matched!.id)) {
                            return [...prev, matched!];
                          }
                          return prev;
                        });
                      }
                    } catch (e) {
                      console.warn(e);
                    } finally {
                      setIsSearchingCloudMember(false);
                    }
                  }

                  if (matched) {
                    handleMemberLoginSubmit(undefined, matched);
                  } else {
                    setMemberLoginError(`Barcode/QR "${cleanCode}" tidak terdaftar di database cloud toko.`);
                    setIsMemberModalOpen(true);
                  }
                }}
                onClose={() => setIsMemberCardScannerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ZOOMED PHOTO PREVIEW MODAL */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-3 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-white">
              <span className="font-bold text-xs truncate pr-2 text-slate-200">
                {zoomedImage.title}
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full bg-black rounded-xl overflow-hidden flex items-center justify-center p-2 min-h-[200px] max-h-[70vh]">
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[65vh] max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
      {/* FULLSCREEN PROMO BANNER PREVIEW MODAL */}
      {selectedPromoModal && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedPromoModal(null)}
        >
          <div 
            className="relative bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500 text-slate-950 rounded-xl">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="font-extrabold text-sm text-white truncate">
                  {selectedPromoModal.judul}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPromoModal(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 max-h-[60vh]">
              <img
                src={selectedPromoModal.imageUrl}
                alt={selectedPromoModal.judul}
                className="max-h-[58vh] w-full object-contain"
              />
            </div>

            {selectedPromoModal.deskripsi && (
              <p className="text-xs font-medium text-slate-300 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60 leading-relaxed">
                {selectedPromoModal.deskripsi}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleNavigateToPromoProduct(selectedPromoModal, true)}
                className="w-full sm:flex-1 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>⚡ Langsung Checkout (Beli Sekarang)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleNavigateToPromoProduct(selectedPromoModal, false)}
                className="w-full sm:flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🔍 Lihat Produk Lengkap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
