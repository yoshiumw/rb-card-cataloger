# Google Sign-In Fix

## What Was Fixed

Changed Google authentication from **popup** to **redirect** method to avoid popup blocker issues.

### Before (Popup Method)
- Attempted to open a popup window for Google sign-in
- Blocked by browsers due to "lack of user activation"
- Unreliable in embedded environments and preview modes

### After (Redirect Method)
- Redirects user to Google's sign-in page
- Returns to your app after authentication
- Works reliably in all environments
- No popup blocker issues

## Required Firebase Configuration

To make Google sign-in work, you **must** add your domains to Firebase's authorized domains list:

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**

### Step 2: Add Your Domains
Add these domains (click **Add domain** for each):

#### For Qwen Preview:
```
*.qwen.ai
```
Or the specific preview URL if you know it.

#### For GitHub Pages:
```
yoshiumw.github.io
```

#### For Local Development:
```
localhost
127.0.0.1
```

These should already be in the list by default, but verify they're there.

### Step 3: Verify Google Provider is Enabled
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Make sure **Google** provider is enabled
3. Add a support email if prompted

## How It Works Now

1. User clicks "Sign in with Google"
2. App redirects to Google's sign-in page
3. User authenticates with Google
4. Google redirects back to your app
5. App completes the sign-in process automatically
6. User is logged in and sees the dashboard

## Testing

### Test in Qwen Preview:
1. Make sure your preview domain is in Firebase's authorized domains
2. Click "Sign in with Google"
3. You should be redirected to Google
4. After signing in, you'll be redirected back to the app

### Test Locally:
1. Run `npm run dev`
2. Open `http://localhost:3000`
3. Click "Sign in with Google"
4. Should work without popup blocker issues

## Troubleshooting

### "Domain not authorized" error
- Your domain is not in Firebase's authorized domains list
- Add it following the steps above

### Redirect loop
- Clear browser cache and cookies
- Check browser console for errors
- Verify Firebase configuration in `.env.local`

### Sign-in completes but user not logged in
- Check `/debug` page to verify Firebase is configured
- Check browser console for errors
- Verify Firestore security rules allow user creation

## Technical Details

### Code Changes
- **File**: `src/contexts/AuthContext.tsx`
- **Import**: Changed from `signInWithPopup` to `signInWithRedirect` and `getRedirectResult`
- **Login function**: Now uses `signInWithRedirect(auth!, provider)`
- **Auth initialization**: Added `getRedirectResult()` to handle return from Google

### Why This Works Better
- **Redirect method** doesn't require popup windows
- Works in all browser environments
- More reliable in embedded contexts (iframes, preview modes)
- Better mobile support
- No popup blocker interference

## Next Steps

1. Add your domains to Firebase authorized domains
2. Test Google sign-in in your environment
3. Verify user data is created in Firestore
4. Test the full authentication flow
