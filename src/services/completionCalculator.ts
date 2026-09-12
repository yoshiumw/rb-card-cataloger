import { ParsedDecklist, CollectionEntry, DeckCompletion, SectionCompletion, CompletionResult, MissingCardSummary, Deck, DeckSectionKey } from '../types';
import { getCardByName } from './cardLookupService';

/**
 * Completion Calculator Service
 * 
 * Compares a decklist against a user's collection to determine
 * what cards are missing and how complete the deck is.
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
 * Calculate completion for a single section
 */
function calculateSectionCompletion(
  sectionKey: DeckSectionKey,
  cards: { cardName: string; quantity: number }[],
  collection: Map<string, CollectionEntry>,
  collectionByName: Map<string, CollectionEntry>
): SectionCompletion {
  const completionCards: CompletionResult[] = [];
  let totalRequired = 0;
  let totalOwned = 0;

  for (const deckCard of cards) {
    // Try to find the card in the collection by name
    const collectionEntry = collectionByName.get(deckCard.cardName.toLowerCase());
    const owned = collectionEntry ? collectionEntry.quantity : 0;
    const missing = Math.max(0, deckCard.quantity - owned);
    const actualOwned = Math.min(owned, deckCard.quantity);

    // Try to get card ID from the card database
    const cardFromDb = getCardByName(deckCard.cardName);

    totalRequired += deckCard.quantity;
    totalOwned += actualOwned;

    let status: CompletionResult['status'] = 'complete';
    if (missing > 0 && owned > 0) status = 'partial';
    else if (missing > 0 && owned === 0) status = 'missing';

    completionCards.push({
      cardName: deckCard.cardName,
      cardId: cardFromDb?.cardId,
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
  // Build a name-based index for the collection
  const collectionByName = new Map<string, CollectionEntry>();
  collection.forEach(entry => {
    collectionByName.set(entry.cardName.toLowerCase(), entry);
  });

  const sections: SectionCompletion[] = [];
  const sectionKeys: DeckSectionKey[] = ['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'];

  for (const key of sectionKeys) {
    const sectionCards = parsedDecklist[key];
    if (sectionCards.length > 0) {
      const completion = calculateSectionCompletion(key, sectionCards, collection, collectionByName);
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
  // Build collection name index
  const collectionByName = new Map<string, CollectionEntry>();
  collection.forEach(entry => {
    collectionByName.set(entry.cardName.toLowerCase(), entry);
  });

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
        const normalizedName = card.cardName.toLowerCase();
        const cardFromDb = getCardByName(card.cardName);

        if (!cardRequirements.has(normalizedName)) {
          cardRequirements.set(normalizedName, {
            cardName: card.cardName,
            cardId: cardFromDb?.cardId,
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
    const collectionEntry = collectionByName.get(req.cardName.toLowerCase());
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
