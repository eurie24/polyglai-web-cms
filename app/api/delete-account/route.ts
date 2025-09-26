import { NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/adminInit';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function DELETE(request: Request) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authorization token required' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    console.log(`🗑️ Starting account deletion process`);

    // Initialize the admin SDK
    const admin = await initAdmin();
    const adminAuth = getAuth(admin);
    const firestore = getFirestore(admin);
    
    let firestoreDeleted = false;
    let authDeleted = false;
    let userId: string | null = null;
    
    // Step 1: Verify the user's token and get their UID
    try {
      console.log(`🔍 Verifying user token...`);
      
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      userId = decodedToken.uid;
      console.log(`✅ Token verified for user: ${userId} (${decodedToken.email})`);
      
    } catch (tokenError) {
      console.error('❌ Token verification failed:', tokenError);
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Could not identify user' }, { status: 400 });
    }

    // Step 2: Delete all user data from Firestore first
    try {
      console.log(`🔥 Deleting Firestore data for user: ${userId}`);
      
      // Delete all subcollections (similar to Flutter implementation)
      const subcollections = [
        'stats',
        'languages', 
        'profile',
        'settings',
        'dailyChallenges',
        'daily_profanity',
        'language_profanity',
        'assessmentsData',
        'translationHistory',
        'feedback',
        'notifications',
        'achievements',
        'badges',
        'streaks',
        'challenges',
        'progress',
        'sessions',
        'activity',
        'preferences',
        'walkthrough',
        'onboarding'
      ];

      // Delete all subcollections
      for (const subcollection of subcollections) {
        await deleteSubcollection(firestore, `users/${userId}/${subcollection}`);
      }

      // Delete user references in global collections
      await deleteUserReferences(firestore, userId);

      // Delete the main user document
      const userDoc = firestore.doc(`users/${userId}`);
      const userDocSnapshot = await userDoc.get();
      
      if (userDocSnapshot.exists) {
        await userDoc.delete();
        console.log(`✅ Deleted main user document: users/${userId}`);
        firestoreDeleted = true;
      } else {
        console.log(`⚠️ User document users/${userId} does not exist`);
      }
      
    } catch (firestoreError) {
      console.error(`❌ Error deleting Firestore data for ${userId}:`, firestoreError);
      // Continue with auth deletion even if Firestore deletion fails
    }

    // Step 3: Delete the Firebase Auth user
    try {
      console.log(`🔐 Deleting Firebase Auth user: ${userId}`);
      await adminAuth.deleteUser(userId);
      console.log(`✅ Deleted authentication record for user ${userId}`);
      authDeleted = true;
    } catch (authError) {
      console.error('❌ Error deleting Firebase Auth user:', authError);
      // If auth deletion fails, we still want to return success if Firestore was deleted
    }

    const success = firestoreDeleted || authDeleted;
    
    if (success) {
      console.log(`✅ Account deletion completed successfully`);
    } else {
      console.log(`⚠️ Account deletion may have failed - no data was found to delete`);
    }
    
    return NextResponse.json({ 
      success,
      message: success ? 'Account deleted successfully' : 'No account data found to delete',
      details: {
        firestoreDeleted,
        authDeleted,
        userId
      }
    });
  } catch (error) {
    console.error('❌ Error in delete account API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' }, 
      { status: 500 }
    );
  }
}

// Helper function to delete a subcollection
async function deleteSubcollection(firestore: FirebaseFirestore.Firestore, collectionPath: string) {
  try {
    const collection = firestore.collection(collectionPath);
    const snapshot = await collection.limit(100).get();
    
    if (snapshot.empty) {
      console.log(`ℹ️ No documents in ${collectionPath}`);
      return;
    }

    // Delete documents in batches
    const batch = firestore.batch();
    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.docs.length} documents from ${collectionPath}`);

    // Recursively delete if there are more documents
    if (snapshot.docs.length === 100) {
      await deleteSubcollection(firestore, collectionPath);
    }
  } catch (e) {
    console.error(`❌ Error deleting subcollection ${collectionPath}:`, e);
    // Continue with other deletions even if one fails
  }
}

// Helper function to delete user references in global collections
async function deleteUserReferences(firestore: FirebaseFirestore.Firestore, userId: string) {
  try {
    // Delete profanity records
    const profanityRecords = await firestore
      .collection('profanity_records')
      .where('userId', '==', userId)
      .get();
    
    if (!profanityRecords.empty) {
      const batch = firestore.batch();
      profanityRecords.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`✅ Deleted ${profanityRecords.docs.length} profanity records`);
    }

    // Add more global collections as needed
    console.log(`✅ Completed deletion of user references for ${userId}`);
  } catch (e) {
    console.error(`❌ Error deleting user references for ${userId}:`, e);
    // Continue with other deletions even if this fails
  }
}
