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

    // Prefer environment variables on Vercel/production
    const envProjectId = process.env.FIREBASE_PROJECT_ID;
    const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (envProjectId && envClientEmail && envPrivateKey) {
      console.log('Using environment variables to initialize Firebase Admin SDK');
      const adminApp = initializeApp({
        credential: cert({
          projectId: envProjectId,
          clientEmail: envClientEmail,
          privateKey: envPrivateKey,
        }),
        databaseURL: `https://${envProjectId}.firebaseio.com`,
      }, 'admin-app');

      console.log('✅ Firebase Admin SDK initialized successfully from environment variables!', adminApp.name);
      return adminApp;
    }

    // Fallback to local serviceAccountKey.json for local development
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    console.log('Env vars not found, checking for service account key at:', serviceAccountPath);

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service account credentials not provided. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars or add serviceAccountKey.json');
    }

    console.log('🔑 Service account key found! Initializing Firebase Admin SDK from file...');

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