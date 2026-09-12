import { Card } from '../types';
import { fetchCardById, findCardByName, searchCardsByName } from './apiService';

/**
 * Card Lookup Service
 * 
 * Architecture:
 *   Card ID → Card Lookup Service → API (riftcodex.com) → Result
 * 
 * This service is designed to be independent of the input method.
 * Later, both manual entry and camera scanning can feed into this same service.
 * 
 * Uses the riftcodex.com API with local caching for performance.
 */

// In-memory cache for quick lookups (avoids repeated API calls)
const cardCache = new Map<string, Card>();
const nameCache = new Map<string, Card>();

// Pending requests to avoid duplicate API calls
const pendingRequests = new Map<string, Promise<Card | null>>();

/**
 * Look up a card by its Riftbound ID (e.g., "ven-131" or "OGN-039-298")
 * Uses cache first, then falls back to API.
 * @param cardId - The card identifier
 * @returns The card data if found, null otherwise
 */
export async function getCardById(cardId: string): Promise<Card | null> {
  const normalizedId = cardId.trim().toLowerCase();
  
  // Check cache first
  const cached = cardCache.get(normalizedId);
  if (cached) return cached;
  
  // Check if there's already a pending request for this ID
  const pending = pendingRequests.get(normalizedId);
  if (pending) return pending;
  
  // Fetch from API
  const request = fetchCardById(normalizedId);
  pendingRequests.set(normalizedId, request);
  
  try {
    const card = await request;
    if (card) {
      cardCache.set(normalizedId, card);
      nameCache.set(card.cardName.toLowerCase(), card);
      nameCache.set(card.displayName.toLowerCase(), card);
    }
    return card;
  } finally {
    pendingRequests.delete(normalizedId);
  }
}

/**
 * Look up a card by its name (uses API fuzzy search)
 * @param cardName - The card name (decklist format: "Kai'Sa, Survivor")
 * @returns The card data if found, null otherwise
 */
export async function getCardByName(cardName: string): Promise<Card | null> {
  const normalizedName = cardName.trim().toLowerCase();
  
  // Check cache first
  const cached = nameCache.get(normalizedName);
  if (cached) return cached;
  
  // Also try with dash format
  const dashName = cardName.replace(/,\s*/g, ' - ').toLowerCase();
  const cachedDash = nameCache.get(dashName);
  if (cachedDash) return cachedDash;
  
  // Check pending
  const pending = pendingRequests.get(`name:${normalizedName}`);
  if (pending) return pending;
  
  // Fetch from API
  const request = findCardByName(cardName);
  pendingRequests.set(`name:${normalizedName}`, request);
  
  try {
    const card = await request;
    if (card) {
      cardCache.set(card.cardId.toLowerCase(), card);
      nameCache.set(card.cardName.toLowerCase(), card);
      nameCache.set(card.displayName.toLowerCase(), card);
    }
    return card;
  } finally {
    pendingRequests.delete(`name:${normalizedName}`);
  }
}

/**
 * Search cards by partial name or ID (uses API)
 * @param query - Search query
 * @returns Array of matching cards
 */
export async function searchCards(query: string): Promise<Card[]> {
  if (!query.trim()) return [];
  
  // If it looks like a card ID, try direct lookup first
  const idPattern = /^[A-Za-z]+-\d+/;
  if (idPattern.test(query.trim())) {
    const byId = await getCardById(query.trim());
    if (byId) return [byId];
  }
  
  // Otherwise search by name
  const { cards } = await searchCardsByName(query.trim());
  
  // Cache results
  cards.forEach(card => {
    cardCache.set(card.cardId.toLowerCase(), card);
    nameCache.set(card.cardName.toLowerCase(), card);
    nameCache.set(card.displayName.toLowerCase(), card);
  });
  
  return cards;
}

/**
 * Get all cached cards
 */
export function getCachedCards(): Card[] {
  return Array.from(cardCache.values());
}

/**
 * Get all unique sets from cached cards
 */
export function getCachedSets(): string[] {
  const sets = new Set<string>();
  cardCache.forEach(card => sets.add(card.set));
  return Array.from(sets).sort();
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return cardCache.size;
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  cardCache.clear();
  nameCache.clear();
}

/**
 * Pre-cache a card (add to cache without API call)
 */
export function cacheCard(card: Card): void {
  cardCache.set(card.cardId.toLowerCase(), card);
  nameCache.set(card.cardName.toLowerCase(), card);
  nameCache.set(card.displayName.toLowerCase(), card);
}

/**
 * Check if a card ID format is valid
 * Accepts formats like: VEN-131, OGN-039-298, ven-131, etc.
 */
export function isValidCardIdFormat(cardId: string): boolean {
  // Format: SET-NUMBER or SET-NUMBER-NUMBER
  const pattern = /^[A-Za-z]+-\d+(-\d+)?$/;
  return pattern.test(cardId.trim());
}
