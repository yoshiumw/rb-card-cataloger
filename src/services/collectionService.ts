import { CollectionEntry, Card } from '../types';
import { getCardById, cacheCard } from './cardLookupService';

/**
 * Collection Service
 * 
 * Manages the user's card collection.
 * Uses localStorage for persistence.
 * Card data is fetched from the riftcodex.com API.
 */

const COLLECTION_KEY = 'riftbound_collection';

function getCollectionFromStorage(): Map<string, CollectionEntry> {
  const stored = localStorage.getItem(COLLECTION_KEY);
  if (!stored) return new Map();
  
  const entries: CollectionEntry[] = JSON.parse(stored);
  return new Map(entries.map(e => [e.cardId, e]));
}

function saveCollectionToStorage(collection: Map<string, CollectionEntry>): void {
  const entries = Array.from(collection.values());
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(entries));
}

/**
 * Add a card to the collection by card ID
 * If the card already exists, increases quantity
 * Returns async result since it needs to fetch card data from API
 */
export async function addCardToCollection(cardId: string): Promise<{ success: boolean; entry?: CollectionEntry; error?: string }> {
  const card = await getCardById(cardId);
  if (!card) {
    return { success: false, error: `Card not found: "${cardId}". Please check the card ID and try again.` };
  }

  // Cache the card for future lookups
  cacheCard(card);

  const collection = getCollectionFromStorage();
  const existing = collection.get(card.cardId);

  if (existing) {
    existing.quantity += 1;
    existing.updatedAt = new Date().toISOString();
    collection.set(card.cardId, existing);
    saveCollectionToStorage(collection);
    return { success: true, entry: existing };
  } else {
    const newEntry: CollectionEntry = {
      cardId: card.cardId,
      cardName: card.cardName,
      displayName: card.displayName,
      set: card.set,
      setId: card.setId,
      cardNumber: card.cardNumber,
      cardType: card.cardType,
      supertype: card.supertype,
      imageUrl: card.imageUrl,
      rarity: card.rarity,
      quantity: 1,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collection.set(card.cardId, newEntry);
    saveCollectionToStorage(collection);
    return { success: true, entry: newEntry };
  }
}

/**
 * Add a card to the collection directly (from card data)
 */
export function addCardDirectly(card: Card, quantity: number = 1): { success: boolean; entry?: CollectionEntry } {
  cacheCard(card);
  const collection = getCollectionFromStorage();
  const existing = collection.get(card.cardId);

  if (existing) {
    existing.quantity += quantity;
    existing.updatedAt = new Date().toISOString();
    collection.set(card.cardId, existing);
    saveCollectionToStorage(collection);
    return { success: true, entry: existing };
  } else {
    const newEntry: CollectionEntry = {
      cardId: card.cardId,
      cardName: card.cardName,
      displayName: card.displayName,
      set: card.set,
      setId: card.setId,
      cardNumber: card.cardNumber,
      cardType: card.cardType,
      supertype: card.supertype,
      imageUrl: card.imageUrl,
      rarity: card.rarity,
      quantity,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collection.set(card.cardId, newEntry);
    saveCollectionToStorage(collection);
    return { success: true, entry: newEntry };
  }
}

/**
 * Remove a card from the collection
 */
export function removeCardFromCollection(cardId: string): boolean {
  const collection = getCollectionFromStorage();
  if (collection.has(cardId)) {
    collection.delete(cardId);
    saveCollectionToStorage(collection);
    return true;
  }
  return false;
}

/**
 * Update card quantity in collection
 */
export function updateCardQuantity(cardId: string, quantity: number): { success: boolean; entry?: CollectionEntry; error?: string } {
  if (quantity < 0) {
    return { success: false, error: 'Quantity cannot be negative.' };
  }
  
  const collection = getCollectionFromStorage();
  const existing = collection.get(cardId);
  
  if (!existing) {
    return { success: false, error: 'Card not found in collection.' };
  }

  if (quantity === 0) {
    collection.delete(cardId);
  } else {
    existing.quantity = quantity;
    existing.updatedAt = new Date().toISOString();
    collection.set(cardId, existing);
  }
  
  saveCollectionToStorage(collection);
  return { success: true, entry: quantity === 0 ? undefined : existing };
}

/**
 * Get the entire collection
 */
export function getCollection(): Map<string, CollectionEntry> {
  return getCollectionFromStorage();
}

/**
 * Get collection as array
 */
export function getCollectionAsArray(): CollectionEntry[] {
  return Array.from(getCollectionFromStorage().values());
}

/**
 * Search collection (synchronous, searches local data)
 */
export function searchCollection(query: string): CollectionEntry[] {
  const collection = getCollectionAsArray();
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) return collection;
  
  return collection.filter(entry => 
    entry.cardName.toLowerCase().includes(normalizedQuery) ||
    entry.displayName.toLowerCase().includes(normalizedQuery) ||
    entry.cardId.toLowerCase().includes(normalizedQuery) ||
    entry.set.toLowerCase().includes(normalizedQuery) ||
    entry.cardType.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Filter collection by set
 */
export function filterCollectionBySet(setName: string): CollectionEntry[] {
  const collection = getCollectionAsArray();
  if (!setName) return collection;
  return collection.filter(entry => entry.set === setName);
}

/**
 * Get recently added cards
 */
export function getRecentlyAdded(limit: number = 10): CollectionEntry[] {
  const collection = getCollectionAsArray();
  return collection
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, limit);
}

/**
 * Get all unique sets from collection
 */
export function getCollectionSets(): string[] {
  const sets = new Set<string>();
  getCollectionAsArray().forEach(entry => sets.add(entry.set));
  return Array.from(sets).sort();
}
