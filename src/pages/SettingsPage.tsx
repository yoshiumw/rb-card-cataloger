import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Database, Info } from 'lucide-react';
import { getCacheSize, getCachedSets, clearCache } from '../services/cardLookupService';
import { getCollectionAsArray } from '../services/collectionService';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [cacheSize, setCacheSize] = React.useState(getCacheSize());
  const [collectionSize, setCollectionSize] = React.useState(0);
  const cachedSets = getCachedSets();

  React.useEffect(() => {
    if (user) {
      const loadCollectionSize = async () => {
        const collection = await getCollectionAsArray(user.uid);
        setCollectionSize(collection.length);
      };
      loadCollectionSize();
    }
  }, [user]);

  const handleClearCache = () => {
    if (confirm('Clear the card cache? Cards will be re-fetched from the API as needed.')) {
      clearCache();
      setCacheSize(0);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and app preferences.</p>
      </div>

      {/* Account */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <User size={20} className="text-purple-400" />
          <h2 className="text-lg font-semibold text-white">Account</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Display Name</span>
            <span className="text-sm text-white">{user?.displayName || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Email</span>
            <span className="text-sm text-white">{user?.email || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">User ID</span>
            <span className="text-sm text-gray-300 font-mono text-xs">{user?.uid}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-4 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Card Database Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Card Database</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Cards Cached Locally</span>
            <span className="text-sm text-white font-medium">{cacheSize}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Sets in Cache</span>
            <span className="text-sm text-white font-medium">{cachedSets.length}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Cards in Collection</span>
            <span className="text-sm text-white font-medium">{collectionSize}</span>
          </div>
          {cachedSets.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-700/30">
              <span className="text-sm text-gray-400">Cached Sets:</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {cachedSets.map((set: string) => (
                  <span key={set} className="text-xs px-2 py-1 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
                    {set}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Cards are cached locally as you look them up. The full database is available via the Riftbound API (riftcodex.com).
          </p>
          <button
            onClick={handleClearCache}
            className="mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Clear Card Cache
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-green-400" />
          <h2 className="text-lg font-semibold text-white">Privacy & Data</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-300">
          <p>• Your collection and decklists are stored locally in your browser.</p>
          <p>• Card data is fetched from the public Riftbound API (riftcodex.com).</p>
          <p>• No personal data is sent to external servers.</p>
          <p>• Clearing your browser data will reset your collection and decks.</p>
        </div>
      </div>

      {/* About */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Info size={20} className="text-gray-400" />
          <h2 className="text-lg font-semibold text-white">About</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-300">
          <p><strong className="text-white">Riftbound Card Cataloger</strong> v1.0.0</p>
          <p>A collection management and deck-building utility for the Riftbound trading card game.</p>
          <p className="text-gray-400 mt-3">
            Card data provided by <a href="https://riftcodex.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">RiftCodex</a>.
          </p>
          <p className="text-gray-400">
            Built with React, TypeScript, and Tailwind CSS.
          </p>
        </div>
      </div>
    </div>
  );
}
