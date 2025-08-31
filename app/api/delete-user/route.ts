import { NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/adminInit';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function DELETE(request: Request) {
  try {
    // Get user ID from the request URL
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🗑️ Starting deletion process for user: ${userId}`);

    // Initialize the admin SDK
    const admin = await initAdmin();
    const adminAuth = getAuth(admin);
    const firestore = getFirestore(admin);
    
    let firestoreDeleted = false;
    let authDeleted = false;
    let actualAuthUid = null;
    
    // Step 1: Try to find the user in Firebase Auth to get their actual UID
    try {
      console.log(`🔍 Searching for user in Firebase Auth...`);
      
      let userRecord = null;
      
      // Try different approaches to find the user
      if (userId.includes('@')) {
        // If userId looks like an email, search by email
        console.log(`📧 Searching by email: ${userId}`);
        try {
          userRecord = await adminAuth.getUserByEmail(userId);
          actualAuthUid = userRecord.uid;
          console.log(`✅ Found user by email: ${userRecord.email} (UID: ${userRecord.uid})`);
        } catch (emailError: unknown) {
          const error = emailError as { message?: string };
          console.log(`⚠️ User not found by email: ${error.message || 'Unknown error'}`);
        }
      } else {
        // Try to get user by UID directly
        console.log(`🆔 Searching by UID: ${userId}`);
        try {
          userRecord = await adminAuth.getUser(userId);
          actualAuthUid = userRecord.uid;
          console.log(`✅ Found user by UID: ${userRecord.email} (${userRecord.uid})`);
        } catch (uidError: unknown) {
          const error = uidError as { message?: string };
          console.log(`⚠️ User not found by UID: ${error.message || 'Unknown error'}`);
        }
      }
      
      // If we found the user, delete their auth account
      if (userRecord && actualAuthUid) {
        console.log(`🔐 Deleting Firebase Auth user: ${actualAuthUid}`);
        await adminAuth.deleteUser(actualAuthUid);
        console.log(`✅ Deleted authentication record for user ${actualAuthUid}`);
        authDeleted = true;
      } else {
        console.log(`⚠️ User not found in Firebase Auth - may be a data-only user`);
      }
      
    } catch (authError) {
      console.error("❌ Error in auth search/deletion process:", authError);
    }
    
    // Step 2: Delete all user data from Firestore
    // We'll try both the original userId and the actualAuthUid (if different)
    const idsToDelete = [userId];
    if (actualAuthUid && actualAuthUid !== userId) {
      idsToDelete.push(actualAuthUid);
    }
    
    for (const id of idsToDelete) {
      try {
        console.log(`🔥 Deleting Firestore data for ID: ${id}`);
        
        // Delete main user document
        const userDoc = firestore.doc(`users/${id}`);
        const userDocSnapshot = await userDoc.get();
        
        if (userDocSnapshot.exists) {
          await userDoc.delete();
          console.log(`✅ Deleted main user document: users/${id}`);
          firestoreDeleted = true;
        } else {
          console.log(`⚠️ User document users/${id} does not exist`);
        }
        
        // Delete profile subcollection if it exists
        const profileDocs = await firestore.collection(`users/${id}/profile`).listDocuments();
        for (const doc of profileDocs) {
          await doc.delete();
          console.log(`✅ Deleted profile document: ${doc.path}`);
          firestoreDeleted = true;
        }
        
        // Delete stats subcollection if it exists
        const statsDocs = await firestore.collection(`users/${id}/stats`).listDocuments();
        for (const doc of statsDocs) {
          await doc.delete();
          console.log(`✅ Deleted stats document: ${doc.path}`);
          firestoreDeleted = true;
        }
        
        // Delete any other potential user-related collections
        const collections = ['achievements', 'progress', 'settings', 'favorites'];
        for (const collectionName of collections) {
          try {
            const userSubDocs = await firestore.collection(`users/${id}/${collectionName}`).listDocuments();
            for (const doc of userSubDocs) {
              await doc.delete();
              console.log(`✅ Deleted ${collectionName} document: ${doc.path}`);
              firestoreDeleted = true;
            }
          } catch {
            // Ignore errors for optional subcollections
            console.log(`ℹ️ No ${collectionName} subcollection for user ${id}`);
          }
        }
        
      } catch (firestoreError) {
        console.error(`❌ Error deleting Firestore data for ${id}:`, firestoreError);
      }
    }

    const success = firestoreDeleted || authDeleted;
    
    if (success) {
      console.log(`✅ User deletion completed successfully`);
    } else {
      console.log(`⚠️ User deletion may have failed - no data was found to delete`);
    }
    
    return NextResponse.json({ 
      success,
      message: success ? 'User deletion completed successfully' : 'No user data found to delete',
      details: {
        firestoreDeleted,
        authDeleted,
        originalUserId: userId,
        actualAuthUid,
        searchedIds: idsToDelete
      }
    });
  } catch (error) {
    console.error('❌ Error in delete user API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' }, 
      { status: 500 }
    );
  }
} 