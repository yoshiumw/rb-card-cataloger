import React, { useEffect, useState, useMemo } from 'react';
import { Search, Filter, SortAsc, SortDesc, Trash2, Minus, Plus, Library } from 'lucide-react';
import { getCollectionAsArray, removeCardFromCollection, updateCardQuantity, getCollectionSets } from '../services/collectionService';
import { useAuth } from '../contexts/AuthContext';
import { CollectionEntry } from '../types';
import { usePriceData } from '../hooks/usePriceData';

type SortField = 'name' | 'set' | 'type' | 'quantity' | 'added';
type SortDir = 'asc' | 'desc';

export default function CollectionPage() {
  const { user } = useAuth();
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [setFilter, setSetFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    if (!user) return;
    
    const loadCollection = async () => {
      setLoading(true);
      const collectionArray = await getCollectionAsArray(user.uid);
      setCollection(collectionArray);
      setLoading(false);
    };
    
    loadCollection();
  }, [user]);

  const sets = useMemo(() => {
    const uniqueSets = new Set<string>();
    collection.forEach(entry => uniqueSets.add(entry.set));
    return Array.from(uniqueSets).sort();
  }, [collection]);

  const cardTypes = useMemo(() => {
    const types = new Set(collection.map(c => c.cardType));
    return Array.from(types).sort();
  }, [collection]);

  const filtered = useMemo(() => {
    let result = [...collection];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.cardName.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        c.cardId.toLowerCase().includes(q) ||
        c.set.toLowerCase().includes(q)
      );
    }

    if (setFilter) {
      result = result.filter(c => c.set === setFilter);
    }

    if (typeFilter) {
      result = result.filter(c => c.cardType === typeFilter);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.cardName.localeCompare(b.cardName); break;
        case 'set': cmp = a.set.localeCompare(b.set); break;
        case 'type': cmp = a.cardType.localeCompare(b.cardType); break;
        case 'quantity': cmp = a.quantity - b.quantity; break;
        case 'added': cmp = new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [collection, search, setFilter, typeFilter, sortField, sortDir]);

  const totalCards = collection.reduce((s, c) => s + c.quantity, 0);

  const handleQuantityChange = async (cardId: string, delta: number) => {
    if (!user) return;
    const entry = collection.find(c => c.cardId === cardId);
    if (!entry) return;
    const newQty = entry.quantity + delta;
    
    if (newQty <= 0) {
      await removeCardFromCollection(user.uid, cardId);
    } else {
      await updateCardQuantity(user.uid, cardId, newQty);
    }
    
    // Reload collection
    const collectionArray = await getCollectionAsArray(user.uid);
    setCollection(collectionArray);
  };

  const handleRemove = async (cardId: string) => {
    if (!user) return;
    if (confirm('Remove this card from your collection?')) {
      await removeCardFromCollection(user.uid, cardId);
      const collectionArray = await getCollectionAsArray(user.uid);
      setCollection(collectionArray);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Collection</h1>
          <p className="text-gray-400 mt-1">
            {collection.length} unique cards • {totalCards} total cards
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={setFilter}
              onChange={e => setSetFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
            >
              <option value="">All Sets</option>
              {sets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
            >
              <option value="">All Types</option>
              {cardTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-700">
          <span className="text-xs text-gray-400 self-center mr-2">Sort by:</span>
          {(['name', 'set', 'type', 'quantity', 'added'] as SortField[]).map(field => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${sortField === field 
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
              `}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
              {sortField === field && (
                sortDir === 'asc' ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Library size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">
            {collection.length === 0 ? 'Your collection is empty' : 'No cards match your filters'}
          </p>
          <p className="text-sm mt-2">
            {collection.length === 0 ? 'Start by adding some cards!' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(card => (
            <CardItem
              key={card.cardId}
              card={card}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardItem({ card, onQuantityChange, onRemove }: { 
  card: CollectionEntry; 
  onQuantityChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}) {
  const { getPriceByCardNumber, loading } = usePriceData();
  const price = getPriceByCardNumber(card.cardId);
  console.log('Matching', card.cardName, '->', price);

  const typeColors: Record<string, string> = {
    Champion: 'from-yellow-600/20 to-amber-600/20 border-yellow-500/30',
    Unit: 'from-blue-600/20 to-cyan-600/20 border-blue-500/30',
    Spell: 'from-purple-600/20 to-pink-600/20 border-purple-500/30',
    Equipment: 'from-orange-600/20 to-red-600/20 border-orange-500/30',
    Battlefield: 'from-green-600/20 to-emerald-600/20 border-green-500/30',
    Rune: 'from-indigo-600/20 to-violet-600/20 border-indigo-500/30',
    Legend: 'from-amber-600/20 to-yellow-600/20 border-amber-500/30',
  };

  const gradient = typeColors[card.cardType] || 'from-gray-600/20 to-gray-600/20 border-gray-500/30';

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
      {/* Card image */}
      <div className={`h-32 bg-gradient-to-br ${gradient} border-b flex items-center justify-center relative overflow-hidden`}>
        {card.imageUrl ? (
          <img 
            src={card.imageUrl} 
            alt={card.cardName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl font-bold text-white/30">{card.cardNumber}</span>
        )}
        <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white/80 backdrop-blur-sm">
          {card.cardType}
        </span>
        {card.rarity && (
          <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/50 text-white/80 backdrop-blur-sm">
            {card.rarity}
          </span>
        )}
        {/* Price badge */}
        {price?.marketPrice != null && (
          <span className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-md bg-green-600/90 text-white font-medium shadow-lg">
            ${price.marketPrice.toFixed(2)}
          </span>
        )}
        {loading && price === undefined && (
          <span className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-md bg-gray-600/90 text-gray-300 animate-pulse">
            Loading...
          </span>
        )}
      </div>

      {/* Card info */}
      <div className="p-3">
        <h3 className="font-medium text-white text-sm truncate" title={card.cardName}>
          {card.displayName || card.cardName}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{card.set} • {card.cardId}</p>

        {/* Quantity controls */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onQuantityChange(card.cardId, -1)}
              className="w-7 h-7 rounded-md bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-medium text-white">{card.quantity}</span>
            <button
              onClick={() => onQuantityChange(card.cardId, 1)}
              className="w-7 h-7 rounded-md bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            onClick={() => onRemove(card.cardId)}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-red-600/10 transition-colors"
            title="Remove card"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
