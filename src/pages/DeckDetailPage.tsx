import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Check, AlertTriangle, X, Swords } from 'lucide-react';
import { getDeck, deleteDeck, updateDeck } from '../services/deckService';
import { getCollection } from '../services/collectionService';
import { calculateDeckCompletion } from '../services/completionCalculator';
import { validateDecklist } from '../services/decklistParser';
import { Deck, ParsedDecklist, SectionCompletion } from '../types';

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (id) {
      const d = getDeck(id);
      if (d) {
        setDeck(d);
        setEditName(d.name);
        setEditText(d.rawDecklist);
      } else {
        navigate('/decks');
      }
    }
  }, [id, navigate]);

  if (!deck) return null;

  const collection = getCollection();
  const completion = calculateDeckCompletion(deck.parsedDecklist, collection);
  const warnings = validateDecklist(deck.parsedDecklist);

  const handleDelete = () => {
    if (confirm(`Delete deck "${deck.name}"?`)) {
      deleteDeck(deck.id);
      navigate('/decks');
    }
  };

  const handleSaveEdit = () => {
    const result = updateDeck(deck.id, editName, editText);
    if (result.success && result.deck) {
      setDeck(result.deck);
      setEditing(false);
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
          </p>
        </div>
        <div className="flex gap-2">
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
  const [expanded, setExpanded] = useState(section.totalMissing > 0);

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
        <span className="text-sm font-medium text-gray-400">{section.percentage}%</span>
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
                <th className="text-center px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {section.cards.map((card, i) => (
                <tr key={i} className="border-b border-gray-700/50 last:border-0">
                  <td className="px-4 py-2.5 text-sm text-white">{card.cardName}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-gray-300">{card.required}</td>
                  <td className="px-3 py-2.5 text-sm text-center text-gray-300">{card.owned}</td>
                  <td className="px-3 py-2.5 text-sm text-center">
                    {card.missing > 0 ? (
                      <span className="text-red-400 font-medium">{card.missing}</span>
                    ) : (
                      <span className="text-gray-500">0</span>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
