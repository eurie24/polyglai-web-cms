import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`Resetting all progress for user ${userId}...`);
    
    const app = await initAdmin();
    const adminDb = getFirestore(app);
    
    const batch = adminDb.batch();
    let deletedCollections = 0;
    let deletedDocuments = 0;
    
    try {
      // 1. Delete all language progress data
      const languagesSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('languages')
        .get();
      
      for (const langDoc of languagesSnapshot.docs) {
        const langId = langDoc.id;
        
        // Delete assessments by level
        const levels = ['beginner', 'intermediate', 'advanced'];
        for (const level of levels) {
          const assessmentsSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection('languages')
            .doc(langId)
            .collection('assessmentsByLevel')
            .doc(level)
            .collection('assessments')
            .get();
          
          assessmentsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedDocuments++;
          });
        }
        
        // Reset the language document to initial state
        batch.update(langDoc.ref, {
          points: 0,
          level: 'beginner',
          assessmentCount: 0,
          completedAssessments: 0,
          wordAssessment: 0,
          lastAssessmentDate: null,
          streak: 0,
          lastStreakDate: null
        });
      }
      
      // 2. Delete all achievements
      const achievementsSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('achievements')
        .get();
      
      achievementsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedDocuments++;
      });
      
      // 3. Delete all challenges
      const challengesSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('challenges')
        .get();
      
      challengesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedDocuments++;
      });
      
      // 4. Delete daily challenges
      const dailyChallengesSnapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('dailyChallenges')
        .get();
      
      dailyChallengesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedDocuments++;
      });
      
      // 5. Reset user stats in main user document
      const userRef = adminDb.collection('users').doc(userId);
      batch.update(userRef, {
        totalPoints: 0,
        totalAssessments: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        level: 'beginner',
        achievementsCount: 0,
        challengesCompleted: 0,
        dailyChallengesCompleted: 0,
        // Reset profanity count as well since it's part of user progress
        profanityCount: 0,
        lastProfanityDetected: null
      });
      
      // 6. Delete any other progress-related collections
      const progressCollections = [
        'wordProgress',
        'lessonProgress', 
        'assessmentHistory',
        'userStats',
        'learningStreaks'
      ];
      
      for (const collectionName of progressCollections) {
        try {
          const collectionSnapshot = await adminDb
            .collection('users')
            .doc(userId)
            .collection(collectionName)
            .get();
          
          collectionSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedDocuments++;
          });
          
          if (collectionSnapshot.docs.length > 0) {
            deletedCollections++;
          }
        } catch (error) {
          console.warn(`Could not delete collection ${collectionName}:`, error);
        }
      }
      
      // Execute the batch
      await batch.commit();
      
      console.log(`Successfully reset progress for user ${userId}`);
      console.log(`Deleted ${deletedDocuments} documents from ${deletedCollections} collections`);
      
      return NextResponse.json({
        success: true,
        message: 'User progress reset successfully',
        details: {
          deletedDocuments,
          deletedCollections,
          resetCollections: [
            'languages',
            'achievements', 
            'challenges',
            'dailyChallenges',
            ...progressCollections
          ]
        }
      });
      
    } catch (error) {
      console.error('Error resetting user progress:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to reset user progress',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
  } catch (error: unknown) {
    console.error('Reset user progress API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process reset request',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
