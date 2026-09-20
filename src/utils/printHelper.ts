import { ConfigStruk, Transaksi, DetailItemTransaksi, ItemBarang, Pelanggan } from '../types';

export const formatNameForReceipt = (name: string): string => {
  return name;
};

export interface DebtItem {
  rawLine: string;
  description: string;
  amount: number;
  isTrx: boolean;
  trxId?: string;
  date?: string;
}

export const parseDebtsFromNotes = (catatan?: string): DebtItem[] => {
  if (!catatan) return [];
  const lines = catatan.split('\n');
  const results: DebtItem[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check if line contains "UTANG" keyword (case insensitive) or "hutang"/"bon"
    const isDebtKeyword = /utang|hutang|piutang|bon/i.test(trimmed);
    
    // Check for Rp value
    const rpMatch = trimmed.match(/Rp\s*([0-9.]+)/i);
    if (rpMatch) {
      const amountStr = rpMatch[1].replace(/\./g, '');
      const amount = parseInt(amountStr, 10) || 0;
      
      if (amount > 0) {
        const trxMatch = trimmed.match(/#TRX-([a-zA-Z0-9\-]+)/i);
        const dateMatch = trimmed.match(/\(([^)]+)\)/);
        const date = dateMatch ? dateMatch[1] : '';
        
        results.push({
          rawLine: line,
          description: trimmed,
          amount,
          isTrx: !!trxMatch,
          trxId: trxMatch ? trxMatch[0].substring(1) : undefined,
          date: date || undefined
        });
        continue;
      }
    }
    
    // Fallback if debt keyword is present without Rp (e.g. "utang 15000")
    if (isDebtKeyword) {
      const numMatch = trimmed.match(/\b\d+(?:\.\d{3})*(?:\b|$)/);
      if (numMatch) {
        const val = parseInt(numMatch[0].replace(/\./g, ''), 10) || 0;
        if (val > 0) {
          results.push({
            rawLine: line,
            description: trimmed,
            amount: val,
            isTrx: false,
            date: undefined
          });
        }
      }
    }
  }
  return results;
};

