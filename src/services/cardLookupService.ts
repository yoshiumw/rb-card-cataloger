import { Card } from '../types';
import { fetchCardById, findCardByName, searchCardsByName } from './apiService';

/**
 * Card Lookup Service
 * 
 * Architecture:
 *   Card ID → Card Lookup Service → Local Cache (localStorage) → API (riftcodex.com) → Result
 * 
 * Cards are cached persistently in localStorage so they survive page reloads.
 * The API is only called when a card is not in the local cache.
 */

const CACHE_KEY = 'riftbound_card_cache';

// In-memory cache (loaded from localStorage on init)
const cardCache = new Map<string, Card>();
const nameCache = new Map<string, Card>();

// Pending requests to avoid duplicate API calls
const pendingRequests = new Map<string, Promise<Card | null>>();

/**
 * Load cache from localStorage into memory
 */
function loadCacheFromStorage(): void {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return;
    
    const cards: Card[] = JSON.parse(stored);
    for (const card of cards) {
      cardCache.set(card.cardId.toLowerCase(), card);
      nameCache.set(card.cardName.toLowerCase(), card);
      nameCache.set(card.displayName.toLowerCase(), card);
    }
  } catch (error) {
    console.error('Failed to load card cache from storage:', error);
  }
}

/**
 * Persist the current cache to localStorage
 */
function saveCacheToStorage(): void {
  try {
    const cards = Array.from(cardCache.values());
    localStorage.setItem(CACHE_KEY, JSON.stringify(cards));
  } catch (error) {
    console.error('Failed to save card cache to storage:', error);
  }
}

// Initialize cache on module load
loadCacheFromStorage();

/**
 * Add a card to the cache and persist
 */
function addToCache(card: Card): void {
  cardCache.set(card.cardId.toLowerCase(), card);
  nameCache.set(card.cardName.toLowerCase(), card);
  nameCache.set(card.displayName.toLowerCase(), card);
  saveCacheToStorage();
}

/**
 * Look up a card by its Riftbound ID (e.g., "ven-131" or "OGN-039-298")
 * Uses persistent cache first, then falls back to API.
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
    if (card) addToCache(card);
    return card;
  } finally {
    pendingRequests.delete(normalizedId);
  }
}

/**
 * Look up a card by its name (uses API fuzzy search if not cached)
 */
export async function getCardByName(cardName: string): Promise<Card | null> {
  const normalizedName = cardName.trim().toLowerCase();
  
  // Check cache first (both formats)
  const cached = nameCache.get(normalizedName);
  if (cached) return cached;
  
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
    if (card) addToCache(card);
    return card;
  } finally {
    pendingRequests.delete(`name:${normalizedName}`);
  }
}

/**
 * Search cards by partial name or ID (uses API)
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
  for (const card of cards) {
    addToCache(card);
  }
  
  return cards;
}

/**
 * Check if a card name is already in the local cache (synchronous)
 */
export function isCardCached(cardName: string): boolean {
  const normalized = cardName.trim().toLowerCase();
  if (nameCache.has(normalized)) return true;
  const dashName = cardName.replace(/,\s*/g, ' - ').toLowerCase();
  return nameCache.has(dashName);
}

/**
 * Get a card from cache synchronously (returns null if not cached)
 */
export function getCachedCardByName(cardName: string): Card | null {
  const normalized = cardName.trim().toLowerCase();
  const cached = nameCache.get(normalized);
  if (cached) return cached;
  const dashName = cardName.replace(/,\s*/g, ' - ').toLowerCase();
  return nameCache.get(dashName) || null;
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
 * Clear the cache (both memory and localStorage)
 */
export function clearCache(): void {
  cardCache.clear();
  nameCache.clear();
  localStorage.removeItem(CACHE_KEY);
}

/**
 * Pre-cache a card (add to cache without API call)
 */
export function cacheCard(card: Card): void {
  addToCache(card);
}

/**
 * Check if a card ID format is valid
 */
/**
 * Validate card ID format
 * Accepts formats like: VEN-131, OGN-039, OGN-039-298
 * Also accepts bullet format: SFD • 100/1xx (converts to SFD-100)
 * Also accepts Rune format: VEN-R05, SFD-R12
 */
export function isValidCardIdFormat(cardId: string): boolean {
  const trimmed = cardId.trim();

  // Standard dash format (including Rune cards with R prefix)
  const dashPattern = /^[A-Z]{2,5}-R?\d{2,4}(-\d{2,4})?$/i;
  if (dashPattern.test(trimmed)) {
    return true;
  }

  // Bullet format (from physical cards)
  const bulletPattern = /^[A-Z]{2,5}\s*[•·]\s*R?\d{1,4}(\/\d{1,4})?$/i;
  return bulletPattern.test(trimmed);
}

/**
 * Normalize card ID format
 * Converts "SFD • 100/1xx" to "SFD-100"
 * Converts "VEN • R05" to "VEN-R05"
 */
export function normalizeCardId(cardId: string): string {
  const trimmed = cardId.trim().toUpperCase();

  // Check if it's bullet format (standard or Rune)
  const bulletMatch = trimmed.match(/^([A-Z]{2,5})\s*[•·]\s*(R?\d{1,4})(?:\/\d{1,4})?$/);
  if (bulletMatch) {
    return `${bulletMatch[1]}-${bulletMatch[2]}`;
  }

  // Already in dash format or unknown format
  return trimmed;
}
