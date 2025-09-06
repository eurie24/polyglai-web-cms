import { doc, getDoc, collection, query, getDocs, where, Query, CollectionReference, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

export interface UserScore {
  id: string;
  score: number;
  targetText: string;
  transcript: string;
  level: string;
  language: string;
  timestamp: unknown;
  overallScore?: number;
  pronunciationScore?: number;
  fluencyScore?: number;
  accuracyScore?: number;
  apiResponse?: Record<string, unknown>;
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
      const assessmentsRef = collection(
        db,
        'users',
        userId,
        'languages',
        languageId.toLowerCase(),
        'assessmentsByLevel',
        level.toLowerCase(),
        'assessments'
      ) as CollectionReference<DocumentData>;

      let docs: QueryDocumentSnapshot<DocumentData>[] = [];
      try {
        const q1 = query(assessmentsRef, where('character', '==', targetText)) as Query<DocumentData>;
        const s1 = await getDocs(q1);
        if (!s1.empty) {
          docs = s1.docs;
        }
        if (docs.length === 0) {
          const q2 = query(assessmentsRef, where('targetText', '==', targetText)) as Query<DocumentData>;
          const s2 = await getDocs(q2);
          if (!s2.empty) docs = s2.docs;
        }
        if (docs.length === 0) {
          const q3 = query(assessmentsRef, where('refText', '==', targetText)) as Query<DocumentData>;
          const s3 = await getDocs(q3);
          if (!s3.empty) docs = s3.docs;
        }
        if (docs.length === 0) {
          const q4 = query(assessmentsRef) as Query<DocumentData>;
          const allDocs = await getDocs(q4);
          docs = allDocs.docs.filter(d => {
            const data = d.data() as Record<string, unknown>;
            const sentence = data.sentence as Record<string, unknown> | undefined;
            const sentenceTarget = typeof sentence?.target === 'string' ? sentence.target : undefined;
            return data.character === targetText ||
                   data.targetText === targetText ||
                   data.refText === targetText ||
                   sentenceTarget === targetText ||
                   d.id.includes(targetText);
          });
        }
      } catch (queryError) {
        console.error('Error with specific field queries, trying fallback:', queryError);
        const qFallback = query(assessmentsRef) as Query<DocumentData>;
        const allDocs = await getDocs(qFallback);
        docs = allDocs.docs.filter(d => {
          const data = d.data() as Record<string, unknown>;
          const sentence = data.sentence as Record<string, unknown> | undefined;
          const sentenceTarget = typeof sentence?.target === 'string' ? sentence.target : undefined;
          return data.character === targetText ||
                 data.targetText === targetText ||
                 data.refText === targetText ||
                 sentenceTarget === targetText ||
                 d.id.includes(targetText);
        });
      }

      if (docs.length === 0) return null;

      let highestScore: UserScore | null = null;
      let maxScore = 0;

      docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const score = typeof data.score === 'number' ? data.score : 0;
        if (score > maxScore) {
          maxScore = score;
          highestScore = {
            id: d.id,
            score: score,
            targetText: (typeof data.character === 'string' ? data.character : (typeof data.targetText === 'string' ? data.targetText : targetText)) as string,
            transcript: (typeof data.transcript === 'string' ? data.transcript : ''),
            level: level,
            language: (typeof data.language === 'string' ? data.language : languageId),
            timestamp: (data as Record<string, unknown>).updatedAt ?? (data as Record<string, unknown>).timestamp,
            overallScore: score,
            pronunciationScore: typeof (data as Record<string, unknown>).pronunciationScore === 'number' ? (data as Record<string, unknown>).pronunciationScore as number : 0,
            fluencyScore: typeof (data as Record<string, unknown>).fluencyScore === 'number' ? (data as Record<string, unknown>).fluencyScore as number : 0,
            accuracyScore: typeof (data as Record<string, unknown>).accuracyScore === 'number' ? (data as Record<string, unknown>).accuracyScore as number : 0,
            apiResponse: (typeof (data as Record<string, unknown>).apiResponse === 'object' && (data as Record<string, unknown>).apiResponse !== null ? (data as Record<string, unknown>).apiResponse as Record<string, unknown> : {}),
          };
        }
      });

      return highestScore;
    } catch (error) {
      console.error('Error fetching high score for text:', error);
      return null;
    }
  }

  static async getUserHighScores(userId: string, languageId: string): Promise<HighScore | null> {
    console.log('UserService.getUserHighScores called with:', { userId, languageId });
    try {
      // no need to store the doc value here; this also avoids unused variable lint
      await getDoc(doc(db, 'users', userId, 'languages', languageId.toLowerCase()));

      const scores: UserScore[] = [];
      const levelBreakdown = {
        beginner: { count: 0, total: 0, highest: 0 },
        intermediate: { count: 0, total: 0, highest: 0 },
        advanced: { count: 0, total: 0, highest: 0 }
      } as const;

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
          ) as CollectionReference<DocumentData>;
          const basicQuery = query(assessmentsRef) as Query<DocumentData>;
          const snapshot = await getDocs(basicQuery);

          snapshot.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            const score: UserScore = {
              id: d.id,
              score: typeof data.score === 'number' ? data.score : 0,
              targetText: (typeof data.character === 'string' ? data.character : (typeof data.targetText === 'string' ? data.targetText : d.id.split('_')[0] || '')),
              transcript: (typeof data.transcript === 'string' ? data.transcript : ''),
              level: level,
              language: (typeof data.language === 'string' ? data.language : languageId),
              timestamp: (data as Record<string, unknown>).updatedAt ?? (data as Record<string, unknown>).timestamp,
              overallScore: typeof data.score === 'number' ? data.score : 0,
              pronunciationScore: typeof (data as Record<string, unknown>).pronunciationScore === 'number' ? (data as Record<string, unknown>).pronunciationScore as number : 0,
              fluencyScore: typeof (data as Record<string, unknown>).fluencyScore === 'number' ? (data as Record<string, unknown>).fluencyScore as number : 0,
              accuracyScore: typeof (data as Record<string, unknown>).accuracyScore === 'number' ? (data as Record<string, unknown>).accuracyScore as number : 0,
            };
            scores.push(score);
            // update aggregates
            levelBreakdown[level].count++;
            levelBreakdown[level].total += score.overallScore || score.score;
            levelBreakdown[level].highest = Math.max(levelBreakdown[level].highest, score.overallScore || score.score);
          });
        } catch (levelError) {
          console.warn(`Error fetching ${level} assessments:`, levelError);
        }
      }

      if (scores.length === 0) {
        try {
          const fallbackRef = collection(db, 'users', userId, 'languages', languageId.toLowerCase(), 'assessmentsData') as CollectionReference<DocumentData>;
          const fallbackSnapshot = await getDocs(query(fallbackRef) as Query<DocumentData>);
          fallbackSnapshot.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            const score: UserScore = {
              id: d.id,
              score: typeof data.score === 'number' ? data.score : 0,
              targetText: (typeof data.character === 'string' ? data.character : (typeof data.targetText === 'string' ? data.targetText : d.id.split('_')[0] || '')),
              transcript: (typeof data.transcript === 'string' ? data.transcript : ''),
              level: (typeof data.level === 'string' ? data.level : 'beginner'),
              language: (typeof data.language === 'string' ? data.language : languageId),
              timestamp: (data as Record<string, unknown>).updatedAt ?? (data as Record<string, unknown>).timestamp,
              overallScore: typeof data.score === 'number' ? data.score : 0,
              pronunciationScore: typeof (data as Record<string, unknown>).pronunciationScore === 'number' ? (data as Record<string, unknown>).pronunciationScore as number : 0,
              fluencyScore: typeof (data as Record<string, unknown>).fluencyScore === 'number' ? (data as Record<string, unknown>).fluencyScore as number : 0,
              accuracyScore: typeof (data as Record<string, unknown>).accuracyScore === 'number' ? (data as Record<string, unknown>).accuracyScore as number : 0,
            };
            scores.push(score);
            const lvl = (score.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced');
            levelBreakdown[lvl].count++;
            levelBreakdown[lvl].total += score.overallScore || score.score;
            levelBreakdown[lvl].highest = Math.max(levelBreakdown[lvl].highest, score.overallScore || score.score);
          });
        } catch (fallbackError) {
          console.warn('Error fetching from fallback structure:', fallbackError);
        }
      }

      if (scores.length === 0) return null;

      const totalScore = scores.reduce((sum, s) => sum + (s.overallScore || s.score), 0);
      const averageScore = scores.length > 0 ? totalScore / scores.length : 0;
      const highestScore = Math.max(...scores.map(s => s.overallScore || s.score));

      return {
        highestScore,
        totalAssessments: scores.length,
        averageScore,
        recentScores: scores.slice(0, 10),
        levelBreakdown: {
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
        }
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
      ) as CollectionReference<DocumentData>;

      await addDoc(assessmentsRef, {
        score: scoreData.overallScore || scoreData.score,
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
