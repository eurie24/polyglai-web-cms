import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export async function GET() {
  try {
    console.log('API route: Initializing Admin SDK and fetching users...');
    
    // Use the shared admin initialization
    const app = await initAdmin();
    
    // Get Firestore instance with admin privileges
    console.log('Getting Firestore instance using app:', app?.name);
    const adminDb = getFirestore(app);
    console.log('Firestore instance obtained');
    
    // Test if we can access Firestore
    console.log('Testing Firestore access...');
    try {
      // Get all users from the users collection
      console.log('Getting users from Firestore with Admin SDK...');
      const usersSnapshot = await adminDb.collection('users').get();
      console.log(`Found ${usersSnapshot.docs.length} users in collection`);
      
      // Log each user ID found for debugging
      console.log('User IDs found:', usersSnapshot.docs.map(doc => doc.id).join(', '));
      
      // Process each user
      const users = await Promise.all(usersSnapshot.docs.map(async (doc) => {
        const userId = doc.id;
        
        // Use a proper type with index signature
        type UserData = {
          id: string;
          name: string;
          email: string;
          role: string;
          gender: string;
          age: any;
          location: string;
          profession: string;
          createdAt: string;
          lastLogin: string;
          progress?: any;
          [key: string]: any; // Allow additional properties
        };
        
        const userData: UserData = {
          id: userId,
          ...doc.data() as Record<string, any>,
          // Ensure we have standard property names that match our expected structure
          name: doc.data().displayName || doc.data().name || '',
          email: doc.data().email || '',
          role: doc.data().role || 'user',  // Fallback to preserve compatibility
          gender: doc.data().gender || '',
          age: doc.data().age || '',
          location: doc.data().location || '',
          profession: doc.data().userType || doc.data().profession || '',
          // Safely handle different date formats
          createdAt: formatDate(doc.data().createdAt),
          lastLogin: formatDate(doc.data().lastLogin)
        };
        
        // Try to get profile data from subcollection (old structure)
        try {
          const profileDoc = await adminDb
            .collection('users')
            .doc(userId)
            .collection('profile')
            .doc('info')
            .get();
            
          if (profileDoc.exists) {
            const profileData = profileDoc.data() as Record<string, any>;
            console.log(`Found profile/info data for user ${userId}:`, profileData);
            
            // Map specific fields if they exist in profile/info
            if (profileData.age) userData.age = profileData.age;
            if (profileData.gender) userData.gender = profileData.gender;
            if (profileData.location) userData.location = profileData.location;
            if (profileData.name) userData.name = profileData.name;
            if (profileData.userType) userData.profession = profileData.userType;
            if (profileData.avatarUrl || profileData.avatarURL) userData.photoURL = profileData.avatarUrl || profileData.avatarURL;
            if (profileData.preferredLanguage) userData.preferredLanguage = profileData.preferredLanguage;
            if (profileData.createdAt) userData.createdAt = formatDate(profileData.createdAt);
            if (profileData.updatedAt) userData.lastLogin = formatDate(profileData.updatedAt);
            if (profileData.referralSource) userData.referralSource = profileData.referralSource;
            
            // For more specific fields shown in the screenshot
            if (profileData.avatarUrl) userData.avatarUrl = profileData.avatarUrl;
            
            // Merge any other profile data
            Object.entries(profileData || {}).forEach(([key, value]) => {
              if (!userData[key] && value) {
                userData[key] = value;
              }
            });
          } else {
            console.log(`No profile/info found for user ${userId}`);
          }
        } catch (err) {
          console.error(`Error getting profile for user ${userId}:`, err);
        }

        // Fetch language progress and assessment data
        try {
          const languagesSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection('languages')
            .get();

          if (!languagesSnapshot.empty) {
            const progress: Record<string, any> = {};
            
            for (const langDoc of languagesSnapshot.docs) {
              const languageName = langDoc.id;
              const langData = langDoc.data();
              
              // Get assessment count from assessmentsData subcollection
              const assessmentsSnapshot = await adminDb
                .collection('users')
                .doc(userId)
                .collection('languages')
                .doc(languageName)
                .collection('assessmentsData')
                .get();
              
              const assessmentCount = assessmentsSnapshot.size;
              
              // Store progress data in a format the dashboard expects
              progress[languageName] = {
                points: langData.points || 0,
                level: langData.level || 'beginner',
                assessments: langData.assessments || [],
                assessmentsByLevel: langData.assessmentsByLevel || {},
                assessmentCount: assessmentCount,
                // Add assessment-related keys that the dashboard looks for
                wordAssessment: assessmentCount,
                completedAssessments: assessmentCount
              };
            }
            
            userData.progress = progress;
            console.log(`Loaded progress for user ${userId}:`, progress);
          }
        } catch (err) {
          console.error(`Error getting language progress for user ${userId}:`, err);
        }
        
        return userData;
      }));
      
      return NextResponse.json({
        success: true,
        users,
        count: users.length,
        admin: true,
        source: 'admin-sdk'
      });
    } catch (firestoreError: any) {
      console.error('Firestore access error:', firestoreError.message);
      throw new Error(`Firestore access error: ${firestoreError.message}`);
    }
  } catch (error: any) {
    console.error('API route error:', error);
    
    // Fallback to temporary hack API
    console.log('Falling back to temporary hack API...');
    try {
      // Use relative URL to avoid any potential networking issues
      const response = await fetch('/api/temp-hack', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('Successfully retrieved data from temp-hack API');
          return NextResponse.json({
            ...data,
            note: data.note || "Fallback data used due to Admin SDK error",
            adminError: error.message
          });
        }
      }
    } catch (fallbackError) {
      console.error('Fallback error:', fallbackError);
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users with Admin SDK',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function to safely format different date types
function formatDate(date: any): string {
  if (!date) return new Date().toISOString();
  
  try {
    // Handle Firestore timestamp
    if (typeof date.toDate === 'function') {
      return date.toDate().toISOString();
    }
    // Handle strings
    else if (typeof date === 'string') {
      return date;
    }
    // Handle Date objects
    else if (date instanceof Date) {
      return date.toISOString();
    }
    // Handle objects with seconds
    else if (date._seconds !== undefined) {
      return new Date(date._seconds * 1000).toISOString();
    }
  } catch (err) {
    console.error('Error formatting date:', err);
  }
  
  return new Date().toISOString();
} 