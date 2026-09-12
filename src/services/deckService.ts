import { 
  collection as firestoreCollection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  Firestore
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Deck, ParsedDecklist } from '../types';
import { parseDecklist } from './decklistParser';
import { v4 as uuidv4 } from 'uuid';

// Helper to get db with proper typing
function getDb(): Firestore {
  if (!db) {
    throw new Error('Firebase not configured');
  }
  return db;
}

/**
 * Create a new deck from a decklist
 */
export async function createDeck(userId: string, name: string, rawDecklist: string): Promise<{ success: boolean; deck?: Deck; error?: string }> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Deck name is required.' };
    }
    if (!rawDecklist.trim()) {
      return { success: false, error: 'Decklist is required.' };
    }

    const parsedDecklist = parseDecklist(rawDecklist);
    
    const totalCards = 
      parsedDecklist.legend.length +
      parsedDecklist.champion.length +
      parsedDecklist.mainDeck.length +
      parsedDecklist.battlefields.length +
      parsedDecklist.runePool.length +
      parsedDecklist.sideboard.length;

    if (totalCards === 0 && parsedDecklist.errors.length > 0) {
      return { success: false, error: 'Could not parse any cards from the decklist. Please check the format.' };
    }

    const now = new Date().toISOString();
    const deckId = uuidv4();
    const deck: Deck = {
      id: deckId,
      name: name.trim(),
      rawDecklist,
      parsedDecklist,
      createdAt: now,
      updatedAt: now,
    };

    const firestoreDb = getDb();
    const deckDocRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
    await setDoc(deckDocRef, deck);

    return { success: true, deck };
  } catch (error) {
    console.error('Error creating deck:', error);
    return { success: false, error: 'Failed to create deck.' };
  }
}

/**
 * Update an existing deck
 */
export async function updateDeck(userId: string, deckId: string, name: string, rawDecklist: string): Promise<{ success: boolean; deck?: Deck; error?: string }> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Deck name is required.' };
    }

    const firestoreDb = getDb();
    const deckDocRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
    const deckSnap = await getDoc(deckDocRef);

    if (!deckSnap.exists()) {
      return { success: false, error: 'Deck not found.' };
    }

    const parsedDecklist = parseDecklist(rawDecklist);
    
    const updatedDeck: Deck = {
      ...deckSnap.data() as Deck,
      name: name.trim(),
      rawDecklist,
      parsedDecklist,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(deckDocRef, updatedDeck);
    return { success: true, deck: updatedDeck };
  } catch (error) {
    console.error('Error updating deck:', error);
    return { success: false, error: 'Failed to update deck.' };
  }
}

/**
 * Delete a deck
 */
export async function deleteDeck(userId: string, deckId: string): Promise<boolean> {
  try {
    const firestoreDb = getDb();
    const deckDocRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
    await deleteDoc(deckDocRef);
    return true;
  } catch (error) {
    console.error('Error deleting deck:', error);
    return false;
  }
}

/**
 * Get all decks
 */
export async function getDecks(userId: string): Promise<Deck[]> {
  try {
    const firestoreDb = getDb();
    const decksRef = firestoreCollection(firestoreDb, 'users', userId, 'decks');
    const querySnapshot = await getDocs(decksRef);
    
    const decks: Deck[] = [];
    querySnapshot.forEach((doc) => {
      decks.push(doc.data() as Deck);
    });
    
    return decks;
  } catch (error) {
    console.error('Error getting decks:', error);
    return [];
  }
}

/**
 * Get a single deck by ID
 */
export async function getDeck(userId: string, deckId: string): Promise<Deck | null> {
  try {
    const firestoreDb = getDb();
    const deckDocRef = doc(firestoreDb, 'users', userId, 'decks', deckId);
    const deckSnap = await getDoc(deckDocRef);
    
    if (deckSnap.exists()) {
      return deckSnap.data() as Deck;
    }
    return null;
  } catch (error) {
    console.error('Error getting deck:', error);
    return null;
  }
}

/**
 * Preview parsed decklist without saving
 */
export function previewDecklist(rawDecklist: string): ParsedDecklist {
  return parseDecklist(rawDecklist);
}
