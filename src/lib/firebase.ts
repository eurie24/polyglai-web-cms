// Firebase configuration for PolyglAI Web CMS
// This connects to the same Firebase project as the Flutter mobile app

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { collection, getDocs } from 'firebase/firestore';

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

// Define a type for user data
type UserData = {
  id: string;
  name?: string;
  email?: string;
  [key: string]: any; // Allow for additional properties from Firestore
};

const fetchUsers = async () => {
  try {
    setLoading(true);
    console.log("Starting user fetch...");
    
    // Get all user IDs from the users collection
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    console.log(`Found ${usersSnapshot.docs.length} documents in users collection`);
    
    const allUsers = [];
    
    // Process each user document
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`Processing user ID: ${userId}`);
      
      let userData: UserData = {
        id: userId,
        ...userDoc.data()
      };
      
      // Try to get profile info
      try {
        const profileRef = collection(db, 'users', userId, 'profile');
        const profileSnapshot = await getDocs(profileRef);
        console.log(`Found ${profileSnapshot.docs.length} docs in profile collection for ${userId}`);
        
        const infoDoc = profileSnapshot.docs.find(doc => doc.id === 'info');
        if (infoDoc) {
          console.log(`Found info document for ${userId}`);
          userData = {
            ...userData,
            ...infoDoc.data(),
            name: infoDoc.data().name || userData.name,
            email: infoDoc.data().email || userData.email
          };
        }
      } catch (error) {
        console.error(`Error fetching profile for user ${userId}:`, error);
      }
      
      allUsers.push(userData);
    }
    
    console.log("All users:", allUsers);
    setUsers(allUsers);
    setTotalUsers(allUsers.length);
    setLoading(false);
  } catch (error) {
    console.error("Error fetching users:", error);
    setLoading(false);
  }
}; 

function setLoading(arg0: boolean) {
  throw new Error('Function not implemented.');
}

function setUsers(allUsers: { id: string; }[]) {
  throw new Error('Function not implemented.');
}

function setTotalUsers(length: number) {
  throw new Error('Function not implemented.');
}

