import React, { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Search, Package, Loader2 } from 'lucide-react';
import { getDecks } from '../services/deckService';
import { getCollection } from '../services/collectionService';
import { calculateMissingCards } from '../services/completionCalculator';
import { getCardByName, isCardCached } from '../services/cardLookupService';
import { useAuth } from '../contexts/AuthContext';
import { MissingCardSummary, DeckSectionKey } from '../types';

export default function MissingCardsPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<any[]>([]);
  const [missingCards, setMissingCards] = useState<MissingCardSummary[]>([]);
  const [search, setSearch] = useState('');
  const [deckFilter, setDeckFilter] = useState('');
  const [resolving, setResolving] = useState(false);

  const deckNames = useMemo(() => decks.map((d: any) => d.name), [decks]);

  useEffect(() => {
    if (!user) return;
    
    const loadDecks = async () => {
      const userDecks = await getDecks(user.uid);
      setDecks(userDecks);
    };
    
    loadDecks();
  }, [user]);

  useEffect(() => {
    if (!user || decks.length === 0) return;
    
    const resolveAndCalculate = async () => {
      
      // Collect all card names from all decks
      const allCardNames = new Set<string>();
      const sectionKeys: DeckSectionKey[] = ['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'];
      
      for (const deck of decks) {
        for (const key of sectionKeys) {
          for (const card of deck.parsedDecklist[key]) {
            allCardNames.add(card.cardName);
          }
        }
      }

      // Only resolve cards that aren't already cached
      const uncachedNames = Array.from(allCardNames).filter(name => !isCardCached(name));
      
      if (uncachedNames.length > 0) {
        setResolving(true);

        // Resolve in batches
        const batchSize = 5;
        for (let i = 0; i < uncachedNames.length; i += batchSize) {
          const batch = uncachedNames.slice(i, i + batchSize);
          await Promise.all(batch.map(name => getCardByName(name)));
        }

        setResolving(false);
      }

      // Now calculate missing cards with full cache
      const collection = await getCollection(user.uid);
      const missing = calculateMissingCards(decks, collection);
      setMissingCards(missing);
    };

    resolveAndCalculate();
  }, [decks, user]);

  const filtered = useMemo(() => {
    let result = missingCards;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => c.cardName.toLowerCase().includes(q));
    }

    if (deckFilter) {
      result = result.filter(c => c.requiredBy.some(r => r.deckName === deckFilter));
    }

    return result;
  }, [missingCards, search, deckFilter]);

  const totalStillNeeded = missingCards.reduce((s, c) => s + c.stillNeeded, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Missing Cards</h1>
        <p className="text-gray-400 mt-1">
          Cards you need to complete your decks.
          {!resolving && missingCards.length > 0 && (
            <span className="text-red-400 ml-1">
              {totalStillNeeded} cards still needed across {missingCards.length} unique cards.
            </span>
          )}
        </p>
      </div>

      {/* Resolving indicator */}
      {resolving && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-300 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Resolving card names from API...
        </div>
      )}

      {/* Filters */}
      {!resolving && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search missing cards..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          {deckNames.length > 0 && (
            <select
              value={deckFilter}
              onChange={e => setDeckFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Decks</option>
              {deckNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Missing Cards List */}
      {!resolving && missingCards.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {decks.length === 0 ? 'No decks imported yet' : 'All deck cards are in your collection!'}
          </p>
          <p className="text-sm mt-2">
            {decks.length === 0 ? 'Import a decklist to see what cards you need.' : '🎉 You have everything you need!'}
          </p>
        </div>
      ) : !resolving && filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No cards match your filters.</p>
        </div>
      ) : !resolving && (
        <div className="space-y-3">
          {filtered.map(card => (
            <MissingCardItem key={card.cardName} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

function MissingCardItem({ card }: { card: MissingCardSummary }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-medium text-white">{card.cardName}</h3>
            {card.cardId && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 font-mono">
                {card.cardId}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-400">
              Need: <span className="text-white font-medium">{card.totalNeeded}</span>
            </span>
            <span className="text-gray-400">
              Owned: <span className="text-green-400 font-medium">{card.owned}</span>
            </span>
            <span className="text-red-400 font-medium">
              Still need: {card.stillNeeded}
            </span>
          </div>

          {/* Required by */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.requiredBy.map((req, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 rounded-md bg-gray-700/50 text-gray-300 border border-gray-600"
              >
                {req.deckName}: {req.quantity}× ({req.section})
              </span>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-red-400">-{card.stillNeeded}</div>
          <div className="text-xs text-gray-400">to go</div>
        </div>
      </div>
    </div>
  );
}
