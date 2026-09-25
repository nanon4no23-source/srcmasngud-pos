import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ItemBarang, ConfigStruk, PesananOnline, DetailItemPesananOnline, Pelanggan, PromoBanner } from '../types';
import { 
  ShoppingBag, Search, X, Plus, Minus, Truck, Store, 
  CheckCircle2, AlertCircle, MessageCircle, Trash2,
  ChevronRight, ChevronLeft, QrCode, CreditCard, DollarSign, Send, Info,
  User, UserCheck, Key, LogOut, ShieldCheck, Award, Shield,
  Camera, Copy, Check, Sparkles, Tag, ArrowRight, ArrowUp, Loader2, Cloud,
  Clock, Package, RefreshCw, Receipt, RotateCcw, ExternalLink, Printer,
  CheckSquare, Square, ClipboardCheck, CloudOff, AlertTriangle, Megaphone, Eye
} from 'lucide-react';
import webOrderBannerImg from '../assets/web_order_banner.jpg';
import srcMasngudBannerImg from '../assets/src_masngud_banner.jpg';
import { SrcLogo } from './SrcLogo';
import CameraScanner from './CameraScanner';
import { prepareSearchIndex, searchProductsByPrefix } from '../utils/searchHelper';
import { 
  resolveStoreId, 
  listenToStoreForBuyer, 
  submitBuyerOrder, 
  registerBuyerMember, 
  searchMemberInCloud, 
  normalizePhone,
  listenToIncomingOnlineOrders,
  fetchPesananOnlineFromCloud
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
  onUpdateConfig?: (key: keyof ConfigStruk, value: any) => void;
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
  onUpdateConfig,
}) => {
  const activeStoreId = useMemo(() => storeId || resolveStoreId(), [storeId]);
  const [cloudBarang, setCloudBarang] = useState<ItemBarang[]>(initialBarang);
  const [cloudPelanggan, setCloudPelanggan] = useState<Pelanggan[]>(initialPelanggan);
  const [cloudConfig, setCloudConfig] = useState<ConfigStruk>(initialConfig);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSearchingCloudMember, setIsSearchingCloudMember] = useState<boolean>(false);

  // Monitor browser network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      setIsCloudConnected(true);
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setIsCloudConnected(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
  const [showManualLoginInput, setShowManualLoginInput] = useState<boolean>(false);

  // New states for Member ID features
  const [isDigitalCardOpen, setIsDigitalCardOpen] = useState(false);
  const [isMemberCardScannerOpen, setIsMemberCardScannerOpen] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState(false);

  // =========================================================================
  // MULTIPLE ADVERTISING BANNERS SYSTEM (IKLAN & PROMOSI TOKO DI PEMBELI)
  // =========================================================================
  // Multiple active advertisement banners for the carousel
  const activePromoBanners: PromoBanner[] = useMemo(() => {
    const fromConfig = Array.isArray(config?.promoBanners) ? config.promoBanners.filter(b => b.aktif && b.imageUrl) : [];
    if (fromConfig.length > 0) return fromConfig;

    // Default starter advertisement banners so multiple banners rotate right away!
    return [
      {
        id: 'starter-ad-1',
        judul: 'Belanja Mandiri Lebih Murah & Bebas Antre',
        deskripsi: 'Pesan kebutuhan harian langsung dari HP dengan harga hemat dan diskon toko.',
        imageUrl: webOrderBannerImg,
        aktif: true,
        kategoriBanner: 'Promo',
        linkKategori: 'Semua'
      },
      {
        id: 'starter-ad-2',
        judul: 'Promo Spesial & Poin Belanja Member Setia',
        deskripsi: 'Kumpulkan poin di setiap transaksi dan dapatkan potongan harga eksklusif khusus member.',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&auto=format&fit=crop&q=80',
        aktif: true,
        kategoriBanner: 'Promo',
        linkKategori: 'Semua'
      },
      {
        id: 'starter-ad-3',
        judul: 'Pesan Antar Cepat Langsung ke Rumah Anda',
        deskripsi: 'Belanja praktis tanpa repot keluar rumah, konfirmasi pesanan via WhatsApp kasir.',
        imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&auto=format&fit=crop&q=80',
        aktif: true,
        kategoriBanner: 'Iklan',
        linkKategori: 'Semua'
      }
    ];
  }, [config?.promoBanners]);

  // Daftar banner untuk header utama portal pembeli: banner resmi SRC MASNGUD + banner promo & iklan toko
  const portalHeaderBanners = useMemo(() => {
    const list: { id: string; judul: string; imageUrl: string; deskripsi?: string; kategoriBanner?: 'Promo' | 'Iklan' }[] = [
      {
        id: 'official-masngud-banner',
        judul: config.namaToko || 'SRC MASNGUD',
        imageUrl: srcMasngudBannerImg,
      },
      ...activePromoBanners
    ];
    return list;
  }, [activePromoBanners, config.namaToko]);

  const [portalBannerIndex, setPortalBannerIndex] = useState(0);

  // Auto rotate portal header banners every 4.5 seconds
  useEffect(() => {
    if (portalHeaderBanners.length <= 1) return;
    const timer = setInterval(() => {
      setPortalBannerIndex((prev) => (prev + 1) % portalHeaderBanners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [portalHeaderBanners.length]);

  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [selectedPromoModal, setSelectedPromoModal] = useState<any>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // Auto rotate banners every 4.5 seconds
  useEffect(() => {
    if (activePromoBanners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % activePromoBanners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [activePromoBanners.length]);

  // Helper to handle banner navigation & direct checkout
  const handleNavigateToPromoProduct = (banner: any, autoCheckout = false) => {
    if (!banner) return;
    setIsMemberModalOpen(false);

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
      setOrderToastMessage(`🎉 Selamat datang, ${target.nama}!`);
      setTimeout(() => setOrderToastMessage(null), 3000);
    } else {
      setMemberLoginError(`Nomor HP / ID Member / Nama "${memberInput}" belum ditemukan. Silakan periksa kembali atau gunakan tab "Daftar Member Baru".`);
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

  // Status Pesanan Saya & Riwayat Pesanan States
  const [cloudOrders, setCloudOrders] = useState<PesananOnline[]>(() => {
    const list: PesananOnline[] = [...(existingOrders || [])];
    if (typeof window !== 'undefined') {
      try {
        const savedFullStr = localStorage.getItem('src_online_placed_orders_full');
        if (savedFullStr) {
          const arr = JSON.parse(savedFullStr);
          if (Array.isArray(arr)) {
            arr.forEach((o: PesananOnline) => {
              if (o && o.id && !list.some(item => item.id === o.id)) {
                list.push(o);
              }
            });
          }
        }
      } catch (e) {}
    }
    return list;
  });
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState<boolean>(false);
  const [orderFilterTab, setOrderFilterTab] = useState<'semua' | 'aktif' | 'selesai' | 'dibatalkan' | 'offline'>('semua');
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<PesananOnline | null>(null);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState<boolean>(false);
  const [orderSearchLookup, setOrderSearchLookup] = useState<string>('');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [orderToastMessage, setOrderToastMessage] = useState<string | null>(null);

  // Set of order IDs verified directly from Cloud Firestore
  const [confirmedCloudOrderIds, setConfirmedCloudOrderIds] = useState<Set<string>>(() => new Set());
  const confirmedCloudOrderIdsRef = useRef<Set<string>>(new Set());
  // Tracking per-order retry sync progress
  const [syncingOrderIds, setSyncingOrderIds] = useState<Record<string, boolean>>({});
  const [isSyncingAllPending, setIsSyncingAllPending] = useState<boolean>(false);

  // Background Sync Engine: Scans localStorage and pushes any unsynced offline orders to Firestore Cloud
  const syncAllPendingOrders = useCallback(async (forced = false) => {
    if (typeof window === 'undefined' || !activeStoreId) return;

    let savedOrders: PesananOnline[] = [];
    try {
      const raw = localStorage.getItem('src_online_placed_orders_full');
      if (raw) savedOrders = JSON.parse(raw);
    } catch (e) {}

    if (!savedOrders || savedOrders.length === 0) return;

    // Filter orders that have not been confirmed in cloud
    const pendingOrders = savedOrders.filter(o => {
      if (!o || !o.id) return false;
      // If already verified in cloud, no need to push
      if (confirmedCloudOrderIdsRef.current.has(o.id)) return false;
      // If marked as synced and not forced, skip
      if (o.syncStatus === 'synced' && !forced) return false;
      return true;
    });

    if (pendingOrders.length === 0) return;

    setIsSyncingAllPending(true);
    let newlySyncedCount = 0;

    for (const order of pendingOrders) {
      try {
        const ok = await submitBuyerOrder(activeStoreId, order);
        if (ok) {
          newlySyncedCount++;
          confirmedCloudOrderIdsRef.current.add(order.id);
          setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));
          order.syncStatus = 'synced';
          order.syncedAt = new Date().toISOString();
          order.lastSyncError = undefined;
        } else {
          order.syncStatus = 'failed';
          order.lastSyncError = 'Jaringan belum terhubung ke cloud kasir';
        }
      } catch (err) {
        order.syncStatus = 'failed';
      }
    }

    // Save updated syncStatus back to localStorage
    try {
      localStorage.setItem('src_online_placed_orders_full', JSON.stringify(savedOrders));
    } catch (e) {}

    // Update cloudOrders state so UI reflects synced status immediately
    setCloudOrders(prev => {
      const map = new Map<string, PesananOnline>();
      prev.forEach(o => map.set(o.id, o));
      savedOrders.forEach(o => {
        const existing = map.get(o.id);
        if (existing) {
          map.set(o.id, { ...existing, syncStatus: o.syncStatus, syncedAt: o.syncedAt });
        } else {
          map.set(o.id, o);
        }
      });
      return Array.from(map.values()).sort((a, b) => {
        const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
        const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
        return timeB - timeA;
      });
    });

    setIsSyncingAllPending(false);

    if (newlySyncedCount > 0) {
      setOrderToastMessage(`✅ ${newlySyncedCount} pesanan offline berhasil terkirim ke kasir toko!`);
      setTimeout(() => setOrderToastMessage(null), 4000);
    }
  }, [activeStoreId]);

  // Single order retry push to cloud
  const handleRetrySyncOrder = async (order: PesananOnline) => {
    if (!order || !order.id || syncingOrderIds[order.id]) return;
    setSyncingOrderIds(prev => ({ ...prev, [order.id]: true }));
    try {
      const ok = await submitBuyerOrder(activeStoreId, order);
      if (ok) {
        confirmedCloudOrderIdsRef.current.add(order.id);
        setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

        // Update in localStorage
        try {
          const raw = localStorage.getItem('src_online_placed_orders_full');
          if (raw) {
            const list: PesananOnline[] = JSON.parse(raw);
            const idx = list.findIndex(o => o.id === order.id);
            if (idx !== -1) {
              list[idx].syncStatus = 'synced';
              list[idx].syncedAt = new Date().toISOString();
              list[idx].lastSyncError = undefined;
              localStorage.setItem('src_online_placed_orders_full', JSON.stringify(list));
            }
          }
        } catch (e) {}

        // Update state
        setCloudOrders(prev => prev.map(o => o.id === order.id ? { ...o, syncStatus: 'synced', syncedAt: new Date().toISOString() } : o));
        setOrderToastMessage(`✅ Pesanan #${order.id} berhasil terkirim ke kasir toko!`);
      } else {
        setOrderToastMessage(`⚠️ Gagal mengirim ke kasir. Periksa koneksi internet Anda lalu coba lagi.`);
      }
    } catch (e) {
      setOrderToastMessage(`⚠️ Error koneksi: Gagal mengirim pesanan ke cloud kasir.`);
    } finally {
      setSyncingOrderIds(prev => ({ ...prev, [order.id]: false }));
      setTimeout(() => setOrderToastMessage(null), 3500);
    }
  };

  // Crosscheck verification state for checking off items upon pickup or delivery
  const [crosscheckedItems, setCrosscheckedItems] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('src_buyer_crosscheck_items');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const toggleCrosscheckItem = (orderId: string, itemIdx: number) => {
    const key = `${orderId}_${itemIdx}`;
    setCrosscheckedItems(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('src_buyer_crosscheck_items', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const markAllOrderCrosschecked = (orderId: string, itemsCount: number, status: boolean) => {
    setCrosscheckedItems(prev => {
      const next = { ...prev };
      for (let i = 0; i < itemsCount; i++) {
        next[`${orderId}_${i}`] = status;
      }
      try {
        localStorage.setItem('src_buyer_crosscheck_items', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Real-time Cloud Listener for Online Orders so buyer status stays 100% in sync with Cashier
  useEffect(() => {
    if (!activeStoreId) return;

    // 1. Snapshot Listener
    const unsub = listenToIncomingOnlineOrders([activeStoreId], (incomingList) => {
      if (incomingList && incomingList.length > 0) {
        incomingList.forEach(o => {
          if (o?.id) confirmedCloudOrderIdsRef.current.add(o.id);
        });
        setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

        setCloudOrders(prev => {
          const map = new Map<string, PesananOnline>();
          prev.forEach(o => map.set(o.id, o));
          incomingList.forEach(o => map.set(o.id, o));
          return Array.from(map.values()).sort((a, b) => {
            const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
            const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
            return timeB - timeA;
          });
        });

        // Trigger sweeper for any remaining offline orders
        syncAllPendingOrders();
      }
    });

    // 2. Immediate on-demand fetch
    fetchPesananOnlineFromCloud([activeStoreId]).then((fetched) => {
      if (fetched && fetched.length > 0) {
        fetched.forEach(o => {
          if (o?.id) confirmedCloudOrderIdsRef.current.add(o.id);
        });
        setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

        setCloudOrders(prev => {
          const map = new Map<string, PesananOnline>();
          prev.forEach(o => map.set(o.id, o));
          fetched.forEach(o => map.set(o.id, o));
          return Array.from(map.values()).sort((a, b) => {
            const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
            const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
            return timeB - timeA;
          });
        });

        // Automatically push any local orders that cloud doesn't have yet
        syncAllPendingOrders();
      }
    }).catch(e => console.warn('Fetch online orders initial error:', e));

    // 3. Heartbeat polling every 15 seconds to ensure synchronization even in restrictive webviews
    const interval = setInterval(() => {
      fetchPesananOnlineFromCloud([activeStoreId]).then((fresh) => {
        if (fresh && fresh.length > 0) {
          fresh.forEach(o => {
            if (o?.id) confirmedCloudOrderIdsRef.current.add(o.id);
          });
          setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

          setCloudOrders(prev => {
            const map = new Map<string, PesananOnline>();
            prev.forEach(o => map.set(o.id, o));
            fresh.forEach(o => map.set(o.id, o));
            return Array.from(map.values()).sort((a, b) => {
              const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
              const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
              return timeB - timeA;
            });
          });

          // Check if any local orders need to be pushed
          syncAllPendingOrders();
        }
      }).catch(() => {});
    }, 15000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [activeStoreId, syncAllPendingOrders]);

  // Online network event listener: immediately trigger sync when internet reconnects
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Koneksi internet kembali aktif, menyinkronkan pesanan offline...');
      syncAllPendingOrders(true);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAllPendingOrders]);

  // Auto sync whenever order history modal is opened
  useEffect(() => {
    if (isOrderHistoryOpen) {
      syncAllPendingOrders();
    }
  }, [isOrderHistoryOpen, syncAllPendingOrders]);

  // Keep synced with incoming props if changed
  useEffect(() => {
    if (existingOrders && existingOrders.length > 0) {
      existingOrders.forEach(o => {
        if (o?.id) confirmedCloudOrderIdsRef.current.add(o.id);
      });
      setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

      setCloudOrders(prev => {
        const map = new Map<string, PesananOnline>();
        prev.forEach(o => map.set(o.id, o));
        existingOrders.forEach(o => map.set(o.id, o));
        return Array.from(map.values()).sort((a, b) => {
          const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
          const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
          return timeB - timeA;
        });
      });
    }
  }, [existingOrders]);

  // Handle Manual Refresh of Orders
  const handleRefreshOrders = async () => {
    setIsRefreshingOrders(true);
    try {
      const fresh = await fetchPesananOnlineFromCloud([activeStoreId]);
      if (fresh && fresh.length > 0) {
        fresh.forEach(o => {
          if (o?.id) confirmedCloudOrderIdsRef.current.add(o.id);
        });
        setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));

        setCloudOrders(prev => {
          const map = new Map<string, PesananOnline>();
          prev.forEach(o => map.set(o.id, o));
          fresh.forEach(o => map.set(o.id, o));
          return Array.from(map.values()).sort((a, b) => {
            const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
            const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
            return timeB - timeA;
          });
        });
      }

      // Also force-sync any local offline orders to cloud
      await syncAllPendingOrders(true);
      setOrderToastMessage('✅ Data pesanan berhasil diperbarui & disinkronkan ke kasir!');
    } catch (e) {
      console.warn('Refresh orders error:', e);
      setOrderToastMessage('⚠️ Gagal menyegarkan status pesanan. Periksa koneksi internet.');
    } finally {
      setTimeout(() => {
        setIsRefreshingOrders(false);
        setTimeout(() => setOrderToastMessage(null), 3000);
      }, 600);
    }
  };

  // Re-order items back into cart
  const handleReorderItems = (order: PesananOnline) => {
    let addedCount = 0;
    const newCart = { ...cartItems };

    order.items.forEach((item) => {
      const prod = barang.find(b => b.id === item.itemId || b.nama.toLowerCase().trim() === item.nama.toLowerCase().trim());
      if (prod) {
        const existingCartItem = newCart[prod.id];
        const currentQty = existingCartItem?.qty || 0;
        newCart[prod.id] = {
          qty: currentQty + (item.qty || 1),
          selectedUnitId: item.unitId || existingCartItem?.selectedUnitId
        };
        addedCount += (item.qty || 1);
      }
    });

    if (addedCount > 0) {
      setCartItems(newCart);
      setOrderToastMessage(`🛒 Berhasil menambahkan ${addedCount} barang ke keranjang belanja!`);
      setTimeout(() => setOrderToastMessage(null), 3000);
      setIsOrderHistoryOpen(false);
      setIsCartOpen(true);
    } else {
      setOrderToastMessage('⚠️ Produk dari pesanan ini sedang tidak ada di katalog.');
      setTimeout(() => setOrderToastMessage(null), 3000);
    }
  };

  // Generate Inquiry WhatsApp Message for an order
  const getOrderInquiryWhatsAppUrl = (order: PesananOnline) => {
    const rawPhone = config.noHp || '085876315801';
    let formattedPhone = rawPhone.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    const isOfflinePending = !confirmedCloudOrderIds.has(order.id) && order.syncStatus !== 'synced';
    const itemsSummary = (order.items || []).map((it, idx) => 
      `${idx + 1}. ${it.nama} (${it.qty} ${it.satuanNama || 'pcs'}) = ${formatRp(it.subtotal || (it.jual || 0) * it.qty)}`
    ).join('\n');

    const message = `Halo ${config.namaToko || 'Toko SRC'} 🙏
Saya *${order.namaPembeli}* (${loggedInMember ? `Member: ${formatDisplayMemberId(loggedInMember)}` : `No. HP: ${order.teleponPembeli}`}).

${isOfflinePending ? '⚠️ *Konfirmasi Pesanan Baru (Tersimpan di HP / Offline):*' : 'Ingin menanyakan status pesanan online saya:'}
🧾 *No. Pesanan:* #${order.id}
⏰ *Waktu Pesan:* ${order.waktu || order.waktuPesan || '-'}
📦 *Status di Sistem:* ${order.status}
💰 *Total Bayar:* ${formatRp(order.totalBayar)}
🚚 *Pengiriman:* ${order.tipePengiriman}${order.alamatPembeli ? ` (${order.alamatPembeli})` : ''}
${order.catatan ? `📝 *Catatan:* ${order.catatan}\n` : ''}
🛒 *Daftar Barang Belanja:*
${itemsSummary || '-'}

${isOfflinePending ? 'Pesanan ini saya buat saat jaringan offline, mohon bantu cek dan proses ya kak. Terima kasih! 🙏' : 'Apakah pesanan saya sudah selesai diproses dan siap dikirim / diambil? Terima kasih! 🙏'}`;

    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  };

  // Accessible Buyer & Member Orders (Strictly isolated by member account)
  const buyerOrders = useMemo(() => {
    const map = new Map<string, PesananOnline>();

    // 1. Local saved full orders from device
    if (typeof window !== 'undefined') {
      try {
        const savedFullStr = localStorage.getItem('src_online_placed_orders_full');
        if (savedFullStr) {
          const arr = JSON.parse(savedFullStr);
          if (Array.isArray(arr)) {
            arr.forEach((o: PesananOnline) => {
              if (o && o.id) map.set(o.id, o);
            });
          }
        }
      } catch (e) {}
    }

    // 2. Cloud and prop orders from store
    (cloudOrders || []).forEach(o => {
      if (o && o.id) map.set(o.id, o);
    });

    const allList = Array.from(map.values());

    // 3. Filter strictly by member ownership (no other member's orders can ever leak)
    const memberFiltered = allList.filter(o => {
      if (!o) return false;

      // When logged in as Member: ONLY show orders belonging to this member!
      if (loggedInMember) {
        const currentMemberId = (loggedInMember.id || '').trim().toLowerCase();
        const currentDisplayId = formatDisplayMemberId(loggedInMember).trim().toLowerCase();
        const currentMemberName = (loggedInMember.nama || '').trim().toLowerCase();
        const currentMemberPhone = normalizePhone(loggedInMember.telepon || '');

        // Check if order has explicit memberId
        if (o.memberId) {
          const oMid = o.memberId.trim().toLowerCase();
          if (oMid === currentMemberId || oMid === currentDisplayId) return true;
          // Belongs to a different member account!
          return false;
        }

        // Check if order has explicit idMember
        if (o.idMember) {
          const oIdM = o.idMember.trim().toLowerCase();
          if (oIdM === currentMemberId || oIdM === currentDisplayId || oIdM.includes(currentMemberId)) return true;
          // Belongs to a different member account!
          return false;
        }

        // Check buyer name: MUST match current logged in member's name!
        const oBuyerName = (o.namaPembeli || '').trim().toLowerCase();
        if (currentMemberName && oBuyerName) {
          if (oBuyerName === currentMemberName) return true;
          // Explicitly different name (e.g. Lionel vs Tamir masjid) -> REJECT!
          return false;
        }

        // Check phone if member has valid phone (>= 6 digits)
        if (currentMemberPhone && currentMemberPhone.length >= 6 && o.teleponPembeli) {
          const oPhone = normalizePhone(o.teleponPembeli);
          if (oPhone && (oPhone === currentMemberPhone || oPhone.endsWith(currentMemberPhone.slice(-8)) || currentMemberPhone.endsWith(oPhone.slice(-8)))) {
            if (!oBuyerName || oBuyerName === currentMemberName) {
              return true;
            }
          }
        }

        // Strictly do not show other people's orders
        return false;
      }

      // When NOT logged in as member (Guest / Tamu):
      // Must not belong to any registered member account
      if (o.memberId || o.idMember) {
        return false;
      }

      // Show guest orders placed on this specific device
      let localSavedIds = new Set<string>();
      if (typeof window !== 'undefined') {
        try {
          const savedIdsStr = localStorage.getItem('src_online_placed_order_ids');
          if (savedIdsStr) {
            const arr = JSON.parse(savedIdsStr);
            if (Array.isArray(arr)) arr.forEach(id => localSavedIds.add(id));
          }
        } catch (e) {}
      }

      if (localSavedIds.has(o.id)) return true;

      return false;
    });

    // 4. Apply search query lookup ONLY on the member's own filtered orders!
    const lookupQuery = orderSearchLookup.trim().toLowerCase();
    const cleanLookupPhone = normalizePhone(orderSearchLookup);

    let resultList = memberFiltered;
    if (lookupQuery) {
      resultList = memberFiltered.filter(o => {
        // Search by No. Pesanan
        if (o.id && o.id.toLowerCase().includes(lookupQuery)) return true;
        // Search by Nama Barang
        if (o.items && o.items.some(it => it.nama.toLowerCase().includes(lookupQuery))) return true;
        // Search by Status Pesanan
        if (o.status && o.status.toLowerCase().includes(lookupQuery)) return true;
        // Search by Tanggal / Waktu
        if ((o.waktu || o.waktuPesan || '').toLowerCase().includes(lookupQuery)) return true;
        // Search by Catatan
        if (o.catatan && o.catatan.toLowerCase().includes(lookupQuery)) return true;
        // Search by No. HP jika cocok
        if (o.teleponPembeli && cleanLookupPhone && normalizePhone(o.teleponPembeli).includes(cleanLookupPhone)) return true;
        return false;
      });
    }

    return resultList.sort((a, b) => {
      const timeA = a.timestamp || new Date(a.waktuPesan || a.waktu || 0).getTime() || 0;
      const timeB = b.timestamp || new Date(b.waktuPesan || b.waktu || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [loggedInMember, cloudOrders, orderSearchLookup]);

  const activeOrdersCount = useMemo(() => {
    return buyerOrders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan').length;
  }, [buyerOrders]);

  const unsyncedBuyerOrders = useMemo(() => {
    return buyerOrders.filter(o => {
      if (!o || !o.id) return false;
      if (o.status === 'Selesai' || o.status === 'Dibatalkan') return false;
      return !confirmedCloudOrderIds.has(o.id) && o.syncStatus !== 'synced';
    });
  }, [buyerOrders, confirmedCloudOrderIds]);

  const unsyncedOrdersCount = unsyncedBuyerOrders.length;

  const filteredOrders = useMemo(() => {
    if (orderFilterTab === 'aktif') {
      return buyerOrders.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan');
    }
    if (orderFilterTab === 'selesai') {
      return buyerOrders.filter(o => o.status === 'Selesai');
    }
    if (orderFilterTab === 'dibatalkan') {
      return buyerOrders.filter(o => o.status === 'Dibatalkan');
    }
    if (orderFilterTab === 'offline') {
      return buyerOrders.filter(o => !confirmedCloudOrderIds.has(o.id) && o.syncStatus !== 'synced');
    }
    return buyerOrders;
  }, [buyerOrders, orderFilterTab, confirmedCloudOrderIds]);

  const isStoreOpen = config.tokoOnlineAktif !== false; // Default true unless explicitly closed
  // Disguised store online/offline status (replaces technical database cloud status)
  const isOnlineStatus = isBrowserOnline && isCloudConnected && isStoreOpen;

  const storeOperatingHours = useMemo(() => {
    return (config as any)?.jamBuka || (config as any)?.jamOperasional || '07:00 - 21:00 WIB';
  }, [config]);

  const whatsappNumber = useMemo(() => {
    const raw = config.nomorWaToko || config.noHp || config.karyawan1 || '085876315801';
    let formatted = raw.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.slice(1);
    }
    return formatted;
  }, [config.nomorWaToko, config.noHp, config.karyawan1]);

  const displayWhatsAppNumber = useMemo(() => {
    return config.nomorWaToko || config.noHp || config.karyawan1 || '0858-7631-5801';
  }, [config.nomorWaToko, config.noHp, config.karyawan1]);

  const whatsappOrderGeneralUrl = useMemo(() => {
    const nama = loggedInMember ? loggedInMember.nama : (customerName || 'Pelanggan');
    const msg = `Halo ${config.namaToko || 'Toko SRC'} 🙏\nSaya *${nama}* ingin memesan belanjaan online via WhatsApp toko. Mohon informasi ketersediaan barang ya Kak, terima kasih!`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(msg)}`;
  }, [whatsappNumber, config.namaToko, loggedInMember, customerName]);

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
    // 1. Jika pembeli belum login (berada di halaman utama portal pembeli):
    if (!loggedInMember) {
      if (isMemberCardScannerOpen || memberModalTab === 'register') {
        try {
          window.history.pushState({ modalOpen: true }, '');
        } catch (e) {}
      }

      const handlePopStateAuth = () => {
        // Jika scanner kamera terbuka -> tutup scanner dan kembali ke portal login
        if (isMemberCardScannerOpen) {
          setIsMemberCardScannerOpen(false);
          return;
        }
        // Jika sedang di tab pendaftaran -> kembali ke tab login
        if (memberModalTab === 'register') {
          setMemberModalTab('login');
          return;
        }
        // Di tab login utama: pertahankan halaman portal pembeli (cegah pembeli masuk ke katalog toko)
        try {
          window.history.pushState({ modalOpen: true }, '');
        } catch (e) {}
      };

      window.addEventListener('popstate', handlePopStateAuth);
      return () => window.removeEventListener('popstate', handlePopStateAuth);
    }

    // 2. Jika sudah login member:
    const isAnyModalOpen = isCartOpen || !!selectedPromoModal || isDigitalCardOpen || isOrderHistoryOpen || !!selectedOrderForReceipt || !!zoomedImage;

    if (isAnyModalOpen) {
      try {
        window.history.pushState({ modalOpen: true }, '');
      } catch (e) {}
    }

    const handlePopState = () => {
      if (zoomedImage) { setZoomedImage(null); return; }
      if (selectedOrderForReceipt) { setSelectedOrderForReceipt(null); return; }
      if (isOrderHistoryOpen) { setIsOrderHistoryOpen(false); return; }
      if (isCartOpen) { setIsCartOpen(false); return; }
      if (selectedPromoModal) { setSelectedPromoModal(null); return; }
      if (isDigitalCardOpen) { setIsDigitalCardOpen(false); return; }

      // If scrolled down deep in products list -> scroll back up to top header
      if (window.scrollY > 120) {
        scrollToTopHeader();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    loggedInMember,
    isCartOpen,
    selectedPromoModal,
    isDigitalCardOpen,
    isMemberCardScannerOpen,
    memberModalTab,
    isOrderHistoryOpen,
    selectedOrderForReceipt,
    zoomedImage
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
      waktuPesan: new Date().toISOString(),
      timestamp: Date.now(),
      namaPembeli: finalName,
      teleponPembeli: finalPhone,
      alamatPembeli: deliveryType === 'Pesan Antar' ? customerAddress.trim() : undefined,
      alamatPengiriman: deliveryType === 'Pesan Antar' ? customerAddress.trim() : undefined,
      tipePengiriman: deliveryType,
      opsiPengambilan: deliveryType,
      catatan: orderNotes.trim() || undefined,
      catatanPembeli: orderNotes.trim() || undefined,
      items: itemsPayload,
      totalHarga: cartSubtotal,
      ongkir: deliveryFee,
      totalBayar: grandTotal,
      metodePembayaran: paymentMethod,
      status: 'Menunggu Konfirmasi',
      memberId: loggedInMember?.id,
      idMember: loggedInMember ? formatDisplayMemberId(loggedInMember) : undefined,
      syncStatus: 'pending'
    };

    onPlaceOrder(newOrder);
    setPlacedOrder(newOrder);
    setCloudOrders(prev => [newOrder, ...prev.filter(o => o.id !== newOrder.id)]);

    // Save to local storage first so the order is never lost even if network fails
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

    // Push order to Firestore Cloud database so Cashier APK receives it immediately
    submitBuyerOrder(activeStoreId, newOrder).then((success) => {
      if (success) {
        console.log('✅ Pesanan online berhasil terkirim ke Cloud Firestore:', newOrder.id);
        confirmedCloudOrderIdsRef.current.add(newOrder.id);
        setConfirmedCloudOrderIds(new Set(confirmedCloudOrderIdsRef.current));
        newOrder.syncStatus = 'synced';
        newOrder.syncedAt = new Date().toISOString();

        // Update in localStorage
        try {
          const savedFullStr = localStorage.getItem('src_online_placed_orders_full');
          const savedFull: PesananOnline[] = savedFullStr ? JSON.parse(savedFullStr) : [];
          const idx = savedFull.findIndex(o => o.id === newOrder.id);
          if (idx !== -1) {
            savedFull[idx] = { ...savedFull[idx], syncStatus: 'synced', syncedAt: newOrder.syncedAt };
            localStorage.setItem('src_online_placed_orders_full', JSON.stringify(savedFull));
          }
        } catch (e) {}

        // Update state
        setCloudOrders(prev => prev.map(o => o.id === newOrder.id ? { ...o, syncStatus: 'synced', syncedAt: newOrder.syncedAt } : o));
      } else {
        console.warn('⚠️ Peringatan: Pesanan tersimpan lokal di HP, akan otomatis dikirim saat jaringan online.');
      }
      // Trigger sync sweeper to also push any previously pending offline orders!
      syncAllPendingOrders();
    }).catch(err => {
      console.warn('⚠️ Peringatan pengiriman pesanan cloud:', err);
      syncAllPendingOrders();
    });

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

  // =========================================================================
  // JIKA PEMBELI BELUM LOGIN MEMBER:
  // Tampilkan HANYA Halaman Utama Portal Pembeli (Login & Pendaftaran Member)
  // Menjaga privasi data dan 100% mencegah pembeli masuk ke tampilan katalog toko tanpa autentikasi!
  // =========================================================================
  if (!loggedInMember) {
    return (
      <div className="min-h-screen bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans antialiased">
        <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center relative overflow-hidden border border-slate-100 my-auto">
          {/* FOTO BANNER UTAMA PORTAL PEMBELI: BANNER RESMI SRC MASNGUD & BANNER PROMO / IKLAN (SAMA POSISI) */}
          <div className="w-full overflow-hidden rounded-2xl border border-red-100 shadow-md bg-white relative group">
            <div className="relative w-full h-36 sm:h-44 overflow-hidden">
              {portalHeaderBanners.map((banner, idx) => {
                if (idx !== portalBannerIndex) return null;
                return (
                  <div key={banner.id} className="w-full h-full relative">
                    <img
                      src={banner.imageUrl}
                      alt={banner.judul || 'Banner Toko'}
                      className="w-full h-full object-cover object-center"
                      referrerPolicy="no-referrer"
                    />

                    {/* Lencana kategori jika banner promo / iklan (tanpa tombol langsung checkout, lihat produk, perbesar) */}
                    {banner.kategoriBanner && (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm text-white flex items-center gap-1 ${
                          banner.kategoriBanner === 'Iklan' ? 'bg-blue-600' : 'bg-rose-600'
                        }`}>
                          {banner.kategoriBanner === 'Iklan' ? (
                            <>
                              <Megaphone className="w-2.5 h-2.5" />
                              <span>IKLAN</span>
                            </>
                          ) : (
                            <>
                              <Tag className="w-2.5 h-2.5" />
                              <span>PROMO</span>
                            </>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* NAVIGASI PANAH JIKA LEBIH DARI 1 BANNER */}
              {portalHeaderBanners.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPortalBannerIndex((prev) => (prev - 1 + portalHeaderBanners.length) % portalHeaderBanners.length)}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Banner Sebelumnya"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalBannerIndex((prev) => (prev + 1) % portalHeaderBanners.length)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                    title="Banner Berikutnya"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* INDIKATOR TITIK (DOTS) */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-xs">
                    {portalHeaderBanners.map((b, i) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setPortalBannerIndex(i)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          i === portalBannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* HEADER YUK BELANJA ONLINE SRC MASNGUD DEKAT HEMAT DAN BERSAHABAT SEPERTI HEADER KATALOG */}
          <div className="bg-gradient-to-r from-red-700 via-rose-600 to-red-700 text-white rounded-2xl py-3 px-3 sm:px-4 shadow-sm text-center">
            {/* LENCANA YUK BELANJA ONLINE */}
            <div className="flex items-center justify-center mb-1.5">
              <span className="bg-white text-red-700 font-black text-[10px] sm:text-[11px] px-3 py-0.5 rounded-md tracking-wider uppercase shadow-3xs flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Yuk Belanja Online</span>
              </span>
            </div>

            {/* LOGO TAS BELANJA & PENULISAN SRC MASNGUD SEPERTI HEADER KASIR & KATALOG */}
            <div className="flex flex-row items-center justify-center gap-2 sm:gap-2.5">
              <div className="shrink-0 flex items-center h-7 sm:h-8">
                <SrcLogo className="h-7 sm:h-8 w-auto" whiteVariant={true} />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white flex items-center h-7 sm:h-8 uppercase">
                {(() => {
                  const rawName = (config.namaToko || 'MASNGUD').trim();
                  if (rawName.toUpperCase().startsWith('SRC ')) {
                    return rawName.substring(4).trim();
                  }
                  return rawName;
                })()}
              </h2>
            </div>

            {/* SLOGAN SEPERTI HEADER KASIR & KATALOG */}
            <p className="text-[9px] sm:text-xs text-white font-bold uppercase tracking-widest mt-1">
              Dekat Hemat dan Bersahabat
            </p>

            {/* ALAMAT & NOMOR TOKO */}
            <p className="text-[10.5px] sm:text-xs text-red-100 opacity-90 mt-0.5 max-w-xs mx-auto line-clamp-1">
              {config.alamatToko || 'Jl.Suhada 2/3 Kebakalan 085850051070'}
            </p>
          </div>

          {/* STATUS PILL BAR: JAM BUKA 07.00 - 21.00 & ONLINE */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-3xs text-left">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs font-extrabold text-slate-700">Jam Buka 07.00 - 21.00</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
              isOnlineStatus 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isOnlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{isOnlineStatus ? 'Online' : 'Offline'}</span>
            </div>
          </div>

          {/* ERROR MESSAGE IF ANY */}
          {memberLoginError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{memberLoginError}</span>
            </div>
          )}

          {/* TAB 1: LOGIN (CAMERA SCAN PRIMARY AS IN SCREENSHOT) */}
          {memberModalTab === 'login' ? (
            <div className="space-y-4">
              {/* WHITE CARD FOR PHYSICAL / QR SCAN */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs text-center space-y-3.5">
                <div className="w-16 h-16 rounded-2xl bg-red-100/90 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                  <QrCode className="w-9 h-9" />
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                    VERIFIKASI SCAN FISIK / QR KARTU
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Arahkan kamera ke Barcode atau QR Code pada Kartu Member fisik Anda untuk masuk dan cek poin belanja.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMemberCardScannerOpen(true)}
                  className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Nyalakan Kamera &amp; Scan Barcode Member</span>
                </button>

                {/* TOGGLE FOR MANUAL INPUT (FALLBACK WITHOUT CAM) */}
                <div className="pt-1">
                  {!showManualLoginInput ? (
                    <button
                      type="button"
                      onClick={() => setShowManualLoginInput(true)}
                      className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Atau masukkan No. HP / ID Member manual ▾
                    </button>
                  ) : (
                    <form onSubmit={handleMemberLoginSubmit} className="space-y-2 pt-2 border-t border-slate-100 text-left">
                      <label className="block text-[11px] font-extrabold text-slate-700">
                        Ketik No. HP / ID Member / Barcode Kartu:
                      </label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Contoh: 081234567890 atau MBR-001"
                          value={memberInput}
                          onChange={(e) => setMemberInput(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white placeholder:text-slate-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSearchingCloudMember}
                        className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSearchingCloudMember ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Mencari Akun...</span>
                          </>
                        ) : (
                          <span>Masuk Manual</span>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* BOTTOM FOOTER NAVIGATION */}
              <div className="text-center pt-2">
                <span className="text-xs font-semibold text-slate-500">Belum punya kartu member? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMemberModalTab('register');
                    setMemberLoginError(null);
                  }}
                  className="text-xs font-black text-red-600 hover:underline cursor-pointer"
                >
                  Daftar Akun Baru
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: REGISTER MEMBER BARU */
            <div className="space-y-4 text-left">
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider text-center border-b border-slate-100 pb-2">
                  PENDAFTARAN MEMBER BARU
                </h4>

                <form onSubmit={handleRegisterMemberSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Nama Lengkap Pembeli <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={regNama}
                        onChange={(e) => setRegNama(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Nomor HP / WhatsApp Aktif <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="tel"
                        required
                        placeholder="Contoh: 081234567890"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Nomor WhatsApp digunakan untuk konfirmasi status pesanan dan klaim poin belanja.
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Daftar &amp; Langsung Belanja Online</span>
                  </button>
                </form>
              </div>

              {/* GREEN NOTICE BOX FOR NEW MEMBERS */}
              <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-left flex items-start gap-2.5 shadow-3xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="font-black text-emerald-950">Keuntungan Member: </span>
                  <span>Dapatkan poin belanja di setiap pesanan online yang dapat ditukar dengan potongan belanja saat belanja di toko.</span>
                </div>
              </div>

              {/* BOTTOM FOOTER */}
              <div className="text-center pt-2">
                <span className="text-xs font-semibold text-slate-500">Sudah punya kartu member? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMemberModalTab('login');
                    setMemberLoginError(null);
                  }}
                  className="text-xs font-black text-red-600 hover:underline cursor-pointer"
                >
                  Masuk Member
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SCANNER MODAL JIKA DIBUKA DARI PORTAL */}
        {isMemberCardScannerOpen && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[260] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 text-center relative border border-slate-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800">
                  <Camera className="w-4 h-4 text-red-600" />
                  <span className="font-black text-xs sm:text-sm">Scan Barcode / QR Kartu Member</span>
                </div>
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
                      setMemberLoginError(`Barcode/QR "${cleanCode}" tidak terdaftar di sistem toko.`);
                    }
                  }}
                  onClose={() => setIsMemberCardScannerOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-28 font-sans antialiased">
      {/* HEADER STORE BRANDING & PROMO BANNERS - SCROLLABLE UPWARDS */}
      <header id="store-header-top" className="bg-gradient-to-r from-red-700 via-rose-600 to-red-700 text-white shadow-md select-none">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-2.5 pb-3 sm:py-3.5 flex flex-col items-center justify-center text-center relative">
          
          {/* POJOK KIRI ATAS: STATUS JAM OPERASIONAL TOKO */}
          <div className="absolute top-2 left-2.5 sm:left-4 z-10">
            <span className="inline-flex items-center gap-1 text-[10px] text-red-100 font-bold bg-black/30 px-2.5 py-0.5 rounded-full border border-white/10 shadow-3xs">
              <Clock className="w-3 h-3 text-amber-300" />
              <span>{storeOperatingHours}</span>
            </span>
          </div>

          {/* POJOK KANAN ATAS: STATUS ONLINE (BUKA) & PREVIEW JIKA OWNER */}
          <div className="absolute top-2 right-2.5 sm:right-4 z-10 flex items-center gap-1.5">
            {isOwnerView && (
              <span className="bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/20 text-[9px] font-bold text-white hidden md:inline">
                Preview
              </span>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-3xs ${
              isOnlineStatus ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40' : 'bg-rose-950 text-rose-200 border border-rose-500/40'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnlineStatus ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{isOnlineStatus ? 'Online (Buka)' : 'Offline (Tutup)'}</span>
            </span>
          </div>

          {/* POSISI TENGAH MENGGANTIKAN POSISI JAM: LENCANA YUK BELANJA ONLINE */}
          <div className="flex items-center justify-center mt-5 sm:mt-1 mb-2">
            <span className="bg-white text-red-700 font-black text-[10px] sm:text-[11px] px-3 py-0.5 rounded-md tracking-wider uppercase shadow-3xs flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Yuk Belanja Online</span>
            </span>
          </div>

          {/* LOGO TAS BELANJA & PENULISAN SRC MASNGUD SEPERTI HEADER KASIR */}
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3">
            {/* SRC Logo with signature Shopping Bag */}
            <div className="shrink-0 flex items-center h-8 sm:h-10 md:h-11">
              <SrcLogo className="h-8 sm:h-10 md:h-11 w-auto" whiteVariant={true} />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white flex items-center h-8 sm:h-10 md:h-11 uppercase">
              {(() => {
                const rawName = (config.namaToko || 'MASNGUD').trim();
                if (rawName.toUpperCase().startsWith('SRC ')) {
                  return rawName.substring(4).trim();
                }
                return rawName;
              })()}
            </h1>
          </div>

          {/* SLOGAN SEPERTI HEADER KASIR */}
          <p className="text-[9px] sm:text-xs text-white font-bold uppercase tracking-widest mt-1">
            Dekat Hemat dan Bersahabat
          </p>

          {/* ALAMAT & NOMOR TOKO */}
          <p className="text-[11px] sm:text-xs text-red-100 opacity-90 mt-0.5 max-w-md mx-auto line-clamp-1">
            {config.alamatToko || 'Jl.Suhada 2/3 Kebakalan 085850051070'}
          </p>
        </div>

        {/* MEMBER ACCOUNT HEADER BAR (KOLOM PELANGGAN) */}
        <div className="bg-slate-900 text-white px-3 sm:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          {loggedInMember ? (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
              <span className="bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 shadow-3xs">
                <UserCheck className="w-3 h-3" /> Member SRC
              </span>
              <span className="bg-red-950 text-red-300 border border-red-500/40 font-black px-2 py-0.5 rounded-md text-[10px]">
                🆔 {formatDisplayMemberId(loggedInMember)}
              </span>
              <span className="font-extrabold text-white flex items-center gap-1 text-[11px] sm:text-xs">
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
              <button
                type="button"
                onClick={() => setIsOrderHistoryOpen(true)}
                className="px-2.5 py-0.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-black text-[10px] rounded-lg shadow-3xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title="Lihat Riwayat & Status Pesanan Online Member"
              >
                <Clock className="w-3 h-3 text-amber-300" />
                <span>Riwayat Pesanan</span>
                {buyerOrders.length > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full font-black text-[9px] min-w-4 text-center">
                    {buyerOrders.length}
                  </span>
                )}
              </button>
              {/* TOMBOL LOG OUT DISAMPING RIWAYAT PESANAN (BERUPA IKON PADA LAYAR KECIL / PORTRAIT) */}
              <button
                type="button"
                onClick={handleMemberLogout}
                className="p-1 sm:px-2.5 sm:py-0.5 bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-rose-300 hover:text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-rose-500/40 shadow-3xs"
                title="Keluar / Log Out Akun Member"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-300" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px] sm:text-xs">
                  <Key className="w-3.5 h-3.5" /> Silakan Login ID Member / No. HP
                </span>
                <span className="text-slate-400 text-[11px] hidden sm:inline">
                  (Ketik ID Member atau Scan Kartu untuk kumpulkan poin)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(true)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-white/10"
              >
                <UserCheck className="w-3 h-3 text-amber-300" />
                <span>Login Member</span>
              </button>
            </div>
          )}
        </div>

        {/* STORE OFFLINE BANNER - INFORM CUSTOMER TO SEND ORDER VIA WHATSAPP */}
        {!isOnlineStatus && (
          <div className="bg-amber-400 text-slate-950 px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-xs border-b border-amber-500">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-950 shrink-0" />
              <span>Toko sedang Offline. Anda tetap bisa memilih belanjaan dan kirim pesanan via WhatsApp kasir!</span>
            </div>
            <a
              href={whatsappOrderGeneralUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-black flex items-center gap-1.5 ml-auto shadow-3xs cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Kasir ({displayWhatsAppNumber})</span>
            </a>
          </div>
        )}

        {/* INTERACTIVE PROMO BANNER CAROUSEL / SLIDER */}
        {activePromoBanners.length > 0 && (
          <div className="bg-gradient-to-b from-red-950/90 to-red-900/40 border-t border-b border-red-500/30 px-3 py-3 text-white">
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="flex items-center justify-between px-1 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>BANNER PROMOSI &amp; IKLAN TOKO</span>
                  </span>
                </div>
                {activePromoBanners.length > 1 && (
                  <span className="text-[10px] font-black text-amber-200 bg-black/40 px-2 py-0.5 rounded-full">
                    {currentBannerIndex + 1} / {activePromoBanners.length}
                  </span>
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
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-3xs flex items-center gap-1 ${
                              banner.kategoriBanner === 'Iklan'
                                ? 'bg-blue-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}>
                              {banner.kategoriBanner === 'Iklan' ? (
                                <>
                                  <Megaphone className="w-2.5 h-2.5" />
                                  <span>IKLAN</span>
                                </>
                              ) : (
                                <>
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>PROMO</span>
                                </>
                              )}
                            </span>
                            {banner.linkKategori && banner.linkKategori !== 'Semua' && (
                              <span className="text-[9px] font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md uppercase tracking-wider shadow-3xs">
                                🏷️ {banner.linkKategori}
                              </span>
                            )}
                          </div>
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
                          {banner.kategoriBanner === 'Iklan' ? (
                            /* KATEGORI IKLAN: TIDAK ADA TOMBOL LANGSUNG CHECKOUT / BELI SEKARANG */
                            <button
                              type="button"
                              onClick={() => handleNavigateToPromoProduct(banner, false)}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[10px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                              title="Lihat Produk Lengkap"
                            >
                              <span>Lihat Produk Lengkap</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            /* KATEGORI PROMO: ADA LIHAT PRODUK & LANGSUNG CHECKOUT */
                            <>
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
                            </>
                          )}

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
        {/* FLOATING BUTTON STATUS PESANAN (DISEMBUNYIKAN JIKA PESANAN SUDAH SELESAI / TIDAK ADA PESANAN AKTIF) */}
        {(activeOrdersCount > 0 || unsyncedOrdersCount > 0) && (
          <button
            type="button"
            onClick={() => setIsOrderHistoryOpen(true)}
            className="bg-slate-900/95 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 font-black text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-90 hover:scale-105 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
            title="Buka Status Pesanan Aktif"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Status Pesanan</span>
            {unsyncedOrdersCount > 0 ? (
              <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full animate-bounce flex items-center gap-1">
                <CloudOff className="w-3 h-3" />
                {unsyncedOrdersCount} belum kirim
              </span>
            ) : (
              <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {activeOrdersCount} aktif
              </span>
            )}
          </button>
        )}

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

              {/* OFFLINE NOTICE IN CART */}
              {!isOnlineStatus && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-2.5">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <p className="font-extrabold text-amber-900 text-xs">
                      Toko Sedang Offline / Tutup
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Pesanan Anda akan dibuat dan dapat langsung Anda kirimkan ke WhatsApp kasir toko ({displayWhatsAppNumber}) agar langsung disiapkan!
                    </p>
                  </div>
                </div>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>{isOnlineStatus ? 'Kirim Pesanan Ke Toko' : 'Kirim Pesanan (Lanjut WhatsApp)'}</span>
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

            {/* CLOUD SYNC STATUS NOTICE */}
            <div className="flex items-center justify-center">
              {confirmedCloudOrderIds.has(placedOrder.id) || placedOrder.syncStatus === 'synced' ? (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1.5 shadow-3xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Terkirim Langsung ke Kasir Toko ✓</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-black flex items-center gap-1.5 shadow-3xs animate-pulse">
                  <CloudOff className="w-4 h-4 text-amber-600" />
                  <span>Tersimpan di HP (Otomatis Dikirim saat Online)</span>
                </span>
              )}
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
                onClick={() => {
                  setPlacedOrder(null);
                  setIsOrderHistoryOpen(true);
                }}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Clock className="w-4 h-4 text-red-600" />
                <span>Pantau Status Pesanan Saya (Sinkron Kasir)</span>
              </button>

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

      {/* MEMBER VERIFICATION & REGISTRATION PORTAL (HANDLED AS PRIMARY VIEW WHEN !loggedInMember) */}
      {false && isMemberModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[210] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center relative overflow-hidden border border-slate-100 max-h-[94vh] overflow-y-auto">
            {/* FOTO BANNER UTAMA PORTAL PEMBELI: BANNER RESMI SRC MASNGUD & BANNER PROMO / IKLAN (SAMA POSISI) */}
            <div className="w-full overflow-hidden rounded-2xl border border-red-100 shadow-md bg-white relative group">
              <div className="relative w-full h-36 sm:h-44 overflow-hidden">
                {portalHeaderBanners.map((banner, idx) => {
                  if (idx !== portalBannerIndex) return null;
                  return (
                    <div key={banner.id} className="w-full h-full relative">
                      <img
                        src={banner.imageUrl}
                        alt={banner.judul || 'Banner Toko'}
                        className="w-full h-full object-cover object-center"
                        referrerPolicy="no-referrer"
                      />

                      {/* Lencana kategori jika banner promo / iklan (tanpa tombol langsung checkout, lihat produk, perbesar) */}
                      {banner.kategoriBanner && (
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm text-white flex items-center gap-1 ${
                            banner.kategoriBanner === 'Iklan' ? 'bg-blue-600' : 'bg-rose-600'
                          }`}>
                            {banner.kategoriBanner === 'Iklan' ? (
                              <>
                                <Megaphone className="w-2.5 h-2.5" />
                                <span>IKLAN</span>
                              </>
                            ) : (
                              <>
                                <Tag className="w-2.5 h-2.5" />
                                <span>PROMO</span>
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* NAVIGASI PANAH JIKA LEBIH DARI 1 BANNER */}
                {portalHeaderBanners.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPortalBannerIndex((prev) => (prev - 1 + portalHeaderBanners.length) % portalHeaderBanners.length)}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                      title="Banner Sebelumnya"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalBannerIndex((prev) => (prev + 1) % portalHeaderBanners.length)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900 text-white backdrop-blur-xs transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                      title="Banner Berikutnya"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {/* INDIKATOR TITIK (DOTS) */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full backdrop-blur-xs">
                      {portalHeaderBanners.map((b, i) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setPortalBannerIndex(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            i === portalBannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* HEADER YUK BELANJA ONLINE SRC MASNGUD DEKAT HEMAT DAN BERSAHABAT SEPERTI HEADER KATALOG */}
            <div className="bg-gradient-to-r from-red-700 via-rose-600 to-red-700 text-white rounded-2xl py-3 px-3 sm:px-4 shadow-sm text-center">
              {/* LENCANA YUK BELANJA ONLINE */}
              <div className="flex items-center justify-center mb-1.5">
                <span className="bg-white text-red-700 font-black text-[10px] sm:text-[11px] px-3 py-0.5 rounded-md tracking-wider uppercase shadow-3xs flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Yuk Belanja Online</span>
                </span>
              </div>

              {/* LOGO TAS BELANJA & PENULISAN SRC MASNGUD SEPERTI HEADER KASIR & KATALOG */}
              <div className="flex flex-row items-center justify-center gap-2 sm:gap-2.5">
                <div className="shrink-0 flex items-center h-7 sm:h-8">
                  <SrcLogo className="h-7 sm:h-8 w-auto" whiteVariant={true} />
                </div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white flex items-center h-7 sm:h-8 uppercase">
                  {(() => {
                    const rawName = (config.namaToko || 'MASNGUD').trim();
                    if (rawName.toUpperCase().startsWith('SRC ')) {
                      return rawName.substring(4).trim();
                    }
                    return rawName;
                  })()}
                </h2>
              </div>

              {/* SLOGAN SEPERTI HEADER KASIR & KATALOG */}
              <p className="text-[9px] sm:text-xs text-white font-bold uppercase tracking-widest mt-1">
                Dekat Hemat dan Bersahabat
              </p>

              {/* ALAMAT & NOMOR TOKO */}
              <p className="text-[10.5px] sm:text-xs text-red-100 opacity-90 mt-0.5 max-w-xs mx-auto line-clamp-1">
                {config.alamatToko || 'Jl.Suhada 2/3 Kebakalan 085850051070'}
              </p>
            </div>

            {/* STATUS PILL BAR: JAM BUKA 07.00 - 21.00 & ONLINE */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-3xs text-left">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-xs font-extrabold text-slate-700">Jam Buka 07.00 - 21.00</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black ${
                isOnlineStatus 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isOnlineStatus ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{isOnlineStatus ? 'Online' : 'Offline'}</span>
              </div>
            </div>

            {/* ERROR MESSAGE IF ANY */}
            {memberLoginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{memberLoginError}</span>
              </div>
            )}

            {/* TAB 1: LOGIN (CAMERA SCAN PRIMARY AS IN SCREENSHOT) */}
            {memberModalTab === 'login' ? (
              <div className="space-y-4">
                {/* WHITE CARD FOR PHYSICAL / QR SCAN */}
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs text-center space-y-3.5">
                  <div className="w-16 h-16 rounded-2xl bg-red-100/90 text-red-600 flex items-center justify-center mx-auto shadow-inner">
                    <QrCode className="w-9 h-9" />
                  </div>

                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                      VERIFIKASI SCAN FISIK / QR KARTU
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                      Arahkan kamera ke Barcode atau QR Code pada Kartu Member fisik Anda untuk masuk dan cek poin belanja.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMemberCardScannerOpen(true)}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Nyalakan Kamera &amp; Scan Barcode Member</span>
                  </button>

                  {/* TOGGLE FOR MANUAL INPUT (FALLBACK WITHOUT CAM) */}
                  <div className="pt-1">
                    {!showManualLoginInput ? (
                      <button
                        type="button"
                        onClick={() => setShowManualLoginInput(true)}
                        className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        Atau masukkan No. HP / ID Member manual ▾
                      </button>
                    ) : (
                      <form onSubmit={handleMemberLoginSubmit} className="space-y-2 pt-2 border-t border-slate-100 text-left">
                        <label className="block text-[11px] font-extrabold text-slate-700">
                          Ketik No. HP / ID Member / Barcode Kartu:
                        </label>
                        <div className="relative">
                          <CreditCard className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            required
                            placeholder="Contoh: 081234567890 atau MBR-001"
                            value={memberInput}
                            onChange={(e) => setMemberInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white placeholder:text-slate-400"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isSearchingCloudMember}
                          className="w-full py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isSearchingCloudMember ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Mencari Akun...</span>
                            </>
                          ) : (
                            <span>Masuk Manual</span>
                          )}
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* BOTTOM FOOTER NAVIGATION */}
                <div className="text-center pt-2">
                  <span className="text-xs font-semibold text-slate-500">Belum punya kartu member? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberModalTab('register');
                      setMemberLoginError(null);
                    }}
                    className="text-xs font-black text-red-600 hover:underline cursor-pointer"
                  >
                    Daftar Akun Baru
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: REGISTER MEMBER BARU */
              <div className="space-y-4 text-left">
                <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-3">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider text-center border-b border-slate-100 pb-2">
                    PENDAFTARAN MEMBER BARU
                  </h4>

                  <form onSubmit={handleRegisterMemberSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Nama Lengkap Pembeli <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Budi Santoso"
                          value={regNama}
                          onChange={(e) => setRegNama(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Nomor HP / WhatsApp Aktif <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <Key className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="tel"
                          required
                          placeholder="Contoh: 081234567890"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Nomor WhatsApp digunakan untuk konfirmasi status pesanan dan klaim poin belanja.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98 mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Daftar &amp; Langsung Belanja Online</span>
                    </button>
                  </form>
                </div>

                {/* GREEN NOTICE BOX FOR NEW MEMBERS */}
                <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-left flex items-start gap-2.5 shadow-3xs">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-black text-emerald-950">Keuntungan Member: </span>
                    <span>Dapatkan poin belanja di setiap pesanan online yang dapat ditukar dengan potongan belanja saat belanja di toko.</span>
                  </div>
                </div>

                {/* BOTTOM FOOTER */}
                <div className="text-center pt-2">
                  <span className="text-xs font-semibold text-slate-500">Sudah punya kartu member? </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMemberModalTab('login');
                      setMemberLoginError(null);
                    }}
                    className="text-xs font-black text-red-600 hover:underline cursor-pointer"
                  >
                    Masuk Member
                  </button>
                </div>
              </div>
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

            {/* RIWAYAT PESANAN ONLINE LINK IN MEMBER CARD */}
            <div className="p-3.5 bg-gradient-to-br from-red-50 to-slate-50 border border-red-200/70 rounded-2xl text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-red-600" />
                  <span>Riwayat Pesanan Akun Member</span>
                </span>
                <span className="text-[10px] font-black text-red-700 bg-white px-2 py-0.5 rounded-full border border-red-200 shadow-3xs">
                  {buyerOrders.length} Pesanan
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Cek status real-time pesanan toko online, lacak proses kasir, atau pesan ulang belanjaan Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsDigitalCardOpen(false);
                  setIsOrderHistoryOpen(true);
                }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Buka Riwayat Pesanan Saya ({buyerOrders.length})</span>
              </button>
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
                    setMemberLoginError(`Barcode/QR "${cleanCode}" tidak terdaftar di sistem toko.`);
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
                <span className={`p-1.5 rounded-xl text-white ${
                  selectedPromoModal.kategoriBanner === 'Iklan' ? 'bg-blue-600' : 'bg-rose-600'
                }`}>
                  {selectedPromoModal.kategoriBanner === 'Iklan' ? <Megaphone className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
                </span>
                <div className="min-w-0">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.2 rounded-full inline-block mb-0.5 ${
                    selectedPromoModal.kategoriBanner === 'Iklan' ? 'bg-blue-500/30 text-blue-300' : 'bg-rose-500/30 text-rose-300'
                  }`}>
                    {selectedPromoModal.kategoriBanner === 'Iklan' ? '📢 Iklan Toko' : '🏷️ Promo Toko'}
                  </span>
                  <div className="font-extrabold text-sm text-white truncate">
                    {selectedPromoModal.judul}
                  </div>
                </div>
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
              {selectedPromoModal.kategoriBanner === 'Iklan' ? (
                /* KATEGORI IKLAN: TIDAK ADA TOMBOL LANGSUNG CHECKOUT (BELI SEKARANG), HANYA LIHAT PRODUK LENGKAP */
                <button
                  type="button"
                  onClick={() => handleNavigateToPromoProduct(selectedPromoModal, false)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  <span>🔍 Lihat Produk Lengkap</span>
                </button>
              ) : (
                /* KATEGORI PROMO: MENAMPILKAN TOMBOL CHECKOUT LANGSUNG DAN LIHAT PRODUK LENGKAP */
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL STATUS PESANAN SAYA & RIWAYAT PESANAN ONLINE (SINKRON KASIR) */}
      {/* ========================================================================= */}
      {isOrderHistoryOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* MODAL HEADER */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/90 rounded-2xl border border-red-400/40 shadow-inner">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg tracking-tight">
                      Status &amp; Riwayat Pesanan
                    </h3>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Live Kasir
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                    {loggedInMember ? (
                      <>
                        <span className="text-amber-300 font-extrabold">{loggedInMember.nama}</span>
                        <span className="text-slate-400">•</span>
                        <span className="bg-white/10 px-1.5 py-0.2 rounded font-mono text-[11px] text-amber-200">
                          {formatDisplayMemberId(loggedInMember)}
                        </span>
                      </>
                    ) : (
                      <span>Pesanan di Perangkat Ini / Pencarian No. HP</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRefreshOrders}
                  disabled={isRefreshingOrders}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 disabled:opacity-50 active:scale-95 flex items-center gap-1 text-xs font-bold"
                  title="Segarkan data pesanan dari kasir cloud"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingOrders ? 'animate-spin text-amber-400' : ''}`} />
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOrderHistoryOpen(false)}
                  className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-900/80 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/60"
                  title="Tutup Riwayat Pesanan"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SEARCH LOOKUP BAR & LIVE STATUS BANNER */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearchLookup}
                  onChange={(e) => setOrderSearchLookup(e.target.value)}
                  placeholder={loggedInMember ? `Cari pesanan milik ${loggedInMember.nama} (No. Pesanan, Nama Barang)...` : "Cari No. Pesanan (Contoh: ORD-...) atau No. HP..."}
                  className="w-full pl-9 pr-8 py-2 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-xs rounded-xl border border-slate-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none font-medium transition-all"
                />
                {orderSearchLookup && (
                  <button
                    type="button"
                    onClick={() => setOrderSearchLookup('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* ACTIVE MEMBER BADGE */}
              {loggedInMember && (
                <div className="flex items-center justify-between text-[11px] bg-amber-50/90 border border-amber-200/90 px-3 py-1.5 rounded-xl text-amber-950">
                  <span className="flex items-center gap-1.5 font-bold truncate">
                    <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="truncate">Akun: <strong className="text-amber-900">{loggedInMember.nama}</strong> ({formatDisplayMemberId(loggedInMember)})</span>
                  </span>
                  <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded-full border border-amber-300 text-amber-800 shrink-0 shadow-3xs">
                    🔒 Khusus Pesanan Anda
                  </span>
                </div>
              )}

              {/* FILTER TABS */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrderFilterTab('semua')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'semua'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>Semua</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    orderFilterTab === 'semua' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {buyerOrders.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilterTab('aktif')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'aktif'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Sedang Diproses</span>
                  {activeOrdersCount > 0 && (
                    <span className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                      {activeOrdersCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilterTab('selesai')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'selesai'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selesai</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-emerald-200 text-emerald-900">
                    {buyerOrders.filter(o => o.status === 'Selesai').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderFilterTab('dibatalkan')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    orderFilterTab === 'dibatalkan'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                  }`}
                >
                  <span>Dibatalkan</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-rose-200 text-rose-900">
                    {buyerOrders.filter(o => o.status === 'Dibatalkan').length}
                  </span>
                </button>

                {unsyncedOrdersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderFilterTab('offline')}
                    className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      orderFilterTab === 'offline'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    }`}
                  >
                    <CloudOff className="w-3.5 h-3.5 text-amber-700" />
                    <span>Belum di Kasir</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-red-600 text-white animate-bounce">
                      {unsyncedOrdersCount}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* ORDERS LIST CONTAINER */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-slate-100/60">
              {/* UNSYNCED OFFLINE ORDERS BANNER */}
              {unsyncedOrdersCount > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5 animate-pulse shadow-xs">
                      <CloudOff className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-xs text-amber-950 block">
                        {unsyncedOrdersCount} Pesanan Tersimpan di HP (Belum Masuk Kasir)
                      </span>
                      <span className="text-[11px] text-amber-800 leading-tight block mt-0.5">
                        Pesanan dibuat saat koneksi offline. Tekan tombol di samping untuk langsung menyinkronkan ke kasir toko.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => syncAllPendingOrders(true)}
                    disabled={isSyncingAllPending}
                    className="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAllPending ? 'animate-spin' : ''}`} />
                    <span>{isSyncingAllPending ? 'Mengirim ke Kasir...' : '🚀 Kirim Semua ke Kasir'}</span>
                  </button>
                </div>
              )}
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center space-y-3 border border-slate-200 shadow-xs my-4">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-800">
                      {orderSearchLookup ? 'Pesanan Tidak Ditemukan' : 'Belum Ada Riwayat Pesanan'}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                      {orderSearchLookup 
                        ? `Tidak ada pesanan yang cocok dengan kata kunci "${orderSearchLookup}". Coba periksa kembali No. Pesanan atau No. HP Anda.`
                        : loggedInMember 
                          ? 'Pesanan online yang Anda pesan menggunakan akun member ini akan otomatis muncul di sini dan statusnya tersinkron secara langsung dengan kasir toko.'
                          : 'Masuk dengan ID Member atau No. HP untuk otomatis memuat seluruh riwayat pesanan Anda.'}
                    </p>
                  </div>
                  {!loggedInMember && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOrderHistoryOpen(false);
                        setIsMemberModalOpen(true);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Login Member SRC</span>
                    </button>
                  )}
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const isExpanded = !!expandedOrderIds[order.id];
                  
                  // Calculate workflow step number based on status
                  let stepNumber = 1;
                  let statusColor = 'bg-amber-100 text-amber-900 border-amber-300';
                  let statusTitle = 'Menunggu Konfirmasi Toko';
                  let statusDesc = 'Kasir sedang memeriksa ketersediaan barang';
                  let statusIcon = <Clock className="w-4 h-4 text-amber-600" />;

                  if (order.status === 'Diproses') {
                    stepNumber = 2;
                    statusColor = 'bg-sky-100 text-sky-900 border-sky-300';
                    statusTitle = 'Sedang Diproses & Dipacking';
                    statusDesc = 'Barang belanjaan sedang disiapkan oleh staf toko';
                    statusIcon = <Package className="w-4 h-4 text-sky-600" />;
                  } else if (order.status === 'Siap Diambil/Dikirim') {
                    stepNumber = 3;
                    statusColor = 'bg-purple-100 text-purple-900 border-purple-300';
                    statusTitle = order.tipePengiriman === 'Ambil di Toko' ? 'Siap Diambil di Toko' : 'Siap Diantar Kurir';
                    statusDesc = order.tipePengiriman === 'Ambil di Toko' ? 'Pesanan sudah siap di kasir toko' : 'Kurir sedang bersiap / menuju alamat Anda';
                    statusIcon = <Truck className="w-4 h-4 text-purple-600" />;
                  } else if (order.status === 'Selesai') {
                    stepNumber = 4;
                    statusColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                    statusTitle = 'Pesanan Selesai';
                    statusDesc = 'Transaksi selesai dan barang telah diterima';
                    statusIcon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                  } else if (order.status === 'Dibatalkan') {
                    stepNumber = 0;
                    statusColor = 'bg-rose-100 text-rose-900 border-rose-300';
                    statusTitle = 'Pesanan Dibatalkan';
                    statusDesc = order.catatan || 'Pesanan dibatalkan oleh kasir atau pembeli';
                    statusIcon = <AlertCircle className="w-4 h-4 text-rose-600" />;
                  }

                  const totalItemsInOrder = order.items.length;
                  const checkedCountInOrder = order.items.filter((_, idx) => !!crosscheckedItems[`${order.id}_${idx}`]).length;
                  const isAllOrderChecked = totalItemsInOrder > 0 && checkedCountInOrder === totalItemsInOrder;
                  const isConfirmedInCloud = confirmedCloudOrderIds.has(order.id) || order.syncStatus === 'synced';

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                        !isConfirmedInCloud ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      {/* CARD HEADER */}
                      <div className="p-3.5 sm:p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                              #{order.id}
                            </span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {order.waktu || order.waktuPesan || '-'}
                            </span>
                            {order.idMember && (
                              <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-1.5 py-0.2 rounded">
                                🆔 {order.idMember}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800">{order.namaPembeli}</span>
                            {order.teleponPembeli && (
                              <span className="text-slate-500 font-mono text-[10.5px]">({order.teleponPembeli})</span>
                            )}
                          </div>
                        </div>

                        {/* CLOUD & STATUS BADGE */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isConfirmedInCloud ? (
                            <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-black flex items-center gap-1 shadow-3xs" title="Pesanan ini telah tersinkron langsung ke kasir toko">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Kasir Cloud ✓</span>
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-300 text-[10.5px] font-black flex items-center gap-1 shadow-3xs animate-pulse" title="Pesanan tersimpan di HP ini, belum masuk ke cloud kasir toko karena saat checkout offline">
                              <CloudOff className="w-3.5 h-3.5 text-rose-600" />
                              <span>Belum Masuk Kasir</span>
                            </span>
                          )}

                          <div className={`px-2.5 py-1 rounded-xl border text-xs font-black flex items-center gap-1.5 shadow-3xs ${statusColor}`}>
                            {statusIcon}
                            <span>{order.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* LIVE REAL-TIME PROGRESS BAR TIMELINE */}
                      {order.status !== 'Dibatalkan' ? (
                        <div className="px-4 py-3 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100">
                          <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 mb-1.5">
                            <span className={stepNumber >= 1 ? 'text-amber-600' : ''}>1. Masuk</span>
                            <span className={stepNumber >= 2 ? 'text-sky-600' : ''}>2. Diproses</span>
                            <span className={stepNumber >= 3 ? 'text-purple-600' : ''}>3. Siap Diantar/Ambil</span>
                            <span className={stepNumber >= 4 ? 'text-emerald-600' : ''}>4. Selesai</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                            <div
                              className={`h-full transition-all duration-500 rounded-full ${
                                stepNumber === 1 ? 'bg-amber-500 w-1/4 animate-pulse' :
                                stepNumber === 2 ? 'bg-sky-500 w-2/4 animate-pulse' :
                                stepNumber === 3 ? 'bg-purple-600 w-3/4 animate-pulse' :
                                'bg-emerald-600 w-full'
                              }`}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                            <span className="font-bold text-slate-800">{statusTitle}:</span>
                            <span className="text-slate-500">{statusDesc}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 bg-rose-50/60 border-b border-rose-100 text-rose-800 text-[11px] font-medium flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Pesanan telah dibatalkan di kasir toko. Silakan hubungi toko jika ada kendala.</span>
                        </div>
                      )}

                      {/* DETAILS & ITEMS LIST */}
                      <div className="p-3.5 sm:p-4 space-y-3">
                        {/* OFFLINE NOTICE & QUICK RETRY */}
                        {!isConfirmedInCloud && (
                          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl space-y-2.5">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-amber-950">
                                <span className="font-extrabold block text-amber-900">
                                  Pesanan ini belum masuk ke kasir toko
                                </span>
                                <span className="text-amber-800 leading-tight block mt-0.5">
                                  Pesanan dibuat saat Anda sedang offline. Tekan tombol kirim di bawah agar kasir toko dapat menerima dan menyiapkan pesanan Anda.
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRetrySyncOrder(order)}
                                disabled={syncingOrderIds[order.id]}
                                className="w-full sm:flex-1 py-2 px-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncingOrderIds[order.id] ? 'animate-spin' : ''}`} />
                                <span>
                                  {syncingOrderIds[order.id] ? 'Mengirim ke Kasir Cloud...' : '🚀 Kirim Pesanan Ini ke Kasir Cloud'}
                                </span>
                              </button>
                              <a
                                href={getOrderInquiryWhatsAppUrl(order)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:w-auto py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Kirim via WA</span>
                              </a>
                            </div>
                          </div>
                        )}

                        {/* DELIVERY & PAYMENT META */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                            order.tipePengiriman === 'Pesan Antar'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {order.tipePengiriman === 'Pesan Antar' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                            {order.tipePengiriman}
                          </span>

                          <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-slate-500" />
                            {order.metodePembayaran}
                          </span>

                          {order.alamatPembeli && (
                            <span className="text-slate-500 truncate max-w-xs text-[10.5px]">
                              📍 {order.alamatPembeli}
                            </span>
                          )}
                        </div>

                        {/* ITEMS BREAKDOWN & CROSSCHECK SECTION */}
                        <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-black text-slate-800 border-b border-slate-200/80 pb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5">
                              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                              <span>Daftar Barang &amp; Crosscheck ({order.items.reduce((acc, it) => acc + (it.qty || 1), 0)} pcs)</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {/* Progress Badge */}
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-all ${
                                isAllOrderChecked 
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                  : checkedCountInOrder > 0 
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-slate-200 text-slate-700 border-slate-300'
                              }`}>
                                {checkedCountInOrder}/{order.items.length} Sesuai
                              </span>

                              {/* Toggle All Button */}
                              <button
                                type="button"
                                onClick={() => markAllOrderCrosschecked(order.id, order.items.length, !isAllOrderChecked)}
                                className="text-[10.5px] font-extrabold text-slate-700 hover:text-emerald-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200 hover:border-emerald-300 shadow-3xs cursor-pointer transition-all active:scale-95"
                                title="Klik untuk menandai semua barang sesuai atau mereset"
                              >
                                {isAllOrderChecked ? 'Reset Cek' : 'Ceklis Semua ✓'}
                              </button>

                              {order.items.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedOrderIds(prev => ({ ...prev, [order.id]: !isExpanded }))}
                                  className="text-red-600 hover:text-red-700 font-extrabold text-[10.5px] cursor-pointer ml-1"
                                >
                                  {isExpanded ? 'Ringkas' : `Semua (${order.items.length})`}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Items Checklist List */}
                          <div className="space-y-1.5 pt-0.5">
                            {(isExpanded ? order.items : order.items.slice(0, 3)).map((item, idx) => {
                              const isChecked = !!crosscheckedItems[`${order.id}_${idx}`];
                              return (
                                <div
                                  key={idx}
                                  onClick={() => toggleCrosscheckItem(order.id, idx)}
                                  className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all select-none ${
                                    isChecked
                                      ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-3xs'
                                      : 'bg-white border-slate-200/90 hover:border-slate-300 text-slate-800'
                                  }`}
                                  title="Klik untuk menandai barang sudah dicek dan sesuai"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="shrink-0 flex items-center justify-center">
                                      {isChecked ? (
                                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Square className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="truncate pr-1">
                                      <span className={`font-bold block truncate ${isChecked ? 'line-through text-emerald-800' : 'text-slate-900'}`}>
                                        {item.nama}
                                      </span>
                                      <span className="text-[10.5px] text-slate-500">
                                        {item.qty} {item.satuanNama || 'pcs'} x {formatRp(item.jual)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="font-mono font-bold text-slate-900 text-xs block">
                                      {formatRp(item.subtotal || item.jual * item.qty)}
                                    </span>
                                    {isChecked ? (
                                      <span className="text-[9.5px] font-black text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-300 inline-block">
                                        ✓ Sesuai
                                      </span>
                                    ) : (
                                      <span className="text-[9.5px] text-slate-400 block">
                                        Ketuk ceklis
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {!isExpanded && order.items.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setExpandedOrderIds(prev => ({ ...prev, [order.id]: true }))}
                                className="w-full text-center py-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-white rounded-lg border border-dashed border-slate-300 cursor-pointer"
                              >
                                + Buka {order.items.length - 3} barang lainnya untuk dicroscek
                              </button>
                            )}
                          </div>

                          {/* Crosscheck Notice for Pickup or Delivery */}
                          <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                            isAllOrderChecked 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-amber-50/70 border-amber-200 text-amber-900'
                          }`}>
                            {isAllOrderChecked ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-black">Pemeriksaan Barang Selesai!</span>
                                  <p className="text-[10.5px] text-emerald-800">
                                    Semua ({order.items.length}) barang belanjaan telah Anda verifikasi sesuai dan lengkap.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-black">
                                    {order.tipePengiriman === 'Ambil di Toko' ? 'Crosscheck Pengambilan di Toko:' : 'Crosscheck Penerimaan Pesan Antar:'}
                                  </span>
                                  <p className="text-[10.5px] text-amber-800">
                                    {order.tipePengiriman === 'Ambil di Toko'
                                      ? `Tunjukkan No. Pesanan #${order.id} ke kasir toko. Ceklis setiap barang di atas untuk memastikan belanjaan Anda lengkap sebelum pulang.`
                                      : `Ceklis setiap barang di atas saat kurir mengantar paket ke ${order.alamatPembeli || 'alamat Anda'} untuk memastikan tidak ada barang yang kurang.`}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          {order.catatan && (
                            <div className="pt-1.5 border-t border-slate-200/60 text-[10.5px] text-amber-900 bg-amber-50/50 p-1.5 rounded-lg">
                              <span className="font-bold">Catatan:</span> {order.catatan}
                            </div>
                          )}
                        </div>

                        {/* TOTAL & ACTION BUTTONS */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>Total Bayar:</span>
                              {order.ongkir ? (
                                <span className="text-[10px] text-slate-400">(Termasuk Ongkir {formatRp(order.ongkir)})</span>
                              ) : null}
                            </div>
                            <span className="font-black text-base text-red-600">
                              {formatRp(order.totalBayar)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {/* TOMBOL RETRY SYNC JIKA BELUM MASUK KASIR */}
                            {!isConfirmedInCloud && (
                              <button
                                type="button"
                                onClick={() => handleRetrySyncOrder(order)}
                                disabled={syncingOrderIds[order.id]}
                                className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                title="Kirim pesanan ini ke kasir cloud sekarang"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncingOrderIds[order.id] ? 'animate-spin' : ''}`} />
                                <span>{syncingOrderIds[order.id] ? 'Mengirim...' : 'Kirim ke Kasir'}</span>
                              </button>
                            )}

                            {/* TOMBOL TANYA KASIR WHATSAPP */}
                            <a
                              href={getOrderInquiryWhatsAppUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Tanya perkembangan pesanan ke WhatsApp kasir toko"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Tanya Kasir</span>
                            </a>

                            {/* TOMBOL NOTA STRUK */}
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForReceipt(order)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-extrabold text-xs rounded-xl border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Buka struk / nota digital pesanan"
                            >
                              <Receipt className="w-3.5 h-3.5 text-slate-600" />
                              <span>Struk</span>
                            </button>

                            {/* TOMBOL BELI ULANG */}
                            <button
                              type="button"
                              onClick={() => handleReorderItems(order)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Masukkan barang dari pesanan ini ke keranjang belanja"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                              <span>Pesan Lagi</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-medium">
                  Status otomatis tersinkron dengan kasir toko (Firestore Cloud)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderHistoryOpen(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL NOTA STRUK DIGITAL PESANAN ONLINE */}
      {/* ========================================================================= */}
      {selectedOrderForReceipt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[260] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-400" />
                <h4 className="font-black text-sm">Nota Struk Belanja Online</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForReceipt(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 font-mono text-xs text-slate-800 bg-white">
              {/* STORE HEADER */}
              <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
                <h3 className="font-black text-base tracking-wider uppercase font-sans text-slate-950">
                  {config.namaToko || 'TOKO SRC MASNGUD'}
                </h3>
                <p className="text-[11px] text-slate-600 font-sans">
                  {config.alamatToko || 'Belanja Praktis & Hemat Dekat Rumah'}
                </p>
                {config.noHp && (
                  <p className="text-[10px] text-slate-500 font-sans">
                    Telp / WA: {config.noHp}
                  </p>
                )}
              </div>

              {/* ORDER META */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>No. Pesanan:</span>
                  <span className="font-bold">{selectedOrderForReceipt.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Waktu:</span>
                  <span>{selectedOrderForReceipt.waktu || selectedOrderForReceipt.waktuPesan || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pembeli:</span>
                  <span className="font-bold">{selectedOrderForReceipt.namaPembeli}</span>
                </div>
                {selectedOrderForReceipt.teleponPembeli && (
                  <div className="flex justify-between">
                    <span>No. HP:</span>
                    <span>{selectedOrderForReceipt.teleponPembeli}</span>
                  </div>
                )}
                {selectedOrderForReceipt.idMember && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>ID Member:</span>
                    <span>{selectedOrderForReceipt.idMember}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-bold uppercase text-amber-700">{selectedOrderForReceipt.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pengiriman:</span>
                  <span>{selectedOrderForReceipt.tipePengiriman}</span>
                </div>
                {selectedOrderForReceipt.alamatPembeli && (
                  <div className="text-[10px] text-slate-500 pt-0.5">
                    Alamat: {selectedOrderForReceipt.alamatPembeli}
                  </div>
                )}
              </div>

              {/* ITEMS TABLE */}
              <div className="space-y-1.5 border-b-2 border-dashed border-slate-300 pb-3">
                <div className="flex justify-between text-[11px] font-bold text-slate-900 border-b border-slate-200 pb-1">
                  <span>Barang</span>
                  <span>Total</span>
                </div>
                {selectedOrderForReceipt.items.map((item, idx) => (
                  <div key={idx} className="space-y-0.5 text-[11px]">
                    <div className="font-medium text-slate-900">{item.nama}</div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>{item.qty} {item.satuanNama || 'pcs'} x {formatRp(item.jual)}</span>
                      <span className="font-bold text-slate-900">{formatRp(item.subtotal || item.jual * item.qty)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* TOTALS */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span>Subtotal Barang:</span>
                  <span>{formatRp(selectedOrderForReceipt.totalHarga || (selectedOrderForReceipt.totalBayar - (selectedOrderForReceipt.ongkir || 0)))}</span>
                </div>
                {selectedOrderForReceipt.ongkir ? (
                  <div className="flex justify-between">
                    <span>Ongkos Kirim:</span>
                    <span>{formatRp(selectedOrderForReceipt.ongkir)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1 border-t border-slate-200">
                  <span>TOTAL BAYAR:</span>
                  <span className="text-red-600">{formatRp(selectedOrderForReceipt.totalBayar)}</span>
                </div>
                <div className="flex justify-between text-[10.5px] text-slate-600 pt-0.5">
                  <span>Metode Pembayaran:</span>
                  <span className="font-bold">{selectedOrderForReceipt.metodePembayaran}</span>
                </div>
              </div>

              {/* STORE FOOTER MESSAGE */}
              <div className="text-center text-[10.5px] text-slate-500 font-sans pt-1 space-y-0.5">
                <p className="font-bold text-slate-700">Terima Kasih Telah Berbelanja di {config.namaToko || 'Toko SRC'}</p>
                <p>Simpan nota ini sebagai bukti transaksi pesanan online yang sah.</p>
              </div>
            </div>

            {/* NOTA ACTIONS */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Cetak / PDF</span>
              </button>
              <a
                href={getOrderInquiryWhatsAppUrl(selectedOrderForReceipt)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs text-center"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Kirim WA</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TOAST NOTIFICATION BANNER */}
      {/* ========================================================================= */}
      {orderToastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{orderToastMessage}</span>
        </div>
      )}
    </div>
  );
};
