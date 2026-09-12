import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit3, Layers, Eye, AlertTriangle } from 'lucide-react';
import { getDecks, deleteDeck, previewDecklist, createDeck } from '../services/deckService';
import { getCollection } from '../services/collectionService';
import { calculateDeckCompletion } from '../services/completionCalculator';
import { validateDecklist } from '../services/decklistParser';
import { Deck, ParsedDecklist } from '../types';

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importName, setImportName] = useState('');
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<ParsedDecklist | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setDecks(getDecks());
  }, []);

  const handlePreview = () => {
    if (!importText.trim()) {
      setError('Please paste a decklist.');
      return;
    }
    const parsed = previewDecklist(importText);
    setPreview(parsed);
    setError('');
  };

  const handleSave = () => {
    if (!importName.trim()) {
      setError('Please enter a deck name.');
      return;
    }
    if (!importText.trim()) {
      setError('Please paste a decklist.');
      return;
    }

    const result = createDeck(importName, importText);
    if (result.success && result.deck) {
      setDecks(getDecks());
      setShowImport(false);
      setImportName('');
      setImportText('');
      setPreview(null);
      setError('');
      navigate(`/decks/${result.deck.id}`);
    } else {
      setError(result.error || 'Failed to save deck.');
    }
  };

  const handleDelete = (deckId: string, name: string) => {
    if (confirm(`Delete deck "${name}"?`)) {
      deleteDeck(deckId);
      setDecks(getDecks());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Decks</h1>
          <p className="text-gray-400 mt-1">Manage your saved decklists and track completion.</p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus size={20} />
          Import Deck
        </button>
      </div>

      {/* Import Form */}
      {showImport && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">Import New Deck</h2>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Deck Name</label>
            <input
              type="text"
              value={importName}
              onChange={e => setImportName(e.target.value)}
              placeholder="e.g., Aggro Assassin"
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Decklist</label>
            <textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={`Legend:\n1 Kai'Sa - Daughter of the Void\n\nChampion:\n1 Kai'Sa - Survivor\n\nMainDeck:\n3 Scuttle Crab\n3 Stellacorn Herder\n2 Defy\n2 Long Sword\n...\n\nBattlefields:\n1 Void Gate\n\nRune Pool:\n6 Fury Rune\n\nSideboard:\n2 Ferrous Forerunner\n1 Defy`}
              rows={12}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm resize-y"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              <Eye size={18} />
              Preview Parse
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus size={18} />
              Save Deck
            </button>
            <button
              onClick={() => { setShowImport(false); setPreview(null); setError(''); }}
              className="px-4 py-2.5 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <DeckPreview parsed={preview} />
          )}
        </div>
      )}

      {/* Deck List */}
      {decks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Layers size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No decks saved yet</p>
          <p className="text-sm mt-2">Import a decklist to see what cards you need.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {decks.map(deck => (
            <DeckCard
              key={deck.id}
              deck={deck}
              onDelete={() => handleDelete(deck.id, deck.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeckPreview({ parsed }: { parsed: ParsedDecklist }) {
  const warnings = validateDecklist(parsed);

  return (
    <div className="mt-4 p-4 rounded-lg bg-gray-700/30 border border-gray-600">
      <h3 className="font-medium text-white mb-3">Parsed Decklist Preview</h3>
      
      {warnings.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-300 flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
        </div>
      )}

      {parsed.errors.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-sm font-medium text-red-300 mb-1">Parse Errors:</p>
          {parsed.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-300">
              Line {e.lineNumber}: "{e.line}" — {e.message}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        {parsed.legend.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Legend:</span>{' '}
            <span className="text-white">{parsed.legend.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
        {parsed.champion.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Champion:</span>{' '}
            <span className="text-white">{parsed.champion.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
        {parsed.mainDeck.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Main:</span>{' '}
            <span className="text-white">{parsed.mainDeck.reduce((s, c) => s + c.quantity, 0) + parsed.champion.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
        {parsed.battlefields.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Battlefields:</span>{' '}
            <span className="text-white">{parsed.battlefields.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
        {parsed.runePool.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Runes:</span>{' '}
            <span className="text-white">{parsed.runePool.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
        {parsed.sideboard.length > 0 && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Sideboard:</span>{' '}
            <span className="text-white">{parsed.sideboard.reduce((s, c) => s + c.quantity, 0)}</span>
          </div>
        )}
      </div>

      {/* Card list preview */}
      <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
        {(['legend', 'champion', 'mainDeck', 'battlefields', 'runePool', 'sideboard'] as const).map(key => {
          if (parsed[key].length === 0) return null;
          const sectionNames: Record<string, string> = {
            legend: 'Legend', champion: 'Champion', mainDeck: 'Main Deck',
            battlefields: 'Battlefields', runePool: 'Rune Pool', sideboard: 'Sideboard'
          };
          return (
            <div key={key}>
              <p className="text-xs font-medium text-purple-300 mt-2 mb-1">{sectionNames[key]}</p>
              {parsed[key].map((card, i) => (
                <p key={i} className="text-xs text-gray-300 pl-2">
                  {card.quantity}× {card.cardName}
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeckCard({ deck, onDelete }: { deck: Deck; onDelete: () => void }) {
  const collection = getCollection();
  const completion = calculateDeckCompletion(deck.parsedDecklist, collection);
  const warnings = validateDecklist(deck.parsedDecklist);

  return (
    <Link
      to={`/decks/${deck.id}`}
      className="block bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-gray-600 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">{deck.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(deck.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-600/10 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Completion bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-400">Overall</span>
          <span className={`font-medium ${
            completion.overallPercentage >= 100 ? 'text-green-400' :
            completion.overallPercentage >= 75 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {completion.overallPercentage}%
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              completion.overallPercentage >= 100 ? 'bg-green-500' :
              completion.overallPercentage >= 75 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, completion.overallPercentage)}%` }}
          />
        </div>
      </div>

      {/* Section stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {completion.mainDeckCompletion && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Main: </span>
            <span className="text-white">
              {completion.mainDeckCompletion.totalOwned + (completion.sections.find(s => s.sectionKey === 'champion')?.totalOwned || 0)}/
              {completion.mainDeckCompletion.totalRequired + (completion.sections.find(s => s.sectionKey === 'champion')?.totalRequired || 0)}
            </span>
          </div>
        )}
        {completion.sideboardCompletion && (
          <div className="p-2 rounded bg-gray-700/50">
            <span className="text-gray-400">Side: </span>
            <span className="text-white">{completion.sideboardCompletion.totalOwned}/{completion.sideboardCompletion.totalRequired}</span>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
          <AlertTriangle size={12} />
          <span>{warnings.length} warning(s)</span>
        </div>
      )}
    </Link>
  );
}
