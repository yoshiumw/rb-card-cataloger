import { 
  collection as firestoreCollection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  limit,
  Firestore
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase/config';
import { CollectionEntry, Card } from '../types';
import { getCardById, cacheCard } from './cardLookupService';

// Helper to get db with proper typing.
// Returns null when Firebase isn't configured so callers can fall back to
// localStorage instead of throwing (which previously made every add silently fail).
function getDb(): Firestore | null {
  if (!db || !isFirebaseConfigured) {
    return null;
  }
  return db;
}

/**
 * Collection Service
 *
 * Primary store is Firestore: users/{userId}/collection/{cardId}.
 * When Firebase is NOT configured (demo / local mode), we fall back to
 * per-user localStorage keys: riftbound_collection_{userId}.
 * Without this fallback, adding cards would throw "Firebase not configured",
 * get swallowed by the catch block, and nothing would ever reach the collection.
 */

function getLocalStorageKey(userId: string): string {
  return `riftbound_collection_${userId}`;
}

function readLocalCollection(userId: string): Map<string, CollectionEntry> {
  try {
    const stored = localStorage.getItem(getLocalStorageKey(userId));
    if (!stored) return new Map();
    const entries = JSON.parse(stored) as CollectionEntry[];
    const map = new Map<string, CollectionEntry>();
    for (const entry of entries) {
      map.set(entry.cardId, entry);
    }
    return map;
  } catch (error) {
    console.error('Failed to read local collection:', error);
    return new Map();
  }
}

function writeLocalCollection(userId: string, collectionMap: Map<string, CollectionEntry>): void {
  try {
    const entries = Array.from(collectionMap.values());
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save local collection:', error);
  }
}

/**
 * Clear a user's locally-stored collection (used on logout cleanup)
 */
export function clearUserCollection(userId: string): void {
  localStorage.removeItem(getLocalStorageKey(userId));
}

/**
 * Add a card to the collection by card ID
 */
export async function addCardToCollection(userId: string, cardId: string): Promise<{ success: boolean; entry?: CollectionEntry; error?: string }> {
  try {
    const card = await getCardById(cardId);
    if (!card) {
      return { success: false, error: `Card not found: "${cardId}". Please check the card ID and try again.` };
    }

    // Cache the card for future lookups
    cacheCard(card);

    const now = new Date().toISOString();
    const firestoreDb = getDb();

    if (!firestoreDb) {
      // Demo mode (Firebase not configured): persist to per-user localStorage
      const collectionMap = readLocalCollection(userId);
      const existing = collectionMap.get(card.cardId);
      const entry: CollectionEntry = existing
        ? { ...existing, quantity: existing.quantity + 1, updatedAt: now }
        : buildEntry(card, now);
      collectionMap.set(card.cardId, entry);
      writeLocalCollection(userId, collectionMap);
      return { success: true, entry };
    }

    const cardDocRef = doc(firestoreDb, 'users', userId, 'collection', card.cardId);
    const cardSnap = await getDoc(cardDocRef);

    if (cardSnap.exists()) {
      // Update quantity
      const currentData = cardSnap.data() as CollectionEntry;
      const updatedEntry: CollectionEntry = {
        ...currentData,
        quantity: currentData.quantity + 1,
        updatedAt: now,
      };

      await setDoc(cardDocRef, updatedEntry);
      return { success: true, entry: updatedEntry };
    } else {
      // Add new card
      const newEntry = buildEntry(card, now);

      await setDoc(cardDocRef, newEntry);
      return { success: true, entry: newEntry };
    }
  } catch (error) {
    console.error('Error adding card to collection:', error);
    return { success: false, error: 'Failed to add card to collection.' };
  }
}

/**
 * Build a fresh CollectionEntry from a Card
 */
function buildEntry(card: Card, timestamp: string): CollectionEntry {
  return {
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
    addedAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Remove a card from the collection
 */
export async function removeCardFromCollection(userId: string, cardId: string): Promise<boolean> {
  try {
    const firestoreDb = getDb();
    if (!firestoreDb) {
      // Demo mode: remove from per-user localStorage
      const collectionMap = readLocalCollection(userId);
      if (!collectionMap.has(cardId)) return false;
      collectionMap.delete(cardId);
      writeLocalCollection(userId, collectionMap);
      return true;
    }

    const cardDocRef = doc(firestoreDb, 'users', userId, 'collection', cardId);
    await deleteDoc(cardDocRef);
    return true;
  } catch (error) {
    console.error('Error removing card from collection:', error);
    return false;
  }
}

/**
 * Update card quantity in collection
 */
export async function updateCardQuantity(userId: string, cardId: string, quantity: number): Promise<{ success: boolean; entry?: CollectionEntry; error?: string }> {
  try {
    if (quantity < 0) {
      return { success: false, error: 'Quantity cannot be negative.' };
    }

    const firestoreDb = getDb();

    if (!firestoreDb) {
      // Demo mode: update per-user localStorage
      const collectionMap = readLocalCollection(userId);
      const currentData = collectionMap.get(cardId);
      if (!currentData) {
        return { success: false, error: 'Card not found in collection.' };
      }
      if (quantity === 0) {
        collectionMap.delete(cardId);
        writeLocalCollection(userId, collectionMap);
        return { success: true };
      }
      const updatedEntry: CollectionEntry = {
        ...currentData,
        quantity,
        updatedAt: new Date().toISOString(),
      };
      collectionMap.set(cardId, updatedEntry);
      writeLocalCollection(userId, collectionMap);
      return { success: true, entry: updatedEntry };
    }

    const cardDocRef = doc(firestoreDb, 'users', userId, 'collection', cardId);
    const cardSnap = await getDoc(cardDocRef);

    if (!cardSnap.exists()) {
      return { success: false, error: 'Card not found in collection.' };
    }

    if (quantity === 0) {
      await deleteDoc(cardDocRef);
      return { success: true };
    }

    const currentData = cardSnap.data() as CollectionEntry;
    const updatedEntry: CollectionEntry = {
      ...currentData,
      quantity,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(cardDocRef, updatedEntry);
    return { success: true, entry: updatedEntry };
  } catch (error) {
    console.error('Error updating card quantity:', error);
    return { success: false, error: 'Failed to update card quantity.' };
  }
}

/**
 * Get the entire collection
 */
export async function getCollection(userId: string): Promise<Map<string, CollectionEntry>> {
  try {
    const firestoreDb = getDb();
    if (!firestoreDb) {
      // Demo mode: read from per-user localStorage
      return readLocalCollection(userId);
    }

    const collectionRef = firestoreCollection(firestoreDb, 'users', userId, 'collection');
    const querySnapshot = await getDocs(collectionRef);

    const collectionMap = new Map<string, CollectionEntry>();
    querySnapshot.forEach((doc) => {
      collectionMap.set(doc.id, doc.data() as CollectionEntry);
    });

    return collectionMap;
  } catch (error) {
    console.error('Error getting collection:', error);
    return new Map();
  }
}

/**
 * Get collection as array
 */
export async function getCollectionAsArray(userId: string): Promise<CollectionEntry[]> {
  const collectionMap = await getCollection(userId);
  return Array.from(collectionMap.values());
}

/**
 * Search collection
 */
export async function searchCollection(userId: string, searchQuery: string): Promise<CollectionEntry[]> {
  const collectionArray = await getCollectionAsArray(userId);
  const normalizedQuery = searchQuery.toLowerCase().trim();
  
  if (!normalizedQuery) return collectionArray;
  
  return collectionArray.filter(entry => 
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
export async function filterCollectionBySet(userId: string, setName: string): Promise<CollectionEntry[]> {
  const collectionArray = await getCollectionAsArray(userId);
  if (!setName) return collectionArray;
  return collectionArray.filter(entry => entry.set === setName);
}

/**
 * Get recently added cards
 */
export async function getRecentlyAdded(userId: string, limitCount: number = 10): Promise<CollectionEntry[]> {
  try {
    const firestoreDb = getDb();
    if (!firestoreDb) {
      // Demo mode: sort local entries by addedAt
      const entries = Array.from(readLocalCollection(userId).values());
      return entries
        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
        .slice(0, limitCount);
    }

    const collectionRef = firestoreCollection(firestoreDb, 'users', userId, 'collection');
    const q = query(
      collectionRef,
      orderBy('addedAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as CollectionEntry);
  } catch (error) {
    console.error('Error getting recently added cards:', error);
    return [];
  }
}

/**
 * Get all unique sets from collection
 */
export async function getCollectionSets(userId: string): Promise<string[]> {
  const collectionArray = await getCollectionAsArray(userId);
  const sets = new Set<string>();
  collectionArray.forEach(entry => sets.add(entry.set));
  return Array.from(sets).sort();
}
