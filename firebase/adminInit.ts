import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize the Firebase Admin SDK
export async function initAdmin() {
  try {
    // Check if the app is already initialized
    const apps = getApps();
    if (apps.length > 0) {
      console.log(`Firebase admin already initialized, apps: ${apps.length}`);
      console.log(`Retrieved existing app: ${apps[0].name}`);
      return apps[0];
    }
    
    console.log('Initializing Admin SDK...');
    console.log('Current working directory:', process.cwd());
    
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    console.log('Checking for service account key at:', serviceAccountPath);

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account key file not found at ' + serviceAccountPath);
    }

    console.log('🔑 Service account key found! Initializing Firebase Admin SDK...');
    
    // Read and parse the service account key
    const serviceAccountContent = fs.readFileSync(serviceAccountPath, 'utf8');
    console.log(`Service account file loaded, length: ${serviceAccountContent.length}`);
    
    const serviceAccount = JSON.parse(serviceAccountContent);
    console.log(`Service account parsed, project_id: ${serviceAccount.project_id}`);
    
    // Initialize the app with the service account
    const adminApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
    }, 'admin-app');

    console.log('✅ Firebase Admin SDK initialized successfully!', adminApp.name);
    
    return adminApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
} 