export function formatReceiptText(trx: Transaksi, config: ConfigStruk, paperWidth = 32, allTransactions?: Transaksi[]): string {
  const padLine = (left: string, right: string): string => {
    const spaceCount = paperWidth - left.length - right.length;
    if (spaceCount <= 0) return left + " " + right;
    return left + " ".repeat(spaceCount) + right;
  };

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);
  const dblLine = "=".repeat(paperWidth);

  let result = "";
  
  // Name (Toko Header)
  result += centerText(config.namaToko.toUpperCase()) + "\n";
  
  // Alamat / Telepon
  if (config.alamatToko) {
    // Split into lines if wider than paper width
    const words = config.alamatToko.split(' ');
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length >= paperWidth - 2) {
        result += centerText(currentLine.trim()) + "\n";
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine.trim()) {
      result += centerText(currentLine.trim()) + "\n";
    }
  }
  
  result += dblLine + "\n";
  
  // Metadata
  result += `Nota : #${trx.id}\n`;
  result += `Sesi : ${trx.waktu}\n`;
  if (config.kasirAktif) {
    result += `Kasir: ${config.kasirAktif}\n`;
  }
  result += line + "\n";

  // Items List
  trx.items.forEach(item => {
    const formattedNama = formatNameForReceipt(item.nama);
    // If name is too long, we display it, wrapping in clean style
    const maxNameWidth = paperWidth;
    if (formattedNama.length > maxNameWidth) {
      result += formattedNama.substring(0, maxNameWidth) + "\n";
      if (formattedNama.length > maxNameWidth) {
        const remaining = formattedNama.substring(maxNameWidth);
        const subChunk = remaining.substring(0, maxNameWidth - 4);
        result += "  " + subChunk + "..\n";
      }
    } else {
      result += formattedNama + "\n";
    }
    
    // Line item info: "  2 x 3.500 (Grosir 1)   7.000"
    const promoLabel = (item.jenisHarga !== 'Ecer' && item.jenisHarga !== 'Kustom') ? ` (${item.jenisHarga})` : "";
    const leftText = `  ${item.qty} x ${item.jual.toLocaleString('id-ID')}${promoLabel}`;
    const rightText = item.subtotal.toLocaleString('id-ID');
    result += padLine(leftText, rightText) + "\n";
  });

  result += line + "\n";
  
  // Totals block
  const totalQty = trx.items.reduce((sum, item) => sum + item.qty, 0);
  result += padLine("Jumlah Item", `${totalQty} Pcs`) + "\n";
  
  const hasPelunasan = typeof trx.pelunasanHutang === 'number' && trx.pelunasanHutang > 0;
  if (hasPelunasan) {
    result += padLine("Subtotal Belanja", "Rp " + trx.total.toLocaleString('id-ID')) + "\n";
    result += padLine("Pelunasan Hutang", "Rp " + (trx.pelunasanHutang || 0).toLocaleString('id-ID')) + "\n";
    result += padLine("TOTAL TAGIHAN", "Rp " + (trx.total + (trx.pelunasanHutang || 0)).toLocaleString('id-ID')) + "\n";
  } else {
    result += padLine("TOTAL", "Rp " + trx.total.toLocaleString('id-ID')) + "\n";
  }
  
  const payMethod = trx.metodePembayaran || 'Tunai';
  result += padLine(payMethod.toUpperCase(), "Rp " + trx.bayar.toLocaleString('id-ID')) + "\n";
  
  const grandTotalRec = trx.total + (trx.pelunasanHutang || 0);
  const sisaCash = trx.bayar - grandTotalRec;
  const labelKembali = sisaCash >= 0 ? "KEMBALIAN" : "KURANG (UTANG)";
  const nominalKembali = "Rp " + Math.abs(sisaCash).toLocaleString('id-ID');
  result += padLine(labelKembali, nominalKembali) + "\n";

  // If there are previous debts paid off in this transaction, show original details and time
  if (hasPelunasan && trx.rincianHutangLunas && trx.rincianHutangLunas.length > 0) {
    result += line + "\n";
    result += centerText("RINCIAN HUTANG LUNAS") + "\n";
    trx.rincianHutangLunas.forEach((debtRaw) => {
      const debtParsed = parseDebtsFromNotes(debtRaw)[0];
      if (debtParsed) {
        const matchedTrx = debtParsed.isTrx && debtParsed.trxId && allTransactions
          ? allTransactions.find(t => t.id === debtParsed.trxId)
          : undefined;
          
        const isAutomaticDebt = !!(matchedTrx && matchedTrx.items && matchedTrx.items.length > 0);

        if (isAutomaticDebt && matchedTrx) {
          // Format for automatic transaction debt referring to the transaction layout
          const debtTitle = `Hutang Rp ${debtParsed.amount.toLocaleString('id-ID')}`;
          result += `${debtTitle}\n`;
          const debtDateStr = debtParsed.date ? debtParsed.date : "Sesi Lama";
          result += `  Tgl: ${debtDateStr}\n`;
          matchedTrx.items.forEach(item => {
            const formattedNama = formatNameForReceipt(item.nama);
            result += `  - ${formattedNama.substring(0, paperWidth - 14)}\n`;
            result += padLine(`    ${item.qty}x Rp ${item.jual.toLocaleString('id-ID')}`, `Rp ${item.subtotal.toLocaleString('id-ID')}`) + "\n";
          });
        } else {
          // Format for manual debt with aligned colons
          const nominalStr = `Rp ${debtParsed.amount.toLocaleString('id-ID')}`;
          result += `Hutang      : ${nominalStr}\n`;
          
          const debtDateStr = debtParsed.date ? debtParsed.date : "Sesi Lama";
          result += `Tanggal     : ${debtDateStr}\n`;
          
          let rawDesc = debtParsed.description
            .replace('[UTANG MANUAL]', '')
            .replace(/\[UTANG\s*#[^\]]+\]/i, '')
            .trim();
          // Strip out Rp amount
          rawDesc = rawDesc.replace(/Rp\s*[0-9.]+/i, '').trim();
          // Strip out date pattern
          rawDesc = rawDesc.replace(/\([^)]+\)/g, '').trim();
          // Clean leading/trailing symbols
          let cleanDesc = rawDesc.replace(/^[\s-:]+/, '').replace(/[\s-:]+$/, '').trim();
          
          if (!cleanDesc) {
            cleanDesc = "Kurangan / Sisa Pelunasan";
          }
          
          result += `Keterangan  : ${cleanDesc}\n`;
        }
      }
    });
  }
  
  result += dblLine + "\n";
  
  // Pelanggan Loyalty Section if selected
  if (trx.pelangganNama) {
    result += centerText("LOYALITAS MEMBER") + "\n";
    result += `Nama: ${trx.pelangganNama.substring(0, paperWidth - 6)}\n`;
    if (trx.nilaiPotonganPoin && trx.nilaiPotonganPoin > 0) {
      result += padLine("Potongan Poin", `-Rp ${trx.nilaiPotonganPoin.toLocaleString('id-ID')}`) + "\n";
      result += `Poin Ditukar: ${trx.poinDitukar} Poin\n`;
    }
    if (trx.poinDidapat && trx.poinDidapat > 0) {
      result += `Poin Baru   : +${trx.poinDidapat} Poin\n`;
    }
    result += dblLine + "\n";
  }
  
  // Notes / Footnote
  if (config.footnoteToko) {
    const fnWords = config.footnoteToko.split(' ');
    let fnLine = "";
    fnWords.forEach(word => {
      if ((fnLine + word).length >= paperWidth - 2) {
        result += centerText(fnLine.trim()) + "\n";
        fnLine = word + " ";
      } else {
        fnLine += word + " ";
      }
    });
    if (fnLine.trim()) {
      result += centerText(fnLine.trim()) + "\n";
    }
  }
  
  result += "\n\n\n";

  return result;
}

// Convert ESC/POS controls
export function convertTextToEscPosBytes(text: string): Uint8Array {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  
  const ESC_INIT = new Uint8Array([0x1b, 0x40]); // Initialize
  const ESC_FEED_PULL = new Uint8Array([0x1b, 0x64, 0x03]); // Feed 3 lines and cut/pull
  
  const mergedBytes = new Uint8Array(ESC_INIT.length + textBytes.length + ESC_FEED_PULL.length);
  mergedBytes.set(ESC_INIT, 0);
  mergedBytes.set(textBytes, ESC_INIT.length);
  mergedBytes.set(ESC_FEED_PULL, ESC_INIT.length + textBytes.length);
  
  return mergedBytes;
}

/**
 * Converts a standard Image URL (relative, absolute, or base64) into black-and-white
 * ESC/POS raster bit image command bytes (GS v 0).
 */
