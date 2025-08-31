// Firebase configuration for PolyglAI Web CMS
// This connects to the same Firebase project as the Flutter mobile app

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';


// Firebase configuration directly from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyAzGBH6VXHsQoTi6lFRJo2Za3Ym4jWDRZI",
  authDomain: "polyglai-5591c.firebaseapp.com",
  projectId: "polyglai-5591c",
  storageBucket: "polyglai-5591c.firebasestorage.app",
  messagingSenderId: "384494047717",
  appId: "1:384494047717:web:df532a9442d43f64a61f0c",
  measurementId: "G-XE277SYX0R",
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics - only initialize on client side
export const initAnalytics = () => {
  if (typeof window !== 'undefined') {
    return getAnalytics(app);
  }
  return null;
};

export default app; 



