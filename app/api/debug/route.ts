import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  try {
    console.log('DEBUG API: Examining Firestore database structure');
    
    // Initialize Admin SDK if needed
    let app;
    if (getApps().length === 0) {
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(
          fs.readFileSync(serviceAccountPath, 'utf8')
        );
        
        app = initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id,
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        }, 'admin-app-debug');
      } else {
        return NextResponse.json({
          success: false,
          error: 'Service account key not found'
        }, { status: 500 });
      }
    } else {
      try {
        app = getApp('admin-app');
      } catch (e) {
        try {
          app = getApp('admin-app-debug');
        } catch (e2) {
          app = getApp(); // Try to get default app
        }
      }
    }
    
    // Get Firestore instance
    const db = getFirestore(app);
    const debug = {
      collections: {},
      hardcodedUserIds: [
        'sample-user-1',
        '4fYiosMKA0U49ITZVdcAumyCtH33',
        'F7qUbUeUnKNV3LxRkjNNyMtM8J62',
        'jA4Sdb1O7aX8FVry3IoHNKuS4ob2'
      ],
      idResults: {}
    };
    
    // List all top-level collections
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} top-level collections`);
    
    for (const coll of collections) {
      const collName = coll.id;
      console.log(`Examining collection: ${collName}`);
      
      const snapshot = await db.collection(collName).get();
      debug.collections[collName] = {
        count: snapshot.size,
        documents: {}
      };
      
      // Limit to first 10 docs to avoid massive response
      const docs = snapshot.docs.slice(0, 10);
      for (const doc of docs) {
        debug.collections[collName].documents[doc.id] = doc.data();
      }
    }
    
    // Check explicitly for the hardcoded user IDs
    for (const userId of debug.hardcodedUserIds) {
      try {
        // Check main user document
        const userDoc = await db.collection('users').doc(userId).get();
        
        const result = {
          exists: userDoc.exists,
          data: userDoc.exists ? userDoc.data() : null,
          profile: null,
          stats: null,
          settings: null,
          error: null
        };
        
        // Check subcollections if document exists
        if (userDoc.exists) {
          try {
            const profileDoc = await db.collection('users').doc(userId)
              .collection('profile').doc('info').get();
            result.profile = {
              exists: profileDoc.exists,
              data: profileDoc.exists ? profileDoc.data() : null
            };
          } catch (err) {
            result.profile = { error: err.message };
          }
          
          try {
            const statsDoc = await db.collection('users').doc(userId)
              .collection('stats').doc('usage').get();
            result.stats = {
              exists: statsDoc.exists,
              data: statsDoc.exists ? statsDoc.data() : null
            };
          } catch (err) {
            result.stats = { error: err.message };
          }
          
          try {
            const settingsDoc = await db.collection('users').doc(userId)
              .collection('settings').doc('preferences').get();
            result.settings = {
              exists: settingsDoc.exists,
              data: settingsDoc.exists ? settingsDoc.data() : null
            };
          } catch (err) {
            result.settings = { error: err.message };
          }
        }
        
        debug.idResults[userId] = result;
      } catch (err) {
        debug.idResults[userId] = { error: err.message };
      }
    }
    
    return NextResponse.json({
      success: true,
      dbInfo: debug,
      apps: getApps().map(a => a.name)
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 