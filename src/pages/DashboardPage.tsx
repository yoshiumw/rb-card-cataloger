import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Library, 
  PlusCircle, 
  Layers, 
  AlertTriangle, 
  TrendingUp,
  Swords,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { getCollectionAsArray, getRecentlyAdded } from '../services/collectionService';
import { getDecks } from '../services/deckService';
import { getCollectionStats } from '../services/completionCalculator';
import { CollectionEntry, Deck } from '../types';

export default function DashboardPage() {
  const [stats, setStats] = useState({ totalUnique: 0, totalCards: 0, totalSets: 0 });
  const [recentCards, setRecentCards] = useState<CollectionEntry[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);

  useEffect(() => {
    const collection = getCollectionAsArray();
    const collectionMap = new Map(collection.map(c => [c.cardId, c]));
    setStats(getCollectionStats(collectionMap));
    setRecentCards(getRecentlyAdded(5));
    setDecks(getDecks());
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back! Here's your collection overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Library size={24} />}
          label="Unique Cards"
          value={stats.totalUnique}
          color="purple"
        />
        <StatCard
          icon={<Sparkles size={24} />}
          label="Total Cards"
          value={stats.totalCards}
          color="pink"
        />
        <StatCard
          icon={<Layers size={24} />}
          label="Sets Owned"
          value={stats.totalSets}
          color="blue"
        />
        <StatCard
          icon={<Swords size={24} />}
          label="Saved Decks"
          value={decks.length}
          color="green"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickAction
          to="/add-cards"
          icon={<PlusCircle size={24} />}
          title="Add Cards"
          description="Quickly enter card IDs to build your collection"
          color="purple"
        />
        <QuickAction
          to="/decks"
          icon={<Layers size={24} />}
          title="Import Deck"
          description="Paste a decklist to see what cards you need"
          color="pink"
        />
        <QuickAction
          to="/missing"
          icon={<AlertTriangle size={24} />}
          title="Missing Cards"
          description="See all cards you need across your decks"
          color="amber"
        />
      </div>

      {/* Recent Cards & Decks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently Added */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp size={20} className="text-purple-400" />
              Recently Added
            </h2>
            <Link to="/collection" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {recentCards.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Library size={40} className="mx-auto mb-3 opacity-50" />
              <p>No cards added yet</p>
              <Link to="/add-cards" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
                Add your first card →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCards.map(card => (
                <div key={card.cardId} className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50">
                  <div className="flex items-center gap-3 min-w-0">
                    {card.imageUrl && (
                      <img src={card.imageUrl} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{card.displayName || card.cardName}</p>
                      <p className="text-xs text-gray-400">{card.set} • {card.cardId}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-purple-300 flex-shrink-0">×{card.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Saved Decks */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Swords size={20} className="text-pink-400" />
              Saved Decks
            </h2>
            <Link to="/decks" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          {decks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Layers size={40} className="mx-auto mb-3 opacity-50" />
              <p>No decks saved yet</p>
              <Link to="/decks" className="text-purple-400 hover:text-purple-300 text-sm mt-2 inline-block">
                Import your first deck →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {decks.slice(0, 5).map(deck => (
                <Link
                  key={deck.id}
                  to={`/decks/${deck.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{deck.name}</p>
                    <p className="text-xs text-gray-400">
                      {deck.parsedDecklist.mainDeck.reduce((s, c) => s + c.quantity, 0)} cards
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-gray-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-600/10 border-purple-500/20 text-purple-400',
    pink: 'bg-pink-600/10 border-pink-500/20 text-pink-400',
    blue: 'bg-blue-600/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-600/10 border-green-500/20 text-green-400',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-300">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function QuickAction({ to, icon, title, description, color }: { to: string; icon: React.ReactNode; title: string; description: string; color: string }) {
  const colorClasses: Record<string, string> = {
    purple: 'hover:border-purple-500/50 hover:bg-purple-600/5',
    pink: 'hover:border-pink-500/50 hover:bg-pink-600/5',
    amber: 'hover:border-amber-500/50 hover:bg-amber-600/5',
  };
  const iconColors: Record<string, string> = {
    purple: 'text-purple-400',
    pink: 'text-pink-400',
    amber: 'text-amber-400',
  };

  return (
    <Link
      to={to}
      className={`block p-5 rounded-xl border border-gray-700 bg-gray-800 transition-all duration-200 ${colorClasses[color]}`}
    >
      <div className={`mb-3 ${iconColors[color]}`}>{icon}</div>
      <h3 className="font-semibold text-white mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </Link>
  );
}
