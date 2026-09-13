import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Check, AlertTriangle, X, Swords, Loader2, RefreshCw } from 'lucide-react';
import { getDeck, deleteDeck, updateDeck } from '../services/deckService';
import { getCollection } from '../services/collectionService';
import { calculateDeckCompletion } from '../services/completionCalculator';
import { validateDecklist } from '../services/decklistParser';
import { getCardByName, isCardCached, getCachedCards } from '../services/cardLookupService';
import { useAuth } from '../contexts/AuthContext';
import { Deck, ParsedDecklist, SectionCompletion, DeckSectionKey, CollectionEntry } from '../types';
import { usePriceData } from '../hooks/usePriceData';

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [collection, setCollection] = useState<Map<string, CollectionEntry>>(new Map());
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id && user) {
      const loadDeck = async () => {
        const d = await getDeck(user.uid, id);
        console.log('DeckDetailPage: id =', id, 'deck =', d);
        if (d) {
          setDeck(d);
          setEditName(d.name);
          setEditText(d.rawDecklist);
        } else {
          console.error('Deck not found for id:', id);
          navigate('/decks');
        }
      };
      loadDeck();
    }
  }, [id, navigate, user]);

  useEffect(() => {
    if (user) {
      const loadCollection = async () => {
        const coll = await getCollection(user.uid);
        setCollection(coll);
      };
      loadCollection();
    }
  }, [user]);

  const resolveCards = async (parsed: ParsedDecklist) => {
    const sectionKeys: DeckSectionKey[] = ['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'];
    
    const allCardNames: string[] = [];
    for (const key of sectionKeys) {
      for (const card of parsed[key]) {
        allCardNames.push(card.cardName);
      }
    }

    // Only resolve cards that aren't already cached
    // Use flexible matching to check if already cached
    const uncachedNames = allCardNames.filter(name => {
      if (isCardCached(name)) return false;
      
      // Also check if a similar name is cached (handles variations like "Kennen, Heart of the Tempest" vs "Yordle, Kennen - Heart of the Tempest")
      const cachedCards = getCachedCards();
      for (const cachedCard of cachedCards) {
        const normalizedDecklist = name.toLowerCase().replace(/[,']/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
        const normalizedCached = cachedCard.cardName.toLowerCase().replace(/[,']/g, '').replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (normalizedCached.includes(normalizedDecklist) || normalizedDecklist.includes(normalizedCached)) {
          return false;
        }
        
        // Check word overlap
        const decklistWords = normalizedDecklist.split(' ').filter((w: string) => w.length > 2);
        const cachedWords = normalizedCached.split(' ').filter((w: string) => w.length > 2);
        const matchingWords = decklistWords.filter((word: string) => cachedWords.includes(word));
        if (decklistWords.length > 0 && matchingWords.length / decklistWords.length >= 0.7) {
          return false;
        }
      }
      
      return true;
    });
    
    if (uncachedNames.length === 0) {
      setResolved(true);
      return;
    }

    setResolving(true);

    // Resolve in batches to avoid too many concurrent requests
    const batchSize = 5;
    for (let i = 0; i < uncachedNames.length; i += batchSize) {
      const batch = uncachedNames.slice(i, i + batchSize);
      await Promise.all(batch.map(name => getCardByName(name)));
    }

    setResolving(false);
    setResolved(true);
  };

  // Auto-resolve card names when viewing a deck
  useEffect(() => {
    if (deck && !resolved) {
      resolveCards(deck.parsedDecklist);
    }
  }, [deck, resolved]);

  if (!deck || !user) return null;

  const completion = calculateDeckCompletion(deck.parsedDecklist, collection);
  const warnings = validateDecklist(deck.parsedDecklist);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    deleteDeck(user.uid, deck.id);
    navigate('/decks');
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleSaveEdit = async () => {
    const result = await updateDeck(user.uid, deck.id, editName, editText);
    if (result.success && result.deck) {
      setDeck(result.deck);
      setEditing(false);
      setResolved(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/decks" className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-white">{deck.name}</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Last updated: {new Date(deck.updatedAt).toLocaleDateString()}
            {deck.parsedDecklist.errors.length > 0 && ` • ${deck.parsedDecklist.errors.length} parse error(s)`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setResolved(false); resolveCards(deck.parsedDecklist); }}
            disabled={resolving}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Re-resolve card names from API"
          >
            {resolving ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Edit deck"
          >
            <Edit3 size={20} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg hover:bg-red-600/10 text-gray-400 hover:text-red-400 transition-colors"
            title="Delete deck"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Resolving indicator */}
      {resolving && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-300 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Resolving card names from API...
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">Edit Deck</h2>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Deck name"
          />
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={12}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
          />
          <div className="flex gap-3">
            <button onClick={handleSaveEdit} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
              Save Changes
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-400 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && !editing && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Parse Errors */}
      {deck.parsedDecklist.errors.length > 0 && !editing && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-sm font-medium text-red-300 mb-2">Parse Errors:</p>
          {deck.parsedDecklist.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-300 mb-1">
              Line {e.lineNumber}: "{e.line}" — {e.message}
            </p>
          ))}
        </div>
      )}

      {/* Overall Status */}
      {!editing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Overall */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Swords size={20} className="text-purple-400" />
              <h3 className="font-semibold text-white">Overall</h3>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {completion.overallPercentage}%
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  completion.overallPercentage >= 100 ? 'bg-green-500' :
                  completion.overallPercentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, completion.overallPercentage)}%` }}
              />
            </div>
          </div>

          {/* Main Deck */}
          {completion.mainDeckCompletion && (
            <SectionStatCard
              title="Main Deck"
              completion={completion.mainDeckCompletion}
              color="blue"
            />
          )}

          {/* Sideboard */}
          {completion.sideboardCompletion && (
            <SectionStatCard
              title="Sideboard"
              completion={completion.sideboardCompletion}
              color="amber"
            />
          )}
        </div>
      )}

      {/* Section Details */}
      {!editing && completion.sections.map(section => (
        <SectionDetail key={section.sectionKey} section={section} />
      ))}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Deck</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete "<span className="font-medium text-white">{deck.name}</span>"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionStatCard({ title, completion, color }: { title: string; completion: SectionCompletion; color: string }) {
  const colors: Record<string, { bg: string; text: string; bar: string }> = {
    blue: { bg: 'bg-blue-600/10 border-blue-500/20', text: 'text-blue-400', bar: 'bg-blue-500' },
    amber: { bg: 'bg-amber-600/10 border-amber-500/20', text: 'text-amber-400', bar: 'bg-amber-500' },
    green: { bg: 'bg-green-600/10 border-green-500/20', text: 'text-green-400', bar: 'bg-green-500' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`rounded-xl border p-5 ${c.bg}`}>
      <h3 className={`font-semibold ${c.text} mb-2`}>{title}</h3>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-white">{completion.totalOwned}</span>
        <span className="text-gray-400">/ {completion.totalRequired}</span>
      </div>
      <p className="text-sm text-gray-400 mb-2">
        {completion.percentage}% complete • {completion.totalMissing} missing
      </p>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar}`}
          style={{ width: `${Math.min(100, completion.percentage)}%` }}
        />
      </div>
    </div>
  );
}

