import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Shield, Database, Info } from 'lucide-react';
import { getDatabaseSize, getAllSets } from '../services/cardLookupService';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const dbSize = getDatabaseSize();
  const sets = getAllSets();

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

      {/* Database Info */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Database size={20} className="text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Card Database</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Total Cards in Database</span>
            <span className="text-sm text-white font-medium">{dbSize}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Available Sets</span>
            <span className="text-sm text-white font-medium">{sets.length}</span>
          </div>
          <div className="p-3 rounded-lg bg-gray-700/30">
            <span className="text-sm text-gray-400">Sets:</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {sets.map(set => (
                <span key={set} className="text-xs px-2 py-1 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
                  {set}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-green-400" />
          <h2 className="text-lg font-semibold text-white">Privacy & Security</h2>
        </div>
        <div className="space-y-2 text-sm text-gray-300">
          <p>• Your collection and decklists are stored locally in this demo.</p>
          <p>• In production with Firebase, each user's data is private and isolated.</p>
          <p>• Firestore security rules ensure users can only access their own data.</p>
          <p>• The global card database is shared and read-only for all users.</p>
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
            Built with React, TypeScript, Tailwind CSS, and Firebase.
          </p>
        </div>
      </div>
    </div>
  );
}