export function convertImageToEscPosBytes(imageUrl: string, targetWidth = 384): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const ratio = img.height / img.width;
        const width = targetWidth; // Standard 58mm printer is 384 pixels
        const height = Math.round(width * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        // Standard ESC/POS raster bit image horizontal bytes
        const widthBytes = Math.ceil(width / 8);
        const imageBytes = new Uint8Array(widthBytes * height);

        // Convert to black & white (monochrome bitmask) using a brightness threshold
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixelIdx = (y * width + x) * 4;
            const r = pixels[pixelIdx];
            const g = pixels[pixelIdx + 1];
            const b = pixels[pixelIdx + 2];
            const a = pixels[pixelIdx + 3];

            let isBlack = false;
            if (a > 50) {
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              if (gray < 165) { // 165 gives slightly darker details (very clear on thermal printheads)
                isBlack = true;
              }
            }

            if (isBlack) {
              const byteIdx = y * widthBytes + Math.floor(x / 8);
              const bitIdx = 7 - (x % 8);
              imageBytes[byteIdx] |= (1 << bitIdx);
            }
          }
        }

        // ESC/POS GS v 0 m xL xH yL yH Command
        const xL = widthBytes & 0xff;
        const xH = (widthBytes >> 8) & 0xff;
        const yL = height & 0xff;
        const yH = (height >> 8) & 0xff;

        // Alignment: Center -> ESC a 1 (0x1b 0x61 0x01)
        // Alignment: Left -> ESC a 0 (0x1b 0x61 0x00)
        const ESC_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]);
        const ESC_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);
        
        const GS_V_0_HEADER = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
        const LINE_FEED = new Uint8Array([0x0a]); // Line feed after image

        // Combine all chunks
        const totalSize = ESC_ALIGN_CENTER.length + GS_V_0_HEADER.length + imageBytes.length + LINE_FEED.length + ESC_ALIGN_LEFT.length;
        const escposBytes = new Uint8Array(totalSize);

        let offset = 0;
        escposBytes.set(ESC_ALIGN_CENTER, offset); offset += ESC_ALIGN_CENTER.length;
        escposBytes.set(GS_V_0_HEADER, offset); offset += GS_V_0_HEADER.length;
        escposBytes.set(imageBytes, offset); offset += imageBytes.length;
        escposBytes.set(LINE_FEED, offset); offset += LINE_FEED.length;
        escposBytes.set(ESC_ALIGN_LEFT, offset); offset += ESC_ALIGN_LEFT.length;

        resolve(escposBytes);
      } catch (err) {
        console.error("Error formatting image for ESC/POS:", err);
        resolve(null);
      }
    };
    img.onerror = (err) => {
      console.error("Failed to load image for ESC/POS conversion:", err);
      resolve(null);
    };
    img.src = imageUrl;
  });
}

export function getEan8Digits(code: string): string {
  const numericOnly = code.replace(/\D/g, '');
  let digits7 = "";
  
  if (/^\d+$/.test(code) && (code.length === 7 || code.length === 8)) {
    digits7 = code.slice(0, 7);
  } else if (numericOnly.length >= 7) {
    digits7 = numericOnly.slice(0, 7);
  } else {
    // Alphanumeric or short numeric -> hash to 7 digits deterministically
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = (hash << 5) - hash + code.charCodeAt(i);
      hash |= 0;
    }
    // Absolute value and pad
    let hashStr = Math.abs(hash).toString();
    while (hashStr.length < 7) {
      hashStr = "0" + hashStr;
    }
    digits7 = hashStr.slice(-7);
  }

  // Calculate EAN-8 checksum
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(digits7[i], 10);
    const weight = (i % 2 === 0) ? 3 : 1;
    sum += digit * weight;
  }
  const checksum = (10 - (sum % 10)) % 10;
  return digits7 + checksum.toString();
}

export function getEan13Digits(code: string): string {
  const numericOnly = code.replace(/\D/g, '');
  if (numericOnly.length >= 12) {
    const digits12 = numericOnly.slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits12[i], 10);
      const weight = (i % 2 === 0) ? 1 : 3;
      sum += digit * weight;
    }
    const checksum = (10 - (sum % 10)) % 10;
    return digits12 + checksum.toString();
  }
  return "";
}

const EAN13_PARITY = [
  [0, 0, 0, 0, 0, 0], // 0: L L L L L L
  [0, 0, 1, 0, 1, 1], // 1: L L G L G G
  [0, 0, 1, 1, 0, 1], // 2: L L G G L G
  [0, 0, 1, 1, 1, 0], // 3: L L G G G L
  [0, 1, 0, 0, 1, 1], // 4: L G L L G G
  [0, 1, 1, 0, 0, 1], // 5: L G G L L G
  [0, 1, 1, 1, 0, 0], // 6: L G G G L L
  [0, 1, 0, 1, 0, 1], // 7: L G L G L G
  [0, 1, 0, 1, 1, 0], // 8: L G L G G L
  [0, 1, 1, 0, 1, 0]  // 9: L G G L G L
];

const L_CODES = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const G_CODES = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const R_CODES = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];

export function getEan13Binary(ean13Code: string): string {
  if (ean13Code.length !== 13 || !/^\d+$/.test(ean13Code)) {
    return "";
  }
  const firstDigit = parseInt(ean13Code[0], 10);
  const leftDigits = ean13Code.slice(1, 7);
  const rightDigits = ean13Code.slice(7, 13);
  const parityPattern = EAN13_PARITY[firstDigit];

  let binary = "101"; // Start guard

  // Left 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(leftDigits[i], 10);
    const useG = parityPattern[i] === 1;
    binary += useG ? G_CODES[digit] : L_CODES[digit];
  }

  binary += "01010"; // Center guard

  // Right 6 digits
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(rightDigits[i], 10);
    binary += R_CODES[digit];
  }

  binary += "101"; // End guard
  return binary;
}

