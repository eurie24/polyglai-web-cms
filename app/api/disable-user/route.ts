import { NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/adminInit';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const { userId, action, userEmail, userName } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and action are required' 
      }, { status: 400 });
    }

    if (!['disable', 'enable'].includes(action)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Action must be either "disable" or "enable"' 
      }, { status: 400 });
    }

    console.log(`🔄 ${action === 'disable' ? 'Disabling' : 'Enabling'} user: ${userId}`);

    // Initialize the admin SDK
    const admin = await initAdmin();
    const adminAuth = getAuth(admin);
    const firestore = getFirestore(admin);
    
    let authUpdated = false;
    let firestoreUpdated = false;
    let actualAuthUid = null;
    
    // Step 1: Find and update the user in Firebase Auth
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
      
      // If we found the user, update their auth account
      if (userRecord && actualAuthUid) {
        console.log(`🔐 ${action === 'disable' ? 'Disabling' : 'Enabling'} Firebase Auth user: ${actualAuthUid}`);
        
        if (action === 'disable') {
          // Disable the user account
          await adminAuth.updateUser(actualAuthUid, {
            disabled: true
          });
          
          // Revoke all refresh tokens to log them out immediately
          await adminAuth.revokeRefreshTokens(actualAuthUid);
          console.log(`✅ Disabled and logged out user: ${actualAuthUid}`);
        } else {
          // Enable the user account
          await adminAuth.updateUser(actualAuthUid, {
            disabled: false
          });
          console.log(`✅ Enabled user: ${actualAuthUid}`);
        }
        
        authUpdated = true;
      } else {
        console.log(`⚠️ User not found in Firebase Auth - may be a data-only user`);
      }
      
    } catch (authError) {
      console.error("❌ Error in auth update process:", authError);
    }
    
    // Step 2: Update user status in Firestore
    const idsToUpdate = [userId];
    if (actualAuthUid && actualAuthUid !== userId) {
      idsToUpdate.push(actualAuthUid);
    }
    
    console.log(`📝 IDs to update in Firestore:`, idsToUpdate);
    
    for (const id of idsToUpdate) {
      try {
        console.log(`🔥 Updating Firestore status for ID: ${id}`);
        
        const userDoc = firestore.doc(`users/${id}`);
        const userDocSnapshot = await userDoc.get();
        
        if (userDocSnapshot.exists) {
          const newStatus = action === 'disable' ? 'DISABLED' : 'ACTIVE';
          const currentData = userDocSnapshot.data();
          console.log(`📋 Current user data:`, currentData);
          console.log(`📋 Current status: ${currentData?.status || 'NOT_SET'}`);
          
          await userDoc.update({
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ Updated user status to ${newStatus}: users/${id}`);
          
          // Verify the update
          const updatedDoc = await userDoc.get();
          const updatedData = updatedDoc.data();
          console.log(`📋 Updated user data:`, updatedData);
          console.log(`📋 New status: ${updatedData?.status || 'NOT_SET'}`);
          
          firestoreUpdated = true;
        } else {
          console.log(`⚠️ User document users/${id} does not exist`);
          
          // Try to find user by email if we have it
          if (userEmail) {
            console.log(`🔍 Searching for user by email: ${userEmail}`);
            try {
              const usersQuery = await firestore.collection('users')
                .where('email', '==', userEmail)
                .limit(1)
                .get();
              
              if (!usersQuery.empty) {
                const userDocByEmail = usersQuery.docs[0];
                console.log(`✅ Found user by email: ${userDocByEmail.id}`);
                
                const newStatus = action === 'disable' ? 'DISABLED' : 'ACTIVE';
                await userDocByEmail.ref.update({
                  status: newStatus,
                  updatedAt: new Date().toISOString()
                });
                console.log(`✅ Updated user status to ${newStatus} via email search: ${userDocByEmail.id}`);
                firestoreUpdated = true;
              } else {
                console.log(`⚠️ No user found with email: ${userEmail}`);
              }
            } catch (emailSearchError) {
              console.error(`❌ Error searching by email:`, emailSearchError);
            }
          }
          
          // If still not found, create the document
          if (!firestoreUpdated) {
            console.log(`🆕 Creating new user document for ${id}`);
            const newStatus = action === 'disable' ? 'DISABLED' : 'ACTIVE';
            await userDoc.set({
              id: id,
              email: userEmail || '',
              name: userName || 'User',
              status: newStatus,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              role: 'user'
            });
            console.log(`✅ Created new user document with status ${newStatus}: users/${id}`);
            firestoreUpdated = true;
          }
        }
        
      } catch (firestoreError) {
        console.error(`❌ Error updating Firestore data for ${id}:`, firestoreError);
      }
    }

    // Note: Email notifications are now handled on the client side using EmailJS

    const success = authUpdated || firestoreUpdated;
    
    if (success) {
      console.log(`✅ User ${action} completed successfully`);
    } else {
      console.log(`⚠️ User ${action} may have failed - no data was found to update`);
    }
    
    return NextResponse.json({ 
      success,
      message: `User ${action} completed successfully`,
      details: {
        authUpdated,
        firestoreUpdated,
        originalUserId: userId,
        actualAuthUid,
        searchedIds: idsToUpdate
      }
    });
  } catch (error) {
    console.error(`❌ Error in ${request.method} user API:`, error);
    return NextResponse.json(
      { success: false, error: `Failed to ${request.method.toLowerCase()} user` }, 
      { status: 500 }
    );
  }
}
