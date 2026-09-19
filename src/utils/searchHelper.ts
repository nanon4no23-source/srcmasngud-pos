import { ItemBarang } from '../types';

export interface SearchableItem {
  item: ItemBarang;
  namaLower: string;
  kodeLower: string;
  kategoriLower: string;
  words: string[];
}

/**
 * Prepares an item into pre-tokenized lowercase words for ultra-fast matching
 */
export const prepareSearchIndex = (barang: ItemBarang[]): SearchableItem[] => {
  return barang.map(item => {
    const namaLower = (item.nama || '').toLowerCase().trim();
    const kodeLower = (item.kode || '').toLowerCase().trim();
    const kategoriLower = (item.kategori || '').toLowerCase().trim();
    // Split into clean words by space and punctuation
    const words = namaLower.split(/[\s\-_,./+&()]+/).filter(Boolean);
    return {
      item,
      namaLower,
      kodeLower,
      kategoriLower,
      words
    };
  });
};

export interface MatchResult {
  item: ItemBarang;
  score: number; // Lower score = higher priority
}

/**
 * Searches items prioritizing word-prefix matching (suku kata / awalan kata).
 * If word-prefix matches exist, mid-word substring matches (e.g. 'ya' in 'surya')
 * are excluded as requested by user.
 */
export const searchProductsByPrefix = (
  searchIndex: SearchableItem[],
  query: string,
  limit: number = 60
): ItemBarang[] => {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const prefixMatches: MatchResult[] = [];
  const substringFallback: MatchResult[] = [];

  for (let i = 0; i < searchIndex.length; i++) {
    const entry = searchIndex[i];
    const { item, namaLower, kodeLower, words } = entry;

    // 1. Test Word-Prefix Match (Each token matches the START of a word in name, or start of barcode)
    let isPrefixMatch = true;
    let tokenScoreSum = 0;

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      let tokenMatched = false;

      // Check exact start of full product name (Priority 1)
      if (namaLower.startsWith(token)) {
        tokenMatched = true;
        tokenScoreSum += 10;
      } else {
        // Check start of barcode
        if (kodeLower.startsWith(token)) {
          tokenMatched = true;
          tokenScoreSum += 20;
        } else {
          // Check start of any individual word in product name (Priority 2)
          const wordIndex = words.findIndex(w => w.startsWith(token));
          if (wordIndex !== -1) {
            tokenMatched = true;
            tokenScoreSum += 30 + (wordIndex * 5); // earlier words get higher priority
          }
        }
      }

      if (!tokenMatched) {
        isPrefixMatch = false;
        break;
      }
    }

    if (isPrefixMatch) {
      // Extra boost if full name starts directly with entire query
      if (namaLower.startsWith(trimmed)) {
        tokenScoreSum -= 25;
      }
      prefixMatches.push({ item, score: tokenScoreSum });
      continue;
    }

    // 2. Substring fallback candidate (only considered if no prefix matches exist)
    // Checks if all tokens appear anywhere in name or barcode
    let isSubstringMatch = true;
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (!namaLower.includes(token) && !kodeLower.includes(token)) {
        isSubstringMatch = false;
        break;
      }
    }

    if (isSubstringMatch) {
      substringFallback.push({ item, score: 1000 + i });
    }
  }

  // If we have prefix matches, ONLY return prefix matches (excluding mid-word matches!)
  if (prefixMatches.length > 0) {
    prefixMatches.sort((a, b) => a.score - b.score);
    return prefixMatches.slice(0, limit).map(m => m.item);
  }

  // Only if zero prefix matches are found, fallback to substring matches
  substringFallback.sort((a, b) => a.score - b.score);
  return substringFallback.slice(0, limit).map(m => m.item);
};
