import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CollectionEntry } from '../types';

interface CardDetailModalProps {
  card: CollectionEntry | null;
  onClose: () => void;
}

export function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (card) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [card, onClose]);

  if (!card) return null;

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
    <div 
      className="modal-overlay fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div 
        className="modal-content bg-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="modal-close absolute top-4 right-4 p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors z-10"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="modal-body p-6">
          {/* Card Art Section */}
          <div className="mb-6">
            <div className={`relative rounded-lg overflow-hidden border ${gradient.split(' ')[2]} bg-gradient-to-br ${gradient}`}>
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.cardName}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: '400px' }}
                />
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <span className="text-4xl font-bold text-white/30">{card.cardNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card Details Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white">{card.cardName}</h2>
              {card.supertype && (
                <p className="text-sm text-gray-400 mt-1">{card.supertype}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Set</p>
                <p className="text-white font-medium">{card.set}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Card #</p>
                <p className="text-white font-medium">{card.cardId}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
                <p className="text-white font-medium">{card.cardType}</p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Rarity</p>
                <p className="text-white font-medium capitalize">{card.rarity || 'Common'}</p>
              </div>
            </div>

            {/* Stats for Units/Champions */}
            {(card.might !== null || card.power !== null || card.energy !== null) && (
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Stats</p>
                <div className="flex gap-6">
                  {card.energy !== null && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-600/20 border border-yellow-500/30 flex items-center justify-center">
                        <span className="text-yellow-400 font-bold text-sm">{card.energy}</span>
                      </div>
                      <span className="text-xs text-gray-400">Energy</span>
                    </div>
                  )}
                  {card.might !== null && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center">
                        <span className="text-red-400 font-bold text-sm">{card.might}</span>
                      </div>
                      <span className="text-xs text-gray-400">Might</span>
                    </div>
                  )}
                  {card.power !== null && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <span className="text-blue-400 font-bold text-sm">{card.power}</span>
                      </div>
                      <span className="text-xs text-gray-400">Power</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Quantity Info */}
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">In Collection</p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-white">{card.quantity}x</span>
                <span className="text-sm text-gray-400">
                  Added {new Date(card.addedAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Domain tags */}
            {card.domain && card.domain.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Domains</p>
                <div className="flex flex-wrap gap-2">
                  {card.domain.map((d, i) => (
                    <span 
                      key={i}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300 border border-purple-500/30"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
