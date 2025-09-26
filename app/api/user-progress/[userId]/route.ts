import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Fetching fresh progress data for user ${userId}...`);
    
    const app = await initAdmin();
    const adminDb = getFirestore(app);
    
    // Get user preferred language, map display names to codes like Flutter
    const userDoc = await adminDb.collection('users').doc(userId).get();
    let preferredLanguage: string = 'english';
    if (userDoc.exists) {
      const pdata = userDoc.data() as Record<string, unknown>;
      const raw = (pdata?.preferredLanguage as string | undefined) ?? 'english';
      const validCodes = ['english','mandarin','spanish','japanese','korean'];
      if (validCodes.includes(String(raw).toLowerCase())) {
        preferredLanguage = String(raw).toLowerCase();
      } else {
        const map: Record<string,string> = {
          'English':'english', 'Mandarin':'mandarin', 'Español':'spanish', 'Nihongo':'japanese', 'Hangugeo':'korean'
        };
        preferredLanguage = map[String(raw)] ?? 'english';
      }
    }

    // Load language doc for points
    const langDocSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('languages')
      .doc(preferredLanguage)
      .get();
    const langData = langDocSnap.exists ? (langDocSnap.data() as Record<string, unknown>) : {};

    // Count completed assessments per level (score > 0)
    const levels = ['beginner','intermediate', ...(preferredLanguage === 'english' ? ['advanced'] : [])];
    const assessmentCounts: Record<string, number> = { beginner: 0, intermediate: 0, advanced: 0 };
    for (const level of levels) {
      try {
        const levelAssessmentsSnap = await adminDb
          .collection('users')
          .doc(userId)
          .collection('languages')
          .doc(preferredLanguage)
          .collection('assessmentsByLevel')
          .doc(level)
          .collection('assessments')
          .get();
        levelAssessmentsSnap.forEach(d => {
          const data = d.data() as { score?: number | string };
          const raw = data?.score ?? 0;
          const score = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
          if (!isNaN(score) && score > 0) assessmentCounts[level] = (assessmentCounts[level] || 0) + 1;
        });
      } catch (e) {
        console.warn(`Error counting assessments for ${userId}/${preferredLanguage}/${level}:`, e);
      }
    }

    // Fetch total items per level from languages collection using count() aggregate
    const itemCounts: Record<string, number> = { beginner: 10, intermediate: 10, advanced: 10 };
    for (const level of levels) {
      try {
        const countSnap = await adminDb
          .collection('languages')
          .doc(preferredLanguage)
          .collection('characters')
          .doc(level)
          .collection('items')
          .count()
          .get();
        // Some SDKs return { count }, some nested; handle both
        const c = (countSnap as unknown as { count?: number }).count ?? (countSnap as { _data?: { count?: number } })?._data?.count ?? 0;
        itemCounts[level] = typeof c === 'number' && c > 0 ? c : itemCounts[level];
      } catch (e) {
        console.warn(`Error counting items for ${preferredLanguage}/${level}:`, e);
      }
    }

    const totalCompleted = (assessmentCounts['beginner'] || 0) + (assessmentCounts['intermediate'] || 0) + (preferredLanguage === 'english' ? (assessmentCounts['advanced'] || 0) : 0);

    const progress: Record<string, unknown> = {};
    progress[preferredLanguage] = {
      points: (langData?.points as number) || 0,
      level: (langData?.level as string) || 'beginner',
      assessmentCount: totalCompleted,
      completedAssessments: totalCompleted,
      wordAssessment: totalCompleted,
      assessmentCounts,
      itemCounts
    };
    
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
