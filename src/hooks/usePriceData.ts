import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { realtimeDb } from '../firebase/config';
import Fuse from 'fuse.js';

export interface CardPrice {
  productId: string;
  name: string;
  cleanName: string;
  lowPrice: number | null;
  midPrice: number | null;
  highPrice: number | null;
  marketPrice: number | null;
  extNumber: string;
  subTypeName: string; // "Normal" | "Foil" | "Showcase" | etc.
}

/**
 * Normalize card number for matching.
 * Handles formats like:
 * - "101/298" -> "101"
 * - "VEN-101" -> "101"
 * - "SFD-153/221" -> "153"
 */
export function normalizeCardNumber(raw: string): string {
  // First, extract just the number part before any "/" (removes "/298" suffix)
  const withoutTotal = raw.split('/')[0].trim();
  // Then remove any set prefix like "VEN-" or "SFD-"
  const withoutPrefix = withoutTotal.replace(/^[A-Z]+-/i, '').trim();
  return withoutPrefix;
}

export function usePriceData() {
  const [prices, setPrices] = useState<Record<string, CardPrice>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!realtimeDb) {
      console.warn('[usePriceData] Firebase Realtime Database not configured');
      setLoading(false);
      return;
    }

    const pricesRef = ref(realtimeDb, 'riftbound_prices_tcgcsv');
    const unsubscribe = onValue(
      pricesRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        setPrices(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[usePriceData] Error fetching prices:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Look up a card by its extNumber (set code + card number, e.g. "VEN-101")
  // This uses normalized matching to handle different ID formats
  const getPriceByCardNumber = (extNumber: string): CardPrice | undefined => {
    const normalizedTarget = normalizeCardNumber(extNumber);
    
    return Object.values(prices).find((p) => {
      const normalizedPrice = normalizeCardNumber(p.extNumber);
      return normalizedPrice === normalizedTarget;
    });
  };

  // Direct lookup by exact extNumber (for when formats already match)
  const getPriceByExactId = (extNumber: string): CardPrice | undefined => {
    return prices[extNumber];
  };

  // Fuzzy match by card name, preferring "Normal" variant when multiple matches exist
  const getPriceByName = (cardName: string): CardPrice | undefined => {
    if (!cardName || Object.keys(prices).length === 0) return undefined;
    
    const priceArray = Object.values(prices);
    const fuse = new Fuse(priceArray, {
      keys: ['cleanName', 'name'],
      threshold: 0.4, // Allow some fuzzy matching for minor typos/variations
      includeScore: false,
    });
    
    const results = fuse.search(cardName);
    console.log('=== Fuzzy Match Debug ===');
    console.log('Looking for:', cardName);
    console.log('Total prices in DB:', priceArray.length);
    console.log('Raw Fuse results count:', results.length);
    if (results.length > 0) {
      console.log('First result:', results[0].item.name, '| subTypeName:', results[0].item.subTypeName);
    }
    
    if (results.length === 0) return undefined;

    // Prefer "Normal" variant if found among the matches
    const normalMatch = results.find((r) => r.item.subTypeName === 'Normal');
    const finalResult = normalMatch?.item ?? results[0].item;
    console.log('Final match:', finalResult.name, '| subTypeName:', finalResult.subTypeName);
    console.log('========================');
    return finalResult;
  };

  return { prices, getPriceByCardNumber, getPriceByExactId, getPriceByName, loading, error };
}
