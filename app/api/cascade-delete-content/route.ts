import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/firebase/adminInit';

export async function POST(request: Request) {
  try {
    const { 
      contentType, 
      contentId, 
      languageId, 
      level, 
      contentValue 
    } = await request.json();
    
    if (!contentType || !contentId) {
      return NextResponse.json(
        { success: false, error: 'Content type and content ID are required' },
        { status: 400 }
      );
    }
    
    console.log(`Cascade deleting assessments for ${contentType} content:`, {
      contentId,
      languageId,
      level,
      contentValue
    });
    
    const app = await initAdmin();
    const adminDb = getFirestore(app);
    
    let deletedAssessments = 0;
    let deletedUsers = 0;
    
    try {
      // Get all users to check their assessments
      const usersSnapshot = await adminDb.collection('users').get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        let userHasDeletedAssessments = false;
        
        // Check different assessment collections based on content type
        if (contentType === 'character' || contentType === 'word') {
          // For character/word content, check assessmentsByLevel collections
          const levels = level ? [level] : ['beginner', 'intermediate', 'advanced'];
          
          for (const assessmentLevel of levels) {
            try {
              const assessmentsRef = adminDb
                .collection('users')
                .doc(userId)
                .collection('languages')
                .doc(languageId)
                .collection('assessmentsByLevel')
                .doc(assessmentLevel)
                .collection('assessments');
              
              const assessmentsSnapshot = await assessmentsRef.get();
              
              const batch = adminDb.batch();
              let batchCount = 0;
              
              for (const assessmentDoc of assessmentsSnapshot.docs) {
                const assessmentData = assessmentDoc.data();
                
                // Check if this assessment is for the deleted content
                let shouldDelete = false;
                
                if (contentType === 'character') {
                  // For characters, check if the assessment references the deleted character
                  if (assessmentData.characterId === contentId || 
                      assessmentData.characterValue === contentValue ||
                      assessmentData.wordId === contentId ||
                      assessmentData.wordValue === contentValue) {
                    shouldDelete = true;
                  }
                } else if (contentType === 'word') {
                  // For word trainer content, check if the assessment references the deleted word
                  if (assessmentData.questionId === contentId ||
                      assessmentData.wordId === contentId ||
                      assessmentData.wordValue === contentValue ||
                      assessmentData.question === contentValue) {
                    shouldDelete = true;
                  }
                }
                
                if (shouldDelete) {
                  batch.delete(assessmentDoc.ref);
                  batchCount++;
                  deletedAssessments++;
                  userHasDeletedAssessments = true;
                  
                  // Firestore batch limit is 500 operations
                  if (batchCount >= 500) {
                    await batch.commit();
                    batchCount = 0;
                  }
                }
              }
              
              // Commit remaining batch operations
              if (batchCount > 0) {
                await batch.commit();
              }
              
            } catch (error) {
              console.warn(`Error processing assessments for user ${userId}, level ${assessmentLevel}:`, error);
            }
          }
        }
        
        // Also check other assessment-related collections
        try {
          const otherCollections = [
            'assessments',
            'wordProgress',
            'lessonProgress',
            'assessmentHistory'
          ];
          
          for (const collectionName of otherCollections) {
            try {
              const collectionRef = adminDb
                .collection('users')
                .doc(userId)
                .collection(collectionName);
              
              const collectionSnapshot = await collectionRef.get();
              
              const batch = adminDb.batch();
              let batchCount = 0;
              
              for (const doc of collectionSnapshot.docs) {
                const data = doc.data();
                let shouldDelete = false;
                
                // Check various fields that might reference the deleted content
                if (data.characterId === contentId ||
                    data.characterValue === contentValue ||
                    data.wordId === contentId ||
                    data.wordValue === contentValue ||
                    data.questionId === contentId ||
                    data.question === contentValue ||
                    data.contentId === contentId ||
                    data.contentValue === contentValue) {
                  shouldDelete = true;
                }
                
                if (shouldDelete) {
                  batch.delete(doc.ref);
                  batchCount++;
                  deletedAssessments++;
                  userHasDeletedAssessments = true;
                  
                  if (batchCount >= 500) {
                    await batch.commit();
                    batchCount = 0;
                  }
                }
              }
              
              if (batchCount > 0) {
                await batch.commit();
              }
              
            } catch (error) {
              console.warn(`Error processing collection ${collectionName} for user ${userId}:`, error);
            }
          }
        } catch (error) {
          console.warn(`Error processing other collections for user ${userId}:`, error);
        }
        
        // Update user progress counts if assessments were deleted
        if (userHasDeletedAssessments) {
          try {
            // Recalculate user's assessment counts
            const languageDocRef = adminDb
              .collection('users')
              .doc(userId)
              .collection('languages')
              .doc(languageId);
            
            const languageDoc = await languageDocRef.get();
            if (languageDoc.exists) {
              // Recalculate assessment counts
              let totalAssessments = 0;
              const levels = ['beginner', 'intermediate', 'advanced'];
              
              for (const assessmentLevel of levels) {
                try {
                  const assessmentsRef = adminDb
                    .collection('users')
                    .doc(userId)
                    .collection('languages')
                    .doc(languageId)
                    .collection('assessmentsByLevel')
                    .doc(assessmentLevel)
                    .collection('assessments');
                  
                  const countSnapshot = await assessmentsRef.count().get();
                  const count = countSnapshot.data().count || 0;
                  totalAssessments += count;
                } catch (error) {
                  console.warn(`Error counting assessments for level ${assessmentLevel}:`, error);
                }
              }
              
              // Update the language document with new counts
              await languageDocRef.update({
                assessmentCount: totalAssessments,
                completedAssessments: totalAssessments,
                wordAssessment: totalAssessments,
                lastUpdated: new Date().toISOString()
              });
              
              // Update main user document
              const userRef = adminDb.collection('users').doc(userId);
              await userRef.update({
                totalAssessments: totalAssessments,
                lastActivityDate: new Date().toISOString()
              });
              
              deletedUsers++;
            }
          } catch (error) {
            console.warn(`Error updating user progress for user ${userId}:`, error);
          }
        }
      }
      
      console.log(`Cascade deletion completed:`, {
        deletedAssessments,
        deletedUsers,
        contentType,
        contentId
      });
      
      return NextResponse.json({
        success: true,
        message: 'Cascade deletion completed successfully',
        details: {
          deletedAssessments,
          deletedUsers,
          contentType,
          contentId
        }
      });
      
    } catch (error) {
      console.error('Error in cascade deletion:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to perform cascade deletion',
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      );
    }
    
  } catch (error: unknown) {
    console.error('Cascade delete content API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process cascade deletion request',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
