# Firebase Setup for Local Testing

## Quick Start

1. **Create a Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project" and follow the setup wizard

2. **Enable Authentication**
   - In Firebase Console, go to **Authentication** → **Sign-in method**
   - Enable **Email/Password** provider
   - Optionally enable **Google** provider

3. **Create Firestore Database**
   - Go to **Firestore Database** → **Create database**
   - Choose "Start in test mode" for development
   - Select your preferred location

4. **Get Your Config**
   - Go to **Project settings** (gear icon)
   - Scroll to "Your apps" section
   - Click the web icon (</>) to add a web app
   - Copy the config values

5. **Update .env.local**
   - Open the `.env.local` file in the project root
   - Replace the placeholder values with your actual Firebase config:
   ```
   VITE_FIREBASE_API_KEY=your_actual_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

6. **Restart Development Server**
   - Stop the dev server (Ctrl+C)
   - Run `npm run dev` again
   - The app will now use real Firebase authentication

## Testing Without Firebase

If you want to test the app without setting up Firebase, the app will automatically run in **demo mode**:
- Any email/password will work for login
- User data is stored in localStorage
- No real authentication or database is used

## Firestore Security Rules

For production, update your Firestore rules in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Card database is publicly readable
    match /cards/{cardId} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## Troubleshooting

- **Blank page after login**: Check browser console for Firebase errors
- **Authentication not working**: Verify your `.env.local` values match Firebase Console
- **Environment variables not loading**: Restart your dev server after updating `.env.local`
- **CORS errors**: Make sure your domain is added to Firebase Authentication authorized domains

## Next Steps

After testing locally, you can deploy to GitHub Pages with Firebase by:
1. Adding environment variables as GitHub Secrets
2. Updating the GitHub Actions workflow to inject them during build
3. Adding your GitHub Pages domain to Firebase authorized domains
