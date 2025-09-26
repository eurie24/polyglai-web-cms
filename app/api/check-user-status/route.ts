import { NextResponse } from 'next/server';
import { initAdmin } from '../../../firebase/adminInit';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userEmail = url.searchParams.get('userEmail');

    if (!userId && !userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID or email is required' 
      }, { status: 400 });
    }

    console.log(`🔍 Checking user status for ID: ${userId}, Email: ${userEmail}`);

    // Initialize the admin SDK
    const admin = await initAdmin();
    const firestore = getFirestore(admin);
    
    let userData = null;
    let foundBy = '';
    
    // Try to find by user ID first
    if (userId) {
      try {
        const userDoc = firestore.doc(`users/${userId}`);
        const userDocSnapshot = await userDoc.get();
        
        if (userDocSnapshot.exists) {
          userData = userDocSnapshot.data();
          foundBy = 'user_id';
          console.log(`✅ Found user by ID: ${userId}`);
        }
      } catch (error) {
        console.log(`⚠️ Error finding user by ID: ${error}`);
      }
    }
    
    // If not found by ID, try by email
    if (!userData && userEmail) {
      try {
        const usersQuery = await firestore.collection('users')
          .where('email', '==', userEmail)
          .limit(1)
          .get();
        
        if (!usersQuery.empty) {
          const userDoc = usersQuery.docs[0];
          userData = userDoc.data();
          foundBy = 'email';
          console.log(`✅ Found user by email: ${userEmail}`);
        }
      } catch (error) {
        console.log(`⚠️ Error finding user by email: ${error}`);
      }
    }
    
    if (userData) {
      console.log(`📋 User data:`, userData);
      return NextResponse.json({
        success: true,
        user: {
          id: userData.id || 'unknown',
          email: userData.email || 'unknown',
          name: userData.name || 'unknown',
          status: userData.status || 'NOT_SET',
          role: userData.role || 'unknown',
          createdAt: userData.createdAt || 'unknown',
          updatedAt: userData.updatedAt || 'unknown'
        },
        foundBy
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        searchedBy: { userId, userEmail }
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking user status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check user status' }, 
      { status: 500 }
    );
  }
}
