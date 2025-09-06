import { doc, getDoc, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

export interface UserScore {
  id: string;
  score: number;
  targetText: string;
  transcript: string;
  level: string;
  language: string;
  timestamp: any;
  overallScore?: number;
  pronunciationScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  apiResponse?: any; // Optional API response for detailed feedback
}

export interface HighScore {
  highestScore: number;
  totalAssessments: number;
  averageScore: number;
  recentScores: UserScore[];
  levelBreakdown: {
    beginner: { count: number; average: number; highest: number };
    intermediate: { count: number; average: number; highest: number };
    advanced: { count: number; average: number; highest: number };
  };
}

export class UserService {
  static async getUserHighScoreForText(userId: string, languageId: string, targetText: string, level: string): Promise<UserScore | null> {
    console.log('UserService.getUserHighScoreForText called with:', { userId, languageId, targetText, level });
    
    try {
      // Query for the specific text in the assessmentsByLevel structure
      const assessmentsRef = collection(
        db, 
        'users', 
        userId, 
        'languages', 
        languageId.toLowerCase(), 
        'assessmentsByLevel', 
        level.toLowerCase(), 
        'assessments'
      );
      
      console.log(`Querying for text "${targetText}" in path:`, `users/${userId}/languages/${languageId.toLowerCase()}/assessmentsByLevel/${level.toLowerCase()}/assessments`);
      
      // Query for documents with matching character/targetText - try multiple field names
      // Different languages might store the target text in different fields
      let snapshot;
      try {
        // First try with 'character' field (most common)
        const q1 = query(assessmentsRef, where('character', '==', targetText));
        snapshot = await getDocs(q1);
        console.log(`Found ${snapshot.size} assessments with 'character' field for "${targetText}"`);
        
        if (snapshot.empty) {
          // Try with 'targetText' field
          const q2 = query(assessmentsRef, where('targetText', '==', targetText));
          snapshot = await getDocs(q2);
          console.log(`Found ${snapshot.size} assessments with 'targetText' field for "${targetText}"`);
        }
        
        if (snapshot.empty) {
          // Try with 'refText' field
          const q3 = query(assessmentsRef, where('refText', '==', targetText));
          snapshot = await getDocs(q3);
          console.log(`Found ${snapshot.size} assessments with 'refText' field for "${targetText}"`);
        }
        
        if (snapshot.empty) {
          // As a last resort, get all documents and filter by any field containing the target text
          const q4 = query(assessmentsRef);
          const allDocs = await getDocs(q4);
          console.log(`Found ${allDocs.size} total assessments, filtering for "${targetText}"`);
          
          // Filter documents that contain the target text in any relevant field
          const filteredDocs = allDocs.docs.filter(doc => {
            const data = doc.data();
            return data.character === targetText || 
                   data.targetText === targetText || 
                   data.refText === targetText ||
                   data.sentence?.target === targetText ||
                   doc.id.includes(targetText);
          });
          
          // Create a mock snapshot with filtered docs
          snapshot = {
            empty: filteredDocs.length === 0,
            size: filteredDocs.length,
            forEach: (callback: (doc: any) => void) => filteredDocs.forEach(callback)
          };
          console.log(`Filtered to ${filteredDocs.length} assessments containing "${targetText}"`);
        }
      } catch (queryError) {
        console.error('Error with specific field queries, trying fallback:', queryError);
        // Fallback: get all documents and filter
        const qFallback = query(assessmentsRef);
        const allDocs = await getDocs(qFallback);
        const filteredDocs = allDocs.docs.filter(doc => {
          const data = doc.data();
          return data.character === targetText || 
                 data.targetText === targetText || 
                 data.refText === targetText ||
                 data.sentence?.target === targetText ||
                 doc.id.includes(targetText);
        });
        
        snapshot = {
          empty: filteredDocs.length === 0,
          size: filteredDocs.length,
          forEach: (callback: (doc: any) => void) => filteredDocs.forEach(callback)
        };
      }

      console.log(`Found ${snapshot.size} assessments for text "${targetText}"`);

      if (snapshot.empty) {
        console.log('No assessments found for this text');
        return null;
      }

      // Get the highest scoring assessment for this text
      let highestScore: UserScore | null = null;
      let maxScore = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`Document ${doc.id} data:`, data);
        
        const score = data.score || 0;
        
        if (score > maxScore) {
          maxScore = score;
          highestScore = {
            id: doc.id,
            score: score,
            targetText: data.character || data.targetText || targetText,
            transcript: data.transcript || '',
            level: level,
            language: data.language || languageId,
            timestamp: data.updatedAt || data.timestamp,
            overallScore: score,
            pronunciationScore: data.pronunciationScore || 0,
            fluencyScore: data.fluencyScore || 0,
            accuracyScore: data.accuracyScore || 0,
            apiResponse: data.apiResponse || {}, // Include API response for detailed feedback
          };
        }
      });

      console.log('Highest score for this text:', highestScore);
      return highestScore;
    } catch (error) {
      console.error('Error fetching high score for text:', error);
      return null;
    }
  }

  static async getUserHighScores(userId: string, languageId: string): Promise<HighScore | null> {
    console.log('UserService.getUserHighScores called with:', { userId, languageId });
    
    try {
      // First, check if the user has any language data at all
      const userLangRef = doc(db, 'users', userId, 'languages', languageId.toLowerCase());
      const userLangDoc = await getDoc(userLangRef);
      console.log('User language document exists:', userLangDoc.exists());
      if (userLangDoc.exists()) {
        console.log('User language document data:', userLangDoc.data());
      }
      
      const scores: UserScore[] = [];
      const levelBreakdown = {
        beginner: { count: 0, total: 0, highest: 0 },
        intermediate: { count: 0, total: 0, highest: 0 },
        advanced: { count: 0, total: 0, highest: 0 }
      };

      // Fetch assessments from assessmentsByLevel structure
      const levels = ['beginner', 'intermediate', 'advanced'] as const;
      
      for (const level of levels) {
        try {
          const assessmentsRef = collection(
            db, 
            'users', 
            userId, 
            'languages', 
            languageId.toLowerCase(), 
            'assessmentsByLevel', 
            level, 
            'assessments'
          );
          
          console.log(`Querying ${level} assessments for path:`, `users/${userId}/languages/${languageId.toLowerCase()}/assessmentsByLevel/${level}/assessments`);
          
          // First try without orderBy to see if there are any documents at all
          const basicQuery = query(assessmentsRef);
          const basicSnapshot = await getDocs(basicQuery);
          console.log(`${level} assessments found (basic query):`, basicSnapshot.size);
          
          if (basicSnapshot.size > 0) {
            console.log(`${level} document IDs:`, basicSnapshot.docs.map(doc => doc.id));
            console.log(`${level} first document data:`, basicSnapshot.docs[0].data());
          }
          
          // Use the documents from basic query since orderBy is failing
          const snapshot = basicSnapshot;
          console.log(`Using ${level} assessments from basic query:`, snapshot.size);

          snapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Document ${doc.id} data:`, data);
            
            const score: UserScore = {
              id: doc.id,
              score: data.score || 0,
              targetText: data.character || data.targetText || doc.id.split('_')[0] || '', // Use 'character' field or extract from ID
              transcript: data.transcript || '',
              level: level,
              language: data.language || languageId,
              timestamp: data.updatedAt || data.timestamp, // Use 'updatedAt' field
              overallScore: data.score || 0, // Use the 'score' field as overall score
              pronunciationScore: data.pronunciationScore || 0,
              fluencyScore: data.fluencyScore || 0,
              accuracyScore: data.accuracyScore || 0,
            };

            scores.push(score);

            // Update level breakdown
            levelBreakdown[level].count++;
            levelBreakdown[level].total += score.overallScore || score.score;
            levelBreakdown[level].highest = Math.max(levelBreakdown[level].highest, score.overallScore || score.score);
          });
        } catch (levelError) {
          console.warn(`Error fetching ${level} assessments:`, levelError);
          // Continue with other levels even if one fails
        }
      }

      console.log('Total scores found in assessmentsByLevel:', scores.length);

      // If no scores found in assessmentsByLevel, try fallback to old structure
      if (scores.length === 0) {
        console.log('No scores found in assessmentsByLevel, trying fallback structure...');
        try {
          const fallbackRef = collection(db, 'users', userId, 'languages', languageId.toLowerCase(), 'assessmentsData');
          console.log('Trying fallback path:', `users/${userId}/languages/${languageId.toLowerCase()}/assessmentsData`);
          
          // First try basic query
          const fallbackBasicQuery = query(fallbackRef);
          const fallbackBasicSnapshot = await getDocs(fallbackBasicQuery);
          console.log('Fallback assessments found (basic query):', fallbackBasicSnapshot.size);
          
          if (fallbackBasicSnapshot.size > 0) {
            console.log('Fallback document IDs:', fallbackBasicSnapshot.docs.map(doc => doc.id));
            console.log('Fallback first document data:', fallbackBasicSnapshot.docs[0].data());
          }
          
          // Use basic query for fallback too since orderBy might fail
          const fallbackSnapshot = fallbackBasicSnapshot;

          fallbackSnapshot.forEach((doc) => {
            const data = doc.data();
            console.log(`Fallback document ${doc.id} data:`, data);
            
            const score: UserScore = {
              id: doc.id,
              score: data.score || 0,
              targetText: data.character || data.targetText || doc.id.split('_')[0] || '',
              transcript: data.transcript || '',
              level: data.level || 'beginner',
              language: data.language || languageId,
              timestamp: data.updatedAt || data.timestamp,
              overallScore: data.score || 0, // Use the 'score' field as overall score
              pronunciationScore: data.pronunciationScore || 0,
              fluencyScore: data.fluencyScore || 0,
              accuracyScore: data.accuracyScore || 0,
            };

            scores.push(score);

            // Update level breakdown
            const level = score.level.toLowerCase() as keyof typeof levelBreakdown;
            if (levelBreakdown[level]) {
              levelBreakdown[level].count++;
              levelBreakdown[level].total += score.overallScore || score.score;
              levelBreakdown[level].highest = Math.max(levelBreakdown[level].highest, score.overallScore || score.score);
            }
          });
        } catch (fallbackError) {
          console.warn('Error fetching from fallback structure:', fallbackError);
        }
      }

      console.log('Final total scores found:', scores.length);

      if (scores.length === 0) {
        console.log('No scores found, returning null');
        return null;
      }

      // Calculate overall statistics
      const totalScore = scores.reduce((sum, score) => sum + (score.overallScore || score.score), 0);
      const averageScore = scores.length > 0 ? totalScore / scores.length : 0;
      const highestScore = Math.max(...scores.map(score => score.overallScore || score.score));

      // Calculate level averages
      const finalLevelBreakdown = {
        beginner: {
          count: levelBreakdown.beginner.count,
          average: levelBreakdown.beginner.count > 0 ? levelBreakdown.beginner.total / levelBreakdown.beginner.count : 0,
          highest: levelBreakdown.beginner.highest
        },
        intermediate: {
          count: levelBreakdown.intermediate.count,
          average: levelBreakdown.intermediate.count > 0 ? levelBreakdown.intermediate.total / levelBreakdown.intermediate.count : 0,
          highest: levelBreakdown.intermediate.highest
        },
        advanced: {
          count: levelBreakdown.advanced.count,
          average: levelBreakdown.advanced.count > 0 ? levelBreakdown.advanced.total / levelBreakdown.advanced.count : 0,
          highest: levelBreakdown.advanced.highest
        }
      };

      return {
        highestScore,
        totalAssessments: scores.length,
        averageScore,
        recentScores: scores.slice(0, 10), // Last 10 scores
        levelBreakdown: finalLevelBreakdown
      };
    } catch (error) {
      console.error('Error fetching user high scores:', error);
      return null;
    }
  }

  static async saveAssessmentScore(
    userId: string,
    languageId: string,
    scoreData: {
      score: number;
      targetText: string;
      transcript: string;
      level: string;
      language: string;
      overallScore?: number;
      pronunciationScore?: number;
      fluencyScore?: number;
      accuracyScore?: number;
    }
  ): Promise<void> {
    try {
      const { addDoc } = await import('firebase/firestore');
      
      // Save to assessmentsByLevel structure
      const level = scoreData.level.toLowerCase();
      const assessmentsRef = collection(
        db, 
        'users', 
        userId, 
        'languages', 
        languageId.toLowerCase(), 
        'assessmentsByLevel', 
        level, 
        'assessments'
      );
      
      // Create document ID with target text and timestamp
      const documentId = `${scoreData.targetText}_${Date.now()}`;
      
      await addDoc(assessmentsRef, {
        score: scoreData.overallScore || scoreData.score, // Save as 'score' field
        targetText: scoreData.targetText,
        transcript: scoreData.transcript,
        level: scoreData.level,
        language: scoreData.language,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error saving assessment score:', error);
      throw error;
    }
  }
}
