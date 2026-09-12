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
import { db } from '../firebase/config';
import { CollectionEntry, Card } from '../types';
import { getCardById, cacheCard } from './cardLookupService';

// Helper to get db with proper typing
function getDb(): Firestore {
  if (!db) {
    throw new Error('Firebase not configured');
  }
  return db;
}

/**
 * Collection Service - Firestore Version
 * 
 * Manages the user's card collection in Firestore.
 * Data is stored at: users/{userId}/collection/{cardId}
 */

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

    const firestoreDb = getDb();
    const collectionRef = firestoreCollection(firestoreDb, 'users', userId, 'collection');
    const cardDocRef = doc(firestoreDb, 'users', userId, 'collection', card.cardId);
    const cardSnap = await getDoc(cardDocRef);

    const now = new Date().toISOString();

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
        addedAt: now,
        updatedAt: now,
      };
      
      await setDoc(cardDocRef, newEntry);
      return { success: true, entry: newEntry };
    }
  } catch (error) {
    console.error('Error adding card to collection:', error);
    return { success: false, error: 'Failed to add card to collection.' };
  }
}

/**
 * Remove a card from the collection
 */
export async function removeCardFromCollection(userId: string, cardId: string): Promise<boolean> {
  try {
    const firestoreDb = getDb();
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
