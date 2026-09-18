import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Search, X, Camera, Smartphone, ChevronDown } from 'lucide-react';
import { ItemBarang, Pelanggan } from '../types';
import { matchBarcode, matchMemberBarcode } from '../utils/printHelper';

const CATEGORY_ICONS: Record<string, string> = {
  'Minuman': '🥤',
  'Makanan': '🍔',
  'Perawatan': '🧼',
  'Rokok': '🚬',
  'Lain-lain': '📦'
};

interface KasirSearchInputProps {
  barang: ItemBarang[];
  keranjang: Record<string, number>;
  pelanggan: Pelanggan[];
  hologramMode: boolean;
  onAddToCart: (item: ItemBarang) => void;
  onScanMember: (member: Pelanggan) => void;
  showToast: (msg: string) => void;
  playDeviceBeep: (freq: number, duration: number) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  isCustomItemOpen: boolean;
  setIsCustomItemOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
}

const KasirSearchInput: React.FC<KasirSearchInputProps> = memo(({
  barang,
  keranjang,
  pelanggan,
  hologramMode,
  onAddToCart,
  onScanMember,
  showToast,
  playDeviceBeep,
  isScannerOpen,
  setIsScannerOpen,
  isCustomItemOpen,
  setIsCustomItemOpen,
}) => {
  const [inputText, setInputText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(12);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear search input safely in both React state and native DOM element
  const clearSearchInput = () => {
    setInputText('');
    setDebouncedQuery('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Synchronize native DOM value when inputText is cleared externally
  useEffect(() => {
    if (inputText === '' && inputRef.current && inputRef.current.value !== '') {
      inputRef.current.value = '';
    }
  }, [inputText]);

  // Handle typing without interfering with Android WebView / Samsung Keyboard IME composition
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  // Debounce input to prevent UI lag on Android when typing rapidly
  useEffect(() => {
    const trimmed = inputText.trim();
    if (!trimmed) {
      setDebouncedQuery('');
      setDisplayLimit(12);
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
      setDisplayLimit(12);
    }, 80);

    return () => clearTimeout(timer);
  }, [inputText]);

  // Pre-indexed search cache for high-speed item lookup without repeated toLowerCase calls
  const searchIndex = useMemo(() => {
    return barang.map(item => ({
      item,
      searchStr: `${item.nama || ''} ${item.kode || ''} ${item.kategori || ''}`.toLowerCase()
    }));
  }, [barang]);

  // Filtered items matching all tokens
  const filteredItems = useMemo(() => {
    if (!debouncedQuery) return [];
    const tokens = debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const matches: ItemBarang[] = [];
    for (let i = 0; i < searchIndex.length; i++) {
      const entry = searchIndex[i];
      let match = true;
      for (let t = 0; t < tokens.length; t++) {
        if (!entry.searchStr.includes(tokens[t])) {
          match = false;
          break;
        }
      }
      if (match) {
        matches.push(entry.item);
        if (matches.length >= 60) break; // Limit array size for ultra fast memory handling
      }
    }
    return matches;
  }, [searchIndex, debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcodeInput = inputText.trim();
    if (!barcodeInput) return;

    // A. Exact barcode match
    const foundByBarcode = barang.find(p => p.kode === barcodeInput || matchBarcode(p.kode, barcodeInput));
    if (foundByBarcode) {
      onAddToCart(foundByBarcode);
      clearSearchInput();
      playDeviceBeep(1000, 0.08);
      return;
    }

    // B. Check exact/clean Member ID or Phone number match
    const matchedMember = pelanggan.find(
      m => m.id.toLowerCase() === barcodeInput.toLowerCase() ||
           matchMemberBarcode(m.id, barcodeInput) ||
           m.telepon.replace(/[^0-9]/g, '') === barcodeInput.replace(/[^0-9]/g, '')
    );
    if (matchedMember) {
      onScanMember(matchedMember);
      clearSearchInput();
      playDeviceBeep(1200, 0.12);
      showToast(`👤 Member "${matchedMember.nama}" dipilih lewat scan!`);
      return;
    }

    // C. Fallback: add first filtered product matching typed text
    if (filteredItems.length > 0) {
      const firstItem = filteredItems[0];
      onAddToCart(firstItem);
      clearSearchInput();
      playDeviceBeep(1000, 0.08);
      showToast(`🛒 Ditambahkan: ${firstItem.nama}`);
    } else {
      showToast(`Barang / Member dengan kode "${barcodeInput}" tidak ditemukan.`);
    }
  };

  const handleSelectItem = (p: ItemBarang) => {
    onAddToCart(p);
    clearSearchInput();
    showToast(`✨ ${p.nama} dimasukkan ke keranjang!`);
  };

  const isDropdownOpen = inputText.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex-grow flex gap-2 items-center">
      <form onSubmit={handleSubmit} className="relative flex-grow">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          ref={inputRef}
          id="kasir-search-input"
          type="search"
          enterKeyHint="search"
          placeholder="Cari barcode / ketik nama produk... (F2)"
          className={`w-full text-xs font-mono pl-8 pr-8 py-1.5 focus:outline-none focus:ring-1.5 focus:ring-red-600 rounded-lg font-medium transition-colors ${
            hologramMode 
              ? 'bg-black border border-zinc-800 text-white placeholder-zinc-500 focus:border-white' 
              : 'bg-white border border-slate-200 text-slate-800'
          }`}
          defaultValue=""
          onChange={handleInputChange}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-gramm="false"
          data-enable-grammarly="false"
        />
        {inputText && (
          <button
            type="button"
            onClick={() => {
              clearSearchInput();
              if (inputRef.current) {
                inputRef.current.focus();
              }
            }}
            className="absolute right-2 px-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {/* SCAN CAMERA HP NEXT TO SEARCH INPUT */}
      <button
        type="button"
        onClick={() => {
          setIsScannerOpen(!isScannerOpen);
          if (!isScannerOpen) setIsCustomItemOpen(false);
        }}
        title="Scan Kamera HP"
        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          isScannerOpen 
            ? 'bg-rose-600 border-rose-500 text-white shadow-sm' 
            : hologramMode
            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Camera className="w-4 h-4" />
      </button>

      {/* TOP UP & CUSTOM ITEM TRIGGER */}
      <button
        type="button"
        onClick={() => {
          setIsCustomItemOpen(!isCustomItemOpen);
          if (!isCustomItemOpen) setIsScannerOpen(false);
        }}
        title="📲 Tambah Top Up / Jasa Kustom"
        className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
          isCustomItemOpen 
            ? 'bg-blue-600 border-blue-500 text-white shadow-sm' 
            : hologramMode
            ? 'bg-zinc-900 border-zinc-805 text-zinc-300 hover:bg-zinc-800'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        <Smartphone className="w-4 h-4" />
      </button>

      {/* REAL-TIME INTERACTIVE SEARCH POPUP DROPDOWN */}
      {isDropdownOpen && (
        <div 
          className={`absolute left-0 w-[320px] xs:w-[360px] sm:w-[460px] max-w-[calc(100vw-32px)] top-full mt-1.5 border rounded-2xl shadow-2xl z-[100] max-h-[360px] overflow-y-auto p-2 space-y-1 ${
            hologramMode 
              ? 'bg-[#151515] border-zinc-800 divide-y divide-zinc-800/60 text-white' 
              : 'bg-white border border-slate-200 divide-y divide-slate-100 text-slate-800'
          }`}
          style={{ willChange: 'transform' }}
        >
          <div className={`px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest flex items-center justify-between select-none ${hologramMode ? 'text-zinc-500' : 'text-slate-400'}`}>
            <span>Hasil Pencarian ({filteredItems.length} Item)</span>
            <span className={`${hologramMode ? 'text-red-400' : 'text-red-600'} font-mono`}>Ketuk untuk Membeli</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400 italic select-none">
              {debouncedQuery === '' ? 'Mencari...' : 'Barang tidak ditemukan.'}
            </div>
          ) : (
            <>
              {filteredItems.slice(0, displayLimit).map(p => {
                const matchedCartQty = keranjang[p.id] || 0;
                const isOutOfStock = p.stok <= 0;
                const kat = p.kategori || 'Lain-lain';
                const icon = CATEGORY_ICONS[kat] || '📦';

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => handleSelectItem(p)}
                    className={`w-full text-left p-2 border border-transparent rounded-xl transition-colors flex items-center justify-between gap-2.5 cursor-pointer group active:scale-[0.99] ${
                      hologramMode 
                        ? 'hover:bg-zinc-800/60 text-white' 
                        : 'hover:bg-slate-50 text-slate-800'
                    } ${
                      isOutOfStock ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    {p.foto ? (
                      <img
                        src={p.foto}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-zinc-800 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg border border-dashed flex items-center justify-center shrink-0 ${
                        hologramMode ? 'border-zinc-800 bg-zinc-900/60 text-zinc-500' : 'border-slate-200 bg-slate-100/70 text-slate-400'
                      }`}>
                        <Camera className="w-4 h-4 opacity-40" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-extrabold line-clamp-1 leading-snug transition-colors ${
                        hologramMode ? 'text-zinc-100 group-hover:text-red-400' : 'text-slate-900 group-hover:text-red-600'
                      }`}>
                        {p.nama}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-mono ${hologramMode ? 'text-zinc-400' : 'text-slate-400'}`}>
                          {p.kode}
                        </span>
                        <span className={`text-[9px] font-medium ${hologramMode ? 'text-zinc-400' : 'text-slate-500'}`}>
                          • {icon} {kat}
                        </span>
                      </div>
                      
                      {/* Multi-Satuan Indicators */}
                      {p.multiSatuan && p.multiSatuan.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          {p.multiSatuan.slice(0, 2).map((sat, satIdx) => (
                            <span
                              key={sat.id || satIdx}
                              className={`text-[8.5px] px-1 py-0.2 rounded border font-semibold ${
                                hologramMode
                                  ? 'bg-zinc-950 border-zinc-800 text-amber-400'
                                  : 'bg-amber-50 border-amber-200 text-amber-800'
                              }`}
                            >
                              📏 {sat.namaSatuan} (x{sat.isiPcs})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                      <div className={`text-xs font-black font-mono ${hologramMode ? 'text-red-400' : 'text-red-600'}`}>
                        Rp {p.jual.toLocaleString('id-ID')}
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono ${
                        isOutOfStock 
                          ? (hologramMode ? 'bg-zinc-900 text-zinc-500' : 'bg-slate-200 text-slate-500') 
                          : p.stok <= 3 
                          ? (hologramMode ? 'bg-rose-950/40 text-rose-300 border border-rose-900/30' : 'bg-rose-100 text-rose-700')
                          : (hologramMode ? 'bg-zinc-900 text-zinc-400' : 'bg-slate-100 text-slate-600')
                      }`}>
                        {isOutOfStock ? 'Habis' : `Stok: ${p.stok - matchedCartQty}`}
                      </span>
                    </div>
                  </button>
                );
              })}

              {filteredItems.length > displayLimit && (
                <div className="p-1 text-center">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit(prev => prev + 15)}
                    className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                      hologramMode 
                        ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Tampilkan lebih banyak ({displayLimit} dari {filteredItems.length})</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

KasirSearchInput.displayName = 'KasirSearchInput';

export default KasirSearchInput;