export function matchBarcode(productCode: string, inputBarcode: string): boolean {
  const pCode = (productCode || '').trim();
  const iBar = (inputBarcode || '').trim();
  if (!pCode || !iBar) return false;
  if (pCode.toLowerCase() === iBar.toLowerCase()) return true;

  const isEan13 = /^\d{12,13}$/.test(pCode);
  if (isEan13) {
    return getEan13Digits(pCode) === iBar;
  } else {
    return getEan8Digits(pCode) === iBar;
  }
}

export function matchMemberBarcode(memberId: string, inputBarcode: string): boolean {
  const mId = (memberId || '').trim();
  const iBar = (inputBarcode || '').trim();
  if (!mId || !iBar) return false;
  if (mId.toLowerCase() === iBar.toLowerCase()) return true;

  const mIdClean = mId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const iBarClean = iBar.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (mIdClean && iBarClean && mIdClean === iBarClean) return true;

  const ean8 = getEan8Digits(mId);
  if (ean8 === iBar || (iBarClean && ean8 === iBarClean)) return true;

  const ean13 = getEan13Digits(mId);
  if (ean13 && (ean13 === iBar || (iBarClean && ean13 === iBarClean))) return true;

  return false;
}

export function getEan8Binary(ean8Code: string): string {
  if (ean8Code.length !== 8 || !/^\d+$/.test(ean8Code)) {
    return ""; // Invalid
  }
  
  const leftA = [
    '0001101', '0011001', '0010011', '0111101', '0100011',
    '0110001', '0101111', '0111011', '0110111', '0001011'
  ];
  
  const rightC = [
    '1110010', '1100110', '1101100', '1000010', '1011100',
    '1001110', '1010000', '1000100', '1001000', '1110100'
  ];

  let binary = "";
  // Start guard
  binary += "101";

  // Left 4 digits
  for (let i = 0; i < 4; i++) {
    const digit = parseInt(ean8Code[i], 10);
    binary += leftA[digit];
  }

  // Center guard
  binary += "01010";

  // Right 4 digits
  for (let i = 4; i < 8; i++) {
    const digit = parseInt(ean8Code[i], 10);
    binary += rightC[digit];
  }

  // End guard
  binary += "101";

  return binary;
}

export function getEan8SvgHtml(ean8Code: string, height = 65, moduleWidth = 2.5): { rects: string; totalWidth: number } {
  const binary = getEan8Binary(ean8Code);
  if (!binary) return { rects: "", totalWidth: 0 };

  let rects = "";
  let currentX = 10; // Left margin
  
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      rects += '<rect x="' + currentX + '" y="0" width="' + moduleWidth + '" height="' + height + '" fill="#000000" />';
    }
    currentX += moduleWidth;
  }
  const totalWidth = currentX + 10; // Add right margin
  return { rects, totalWidth };
}

export function getEan13SvgHtml(ean13Code: string, height = 65, moduleWidth = 2.5): { rects: string; totalWidth: number } {
  const binary = getEan13Binary(ean13Code);
  if (!binary) return { rects: "", totalWidth: 0 };

  let rects = "";
  let currentX = 10; // Left margin
  
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      rects += '<rect x="' + currentX + '" y="0" width="' + moduleWidth + '" height="' + height + '" fill="#000000" />';
    }
    currentX += moduleWidth;
  }
  const totalWidth = currentX + 10; // Add right margin
  return { rects, totalWidth };
}

// Convert Member Card custom text containing a BARCODE block into ESC/POS bytes with physical EAN-8 barcode generation
export function convertMemberCardToEscPosBytes(text: string, barcodeValue: string): Uint8Array {
  const encoder = new TextEncoder();
  const ean8Digits = getEan8Digits(barcodeValue);
  
  const parts = text.split('[BARCODE]\n');
  const part1Bytes = encoder.encode(parts[0] || "");
  const part2Bytes = encoder.encode(parts[1] || "");
  
  const ESC_INIT = new Uint8Array([0x1b, 0x40]); // Initialize
  
  // ESC/POS Barcode commands
  const GS_HEIGHT = new Uint8Array([0x1d, 0x68, 120]);     // height: 120 dots (~15mm)
  const GS_WIDTH = new Uint8Array([0x1d, 0x77, 3]);        // width: 3 (thicker bars for great contrast)
  const GS_HRI = new Uint8Array([0x1d, 0x48, 0]);         // HRI (Human Readable Interpretation): 0 = none
  const GS_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]); // alignment: center
  const GS_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);   // alignment: left
  
  // Format EAN-8 barcode (system m=68 (System B), length=8, NO NUL terminator)
  const barcodeHeader = new Uint8Array([0x1d, 0x6b, 68, 8]);
  const barcodeData = encoder.encode(ean8Digits);
  
  const ESC_FEED_PULL = new Uint8Array([0x1b, 0x64, 0x03]); // Feed 3 lines and cut/pull
  
  const totalLength = 
    ESC_INIT.length + 
    part1Bytes.length + 
    GS_ALIGN_CENTER.length + 
    GS_HEIGHT.length + 
    GS_WIDTH.length + 
    GS_HRI.length + 
    barcodeHeader.length + 
    barcodeData.length + 
    GS_ALIGN_LEFT.length + 
    part2Bytes.length + 
    ESC_FEED_PULL.length;
    
  const mergedBytes = new Uint8Array(totalLength);
  let offset = 0;
  
  mergedBytes.set(ESC_INIT, offset); offset += ESC_INIT.length;
  mergedBytes.set(part1Bytes, offset); offset += part1Bytes.length;
  
  // Align center for barcode
  mergedBytes.set(GS_ALIGN_CENTER, offset); offset += GS_ALIGN_CENTER.length;
  mergedBytes.set(GS_HEIGHT, offset); offset += GS_HEIGHT.length;
  mergedBytes.set(GS_WIDTH, offset); offset += GS_WIDTH.length;
  mergedBytes.set(GS_HRI, offset); offset += GS_HRI.length;
  mergedBytes.set(barcodeHeader, offset); offset += barcodeHeader.length;
  mergedBytes.set(barcodeData, offset); offset += barcodeData.length;
  
  // Back to left align for the remaining text
  mergedBytes.set(GS_ALIGN_LEFT, offset); offset += GS_ALIGN_LEFT.length;
  mergedBytes.set(part2Bytes, offset); offset += part2Bytes.length;
  
  // Feed/cut
  mergedBytes.set(ESC_FEED_PULL, offset); offset += ESC_FEED_PULL.length;
  
  return mergedBytes;
}

