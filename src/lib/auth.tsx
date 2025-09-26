import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';
import { getErrorMessage } from './auth-error-handler';

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Admin email constant
const ADMIN_EMAIL = 'polyglAITool@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin based on email
  const checkAdminByEmail = (email: string | null | undefined): boolean => {
    if (!email) return false;
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (user) {
        // Use email-based admin check
        const adminStatus = checkAdminByEmail(user.email);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user has admin email
      if (!checkAdminByEmail(email)) {
        await firebaseSignOut(auth);
        setError('You do not have admin privileges');
        throw new Error('Not an admin account');
      }
      
      setIsAdmin(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'admin'));
      throw err;
    }
  };

  // signUp removed on web

  const signOut = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setIsAdmin(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'admin'));
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signIn, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 