import { NextResponse } from 'next/server';
import { db } from '../../../src/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// Define User type
type User = {
  id: string;
  name?: string;
  email?: string;
  progress?: any;
  [key: string]: any;
};

export async function GET() {
  try {
    console.log('API: Fetching users directly from Firestore client SDK');
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    console.log(`API: Found ${usersSnapshot.docs.length} users in collection`);
    
    const allUsers: User[] = [];
    
    // Process each user from the users collection
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      console.log(`API: Processing user ${userId}`);
      
      // Create a user object with base data
      let userData: User = {
        id: userId,
        ...userDoc.data() as Record<string, any>
      };
      
      try {
        // Try to get profile data
        const profileRef = collection(db, 'users', userId, 'profile');
        const profileSnapshot = await getDocs(profileRef);
        console.log(`API: Found ${profileSnapshot.docs.length} profile docs for user ${userId}`);
        
        // Look for the 'info' document
        const infoDoc = profileSnapshot.docs.find(doc => doc.id === 'info');
        if (infoDoc) {
          const profileData = infoDoc.data() as Record<string, any>;
          userData = {
            ...userData,
            ...profileData,
            // Ensure basic fields exist
            name: profileData?.name || userData.name || `User-${userId.substring(0, 6)}`,
            email: profileData?.email || userData.email || `${userId.substring(0, 6)}@example.com`
          };
        }
      } catch (error) {
        console.error(`API: Error getting profile for user ${userId}:`, error);
      }

      // Fetch language progress and assessment data
      try {
        const languagesRef = collection(db, 'users', userId, 'languages');
        const languagesSnapshot = await getDocs(languagesRef);

        if (!languagesSnapshot.empty) {
          const progress: Record<string, any> = {};
          
          for (const langDoc of languagesSnapshot.docs) {
            const languageName = langDoc.id;
            const langData = langDoc.data();
            
            // Get assessment count from assessmentsData subcollection
            const assessmentsRef = collection(db, 'users', userId, 'languages', languageName, 'assessmentsData');
            const assessmentsSnapshot = await getDocs(assessmentsRef);
            
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
          console.log(`API: Loaded progress for user ${userId}:`, progress);
        }
      } catch (err) {
        console.error(`API: Error getting language progress for user ${userId}:`, err);
      }
      
      allUsers.push(userData);
    }
    
    return NextResponse.json({ 
      success: true, 
      users: allUsers,
      count: allUsers.length
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