export function convertProductBarcodeToEscPosBytes(
  item: ItemBarang, 
  config: ConfigStruk, 
  paperWidth = 32, 
  formatMode: 'nama_dan_barcode' | 'lengkap' = 'nama_dan_barcode'
): Uint8Array {
  const encoder = new TextEncoder();
  const cleanKode = item.kode.trim();
  const isEan13 = /^\d{12,13}$/.test(cleanKode);
  const barcodeValue = isEan13 ? getEan13Digits(cleanKode) : getEan8Digits(cleanKode);
  const barcodeSystem = isEan13 ? 67 : 68;
  const barcodeLength = isEan13 ? 13 : 8;

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);

  // Build the textual parts
  const shopName = config.namaToko.toUpperCase();
  const prodName = item.nama.toUpperCase();
  const priceStr = "Rp " + item.jual.toLocaleString('id-ID');

  // Let's create individual text lines
  let headerText = "";
  if (formatMode === 'lengkap') {
    headerText += centerText(shopName) + "\n";
    headerText += line + "\n";
  }
  
  // Word wrap product name
  const words = prodName.split(' ');
  let currentLine = "";
  words.forEach(word => {
    if ((currentLine + word).length >= paperWidth - 2) {
      headerText += centerText(currentLine.trim()) + "\n";
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });
  if (currentLine.trim()) {
    headerText += centerText(currentLine.trim()) + "\n";
  }

  if (formatMode === 'lengkap') {
    headerText += centerText(priceStr) + "\n\n";
  } else {
    headerText += "\n";
  }

  let footerText = "\n" + centerText(barcodeValue) + "\n";
  if (formatMode === 'lengkap') {
    footerText += line + "\n";
    footerText += centerText(`LABEL BARCODE PRODUK (${isEan13 ? 'EAN-13' : 'EAN-8'})`) + "\n";
  }

  const part1Bytes = encoder.encode(headerText);
  const part2Bytes = encoder.encode(footerText);

  const ESC_INIT = new Uint8Array([0x1b, 0x40]); // Initialize

  // ESC/POS Barcode commands
  const GS_HEIGHT = new Uint8Array([0x1d, 0x68, 120]);     // height: 120 dots (~15mm)
  const GS_WIDTH = new Uint8Array([0x1d, 0x77, 3]);        // width: 3 (high physical scanning contrast)
  const GS_HRI = new Uint8Array([0x1d, 0x48, 0]);         // HRI (Human Readable Interpretation): 0 = none
  const GS_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]); // alignment: center
  const GS_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);   // alignment: left

  // Format barcode (67 is EAN-13, 68 is EAN-8)
  const barcodeHeader = new Uint8Array([0x1d, 0x6b, barcodeSystem, barcodeLength]);
  const barcodeData = encoder.encode(barcodeValue);

  const ESC_FEED_PULL = new Uint8Array([0x1b, 0x64, 0x03]); // Feed 3 lines and cut/pull

  const totalLength = 
    ESC_INIT.length + 
    GS_ALIGN_CENTER.length + 
    part1Bytes.length + 
    GS_HEIGHT.length + 
    GS_WIDTH.length + 
    GS_HRI.length + 
    barcodeHeader.length + 
    barcodeData.length + 
    part2Bytes.length + 
    GS_ALIGN_LEFT.length + 
    ESC_FEED_PULL.length;

  const mergedBytes = new Uint8Array(totalLength);
  let offset = 0;

  mergedBytes.set(ESC_INIT, offset); offset += ESC_INIT.length;
  // Use center alignment for the entire label
  mergedBytes.set(GS_ALIGN_CENTER, offset); offset += GS_ALIGN_CENTER.length;
  mergedBytes.set(part1Bytes, offset); offset += part1Bytes.length;

  mergedBytes.set(GS_HEIGHT, offset); offset += GS_HEIGHT.length;
  mergedBytes.set(GS_WIDTH, offset); offset += GS_WIDTH.length;
  mergedBytes.set(GS_HRI, offset); offset += GS_HRI.length;
  mergedBytes.set(barcodeHeader, offset); offset += barcodeHeader.length;
  mergedBytes.set(barcodeData, offset); offset += barcodeData.length;

  mergedBytes.set(part2Bytes, offset); offset += part2Bytes.length;
  mergedBytes.set(GS_ALIGN_LEFT, offset); offset += GS_ALIGN_LEFT.length;

  // Feed/cut
  mergedBytes.set(ESC_FEED_PULL, offset); offset += ESC_FEED_PULL.length;

  return mergedBytes;
}

