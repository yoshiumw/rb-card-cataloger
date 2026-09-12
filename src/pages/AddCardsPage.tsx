import React, { useState, useRef, useEffect } from 'react';
import { PlusCircle, Check, X, Search, AlertCircle, Loader2 } from 'lucide-react';
import { addCardToCollection } from '../services/collectionService';
import { getCardById, isValidCardIdFormat } from '../services/cardLookupService';
import { Card, CollectionEntry } from '../types';

interface AddResult {
  cardId: string;
  cardName: string;
  success: boolean;
  message: string;
  entry?: CollectionEntry;
}

export default function AddCardsPage() {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<AddResult | null>(null);
  const [history, setHistory] = useState<AddResult[]>([]);
  const [preview, setPreview] = useState<Card | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Preview card as user types (debounced)
  useEffect(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    
    const trimmed = inputValue.trim();
    if (trimmed.length >= 4 && isValidCardIdFormat(trimmed)) {
      setPreviewLoading(true);
      previewTimeoutRef.current = setTimeout(async () => {
        const card = await getCardById(trimmed);
        setPreview(card);
        setPreviewLoading(false);
      }, 300);
    } else {
      setPreview(null);
      setPreviewLoading(false);
    }

    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, [inputValue]);

  const handleAdd = async () => {
    const cardId = inputValue.trim();
    if (!cardId) return;

    setLoading(true);
    const result = await addCardToCollection(cardId);
    
    const addResult: AddResult = {
      cardId,
      cardName: result.entry?.cardName || result.entry?.displayName || cardId,
      success: result.success,
      message: result.success 
        ? `Added ${result.entry!.cardName} (×${result.entry!.quantity})` 
        : result.error || 'Failed to add card',
      entry: result.entry,
    };

    setLastResult(addResult);
    setHistory(prev => [addResult, ...prev].slice(0, 20));
    setInputValue('');
    setPreview(null);
    setLoading(false);

    // Re-focus input for rapid entry
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const formatValid = inputValue.trim() ? isValidCardIdFormat(inputValue.trim()) : null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Add Cards</h1>
        <p className="text-gray-400 mt-1">Enter card IDs (e.g., <code className="text-purple-300">OGN-039</code>) to add them to your collection. Press Enter for rapid entry.</p>
      </div>

      {/* Main Input Area */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="space-y-4">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Card ID</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., OGN-039 or VEN-131"
                  disabled={loading}
                  className={`
                    w-full pl-10 pr-10 py-3 bg-gray-700 border rounded-lg text-white text-lg 
                    placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                    disabled:opacity-50
                    ${formatValid === false && inputValue.trim() ? 'border-red-500/50' : 
                      formatValid === true ? 'border-green-500/50' : 'border-gray-600'}
                  `}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                {previewLoading && (
                  <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
                {!previewLoading && formatValid === true && (
                  <Check size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400" />
                )}
                {formatValid === false && inputValue.trim() && (
                  <X size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
                )}
              </div>
              <button
                onClick={handleAdd}
                disabled={loading || !inputValue.trim()}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
            {formatValid === false && inputValue.trim() && (
              <p className="mt-2 text-sm text-red-400">Invalid format. Use format like OGN-039, VEN-131, or OGN-039-298.</p>
            )}
          </div>

          {/* Card Preview */}
          {preview && (
            <div className="p-4 rounded-lg bg-gray-700/50 border border-gray-600 flex items-center gap-4">
              <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-600 flex-shrink-0">
                {preview.imageUrl ? (
                  <img src={preview.imageUrl} alt={preview.cardName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-400">{preview.cardNumber}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{preview.cardName}</p>
                <p className="text-sm text-gray-400">{preview.set} • {preview.cardType}{preview.supertype ? ` (${preview.supertype})` : ''}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
                    {preview.rarity}
                  </span>
                  {preview.domain.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">
                      {preview.domain.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs px-2 py-1 rounded-full bg-green-600/20 text-green-300 border border-green-500/30">
                  Found
                </span>
              </div>
            </div>
          )}

          {/* Last Result */}
          {lastResult && (
            <div className={`
              p-4 rounded-lg flex items-center gap-3
              ${lastResult.success 
                ? 'bg-green-600/10 border border-green-500/30' 
                : 'bg-red-600/10 border border-red-500/30'}
            `}>
              {lastResult.success ? (
                <Check size={20} className="text-green-400 flex-shrink-0" />
              ) : (
                <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${lastResult.success ? 'text-green-300' : 'text-red-300'}`}>
                  {lastResult.message}
                </p>
                {lastResult.entry && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lastResult.entry.set} • {lastResult.entry.cardType} • {lastResult.entry.rarity}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">💡 Quick Tips</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">Enter</kbd> to add and immediately enter the next card</li>
          <li>• Card IDs are case-insensitive (OGN-039 = ogn-039)</li>
          <li>• Adding the same card increases its quantity</li>
          <li>• IDs follow the format: <code className="text-purple-300">SET-NUMBER</code> (e.g., OGN-039, VEN-131)</li>
          <li>• Card data is fetched live from the Riftbound database</li>
        </ul>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Additions</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((item, index) => (
              <div
                key={`${item.cardId}-${index}`}
                className={`
                  flex items-center gap-3 p-3 rounded-lg
                  ${item.success ? 'bg-gray-700/30' : 'bg-red-900/10'}
                `}
              >
                {item.success ? (
                  <Check size={16} className="text-green-400 flex-shrink-0" />
                ) : (
                  <X size={16} className="text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.success ? 'text-gray-200' : 'text-red-300'}`}>
                    <span className="font-mono text-xs text-gray-400 mr-2">{item.cardId}</span>
                    {item.cardName}
                  </p>
                </div>
                {item.entry && (
                  <span className="text-xs text-purple-300">×{item.entry.quantity}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
