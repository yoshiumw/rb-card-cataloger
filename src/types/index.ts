// Core type definitions for the Riftbound Card Cataloger

// ============ API Response Types ============

export interface RiftboundApiResponse {
  items: RiftboundCard[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface RiftboundCard {
  id: string;
  name: string;
  riftbound_id: string;
  tcgplayer_id?: string;
  collector_number: number;
  attributes: {
    energy: number | null;
    might: number | null;
    power: number | null;
  };
  classification: {
    type: string;
    supertype: string | null;
    rarity: string;
    domain: string[];
  };
  text: {
    rich: string;
    plain: string;
    flavour: string | null;
  };
  set: {
    set_id: string;
    label: string;
  };
  media: {
    image_url: string;
    artist: string;
    accessibility_text: string;
  };
  tags: string[];
  orientation: string;
  metadata: {
    clean_name: string;
    updated_on: string;
    alternate_art: boolean;
    overnumbered: boolean;
    signature: boolean;
  };
  new: boolean;
}

// ============ Application Types ============

export interface Card {
  cardId: string;           // riftbound_id (e.g., "ven-131" or "ogn-039-298")
  cardName: string;         // display name (e.g., "Kai'Sa - Survivor")
  displayName: string;      // decklist-friendly name (e.g., "Kai'Sa, Survivor")
  set: string;              // set label (e.g., "Origins")
  setId: string;            // set code (e.g., "OGN")
  cardNumber: string;       // collector number
  cardType: string;         // type (e.g., "Unit", "Spell")
  supertype: string | null; // supertype (e.g., "Champion")
  imageUrl: string;
  rarity: string;
  domain: string[];
  energy: number | null;
  might: number | null;
  power: number | null;
  cardText: string;
  artist: string;
  tags: string[];
  alternateArt: boolean;
}

export interface CollectionEntry {
  cardId: string;
  cardName: string;
  displayName: string;
  set: string;
  setId: string;
  cardNumber: string;
  cardType: string;
  supertype: string | null;
  imageUrl: string;
  rarity: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
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
