import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../firebase/config';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Demo user for when Firebase is not configured
const DEMO_USER: User = {
  uid: 'demo-user-001',
  email: 'demo@riftbound.app',
  displayName: 'Demo Player',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      // Demo mode: check localStorage
      const storedUser = localStorage.getItem('riftbound_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
      return;
    }

    // Firebase mode: handle redirect result and listen to auth state
    const initAuth = async () => {
      // Check if we're returning from a redirect sign-in
      try {
        const result = await getRedirectResult(auth!);
        if (result) {
          // User just completed Google sign-in via redirect
          console.log('Google sign-in successful via redirect');
        }
      } catch (error) {
        console.error('Error getting redirect result:', error);
      }

      // Listen to auth state changes
      const unsubscribe = onAuthStateChanged(auth!, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // User is signed in
          const userDocRef = doc(db!, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
        
          const userData: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || userDoc.data()?.displayName || firebaseUser.email?.split('@')[0] || 'Player',
            photoURL: firebaseUser.photoURL,
          };
        
          setUser(userData);
        } else {
          // User is signed out
          setUser(null);
        }
        setLoading(false);
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
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    
    if (!isFirebaseConfigured || !auth) {
      // Demo mode
      try {
        const demoUser: User = {
          uid: 'demo-user-001',
          email,
          displayName: email.split('@')[0],
        };
        setUser(demoUser);
        localStorage.setItem('riftbound_user', JSON.stringify(demoUser));
      } catch (err) {
        setError('Login failed. Please try again.');
      }
      return;
    }

    // Firebase mode
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const errorCode = err.code;
      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Login failed. Please try again.');
      }
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setError(null);
    
    if (!isFirebaseConfigured || !auth) {
      // Demo mode
      try {
        const newUser: User = {
          uid: 'demo-user-001',
          email,
          displayName: displayName || email.split('@')[0],
        };
        setUser(newUser);
        localStorage.setItem('riftbound_user', JSON.stringify(newUser));
      } catch (err) {
        setError('Registration failed. Please try again.');
      }
      return;
    }

    // Firebase mode
    try {
      const userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      
      // Create user document in Firestore
      const userDocRef = doc(db!, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        email: email,
        displayName: displayName || email.split('@')[0],
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const errorCode = err.code;
      if (errorCode === 'auth/email-already-in-use') {
        setError('Email already in use.');
      } else if (errorCode === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    
    if (!isFirebaseConfigured || !auth) {
      // Demo mode
      try {
        const googleUser: User = {
          uid: 'demo-google-user',
          email: 'player@gmail.com',
          displayName: 'Google Player',
          photoURL: null,
        };
        setUser(googleUser);
        localStorage.setItem('riftbound_user', JSON.stringify(googleUser));
      } catch (err) {
        setError('Google sign-in failed. Please try again.');
      }
      return;
    }

    // Firebase mode - use redirect instead of popup to avoid popup blockers
    try {
      const provider = new GoogleAuthProvider();
      // signInWithRedirect doesn't return a promise that resolves - it initiates redirect
      signInWithRedirect(auth!, provider);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      const errorMessage = err?.message || err?.code || 'Unknown error';
      setError(`Google sign-in failed: ${errorMessage}`);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      // Demo mode
      setUser(null);
      localStorage.removeItem('riftbound_user');
      return;
    }

    // Firebase mode
    try {
      await signOut(auth);
    } catch (err) {
      setError('Logout failed. Please try again.');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, error, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
