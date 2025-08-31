import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

// Simple in-memory cache (in production, use Redis or similar)
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const cacheKey = 'users-data';
    const cached = cache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Returning cached users data');
      return NextResponse.json({
        success: true,
        users: cached.data,
        count: cached.data.length,
        cached: true,
        source: 'cache'
      });
    }

    console.log('Fetching fresh users data...');
    
    // Use the shared admin initialization
    const app = await initAdmin();
    const adminDb = getFirestore(app);
    
    // Optimized query - get only essential data first
    const usersSnapshot = await adminDb.collection('users').get();
    console.log(`Found ${usersSnapshot.docs.length} users in collection`);
    
    // Process users in batches to avoid memory issues
    const batchSize = 10;
    const users = [];
    
    for (let i = 0; i < usersSnapshot.docs.length; i += batchSize) {
      const batch = usersSnapshot.docs.slice(i, i + batchSize);
      
      const batchUsers = await Promise.all(batch.map(async (doc) => {
        const userId = doc.id;
        const userData = doc.data();
        
        // Create optimized user object with only essential fields
        const optimizedUser = {
          id: userId,
          name: userData.displayName || userData.name || `User ${userId.substring(0, 6)}`,
          email: userData.email || `${userId.substring(0, 6)}@unknown.com`,
          gender: userData.gender || '',
          age: userData.age || '',
          location: userData.location || '',
          profession: userData.userType || userData.profession || '',
          createdAt: formatDate(userData.createdAt),
          lastLogin: formatDate(userData.lastLogin),
          preferredLanguage: userData.preferredLanguage || '',
          referralSource: userData.referralSource || '',
          // Only fetch progress if specifically needed (lazy loading)
          progress: null
        };
        
        // Try to get profile data from subcollection (only if exists)
        try {
          const profileDoc = await adminDb
            .collection('users')
            .doc(userId)
            .collection('profile')
            .doc('info')
            .get();
            
          if (profileDoc.exists) {
            const profileData = profileDoc.data() as Record<string, unknown>;
            
            // Update with profile data
            if (profileData.age) optimizedUser.age = profileData.age;
            if (profileData.gender) optimizedUser.gender = profileData.gender;
            if (profileData.location) optimizedUser.location = profileData.location;
            if (profileData.name) optimizedUser.name = profileData.name;
            if (profileData.userType) optimizedUser.profession = profileData.userType;
            if (profileData.preferredLanguage) optimizedUser.preferredLanguage = profileData.preferredLanguage;
            if (profileData.referralSource) optimizedUser.referralSource = profileData.referralSource;
          }
        } catch (err) {
          console.error(`Error getting profile for user ${userId}:`, err);
        }
        
        return optimizedUser;
      }));
      
      users.push(...batchUsers);
    }
    
    // Cache the results
    cache.set(cacheKey, { data: users, timestamp: Date.now() });
    
    return NextResponse.json({
      success: true,
      users,
      count: users.length,
      cached: false,
      source: 'firestore-optimized'
    });
    
  } catch (error: unknown) {
    console.error('Optimized API route error:', error);
    
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

// Helper function to safely format different date types
function formatDate(date: unknown): string {
  if (!date) return new Date().toISOString();
  
  try {
    if (typeof date.toDate === 'function') {
      return date.toDate().toISOString();
    } else if (typeof date === 'string') {
      return date;
    } else if (date instanceof Date) {
      return date.toISOString();
    } else if (date._seconds !== undefined) {
      return new Date(date._seconds * 1000).toISOString();
    }
  } catch (err) {
    console.error('Error formatting date:', err);
  }
  
  return new Date().toISOString();
}