export function formatDebtReceiptText(
  pelangganNama: string,
  type: "Cicilan" | "Lunas Penuh",
  amountPaid: number,
  remainingDebt: number,
  details: string,
  config: ConfigStruk,
  paperWidth = 32,
  items?: DetailItemTransaksi[]
): string {
  const padLine = (left: string, right: string): string => {
    const spaceCount = paperWidth - left.length - right.length;
    if (spaceCount <= 0) return left + " " + right;
    return left + " ".repeat(spaceCount) + right;
  };

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);
  const dblLine = "=".repeat(paperWidth);

  let result = "";
  
  // Name (Toko Header)
  result += centerText(config.namaToko.toUpperCase()) + "\n";
  
  // Alamat / Telepon
  if (config.alamatToko) {
    const words = config.alamatToko.split(' ');
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length >= paperWidth - 2) {
        result += centerText(currentLine.trim()) + "\n";
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine.trim()) {
      result += centerText(currentLine.trim()) + "\n";
    }
  }
  
  result += dblLine + "\n";
  
  // Title
  result += centerText("STRUK BUKU HUTANG") + "\n";
  result += line + "\n";
  
  // Metadata
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + " WIB";
  
  result += `Waktu  : ${dateStr}\n`;
  result += `Pelang : ${pelangganNama.substring(0, paperWidth - 9)}\n`;
  if (config.kasirAktif) {
    result += `Kasir  : ${config.kasirAktif.substring(0, paperWidth - 9)}\n`;
  }
  result += line + "\n";
  
  // Description/Info
  result += "KETERANGAN:\n";
  const descPrefix = type === "Lunas Penuh" ? "Pelunasan: " : "Pembayaran cicilan: ";
  const fullDesc = descPrefix + details;
  
  // Line wrap the description
  const words = fullDesc.split(' ');
  let currentDescLine = "  ";
  words.forEach(word => {
    if ((currentDescLine + word).length >= paperWidth) {
      result += currentDescLine + "\n";
      currentDescLine = "  " + word + " ";
    } else {
      currentDescLine += word + " ";
    }
  });
  if (currentDescLine.trim()) {
    result += currentDescLine + "\n";
  }
  
  // Under the description, print original shopping list items if available
  if (items && items.length > 0) {
    result += line + "\n";
    result += centerText("RINCIAN BARANG:") + "\n";
    items.forEach(item => {
      const formattedNama = formatNameForReceipt(item.nama);
      const maxNameWidth = paperWidth;
      if (formattedNama.length > maxNameWidth) {
        result += formattedNama.substring(0, maxNameWidth) + "\n";
        if (formattedNama.length > maxNameWidth) {
          const remaining = formattedNama.substring(maxNameWidth);
          const subChunk = remaining.substring(0, maxNameWidth - 4);
          result += "  " + subChunk + "..\n";
        }
      } else {
        result += formattedNama + "\n";
      }
      
      const promoLabel = (item.jenisHarga !== 'Ecer' && item.jenisHarga !== 'Kustom') ? ` (${item.jenisHarga})` : "";
      const leftText = `  ${item.qty} x ${item.jual.toLocaleString('id-ID')}${promoLabel}`;
      const rightText = item.subtotal.toLocaleString('id-ID');
      result += padLine(leftText, rightText) + "\n";
    });
  }
  
  result += line + "\n";
  
  // Flow
  result += padLine("Transaksi", type.toUpperCase()) + "\n";
  result += padLine("Jumlah Bayar", "Rp " + amountPaid.toLocaleString('id-ID')) + "\n";
  result += padLine("Sisa Hutang", "Rp " + remainingDebt.toLocaleString('id-ID')) + "\n";
  
  result += dblLine + "\n";
  
  // Footnote
  if (config.footnoteToko) {
    const fnWords = config.footnoteToko.split(' ');
    let fnLine = "";
    fnWords.forEach(word => {
      if ((fnLine + word).length >= paperWidth - 2) {
        result += centerText(fnLine.trim()) + "\n";
        fnLine = word + " ";
      } else {
        fnLine += word + " ";
      }
    });
    if (fnLine.trim()) {
      result += centerText(fnLine.trim()) + "\n";
    }
  }
  
  result += "\n\n\n";
  return result;
}

