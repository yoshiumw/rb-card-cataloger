import { Deck, ParsedDecklist } from '../types';
import { parseDecklist } from './decklistParser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Deck Service
 * 
 * Manages saved decklists.
 * Uses localStorage for persistence.
 */

const DECKS_KEY = 'riftbound_decks';

function getDecksFromStorage(): Deck[] {
  const stored = localStorage.getItem(DECKS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
}

function saveDecksToStorage(decks: Deck[]): void {
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

/**
 * Create a new deck from a decklist
 */
export function createDeck(name: string, rawDecklist: string): { success: boolean; deck?: Deck; error?: string } {
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
  const deck: Deck = {
    id: uuidv4(),
    name: name.trim(),
    rawDecklist,
    parsedDecklist,
    createdAt: now,
    updatedAt: now,
  };

  const decks = getDecksFromStorage();
  decks.push(deck);
  saveDecksToStorage(decks);

  return { success: true, deck };
}

/**
 * Update an existing deck
 */
export function updateDeck(deckId: string, name: string, rawDecklist: string): { success: boolean; deck?: Deck; error?: string } {
  if (!name.trim()) {
    return { success: false, error: 'Deck name is required.' };
  }

  const decks = getDecksFromStorage();
  const index = decks.findIndex(d => d.id === deckId);
  
  if (index === -1) {
    return { success: false, error: 'Deck not found.' };
  }

  const parsedDecklist = parseDecklist(rawDecklist);
  
  decks[index] = {
    ...decks[index],
    name: name.trim(),
    rawDecklist,
    parsedDecklist,
    updatedAt: new Date().toISOString(),
  };

  saveDecksToStorage(decks);
  return { success: true, deck: decks[index] };
}

/**
 * Delete a deck
 */
export function deleteDeck(deckId: string): boolean {
  const decks = getDecksFromStorage();
  const filtered = decks.filter(d => d.id !== deckId);
  
  if (filtered.length === decks.length) return false;
  
  saveDecksToStorage(filtered);
  return true;
}

/**
 * Get all decks
 */
export function getDecks(): Deck[] {
  return getDecksFromStorage();
}

/**
 * Get a single deck by ID
 */
export function getDeck(deckId: string): Deck | null {
  const decks = getDecksFromStorage();
  return decks.find(d => d.id === deckId) || null;
}

/**
 * Preview parsed decklist without saving
 */
export function previewDecklist(rawDecklist: string): ParsedDecklist {
  return parseDecklist(rawDecklist);
}
