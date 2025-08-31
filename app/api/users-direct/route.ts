import { NextResponse } from 'next/server';
import { db, auth } from '../../../src/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

// Define User type
type User = {
  id: string;
  name?: string;
  email?: string;
  [key: string]: any;
};

export async function GET() {
  try {
    // Check current auth state
    const currentUser = auth.currentUser;
    const debug = {
      isAuthenticated: !!currentUser,
      currentUserEmail: currentUser?.email,
      isVerifiedAdmin: currentUser?.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase(),
      authTime: new Date().toISOString()
    };
    
    console.log('API: Directly fetching specific users by ID');
    
    // Hardcode the user IDs we saw in the Firestore console
    const userIds = [
      'sample-user-1',
      '4fYiosMKA0U49ITZVdcAumyCtH33',
      'F7qUbUeUnKNV3LxRkjNNyMtM8J62',
      'jA4Sdb1O7aX8FVry3IoHNKuS4ob2'
    ];
    
    const allUsers: User[] = [];
    
    // Process each specific user ID
    for (const userId of userIds) {
      console.log(`API: Trying to access user ${userId}`);
      
      try {
        // Try to get the base user document
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          console.log(`API: Found user document for ${userId}`);
          
          // Create user object
          let userData: User = {
            id: userId,
            ...userDocSnap.data() as Record<string, any>
          };
          
          // Try to get profile data
          try {
            console.log(`API: Looking for profile data for ${userId}`);
            const profileRef = doc(db, 'users', userId, 'profile', 'info');
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
              console.log(`API: Found profile for ${userId}`);
              const profileData = profileSnap.data() as Record<string, any>;
              
              // Merge the data
              userData = {
                ...userData,
                ...profileData,
                // Ensure basic fields exist
                name: profileData?.name || userData.name || `User-${userId.substring(0, 6)}`,
                email: profileData?.email || userData.email || `${userId.substring(0, 6)}@example.com`
              };
            } else {
              console.log(`API: No profile doc found for ${userId}`);
            }
          } catch (profileError) {
            console.error(`API: Error fetching profile for ${userId}:`, profileError);
          }
          
          // Add this user to our results
          allUsers.push(userData);
        } else {
          console.log(`API: User document ${userId} does not exist or cannot be accessed`);
        }
      } catch (userError) {
        console.error(`API: Error accessing user ${userId}:`, userError);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      users: allUsers,
      count: allUsers.length,
      debug: debug
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 