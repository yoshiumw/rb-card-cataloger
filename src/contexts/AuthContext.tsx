import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
    // Check if user is logged in (demo mode)
    const storedUser = localStorage.getItem('riftbound_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string) => {
    setError(null);
    try {
      // Demo mode: accept any credentials
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
  }, []);

  const register = useCallback(async (email: string, _password: string, displayName: string) => {
    setError(null);
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
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
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
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    localStorage.removeItem('riftbound_user');
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
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