function SectionDetail({ section }: { section: SectionCompletion }) {
  const { getPriceByCardNumber, loading } = usePriceData();
  const [expanded, setExpanded] = useState(section.totalMissing > 0);

  // Calculate section total price
  const sectionTotal = section.cards.reduce((sum, card) => {
    if (!card.cardId) return sum;
    const price = getPriceByCardNumber(card.cardId);
    return sum + (price?.marketPrice ?? 0) * card.required;
  }, 0);

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">{section.sectionName}</h3>
          <span className="text-sm text-gray-400">
            {section.totalOwned}/{section.totalRequired}
          </span>
          {section.totalMissing > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-600/20 text-red-300 border border-red-500/30">
              {section.totalMissing} missing
            </span>
          )}
          {section.totalMissing === 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-600/20 text-green-300 border border-green-500/30">
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400">{section.percentage}%</span>
          <span className="text-sm font-medium text-green-400 min-w-[60px] text-right">
            {loading ? '...' : `$${sectionTotal.toFixed(2)}`}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700">
                <th className="text-left px-4 py-2">Card</th>
                <th className="text-center px-3 py-2">Required</th>
                <th className="text-center px-3 py-2">Owned</th>
                <th className="text-center px-3 py-2">Missing</th>
                <th className="text-center px-3 py-2">Price</th>
                <th className="text-center px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {section.cards.map((card, i) => {
                const price = card.cardId ? getPriceByCardNumber(card.cardId) : undefined;
                console.log('Matching', card.cardName, '->', price);
                const lineTotal = (price?.marketPrice ?? 0) * card.required;
                
                return (
                  <tr key={i} className="border-b border-gray-700/50 last:border-0">
                    <td className="px-4 py-2.5 text-sm text-white">
                      {card.cardName}
                      {card.cardId && (
                        <span className="ml-2 text-xs text-gray-500 font-mono">{card.cardId}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-300">{card.required}</td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-300">{card.owned}</td>
                    <td className="px-3 py-2.5 text-sm text-center">
                      {card.missing > 0 ? (
                        <span className="text-red-400 font-medium">{card.missing}</span>
                      ) : (
                        <span className="text-gray-500">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-center text-gray-300">
                      {price?.marketPrice != null ? (
                        <span className="text-green-400">
                          ${price.marketPrice.toFixed(2)}
                          {card.required > 1 && (
                            <span className="text-xs text-gray-500 ml-1">×{card.required}=${lineTotal.toFixed(2)}</span>
                          )}
                        </span>
                      ) : loading ? (
                        <span className="text-gray-500 animate-pulse">...</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {card.status === 'complete' && (
                        <Check size={16} className="inline text-green-400" />
                      )}
                      {card.status === 'partial' && (
                        <AlertTriangle size={16} className="inline text-yellow-400" />
                      )}
                      {card.status === 'missing' && (
                        <X size={16} className="inline text-red-400" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
