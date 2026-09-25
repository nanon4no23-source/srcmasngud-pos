export interface MultiSatuanItem {
  id: string;
  namaSatuan: string; // e.g. "Renceng", "Lusin", "Dus", "Karton"
  isiPcs: number; // conversion rate: how many base pcs are inside this unit? (e.g., 10, 12, 40)
  hargaJual: number; // price for this unit (e.g. Rp 15.000)
  hargaBeli?: number; // buy/cost price for this unit
  barcode?: string; // optional barcode specifically for this unit
}

export interface ItemBarang {
  id: string;
  nama: string;
  kode: string; // Barcode or QR code
  foto?: string; // Product photo (base64 compressed image data URL or URL)
  beli: number; // Cost / Buy price
  jual: number; // Retail sell price
  stok: number; // Current physical stock
  g1Min: number; // Wholesale min qty level 1
  g1Harga: number; // Wholesale price level 1
  g2Min: number; // Wholesale min qty level 2
  g2Harga: number; // Wholesale price level 2
  expired?: string; // Tanggal Kedaluwarsa (YYYY-MM-DD or empty)
  kategori: string;
  minStok?: number; // Minimum stock threshold (Alert level, e.g. 5, defaults to 3 if unset)
  rak?: string; // Rack storage position (e.g., Rack A-1)
  supplier?: string; // Product supplier/vendor distributor
  multiSatuan?: MultiSatuanItem[]; // Multi-Unit Configurations
}

export interface DetailItemTransaksi {
  id: string;
  nama: string;
  kode: string;
  qty: number;
  jual: number;
  hargaAsli: number; // original price before bulk promo
  jenisHarga: 'Ecer' | 'Grosir 1' | 'Grosir 2' | 'Kustom';
  subtotal: number;
  kategori?: string;
  stok?: number;
  modal?: number; // Cost price (harga modal/beli)
}

export interface Pelanggan {
  id: string;
  nama: string;
  telepon: string;
  poin: number;
  totalBelanja: number; // akumulasi belanja rupiah
  catatan?: string;
  tanggalDaftar: string;
  bolehHutangRokok?: boolean;
  limitKredit?: number;
  perjanjianUtang?: {
    dueDate: string;
    additionalWitness: string;
    customTerms: string;
    signatureImg?: string; // base64 PNG
    signedAt: string;
  };
}

export interface Transaksi {
  id: string; // e.g. TRX-20260521-1234
  waktu: string; // Formatted date string
  items: DetailItemTransaksi[];
  total: number;
  bayar: number;
  kembalian: number;
  pelangganId?: string; // ID pelanggan jika ada
  pelangganNama?: string;
  poinDitukar?: number; // jumlah poin yang ditukar
  nilaiPotonganPoin?: number; // rupiah diskon potongan poin
  poinDidapat?: number; // poin baru didapat
  pelunasanHutang?: number; // nominal bayar sangkutan hutang lama
  rincianHutangLunas?: string[]; // rincian utang yang dilunasi dalam transaksi ini
  metodePembayaran?: 'Tunai' | 'QRIS' | 'Transfer' | 'Kartu';
  kasir?: string; // cashier username who processed the transaction
  timestamp?: number; // epoch ms for calculations
}

export interface PromoBanner {
  id: string;
  judul: string;
  imageUrl: string; // Base64 data URL or photo URL
  deskripsi?: string;
  aktif: boolean;
  kategoriBanner?: 'Promo' | 'Iklan'; // Category: 'Promo' (default, has checkout/buy now) or 'Iklan' (only view product)
  linkKategori?: string; // Optional category filter link e.g. "Sembako", "Minuman", "Semua"
  linkProductId?: string; // Optional specific product ID to directly target/view product
  linkProductName?: string; // Optional specific product name for display
  tanggalDibuat?: string;
}

export interface ConfigStruk {
  namaToko: string;
  alamatToko: string;
  footnoteToko: string;
  kasirAktif?: string;
  karyawan1?: string;
  karyawan2?: string;
  karyawan3?: string;
  daftarKaryawan?: string[];
  logoUseImage?: boolean; // toggle to use header image instead of text
  logoImageUrl?: string;   // base64 data URL or path to image
  tokoOnlineAktif?: boolean; // toggle whether My AYO SRC Online store is open
  nomorWaToko?: string; // WhatsApp number for online order confirmation
  minOrderDelivery?: number; // Minimum transaction for Pesan Antar
  ongkirDelivery?: number; // Delivery fee
  deskripsiTokoOnline?: string; // Short store greeting/promo description
  sembunyikanPortalPembeli?: boolean; // Toggle to hide customer online store portal in cashier app
  customDomainOnlineStore?: string; // Custom public store link/domain (e.g. cloud run or personal domain)
  promoBanners?: PromoBanner[]; // Store online promo banner list
}

export interface DetailItemPesananOnline {
  itemId: string;
  nama: string;
  kode?: string;
  barcode?: string;
  qty: number;
  jual?: number;
  harga?: number; // alias for jual
  subtotal: number;
  satuanNama?: string;
  satuan?: string; // alias for satuanNama
  unitId?: string;
}

export interface PesananOnline {
  id: string; // e.g. ORD-20260722-1234
  waktu?: string; // Formatted date string
  waktuPesan?: string; // alias for waktu
  timestamp?: number; // epoch ms
  namaPembeli: string;
  teleponPembeli: string;
  alamatPembeli?: string;
  alamatPengiriman?: string; // alias for alamatPembeli
  tipePengiriman: 'Ambil di Toko' | 'Pesan Antar';
  opsiPengambilan?: string; // alias for tipePengiriman
  catatan?: string;
  catatanPembeli?: string; // alias for catatan
  items: DetailItemPesananOnline[];
  totalHarga?: number;
  ongkir?: number;
  totalBayar: number;
  metodePembayaran: 'COD (Bayar di Tempat)' | 'QRIS' | 'Transfer Bank';
  status: 'Menunggu Konfirmasi' | 'Diproses' | 'Siap Diambil/Dikirim' | 'Selesai' | 'Dibatalkan';
  alasanBatal?: string;
  memberId?: string; // ID Member pembeli jika bertransaksi via akun member
  idMember?: string; // Display ID member (e.g. SRC-MEM-...)
  syncStatus?: 'synced' | 'pending' | 'failed'; // Status sinkronisasi ke Firebase Cloud Firestore
  lastSyncError?: string; // Pesan kegagalan sinkronisasi cloud
  syncedAt?: string; // Waktu pesanan berhasil terkirim ke Firestore
}

export interface ShiftLog {
  id: string;
  namaKasir: string;
  mulai: string;
  mulaiMs: number;
  selesai?: string;
  selesaiMs?: number;
  status: 'aktif' | 'selesai';
}

