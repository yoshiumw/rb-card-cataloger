import { ParsedDecklist, CollectionEntry, DeckCompletion, SectionCompletion, CompletionResult, MissingCardSummary, Deck, DeckSectionKey } from '../types';
import { getCachedCards } from './cardLookupService';

/**
 * Completion Calculator Service
 * 
 * Compares a decklist against a user's collection to determine
 * what cards are missing and how complete the deck is.
 * 
 * Uses cached card data for name matching (cards are cached when looked up via API).
 */

const SECTION_NAMES: Record<DeckSectionKey, string> = {
  legend: 'Legend',
  champion: 'Champion',
  mainDeck: 'Main Deck',
  battlefields: 'Battlefields',
  runePool: 'Rune Pool',
  sideboard: 'Sideboard',
};

/**
 * Normalize a card name for matching.
 * Handles both formats:
 *   "Kai'Sa, Survivor" (decklist) → "kaisa survivor"
 *   "Kai'Sa - Survivor" (API) → "kaisa survivor"
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[,']/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Check if two card names match, allowing for variations.
 * Handles cases like:
 *   - "Kennen, Heart of the Tempest" vs "Yordle, Kennen - Heart of the Tempest"
 *   - Different punctuation and formatting
 */
function namesMatch(decklistName: string, cachedName: string): boolean {
  const normalizedDecklist = normalizeName(decklistName);
  const normalizedCached = normalizeName(cachedName);
  
  // Exact match after normalization
  if (normalizedDecklist === normalizedCached) return true;
  
  // Check if one is a substring of the other
  if (normalizedCached.includes(normalizedDecklist) || normalizedDecklist.includes(normalizedCached)) {
    return true;
  }
  
  // Check if the significant words match (ignore common prefixes like "Yordle", "The", etc.)
  const decklistWords = normalizedDecklist.split(' ').filter(w => w.length > 2);
  const cachedWords = normalizedCached.split(' ').filter(w => w.length > 2);
  
  // If most words from the decklist name appear in the cached name, it's a match
  const matchingWords = decklistWords.filter(word => cachedWords.includes(word));
  const matchRatio = matchingWords.length / decklistWords.length;
  
  return matchRatio >= 0.7; // 70% of words must match
}

/**
 * Build a name-based index from the collection
 */
function buildCollectionNameIndex(collection: Map<string, CollectionEntry>): Map<string, CollectionEntry> {
  const index = new Map<string, CollectionEntry>();
  collection.forEach(entry => {
    // Index by both display name and card name
    index.set(normalizeName(entry.displayName), entry);
    index.set(normalizeName(entry.cardName), entry);
    index.set(entry.cardName.toLowerCase(), entry);
    index.set(entry.displayName.toLowerCase(), entry);
  });
  return index;
}

/**
 * Find a collection entry by card name using flexible matching
 */
function findCollectionEntry(
  cardName: string,
  collectionByName: Map<string, CollectionEntry>
): CollectionEntry | undefined {
  // Try exact normalized match first
  const normalized = normalizeName(cardName);
  let entry = collectionByName.get(normalized);
  if (entry) return entry;
  
  // Try lowercase match
  entry = collectionByName.get(cardName.toLowerCase());
  if (entry) return entry;
  
  // Try flexible matching
  for (const [key, value] of collectionByName.entries()) {
    if (namesMatch(cardName, value.cardName) || namesMatch(cardName, value.displayName)) {
      return value;
    }
  }
  
  return undefined;
}

/**
 * Build a name-based index from cached API cards
 */
function buildCardNameIndex(): Map<string, string> {
  const index = new Map<string, string>();
  getCachedCards().forEach(card => {
    index.set(normalizeName(card.displayName), card.cardId);
    index.set(normalizeName(card.cardName), card.cardId);
    index.set(card.cardName.toLowerCase(), card.cardId);
    index.set(card.displayName.toLowerCase(), card.cardId);
  });
  return index;
}

/**
 * Calculate completion for a single section
 */
function calculateSectionCompletion(
  sectionKey: DeckSectionKey,
  cards: { cardName: string; quantity: number }[],
  collectionByName: Map<string, CollectionEntry>,
  cardNameIndex: Map<string, string>
): SectionCompletion {
  const completionCards: CompletionResult[] = [];
  let totalRequired = 0;
  let totalOwned = 0;

  for (const deckCard of cards) {
    // Try to find the card in the collection using flexible matching
    const collectionEntry = findCollectionEntry(deckCard.cardName, collectionByName);
    
    const owned = collectionEntry ? collectionEntry.quantity : 0;
    const missing = Math.max(0, deckCard.quantity - owned);
    const actualOwned = Math.min(owned, deckCard.quantity);

    // Try to get card ID from cache using flexible matching
    const normalizedDeckName = normalizeName(deckCard.cardName);
    let cardId = 
      cardNameIndex.get(normalizedDeckName) ||
      cardNameIndex.get(deckCard.cardName.toLowerCase());
    
    // If not found in index, try flexible matching against cached cards
    if (!cardId) {
      const cachedCards = getCachedCards();
      for (const cachedCard of cachedCards) {
        if (namesMatch(deckCard.cardName, cachedCard.cardName) || 
            namesMatch(deckCard.cardName, cachedCard.displayName)) {
          cardId = cachedCard.cardId;
          break;
        }
      }
    }
    
    // Fall back to collection entry's card ID
    if (!cardId && collectionEntry) {
      cardId = collectionEntry.cardId;
    }

    totalRequired += deckCard.quantity;
    totalOwned += actualOwned;

    let status: CompletionResult['status'] = 'complete';
    if (missing > 0 && owned > 0) status = 'partial';
    else if (missing > 0 && owned === 0) status = 'missing';

    completionCards.push({
      cardName: deckCard.cardName,
      cardId,
      required: deckCard.quantity,
      owned,
      missing,
      status,
    });
  }

  const totalMissing = Math.max(0, totalRequired - totalOwned);
  const percentage = totalRequired > 0 ? Math.round((totalOwned / totalRequired) * 1000) / 10 : 0;

  return {
    sectionName: SECTION_NAMES[sectionKey],
    sectionKey,
    totalRequired,
    totalOwned,
    totalMissing,
    percentage,
    cards: completionCards,
  };
}

