import React from 'react';
import { isFirebaseConfigured } from '../firebase/config';
import { Check, X, AlertCircle } from 'lucide-react';

export default function DebugPage() {
  const envVars = {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const hasAllVars = Object.values(envVars).every(v => v && v.length > 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Environment Debug</h1>
        <p className="text-gray-400 mt-1">Check if your environment variables are loading correctly</p>
      </div>

      {/* Status Card */}
      <div className={`rounded-xl border p-6 ${
        hasAllVars 
          ? 'bg-green-600/10 border-green-500/30' 
          : 'bg-red-600/10 border-red-500/30'
      }`}>
        <div className="flex items-start gap-4">
          {hasAllVars ? (
            <Check size={32} className="text-green-400 flex-shrink-0" />
          ) : (
            <X size={32} className="text-red-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">
              {hasAllVars ? '✅ Firebase Configured' : '❌ Firebase Not Configured'}
            </h2>
            <p className="text-gray-300">
              {hasAllVars 
                ? 'All environment variables are loaded. Firebase authentication and Firestore are ready to use.'
                : 'Some environment variables are missing. The app is running in demo mode. Check your .env.local file or Qwen environment settings.'}
            </p>
          </div>
        </div>
      </div>

      {/* Environment Variables */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Environment Variables</h2>
        <div className="space-y-3">
          {Object.entries(envVars).map(([key, value]) => (
            <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-gray-700/30">
              {value ? (
                <Check size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <X size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-gray-300 break-all">{key}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {value ? (
                    <>
                      <span className="text-green-400">Value:</span>{' '}
                      <span className="text-gray-400">
                        {value.substring(0, 10)}...{value.substring(value.length - 5)}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-400">Not set</span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Firebase Status */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Firebase Status</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {isFirebaseConfigured ? (
              <Check size={20} className="text-green-400" />
            ) : (
              <X size={20} className="text-red-400" />
            )}
            <span className="text-gray-300">
              Firebase is {isFirebaseConfigured ? 'configured' : 'not configured'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isFirebaseConfigured ? (
              <Check size={20} className="text-green-400" />
            ) : (
              <AlertCircle size={20} className="text-yellow-400" />
            )}
            <span className="text-gray-300">
              App is running in {isFirebaseConfigured ? 'Firebase mode' : 'demo mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">How to Fix</h2>
        {!hasAllVars && (
          <div className="space-y-4 text-sm text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">For Local Development:</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Create or update <code className="px-2 py-0.5 bg-gray-700 rounded text-purple-300">.env.local</code> in the project root</li>
                <li>Add all Firebase config values with the <code className="px-2 py-0.5 bg-gray-700 rounded text-purple-300">VITE_</code> prefix</li>
                <li>Restart your development server</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">For Qwen Preview:</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Go to Qwen Settings → Environment</li>
                <li>Add each variable with the exact names shown above</li>
                <li>Make sure all values start with <code className="px-2 py-0.5 bg-gray-700 rounded text-purple-300">VITE_</code></li>
                <li>Refresh the preview</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">For GitHub Pages:</h3>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li>Go to your GitHub repository → Settings → Secrets and variables → Actions</li>
                <li>Add each variable as a repository secret</li>
                <li>Update your GitHub Actions workflow to inject them during build</li>
              </ol>
            </div>
          </div>
        )}
        {hasAllVars && (
          <div className="text-sm text-gray-300">
            <p className="mb-2">✅ All environment variables are loaded correctly!</p>
            <p className="text-gray-400">
              You can now use Firebase authentication and Firestore. Try logging in with your Firebase credentials.
            </p>
          </div>
        )}
      </div>

      {/* Console Log Helper */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Browser Console</h2>
        <p className="text-sm text-gray-300 mb-3">
          Open your browser's developer console (F12) and run:
        </p>
        <code className="block p-3 bg-gray-900 rounded-lg text-sm text-green-400 font-mono">
          console.log(import.meta.env)
        </code>
        <p className="text-xs text-gray-500 mt-2">
          This will show all environment variables available to your app.
        </p>
      </div>
    </div>
  );
}
