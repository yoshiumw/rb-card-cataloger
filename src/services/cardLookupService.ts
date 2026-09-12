import { Card } from '../types';
import { sampleCards } from '../data/cardDatabase';

/**
 * Card Lookup Service
 * 
 * Architecture:
 *   Card ID → Card Lookup Service → Card Database → Result
 * 
 * This service is designed to be independent of the input method.
 * Later, both manual entry and camera scanning can feed into this same service.
 * 
 * Currently uses localStorage as a local card database.
 * In production, this would query Firestore's /cards collection.
 */

// In-memory cache for quick lookups
let cardCache: Map<string, Card> = new Map();
let nameCache: Map<string, Card> = new Map();

function initializeCache() {
  const stored = localStorage.getItem('riftbound_card_database');
  if (stored) {
    const cards: Card[] = JSON.parse(stored);
    cardCache = new Map(cards.map(c => [c.cardId.toLowerCase(), c]));
    nameCache = new Map(cards.map(c => [c.cardName.toLowerCase(), c]));
  } else {
    cardCache = new Map(sampleCards.map(c => [c.cardId.toLowerCase(), c]));
    nameCache = new Map(sampleCards.map(c => [c.cardName.toLowerCase(), c]));
  }
}

initializeCache();

/**
 * Look up a card by its ID
 * @param cardId - The card identifier (e.g., "CR-001" or "XYZ-123")
 * @returns The card data if found, null otherwise
 */
export function getCardById(cardId: string): Card | null {
  const normalizedId = cardId.trim().toLowerCase();
  return cardCache.get(normalizedId) || null;
}

/**
 * Look up a card by its name
 * @param cardName - The exact card name
 * @returns The card data if found, null otherwise
 */
export function getCardByName(cardName: string): Card | null {
  const normalizedName = cardName.trim().toLowerCase();
  return nameCache.get(normalizedName) || null;
}

/**
 * Search cards by partial name or ID
 * @param query - Search query
 * @returns Array of matching cards
 */
export function searchCards(query: string): Card[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  
  const results: Card[] = [];
  cardCache.forEach(card => {
    if (
      card.cardName.toLowerCase().includes(normalizedQuery) ||
      card.cardId.toLowerCase().includes(normalizedQuery) ||
      card.set.toLowerCase().includes(normalizedQuery) ||
      card.cardType.toLowerCase().includes(normalizedQuery)
    ) {
      results.push(card);
    }
  });
  
  return results;
}

/**
 * Get all unique sets in the database
 */
export function getAllSets(): string[] {
  const sets = new Set<string>();
  cardCache.forEach(card => sets.add(card.set));
  return Array.from(sets).sort();
}

/**
 * Get all cards in the database
 */
export function getAllCards(): Card[] {
  return Array.from(cardCache.values());
}

/**
 * Add a card to the database (for importing new card data)
 */
export function addCardToDatabase(card: Card): void {
  cardCache.set(card.cardId.toLowerCase(), card);
  nameCache.set(card.cardName.toLowerCase(), card);
  
  // Persist to localStorage
  const allCards = Array.from(cardCache.values());
  localStorage.setItem('riftbound_card_database', JSON.stringify(allCards));
}

/**
 * Import multiple cards into the database
 */
export function importCards(cards: Card[]): void {
  cards.forEach(card => {
    cardCache.set(card.cardId.toLowerCase(), card);
    nameCache.set(card.cardName.toLowerCase(), card);
  });
  
  const allCards = Array.from(cardCache.values());
  localStorage.setItem('riftbound_card_database', JSON.stringify(allCards));
}

/**
 * Get total card count in database
 */
export function getDatabaseSize(): number {
  return cardCache.size;
}

/**
 * Validate a card ID format
 * Accepts formats like: CR-001, RB-001, XYZ-123, etc.
 */
export function isValidCardIdFormat(cardId: string): boolean {
  const pattern = /^[A-Za-z]+-\d+$/;
  return pattern.test(cardId.trim());
}