/**
 * Calculate full deck completion against a collection
 */
export function calculateDeckCompletion(
  parsedDecklist: ParsedDecklist,
  collection: Map<string, CollectionEntry>
): DeckCompletion {
  const collectionByName = buildCollectionNameIndex(collection);
  const cardNameIndex = buildCardNameIndex();

  const sections: SectionCompletion[] = [];
  const sectionKeys: DeckSectionKey[] = ['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'];

  for (const key of sectionKeys) {
    const sectionCards = parsedDecklist[key];
    if (sectionCards.length > 0) {
      const completion = calculateSectionCompletion(key, sectionCards, collectionByName, cardNameIndex);
      sections.push(completion);
    }
  }

  const mainDeckCompletion = sections.find(s => s.sectionKey === 'mainDeck') || null;
  const sideboardCompletion = sections.find(s => s.sectionKey === 'sideboard') || null;

  // Overall percentage based on main sections (excluding sideboard)
  const mainSections = sections.filter(s => s.sectionKey !== 'sideboard');
  const totalMainRequired = mainSections.reduce((s, sec) => s + sec.totalRequired, 0);
  const totalMainOwned = mainSections.reduce((s, sec) => s + sec.totalOwned, 0);
  const overallPercentage = totalMainRequired > 0 
    ? Math.round((totalMainOwned / totalMainRequired) * 1000) / 10 
    : 100;

  return {
    sections,
    mainDeckCompletion,
    sideboardCompletion,
    overallPercentage,
  };
}

/**
 * Calculate missing cards across multiple decks
 */
export function calculateMissingCards(
  decks: Deck[],
  collection: Map<string, CollectionEntry>
): MissingCardSummary[] {
  const collectionByName = buildCollectionNameIndex(collection);
  const cardNameIndex = buildCardNameIndex();

  // Aggregate required cards across all decks
  const cardRequirements = new Map<string, {
    cardName: string;
    cardId?: string;
    totalRequired: number;
    requiredBy: { deckName: string; quantity: number; section: string }[];
  }>();

  for (const deck of decks) {
    const parsed = deck.parsedDecklist;
    const sectionKeys: DeckSectionKey[] = ['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'];

    for (const key of sectionKeys) {
      for (const card of parsed[key]) {
        const normalizedName = normalizeName(card.cardName);
        let cardId = cardNameIndex.get(normalizedName) || cardNameIndex.get(card.cardName.toLowerCase());
        
        // If not found in index, try flexible matching against cached cards
        if (!cardId) {
          const cachedCards = getCachedCards();
          for (const cachedCard of cachedCards) {
            if (namesMatch(card.cardName, cachedCard.cardName) || 
                namesMatch(card.cardName, cachedCard.displayName)) {
              cardId = cachedCard.cardId;
              break;
            }
          }
        }

        if (!cardRequirements.has(normalizedName)) {
          cardRequirements.set(normalizedName, {
            cardName: card.cardName,
            cardId,
            totalRequired: 0,
            requiredBy: [],
          });
        }

        const req = cardRequirements.get(normalizedName)!;
        req.totalRequired += card.quantity;
        req.requiredBy.push({
          deckName: deck.name,
          quantity: card.quantity,
          section: SECTION_NAMES[key],
        });
      }
    }
  }

  // Calculate missing amounts
  const missingCards: MissingCardSummary[] = [];

  cardRequirements.forEach(req => {
    // Use flexible matching to find collection entry
    const collectionEntry = findCollectionEntry(req.cardName, collectionByName);
    const owned = collectionEntry ? collectionEntry.quantity : 0;
    const stillNeeded = Math.max(0, req.totalRequired - owned);

    if (stillNeeded > 0) {
      missingCards.push({
        cardName: req.cardName,
        cardId: req.cardId,
        totalNeeded: req.totalRequired,
        owned,
        stillNeeded,
        requiredBy: req.requiredBy,
      });
    }
  });

  // Sort by still needed (descending)
  missingCards.sort((a, b) => b.stillNeeded - a.stillNeeded);

  return missingCards;
}

/**
 * Get collection statistics
 */
export function getCollectionStats(collection: Map<string, CollectionEntry>) {
  let totalUnique = 0;
  let totalCards = 0;
  const sets = new Set<string>();

  collection.forEach(entry => {
    totalUnique++;
    totalCards += entry.quantity;
    sets.add(entry.set);
  });

  return {
    totalUnique,
    totalCards,
    totalSets: sets.size,
    sets: Array.from(sets).sort(),
  };
}
