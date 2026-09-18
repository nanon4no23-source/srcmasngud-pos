import { ItemBarang, Pelanggan } from './types';

const INITIAL_BARANG_RAW: ItemBarang[] = [
  // --- BRAND: OTHER / EXISTING ---
  {
    id: "p1",
    nama: "76 Apel",
    kode: "8991906106250",
    beli: 15000,
    jual: 16000,
    stok: 9999994,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p2",
    nama: "76 KRETEK 12",
    kode: "8991906101668",
    beli: 15300,
    jual: 17000,
    stok: 62,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    expired: "2026-06-10",
    kategori: "Rokok"
  },
  {
    id: "p3",
    nama: "76 mangga",
    kode: "8991906101811",
    beli: 15000,
    jual: 16000,
    stok: 99997,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p4",
    nama: "Air mineral Aqua 1500ml",
    kode: "8886008101091",
    beli: 5500,
    jual: 6000,
    stok: 1000,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Minuman"
  },
  {
    id: "p5",
    nama: "Air mineral Aquviva 1600L",
    kode: "8998866632300",
    beli: 4500,
    jual: 6000,
    stok: 250,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Minuman"
  },
  {
    id: "p6",
    nama: "ALTIS DUS",
    kode: "001",
    beli: 14500,
    jual: 18000,
    stok: 89,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p7",
    nama: "Beras 1 kg",
    kode: "01",
    beli: 13500,
    jual: 14500,
    stok: 200,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "p8",
    nama: "Class mild 16",
    kode: "8993989311699",
    beli: 29000,
    jual: 31000,
    stok: 500,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p9",
    nama: "DJARUM SUPER 12",
    kode: "8991906101019",
    beli: 22900,
    jual: 25000,
    stok: 97,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p10",
    nama: "Indomie Goreng",
    kode: "089686010947",
    beli: 3250,
    jual: 3500,
    stok: 800,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "p11",
    nama: "JOLLY 200",
    kode: "8992759184013",
    beli: 3000,
    jual: 4000,
    stok: 1000,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Lain-lain"
  },
  {
    id: "p12",
    nama: "Kapal Api 150gr",
    kode: "8991002105423",
    beli: 21900,
    jual: 25000,
    stok: 98,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Minuman"
  },
  {
    id: "p13",
    nama: "PUCUK HARUM",
    kode: "8996001600146",
    beli: 3000,
    jual: 4000,
    stok: 120,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Minuman"
  },
  {
    id: "p14",
    nama: "Sabun lifebuoy merah",
    kode: "8999999567651",
    beli: 3000,
    jual: 3500,
    stok: 350,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Perawatan"
  },
  {
    id: "p15",
    nama: "Sedaap mi Goreng",
    kode: "8998866200301",
    beli: 3250,
    jual: 3500,
    stok: 400,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "p16",
    nama: "SURYA 12",
    kode: "8998989110129",
    beli: 25500,
    jual: 27000,
    stok: 100,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Rokok"
  },
  {
    id: "p17",
    nama: "Kapal api 6g",
    kode: "8991002105584",
    beli: 900,
    jual: 1500,
    stok: 940,
    g1Min: 2,
    g1Harga: 1250,
    g2Min: 10,
    g2Harga: 1000,
    kategori: "Minuman"
  },
  {
    id: "p18",
    nama: "Santen sasa cair 65ml",
    kode: "8991188943536",
    beli: 4500,
    jual: 5000,
    stok: 180,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "p19",
    nama: "Wafello 97g",
    kode: "8996001358399",
    beli: 5500,
    jual: 6500,
    stok: 99,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "p20",
    nama: "Roma kelapa 300g",
    kode: "8996001301142",
    beli: 9000,
    jual: 10000,
    stok: 240,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },

  // --- REQUESTED NEW BEST-SELLING PRODUCTS ---
  // Brand: Unilever
  {
    id: "ul-1",
    nama: "Pepsodent Pencegah Gigi Berlubang 120g",
    kode: "8999999056629",
    beli: 8500,
    jual: 10000,
    stok: 150,
    g1Min: 6,
    g1Harga: 9700,
    g2Min: 24,
    g2Harga: 9500,
    kategori: "Perawatan"
  },
  {
    id: "ul-2",
    nama: "Rinso Anti Noda Liquid 700ml",
    kode: "8999999002251",
    beli: 18000,
    jual: 20500,
    stok: 85,
    g1Min: 4,
    g1Harga: 20000,
    g2Min: 12,
    g2Harga: 19500,
    kategori: "Perawatan"
  },

  // Brand: Wings
  {
    id: "wg-1",
    nama: "So Klin Liquid Softergent 750ml",
    kode: "8998866102148",
    beli: 15000,
    jual: 17500,
    stok: 90,
    g1Min: 4,
    g1Harga: 17000,
    g2Min: 12,
    g2Harga: 16500,
    kategori: "Perawatan"
  },
  {
    id: "wg-2",
    nama: "Floridina Orange Coco 350ml",
    kode: "8998866204019",
    beli: 2500,
    jual: 3500,
    stok: 300,
    g1Min: 12,
    g1Harga: 3200,
    g2Min: 24,
    g2Harga: 3000,
    kategori: "Minuman"
  },

  // Brand: Garuda
  {
    id: "gd-1",
    nama: "Kacang Garuda Rosta 60g",
    kode: "8992775317709",
    beli: 5200,
    jual: 6000,
    stok: 120,
    g1Min: 10,
    g1Harga: 5800,
    g2Min: 40,
    g2Harga: 5500,
    kategori: "Makanan"
  },
  {
    id: "gd-2",
    nama: "Chocolatos Wafer Roll Chocolate 24g",
    kode: "8992775313107",
    beli: 1800,
    jual: 2500,
    stok: 250,
    g1Min: 24,
    g1Harga: 2200,
    g2Min: 48,
    g2Harga: 2000,
    kategori: "Makanan"
  },

  // Brand: Mayora
  {
    id: "my-1",
    nama: "Beng Beng Share It 95g",
    kode: "8996001357590",
    beli: 11000,
    jual: 12500,
    stok: 140,
    g1Min: 5,
    g1Harga: 12200,
    g2Min: 20,
    g2Harga: 11800,
    kategori: "Makanan"
  },
  {
    id: "my-2",
    nama: "Teh Pucuk Harum 350ml",
    kode: "8996001600269",
    beli: 3000,
    jual: 4000,
    stok: 350,
    g1Min: 12,
    g1Harga: 3700,
    g2Min: 24,
    g2Harga: 3500,
    kategori: "Minuman"
  },

  // Brand: Sari Roti
  {
    id: "sr-1",
    nama: "Sari Roti Tawar Spesial 370g",
    kode: "8993206111166",
    beli: 13500,
    jual: 15000,
    stok: 40,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },
  {
    id: "sr-2",
    nama: "Sari Roti Roti Sobek Coklat",
    kode: "8993206111074",
    beli: 16500,
    jual: 18500,
    stok: 35,
    g1Min: 0,
    g1Harga: 0,
    g2Min: 0,
    g2Harga: 0,
    kategori: "Makanan"
  },

  // Brand: Campina Ice Cream
  {
    id: "cp-1",
    nama: "Campina Concerto Choco Banana 80ml",
    kode: "8991001111524",
    beli: 4000,
    jual: 5000,
    stok: 80,
    g1Min: 10,
    g1Harga: 4800,
    g2Min: 30,
    g2Harga: 4500,
    kategori: "Makanan"
  },
  {
    id: "cp-2",
    nama: "Campina Hula Hula Kacang Hijau 60ml",
    kode: "8991001111326",
    beli: 3500,
    jual: 4500,
    stok: 100,
    g1Min: 10,
    g1Harga: 4200,
    g2Min: 30,
    g2Harga: 4000,
    kategori: "Makanan"
  }
];

export const INITIAL_BARANG: ItemBarang[] = INITIAL_BARANG_RAW.map(p => ({
  ...p,
  stok: 999
}));

export const INITIAL_PELANGGAN: Pelanggan[] = [
  { id: "pel-1", nama: "Hendra Wijaya", telepon: "081234567890", poin: 150, totalBelanja: 1500000, catatan: "Pembelian selalu rutin mingguan", tanggalDaftar: "2026-03-12", bolehHutangRokok: true },
  { id: "pel-2", nama: "Ibu Siska Amelia", telepon: "082198765432", poin: 45, totalBelanja: 450000, catatan: "Langganan sembako & grosir", tanggalDaftar: "2026-04-05" },
  { id: "pel-3", nama: "Pak Joko Widodo", telepon: "089677889900", poin: 15, totalBelanja: 150000, catatan: "", tanggalDaftar: "2026-05-01" }
];
