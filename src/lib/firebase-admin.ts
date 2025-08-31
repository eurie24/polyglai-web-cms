import * as admin from 'firebase-admin';
import { getApps, initializeApp, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin SDK
let adminApp: App | undefined;
try {
  if (getApps().length === 0) {
    // For development, use a real service account key
    // You must download this from Firebase Console and place in the web-cms root
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    console.log('Checking for service account key at:', serviceAccountPath);
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('🔑 Service account key found! Initializing Firebase Admin SDK from shared lib...');
      
      // Load the service account file directly instead of using require
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8')
      );
      
      adminApp = initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      }, 'admin-app');
      
      console.log('✅ Firebase Admin SDK initialized successfully from shared lib!');
      console.log(`Connected to project: ${serviceAccount.project_id}`);
    } else {
      console.error('❌ Service account key not found!');
      console.error('Please download a service account key from Firebase Console and save as serviceAccountKey.json');
    }
  } else {
    console.log('✅ Firebase Admin SDK already initialized');
    try {
      adminApp = getApp('admin-app');
    } catch (error) {
      console.error('Error getting existing admin app:', error);
    }
  }
} catch (error: unknown) {
  const err = error as { message?: string };
  console.error('Firebase Admin initialization error:', err.message);
}



// Function to get all users from Firestore with admin privileges
export async function getAllUsers() {
  try {
    console.log('Getting all users with admin privileges');
    if (!adminApp) {
      throw new Error('Admin app not initialized');
    }
    const firestore = getFirestore(adminApp);
    const usersSnapshot = await firestore.collection('users').get();
    
    console.log(`Found ${usersSnapshot.docs.length} users with admin access`);
    
    const allUsers = [];
    
    // Process each user to get their profile data
    for (const doc of usersSnapshot.docs) {
      try {
        const userId = doc.id;
        const userData = {
          id: userId,
          ...doc.data()
        };
        
        // Get profile info from subcollection if it exists
        const profileSnap = await firestore
          .collection('users')
          .doc(userId)
          .collection('profile')
          .doc('info')
          .get();
          
        if (profileSnap.exists) {
          const profileData = profileSnap.data();
          Object.assign(userData, profileData);
          console.log(`Found profile for user ${userId}`);
        } else {
          console.log(`No profile found for user ${userId}`);
        }
        
        allUsers.push(userData);
      } catch (err) {
        console.error(`Error processing user ${doc.id}:`, err);
      }
    }
    
    return allUsers;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
}

export const getAdminDb = () => {
  try {
    if (!adminApp) {
      throw new Error('Admin app not initialized');
    }
    return getFirestore(adminApp);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error getting admin firestore:', err.message);
    return null;
  }
};

export const getAdminAuth = () => {
  try {
    if (!adminApp) {
      throw new Error('Admin app not initialized');
    }
    return getAuth(adminApp);
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error getting admin auth:', err.message);
    return null;
  }
};

export default admin; 