export function convertMemberCardLabelToEscPosBytes(p: Pelanggan, config: ConfigStruk, paperWidth = 32): Uint8Array {
  const encoder = new TextEncoder();
  const ean8Digits = getEan8Digits(p.id);

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);
  const dblLine = "=".repeat(paperWidth);

  const shopName = config.namaToko.toUpperCase();
  const address = config.alamatToko || "KASIR SRC MASNGUD PREMIUM SYSTEM";

  // Build the text segments
  let headerText = "";
  headerText += centerText(shopName) + "\n";
  headerText += centerText(address) + "\n";
  headerText += dblLine + "\n";
  headerText += centerText("KARTU MEMBER") + "\n";
  headerText += dblLine + "\n";
  
  headerText += "ID PEL : " + ean8Digits + "\n";
  headerText += "NAMA   : " + p.nama.toUpperCase() + "\n";
  headerText += "TELP   : " + p.telepon + "\n";
  headerText += "DAFTAR : " + p.tanggalDaftar + "\n";
  headerText += "POIN   : " + p.poin + " POIN\n";
  headerText += line + "\n\n";

  let footerText = "\n" + centerText(ean8Digits) + "\n";
  footerText += line + "\n";
  footerText += centerText("Tunjukkan QR/ID ini pada") + "\n";
  footerText += centerText("kasir untuk klaim poin.") + "\n";
  footerText += line + "\n";

  const part1Bytes = encoder.encode(headerText);
  const part2Bytes = encoder.encode(footerText);

  const ESC_INIT = new Uint8Array([0x1b, 0x40]); // Initialize

  // ESC/POS Barcode commands
  const GS_HEIGHT = new Uint8Array([0x1d, 0x68, 120]);     // height: 120 dots (~15mm)
  const GS_WIDTH = new Uint8Array([0x1d, 0x77, 3]);        // width: 3 (higher physical scanning contrast)
  const GS_HRI = new Uint8Array([0x1d, 0x48, 0]);         // HRI (Human Readable Interpretation): 0 = none
  const GS_ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01]); // alignment: center
  const GS_ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00]);   // alignment: left

  // Format EAN-8 barcode (system m=68 (System B), length=8, NO NUL terminator)
  const barcodeHeader = new Uint8Array([0x1d, 0x6b, 68, 8]);
  const barcodeData = encoder.encode(ean8Digits);

  const ESC_FEED_PULL = new Uint8Array([0x1b, 0x64, 0x03]); // Feed 3 lines and cut/pull

  const totalLength = 
    ESC_INIT.length + 
    part1Bytes.length + 
    GS_ALIGN_CENTER.length + 
    GS_HEIGHT.length + 
    GS_WIDTH.length + 
    GS_HRI.length + 
    barcodeHeader.length + 
    barcodeData.length + 
    part2Bytes.length + 
    GS_ALIGN_LEFT.length + 
    ESC_FEED_PULL.length;

  const mergedBytes = new Uint8Array(totalLength);
  let offset = 0;

  mergedBytes.set(ESC_INIT, offset); offset += ESC_INIT.length;
  // Part 1 text
  mergedBytes.set(part1Bytes, offset); offset += part1Bytes.length;

  // Align center for barcode
  mergedBytes.set(GS_ALIGN_CENTER, offset); offset += GS_ALIGN_CENTER.length;
  mergedBytes.set(GS_HEIGHT, offset); offset += GS_HEIGHT.length;
  mergedBytes.set(GS_WIDTH, offset); offset += GS_WIDTH.length;
  mergedBytes.set(GS_HRI, offset); offset += GS_HRI.length;
  mergedBytes.set(barcodeHeader, offset); offset += barcodeHeader.length;
  mergedBytes.set(barcodeData, offset); offset += barcodeData.length;

  // Align back for Part 2 text or center as part 2 also has centerText
  mergedBytes.set(part2Bytes, offset); offset += part2Bytes.length;
  mergedBytes.set(GS_ALIGN_LEFT, offset); offset += GS_ALIGN_LEFT.length;

  // Feed/cut
  mergedBytes.set(ESC_FEED_PULL, offset); offset += ESC_FEED_PULL.length;

  return mergedBytes;
}

