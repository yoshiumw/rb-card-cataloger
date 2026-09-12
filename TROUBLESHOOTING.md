# Google Sign-In Troubleshooting Guide

## Issue: "Google sign-in failed. Please try again."

If you're seeing this error immediately when clicking "Sign in with Google", follow these steps to diagnose and fix the issue.

## Step 1: Check the Debug Page

1. Navigate to `/#/debug` in your app
2. Verify all environment variables are loaded (green checkmarks)
3. Click "Test Firebase" button to verify Firebase connection
4. Check the "Firebase Status" section for authorized domains reminder

## Step 2: Check Browser Console

1. Open browser developer tools (F12)
2. Go to the Console tab
3. Click "Sign in with Google"
4. Look for error messages - they should now show the actual Firebase error

Common errors and their solutions:

### Error: "auth/unauthorized-domain"
**Cause**: Your domain is not in Firebase's authorized domains list

**Solution**:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain** and add:
   - For Qwen: `*.qwen.ai` or your specific preview URL
   - For GitHub Pages: `yoshiumw.github.io`
   - For local: `localhost` and `127.0.0.1`

### Error: "auth/api-key-not-valid"
**Cause**: Firebase API key is incorrect or missing

**Solution**:
1. Check your environment variables in Qwen settings
2. Verify `VITE_FIREBASE_API_KEY` is set correctly
3. Get the correct API key from Firebase Console → Project Settings → General → Your apps

### Error: "auth/invalid-api-key"
**Cause**: API key format is invalid

**Solution**:
1. Copy the API key directly from Firebase Console
2. Make sure there are no extra spaces or characters
3. Ensure it starts with `AIza`

### Error: "auth/app-deleted" or "auth/project-not-found"
**Cause**: Project ID is incorrect

**Solution**:
1. Verify `VITE_FIREBASE_PROJECT_ID` matches your Firebase project
2. Get the correct project ID from Firebase Console → Project Settings → General

### Error: "auth/configuration-not-found"
**Cause**: Google sign-in provider is not enabled

**Solution**:
1. Go to Firebase Console → Authentication → Sign-in method
2. Click on **Google** provider
3. Toggle it to **Enable**
4. Add a support email if prompted
5. Click **Save**

## Step 3: Verify Firebase Configuration

Run this in your browser console:
```javascript
console.log(import.meta.env)
```

You should see all your `VITE_FIREBASE_*` variables. If they're missing or show as `undefined`, your environment variables aren't being loaded.

## Step 4: Check Firebase Console Settings

### Authentication Settings
1. Go to **Authentication** → **Sign-in method**
2. Verify **Google** is enabled
3. Check that your support email is set

### Authorized Domains
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Verify your domain is listed:
   - `localhost` (for local development)
   - `127.0.0.1` (for local development)
   - Your Qwen preview domain (e.g., `*.qwen.ai`)
   - `yoshiumw.github.io` (for GitHub Pages)

### Web App Configuration
1. Go to **Project Settings** → **General** → **Your apps**
2. Verify you have a Web app registered
3. Check that the config values match your environment variables

## Step 5: Test in Different Environments

### Local Development
```bash
npm run dev
```
- Open `http://localhost:3000`
- Try Google sign-in
- Should work if `localhost` is in authorized domains

### Qwen Preview
- Refresh the preview after adding environment variables
- Check the `/debug` page
- Try Google sign-in

### GitHub Pages
- Push changes to trigger rebuild
- Wait for deployment to complete
- Check the `/debug` page
- Try Google sign-in

## Step 6: Common Mistakes

### ❌ Wrong Environment Variable Names
Make sure all variables start with `VITE_`:
- ✅ `VITE_FIREBASE_API_KEY`
- ❌ `FIREBASE_API_KEY` (won't work)

### ❌ Missing Domain in Authorized List
Even if everything else is correct, Google sign-in will fail if your domain isn't authorized.

### ❌ Using Popup Instead of Redirect
The app now uses redirect method to avoid popup blockers. If you modified the code back to popup, switch it back to redirect.

### ❌ Not Waiting for Deployment
After changing environment variables or Firebase settings:
- Qwen: Refresh the preview
- GitHub Pages: Wait for the GitHub Actions build to complete (check Actions tab)

## Step 7: Clear Browser Data

Sometimes cached data can cause issues:
1. Open browser developer tools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Clear:
   - Local Storage
   - Session Storage
   - Cookies
4. Refresh the page
5. Try Google sign-in again

## Step 8: Check Firebase SDK Version

Make sure you're using compatible Firebase versions. Check `package.json`:
```json
{
  "dependencies": {
    "firebase": "^10.0.0"
  }
}
```

If you need to update:
```bash
npm install firebase@latest
```

## Step 9: Verify Redirect Configuration

The app uses `signInWithRedirect` which requires:
1. Firebase SDK properly initialized
2. Google provider enabled
3. Domain authorized
4. No popup blockers interfering

## Step 10: Alternative - Use Email/Password

If Google sign-in continues to fail, you can use email/password authentication:
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable **Email/Password** provider
3. Use the registration form to create an account
4. Sign in with email and password

## Getting Help

If you've tried all these steps and Google sign-in still fails:

1. **Check the exact error message** in the browser console
2. **Take a screenshot** of the `/debug` page showing:
   - Environment variables status
   - Firebase test result
   - Any error messages
3. **Verify Firebase Console settings** match the troubleshooting steps above

## Quick Checklist

- [ ] All `VITE_FIREBASE_*` environment variables are set
- [ ] Firebase project exists and is active
- [ ] Google sign-in provider is enabled in Firebase
- [ ] Your domain is in Firebase's authorized domains list
- [ ] Environment variables are loaded (check `/debug` page)
- [ ] Firebase test passes (click "Test Firebase" on `/debug` page)
- [ ] Browser console shows helpful error messages
- [ ] You've cleared browser cache and cookies
- [ ] You've refreshed/redeployed after making changes

## Expected Behavior

When working correctly:
1. Click "Sign in with Google"
2. Browser redirects to Google sign-in page
3. You authenticate with Google
4. Browser redirects back to your app
5. You're automatically logged in
6. Dashboard loads with your user data

If you see the error immediately without redirecting to Google, there's a configuration issue that needs to be fixed before the redirect can happen.
