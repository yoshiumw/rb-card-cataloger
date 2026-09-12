// Core type definitions for the Riftbound Card Cataloger

export interface Card {
  cardId: string;
  cardName: string;
  set: string;
  cardNumber: string;
  cardType: string;
  imageUrl?: string;
  rarity?: string;
  metadata?: Record<string, unknown>;
}

export interface CollectionEntry {
  cardId: string;
  cardName: string;
  set: string;
  cardNumber: string;
  cardType: string;
  imageUrl?: string;
  quantity: number;
  addedAt: Date;
  updatedAt: Date;
}

export interface DeckCardEntry {
  cardName: string;
  quantity: number;
  cardId?: string;
}

export interface ParsedDecklist {
  legend: DeckCardEntry[];
  champion: DeckCardEntry[];
  mainDeck: DeckCardEntry[];
  battlefields: DeckCardEntry[];
  runePool: DeckCardEntry[];
  sideboard: DeckCardEntry[];
  errors: ParseError[];
}

export interface ParseError {
  lineNumber: number;
  line: string;
  message: string;
}

export interface Deck {
  id: string;
  name: string;
  rawDecklist: string;
  parsedDecklist: ParsedDecklist;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeckSection {
  name: string;
  key: keyof Omit<ParsedDecklist, 'errors'>;
  cards: DeckCardEntry[];
}

export interface CompletionResult {
  cardName: string;
  cardId?: string;
  required: number;
  owned: number;
  missing: number;
  status: 'complete' | 'partial' | 'missing';
}

export interface SectionCompletion {
  sectionName: string;
  sectionKey: string;
  totalRequired: number;
  totalOwned: number;
  totalMissing: number;
  percentage: number;
  cards: CompletionResult[];
}

export interface DeckCompletion {
  sections: SectionCompletion[];
  mainDeckCompletion: SectionCompletion | null;
  sideboardCompletion: SectionCompletion | null;
  overallPercentage: number;
}

export interface MissingCardSummary {
  cardName: string;
  cardId?: string;
  totalNeeded: number;
  owned: number;
  stillNeeded: number;
  requiredBy: { deckName: string; quantity: number; section: string }[];
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export type DeckSectionKey = 'legend' | 'champion' | 'mainDeck' | 'battlefields' | 'runePool' | 'sideboard';