export function formatConsolidatedDebtReceiptText(
  pelangganNama: string,
  debtsPaid: DebtItem[],
  allTransactions: Transaksi[],
  config: ConfigStruk,
  paperWidth = 32
): string {
  const padLine = (left: string, right: string): string => {
    const spaceCount = paperWidth - left.length - right.length;
    if (spaceCount <= 0) return left + " " + right;
    return left + " ".repeat(spaceCount) + right;
  };

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);
  const dblLine = "=".repeat(paperWidth);

  let result = "";

  // Name (Toko Header)
  result += centerText(config.namaToko.toUpperCase()) + "\n";
  if (config.alamatToko) {
    const words = config.alamatToko.split(' ');
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length >= paperWidth - 2) {
        result += centerText(currentLine.trim()) + "\n";
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine.trim()) {
      result += centerText(currentLine.trim()) + "\n";
    }
  }

  result += dblLine + "\n";
  result += centerText("STRUK GABUNGAN PELUNASAN") + "\n";
  result += line + "\n";

  // Metadata
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + " WIB";

  result += `Waktu  : ${dateStr}\n`;
  result += `Pelang : ${pelangganNama.substring(0, paperWidth - 9)}\n`;
  if (config.kasirAktif) {
    result += `Kasir  : ${config.kasirAktif.substring(0, paperWidth - 9)}\n`;
  }
  result += line + "\n";

  result += centerText("RINCIAN HUTANG & BARANG") + "\n";
  result += line + "\n";

  let totalAmount = 0;

  debtsPaid.forEach((d, idx) => {
    totalAmount += d.amount;
    const debtTitle = `Hutang #${idx + 1}: Rp ${d.amount.toLocaleString('id-ID')}`;
    result += `${debtTitle}\n`;
    const debtDateStr = d.date ? d.date : "Sesi Lama";
    result += `  Tgl: ${debtDateStr}\n`;

    // Find the original transaction
    const matchedTrx = d.isTrx && d.trxId 
      ? allTransactions.find(t => t.id === d.trxId) 
      : undefined;

    if (matchedTrx && matchedTrx.items && matchedTrx.items.length > 0) {
      result += " * Rincian Belanja:\n";
      matchedTrx.items.forEach(item => {
        const formattedNama = formatNameForReceipt(item.nama);
        result += `   - ${formattedNama.substring(0, paperWidth - 14)}\n`;
        result += padLine(`     ${item.qty}x Rp ${item.jual.toLocaleString('id-ID')}`, `Rp ${item.subtotal.toLocaleString('id-ID')}`) + "\n";
      });
    } else {
      // Manual or not found transaction
      const cleanDesc = d.description
        .replace('[UTANG MANUAL] ', '')
        .replace(/\[UTANG\s*#[^\]]+\]\s*/i, '');
      const descriptionText = d.isTrx 
        ? `   - Sisa nota #${d.trxId || 'TRX'}` 
        : `   - ${cleanDesc}`;
      result += descriptionText + "\n";
    }

    result += "- ".repeat(Math.floor(paperWidth / 2)) + "\n";
  });

  result += line + "\n";
  result += padLine("TOTAL PELUNASAN", "Rp " + totalAmount.toLocaleString('id-ID')) + "\n";
  result += padLine("SISA HUTANG AKTIF", "Rp 0") + "\n";
  result += dblLine + "\n";

  // Footnote
  if (config.footnoteToko) {
    const fnWords = config.footnoteToko.split(' ');
    let fnLine = "";
    fnWords.forEach(word => {
      if ((fnLine + word).length >= paperWidth - 2) {
        result += centerText(fnLine.trim()) + "\n";
        fnLine = word + " ";
      } else {
        fnLine += word + " ";
      }
    });
    if (fnLine.trim()) {
      result += centerText(fnLine.trim()) + "\n";
    }
  }

  result += "\n\n\n";
  return result;
}

export function formatHistoryPaymentReceiptText(
  log: {
    id: string;
    memberId: string;
    namaMember: string;
    tanggal: string;
    nominal: number;
    keterangan: string;
    tipe: 'Cicilan' | 'Lunas Penuh';
  },
  config: ConfigStruk,
  paperWidth = 32
): string {
  const padLine = (left: string, right: string): string => {
    const spaceCount = paperWidth - left.length - right.length;
    if (spaceCount <= 0) return left + " " + right;
    return left + " ".repeat(spaceCount) + right;
  };

  const centerText = (text: string): string => {
    if (text.length >= paperWidth) return text.substring(0, paperWidth);
    const pad = Math.floor((paperWidth - text.length) / 2);
    return " ".repeat(pad) + text;
  };

  const line = "-".repeat(paperWidth);
  const dblLine = "=".repeat(paperWidth);

  let result = "";

  // Name (Toko Header)
  result += centerText(config.namaToko.toUpperCase()) + "\n";
  if (config.alamatToko) {
    const words = config.alamatToko.split(' ');
    let currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length >= paperWidth - 2) {
        result += centerText(currentLine.trim()) + "\n";
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    });
    if (currentLine.trim()) {
      result += centerText(currentLine.trim()) + "\n";
    }
  }

  result += dblLine + "\n";
  result += centerText("STRUK SALINAN PELUNASAN") + "\n";
  result += centerText("(RE-PRINT)") + "\n";
  result += line + "\n";

  result += `No. Ref : ${log.id}\n`;
  result += `Waktu   : ${log.tanggal}\n`;
  result += `Pelang  : ${log.namaMember.substring(0, paperWidth - 10)}\n`;
  if (config.kasirAktif) {
    result += `Kasir   : ${config.kasirAktif.substring(0, paperWidth - 10)}\n`;
  }
  result += line + "\n";

  result += "DETAIL PELUNASAN:\n";
  const descText = log.keterangan
    .replace('[UTANG MANUAL] ', '')
    .replace(/\[UTANG\s*#[^\]]+\]\s*/i, '');
  
  // Wrap description details nicely
  const words = descText.split(' ');
  let currentDescLine = "  ";
  words.forEach(word => {
    if ((currentDescLine + word).length >= paperWidth) {
      result += currentDescLine + "\n";
      currentDescLine = "  " + word + " ";
    } else {
      currentDescLine += word + " ";
    }
  });
  if (currentDescLine.trim()) {
    result += currentDescLine + "\n";
  }

  result += line + "\n";
  result += padLine("Status", log.tipe.toUpperCase()) + "\n";
  result += padLine("Nominal Bayar", "Rp " + log.nominal.toLocaleString('id-ID')) + "\n";
  result += dblLine + "\n";

  // Footnote
  if (config.footnoteToko) {
    const fnWords = config.footnoteToko.split(' ');
    let fnLine = "";
    fnWords.forEach(word => {
      if ((fnLine + word).length >= paperWidth - 2) {
        result += centerText(fnLine.trim()) + "\n";
        fnLine = word + " ";
      } else {
        fnLine += word + " ";
      }
    });
    if (fnLine.trim()) {
      result += centerText(fnLine.trim()) + "\n";
    }
  }

  result += "\n\n\n";
  return result;
}

/**
 * Universal printing via off-screen iframe.
 * Never destroys or navigates the primary webview or React app in Android APK!
 */
export const printHtmlViaHiddenIframe = (htmlContent: string) => {
  try {
    const existing = document.getElementById('app-print-hidden-iframe');
    if (existing) {
      existing.remove();
    }
    const iframe = document.createElement('iframe');
    iframe.id = 'app-print-hidden-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '10px';
    iframe.style.height = '10px';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.warn('Iframe print error, falling back to window.print', err);
          window.print();
        }
      }, 500);
    }
  } catch (err) {
    console.error('Failed to trigger hidden iframe print', err);
    window.print();
  }
};



