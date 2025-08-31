import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

// Cache for user progress data
const progressCache = new Map<string, { data: unknown; timestamp: number }>();
const PROGRESS_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const cacheKey = `user-progress-${userId}`;
    const cached = progressCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < PROGRESS_CACHE_DURATION) {
      console.log(`Returning cached progress data for user ${userId}`);
      return NextResponse.json({
        success: true,
        progress: cached.data,
        cached: true
      });
    }

    console.log(`Fetching progress data for user ${userId}...`);
    
    const app = await initAdmin();
    const adminDb = getFirestore(app);
    
    // Fetch language progress and assessment data
    const languagesSnapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('languages')
      .get();

    const progress: Record<string, unknown> = {};
    
    if (!languagesSnapshot.empty) {
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
        
        // Store progress data
        progress[languageName] = {
          points: langData.points || 0,
          level: langData.level || 'beginner',
          assessments: langData.assessments || [],
          assessmentsByLevel: langData.assessmentsByLevel || {},
          assessmentCount: assessmentCount,
          wordAssessment: assessmentCount,
          completedAssessments: assessmentCount
        };
      }
    }
    
    // Cache the results
    progressCache.set(cacheKey, { data: progress, timestamp: Date.now() });
    
    return NextResponse.json({
      success: true,
      progress,
      cached: false
    });
    
  } catch (error: unknown) {
    console.error('User progress API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user progress',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
