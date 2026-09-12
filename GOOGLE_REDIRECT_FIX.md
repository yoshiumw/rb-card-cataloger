# Google Sign-In Redirect Fix

## Problem
After signing in with Google, users were being redirected back to the login page instead of staying logged in.

## Root Cause
The auth state handling was too complex and had a race condition:
1. We were calling `getRedirectResult()` before setting up the auth state listener
2. This created timing issues where the auth state would change before we were listening
3. The complex async initialization was causing the user state to not be properly set

## Solution
Simplified the auth state handling to rely solely on `onAuthStateChanged`, which automatically handles both regular sign-ins and redirect results.

### Key Changes

1. **Removed `getRedirectResult()` call**
   - This was causing race conditions
   - `onAuthStateChanged` automatically fires after redirect sign-in

2. **Simplified auth initialization**
   - Direct listener setup without async wrapper
   - Cleaner, more reliable flow

3. **Better error handling**
   - Added try/catch around user data fetch
   - Falls back to basic user data if Firestore fetch fails

4. **Added debug logging**
   - Console logs to track auth state changes
   - Helps identify where issues occur

## How It Works Now

1. User clicks "Sign in with Google"
2. `signInWithRedirect()` is called
3. User is redirected to Google
4. User authenticates with Google
5. Google redirects back to your app
6. Firebase SDK automatically detects the sign-in
7. `onAuthStateChanged` fires with the user data
8. User state is set and loading completes
9. User is redirected to dashboard

## Testing

### Check Browser Console
After refreshing the app, open browser console (F12) and look for:
- "Auth state changed: user@email.com" (when signed in)
- "Auth state changed: null" (when signed out)

### Expected Flow
1. Click "Sign in with Google"
2. See "Initiating Google sign-in redirect..." in console
3. Redirect to Google
4. After authentication, redirect back to app
5. See "Auth state changed: your@email.com" in console
6. Automatically navigate to dashboard

## Troubleshooting

### Still Redirecting to Login?

1. **Check Console Logs**
   - Open browser console (F12)
   - Look for "Auth state changed" messages
   - Check for any error messages

2. **Verify Firebase Config**
   - Go to `/#/debug`
   - Ensure all environment variables are loaded
   - Click "Test Firebase" button

3. **Check Authorized Domains**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Ensure your domain is listed:
     - `*.qwen.ai` (for Qwen preview)
     - `yoshiumw.github.io` (for GitHub Pages)
     - `localhost` (for local development)

4. **Clear Browser Data**
   - Clear cookies and local storage
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

5. **Check Firebase Console**
   - Authentication → Users
   - Verify your Google account appears in the user list

### Common Issues

**Issue: "Auth state changed: null" after sign-in**
- Firebase isn't detecting the redirect result
- Check authorized domains
- Verify Google provider is enabled

**Issue: Infinite redirect loop**
- Check if `loading` state is being set correctly
- Verify `onAuthStateChanged` is firing

**Issue: User data not loading**
- Check Firestore security rules
- Verify user document exists in Firestore

## Code Changes

### Before
```typescript
const initAuth = async () => {
  try {
    const result = await getRedirectResult(auth!);
    if (result) {
      console.log('Google sign-in successful via redirect');
    }
  } catch (error) {
    console.error('Error getting redirect result:', error);
  }

  const unsubscribe = onAuthStateChanged(auth!, async (firebaseUser) => {
    // ... handle user
  });

  return unsubscribe;
};

let cleanup: (() => void) | undefined;
initAuth().then(unsubscribe => {
  cleanup = unsubscribe;
});

return () => {
  if (cleanup) cleanup();
};
```

### After
```typescript
const unsubscribe = onAuthStateChanged(auth!, async (firebaseUser) => {
  console.log('Auth state changed:', firebaseUser?.email || 'null');
  
  if (firebaseUser) {
    try {
      const userDocRef = doc(db!, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      const userData: User = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || userDoc.data()?.displayName || firebaseUser.email?.split('@')[0] || 'Player',
        photoURL: firebaseUser.photoURL,
      };
      
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Player',
        photoURL: firebaseUser.photoURL,
      });
    }
  } else {
    setUser(null);
  }
  setLoading(false);
});

return () => unsubscribe();
```

## Benefits

1. **More Reliable**: No race conditions or timing issues
2. **Simpler Code**: Easier to understand and maintain
3. **Better Error Handling**: Graceful fallbacks if Firestore fetch fails
4. **Better Debugging**: Console logs help identify issues
5. **Standard Pattern**: Follows Firebase recommended approach

## Next Steps

1. Refresh your Qwen preview
2. Try Google sign-in again
3. Check browser console for logs
4. Verify you stay logged in and see the dashboard

If it still doesn't work, check the console logs and share them for further debugging.
