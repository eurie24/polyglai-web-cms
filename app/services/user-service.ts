import { doc, getDoc, collection, query, getDocs, where, Query, CollectionReference, DocumentData, QueryDocumentSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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
  private static normalizeString(input: string): string {
    return (input || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u00C0-\u024F\u4E00-\u9FFF\u3040-\u30FF\u3130-\u318F\uAC00-\uD7AF]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120);
  }
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
      const normalizedTarget = UserService.normalizeString(targetText);
      try {
        // First, prefer normalizedTarget field for exact matching across platforms
        try {
          const q0 = query(assessmentsRef, where('normalizedTarget', '==', normalizedTarget)) as Query<DocumentData>;
          const s0 = await getDocs(q0);
          if (!s0.empty) docs = s0.docs;
        } catch {}
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
            const values = [data.character, data.targetText, data.refText, sentenceTarget, d.id]
              .map(v => typeof v === 'string' ? UserService.normalizeString(v as string) : '');
            return values.includes(normalizedTarget) || (typeof d.id === 'string' && UserService.normalizeString(d.id).startsWith(normalizedTarget));
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
          const values = [data.character, data.targetText, data.refText, sentenceTarget, d.id]
            .map(v => typeof v === 'string' ? UserService.normalizeString(v as string) : '');
          return values.includes(normalizedTarget) || (typeof d.id === 'string' && UserService.normalizeString(d.id).startsWith(normalizedTarget));
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
          const mergedApiResponse: Record<string, unknown> =
            (typeof (data as Record<string, unknown>).apiResponse === 'object' && (data as Record<string, unknown>).apiResponse !== null)
              ? { ...(data as Record<string, unknown>).apiResponse as Record<string, unknown>, originalResponse: (data as Record<string, unknown>).originalResponse }
              : { originalResponse: (data as Record<string, unknown>).originalResponse };

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
            apiResponse: mergedApiResponse,
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
      type LevelKey = 'beginner' | 'intermediate' | 'advanced';
      const levelBreakdown: Record<LevelKey, { count: number; total: number; highest: number }> = {
        beginner: { count: 0, total: 0, highest: 0 },
        intermediate: { count: 0, total: 0, highest: 0 },
        advanced: { count: 0, total: 0, highest: 0 }
      };

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

  static async getAssessedTexts(userId: string, languageId: string, level: string): Promise<Set<string>> {
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

      const snapshot = await getDocs(query(assessmentsRef) as Query<DocumentData>);
      const assessedTexts = new Set<string>();

      snapshot.forEach((doc) => {
        const data = doc.data() as Record<string, unknown>;
        // Check multiple potential text fields to match Flutter logic
        const character = data.character as string;
        const targetText = data.targetText as string;
        const refText = data.refText as string;
        const sentence = data.sentence as Record<string, unknown> | undefined;
        const sentenceTarget = sentence?.target as string;
        const detailsSentence = (data.details as Record<string, unknown> | undefined)?.sentence as Record<string, unknown> | undefined;
        const detailsSentenceTarget = detailsSentence?.target as string;

        // Add all non-empty text values to the set
        if (character) assessedTexts.add(character);
        if (targetText) assessedTexts.add(targetText);
        if (refText) assessedTexts.add(refText);
        if (sentenceTarget) assessedTexts.add(sentenceTarget);
        if (detailsSentenceTarget) assessedTexts.add(detailsSentenceTarget);
      });

      console.log(`getAssessedTexts: Found ${assessedTexts.size} assessed texts for ${languageId} ${level}`);
      return assessedTexts;
    } catch (error) {
      console.error('Error fetching assessed texts:', error);
      return new Set<string>();
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
      apiResponse?: Record<string, unknown>;
      azureRawResponse?: Record<string, unknown>;
      phonemeAnalysis?: Array<{
        phoneme: string;
        pronunciation: number;
        tone: number;
        feedback: string;
      }>;
    }
  ): Promise<void> {
    try {
      const level = scoreData.level.toLowerCase();
      const normalizedTarget = UserService.normalizeString(scoreData.targetText);
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

      // Build a deterministic document id based on normalized target text
      const slug = normalizedTarget || 'item';

      // Try to locate an existing document for this assessment target using the same comprehensive logic as getUserHighScoreForText
      console.log('saveAssessmentScore: Looking for existing assessment for:', { targetText: scoreData.targetText, level, language: languageId });
      let existingDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      let docs: QueryDocumentSnapshot<DocumentData>[] = [];
      try {
        // Prefer normalizedTarget field for exact cross-platform match
        try {
          const q0 = query(assessmentsRef, where('normalizedTarget', '==', normalizedTarget)) as Query<DocumentData>;
          const s0 = await getDocs(q0);
          if (!s0.empty) {
            docs = s0.docs;
          }
        } catch {}
        // Try by character field first (used by Flutter app)
        const q1 = query(assessmentsRef, where('character', '==', scoreData.targetText)) as Query<DocumentData>;
        const s1 = await getDocs(q1);
        if (!s1.empty) {
          docs = s1.docs;
        }
        // Try by targetText field
        if (docs.length === 0) {
          const q2 = query(assessmentsRef, where('targetText', '==', scoreData.targetText)) as Query<DocumentData>;
          const s2 = await getDocs(q2);
          if (!s2.empty) docs = s2.docs;
        }
        // Try by refText field
        if (docs.length === 0) {
          const q3 = query(assessmentsRef, where('refText', '==', scoreData.targetText)) as Query<DocumentData>;
          const s3 = await getDocs(q3);
          if (!s3.empty) docs = s3.docs;
        }
        // Fallback: get all docs and filter manually
        if (docs.length === 0) {
          const q4 = query(assessmentsRef) as Query<DocumentData>;
          const allDocs = await getDocs(q4);
          docs = allDocs.docs.filter(d => {
            const data = d.data() as Record<string, unknown>;
            const sentence = data.sentence as Record<string, unknown> | undefined;
            const sentenceTarget = typeof sentence?.target === 'string' ? sentence.target : undefined;
            const detailsSentence = (data.details as Record<string, unknown> | undefined)?.sentence as Record<string, unknown> | undefined;
            const detailsSentenceTarget = typeof detailsSentence?.target === 'string' ? detailsSentence.target : undefined;
            const values = [data.character, data.targetText, data.refText, sentenceTarget, detailsSentenceTarget, d.id]
              .map(v => typeof v === 'string' ? UserService.normalizeString(v as string) : '');
            return values.includes(normalizedTarget) || (typeof d.id === 'string' && UserService.normalizeString(d.id).startsWith(normalizedTarget));
          });
        }
        
        // Find the highest scoring existing document
        if (docs.length > 0) {
          console.log(`saveAssessmentScore: Found ${docs.length} existing documents`);
          let maxScore = 0;
          docs.forEach((d) => {
            const data = d.data() as Record<string, unknown>;
            const score = typeof data.score === 'number' ? data.score : 0;
            console.log(`saveAssessmentScore: Existing doc ${d.id} has score:`, score);
            if (score > maxScore) {
              maxScore = score;
              existingDoc = d;
            }
          });
          console.log(`saveAssessmentScore: Highest existing score is ${maxScore} from doc ${existingDoc?.id}`);
        } else {
          console.log('saveAssessmentScore: No existing documents found');
        }
      } catch (queryError) {
        console.error('Error finding existing document:', queryError);
        // Try fallback query
        try {
          const qFallback = query(assessmentsRef) as Query<DocumentData>;
          const allDocs = await getDocs(qFallback);
          docs = allDocs.docs.filter(d => {
            const data = d.data() as Record<string, unknown>;
            const sentence = data.sentence as Record<string, unknown> | undefined;
            const sentenceTarget = typeof sentence?.target === 'string' ? sentence.target : undefined;
            const detailsSentence = (data.details as Record<string, unknown> | undefined)?.sentence as Record<string, unknown> | undefined;
            const detailsSentenceTarget = typeof detailsSentence?.target === 'string' ? detailsSentence.target : undefined;
            const values = [data.character, data.targetText, data.refText, sentenceTarget, detailsSentenceTarget, d.id]
              .map(v => typeof v === 'string' ? UserService.normalizeString(v as string) : '');
            return values.includes(normalizedTarget) || (typeof d.id === 'string' && UserService.normalizeString(d.id).startsWith(normalizedTarget));
          });
          
          if (docs.length > 0) {
            let maxScore = 0;
            docs.forEach((d) => {
              const data = d.data() as Record<string, unknown>;
              const score = typeof data.score === 'number' ? data.score : 0;
              if (score > maxScore) {
                maxScore = score;
                existingDoc = d;
              }
            });
          }
        } catch {}
      }

      // Create the assessment payload in the same format as Flutter app
      const overallScore = scoreData.overallScore || scoreData.score;
      const pronunciationScore = scoreData.pronunciationScore || overallScore;
      const fluencyScore = scoreData.fluencyScore || overallScore;
      const accuracyScore = scoreData.accuracyScore || overallScore;
      const prosodyScore = Math.max(0, overallScore - 5); // Slightly lower than overall

      // Create mock Azure Speech API response structure if not provided
      const mockAzureResponse = scoreData.azureRawResponse || {
        DisplayText: scoreData.transcript,
        Duration: 5000000, // 5 seconds in ticks
        NBest: [{
          AccuracyScore: accuracyScore,
          CompletenessScore: 100,
          Confidence: 0.9,
          Display: scoreData.transcript,
          FluencyScore: fluencyScore,
          ITN: scoreData.transcript.toLowerCase(),
          Lexical: scoreData.transcript.toLowerCase(),
          MaskedITN: scoreData.transcript.toLowerCase(),
          PronScore: pronunciationScore,
          ProsodyScore: prosodyScore,
          Words: scoreData.transcript.split(' ').map((word, index) => ({
            AccuracyScore: Math.max(85, accuracyScore + Math.floor(Math.random() * 10) - 5),
            Confidence: 0,
            Duration: 1000000,
            ErrorType: "None",
            Feedback: {
              Prosody: {
                Break: { BreakLength: 0 },
                ErrorTypes: ["None"],
                Intonation: { ErrorTypes: [] },
                MissingBreak: { Confidence: 1 },
                UnexpectedBreak: { Confidence: 0 }
              }
            },
            Offset: 1000000 * index,
            Word: word.toLowerCase()
          }))
        }],
        RecognitionStatus: "Success",
        SNR: 15.0
      };

      const payload: Record<string, unknown> = {
        // Core fields matching Flutter app format
        apiResponse: scoreData.apiResponse || {
          refText: scoreData.targetText,
          result: {
            fluency: fluencyScore,
            integrity: 100,
            overall: overallScore,
            pronunciation: pronunciationScore,
            prosody: prosodyScore,
            words: (() => {
              // For beginner and intermediate levels, include phoneme analysis
              if ((scoreData.level.toLowerCase() === 'beginner' || scoreData.level.toLowerCase() === 'intermediate') && scoreData.phonemeAnalysis && scoreData.phonemeAnalysis.length > 0) {
                if (scoreData.level.toLowerCase() === 'beginner') {
                  // For beginner, put all phonemes in first word
                  return [{
                    word: scoreData.targetText.toLowerCase(),
                    phonemes: scoreData.phonemeAnalysis.map(p => ({
                      phoneme: p.phoneme,
                      pronunciation: p.pronunciation,
                      tone: p.tone || 0
                    })),
                    scores: { overall: pronunciationScore }
                  }];
                } else {
                  // For intermediate, distribute phonemes across words
                  const words = scoreData.transcript.split(' ');
                  const phonemesPerWord = Math.ceil(scoreData.phonemeAnalysis.length / words.length);
                  return words.map((word, index) => {
                    const startIdx = index * phonemesPerWord;
                    const endIdx = Math.min(startIdx + phonemesPerWord, scoreData.phonemeAnalysis.length);
                    const wordPhonemes = scoreData.phonemeAnalysis.slice(startIdx, endIdx);
                    return {
                      word: word.toLowerCase(),
                      phonemes: wordPhonemes.map(p => ({
                        phoneme: p.phoneme,
                        pronunciation: p.pronunciation,
                        tone: p.tone || 0
                      })),
                      scores: { overall: Math.max(85, pronunciationScore + Math.floor(Math.random() * 10) - 5) }
                    };
                  });
                }
              }
              // For advanced or when no phoneme analysis
              return scoreData.transcript.split(' ').map(word => ({
                phonemes: [],
                pinyin: "",
                scores: { overall: Math.max(85, pronunciationScore + Math.floor(Math.random() * 10) - 5) },
                word: word.toLowerCase()
              }));
            })()
          }
        },
        apiProvider: "Microsoft Speech Azure AI", // Match Flutter app exactly
        language: scoreData.language.toLowerCase(),
        level: scoreData.level.toLowerCase(),
        originalResponse: mockAzureResponse,
        result: {
          fluency: fluencyScore,
          integrity: 100,
          overall: overallScore,
          pronunciation: pronunciationScore,
          prosody: prosodyScore,
          words: (() => {
            // For beginner and intermediate levels, include phoneme analysis
            if ((scoreData.level.toLowerCase() === 'beginner' || scoreData.level.toLowerCase() === 'intermediate') && scoreData.phonemeAnalysis && scoreData.phonemeAnalysis.length > 0) {
              if (scoreData.level.toLowerCase() === 'beginner') {
                // For beginner, put all phonemes in first word
                return [{
                  word: scoreData.targetText.toLowerCase(),
                  phonemes: scoreData.phonemeAnalysis.map(p => ({
                    phoneme: p.phoneme,
                    pronunciation: p.pronunciation,
                    tone: p.tone || 0
                  })),
                  scores: { overall: pronunciationScore }
                }];
              } else {
                // For intermediate, distribute phonemes across words
                const words = scoreData.transcript.split(' ');
                const phonemesPerWord = Math.ceil(scoreData.phonemeAnalysis.length / words.length);
                return words.map((word, index) => {
                  const startIdx = index * phonemesPerWord;
                  const endIdx = Math.min(startIdx + phonemesPerWord, scoreData.phonemeAnalysis.length);
                  const wordPhonemes = scoreData.phonemeAnalysis.slice(startIdx, endIdx);
                  return {
                    word: word.toLowerCase(),
                    phonemes: wordPhonemes.map(p => ({
                      phoneme: p.phoneme,
                      pronunciation: p.pronunciation,
                      tone: p.tone || 0
                    })),
                    scores: { overall: Math.max(85, pronunciationScore + Math.floor(Math.random() * 10) - 5) }
                  };
                });
              }
            }
            // For advanced or when no phoneme analysis
            return scoreData.transcript.split(' ').map(word => ({
              phonemes: [],
              pinyin: "",
              scores: { overall: Math.max(85, pronunciationScore + Math.floor(Math.random() * 10) - 5) },
              word: word.toLowerCase()
            }));
          })()
        },
        timestamp: new Date().toISOString(),
        character: scoreData.targetText,
        refText: scoreData.targetText, // Add refText field that Flutter expects
        normalizedTarget: normalizedTarget,
        details: {
          sentence: { overall: overallScore, target: scoreData.targetText }
        },
        level: scoreData.level.toLowerCase(),
        score: overallScore,
        updatedAt: new Date(),
        
        // Compatibility fields for existing queries
        targetText: scoreData.targetText,
        transcript: scoreData.transcript,
        overallScore: overallScore,
        pronunciationScore: pronunciationScore,
        fluencyScore: fluencyScore,
        accuracyScore: accuracyScore,
        
        // Add phoneme analysis if provided (for beginner level)
        ...(scoreData.phonemeAnalysis && { phonemeAnalysis: scoreData.phonemeAnalysis })
      };

      console.log('saveAssessmentScore: Final payload structure:', {
        hasApiResponse: !!payload.apiResponse,
        hasResult: !!(payload.result),
        hasWords: !!(payload.result as any)?.words,
        hasPhonemes: !!((payload.result as any)?.words?.[0]?.phonemes?.length),
        hasRefText: !!payload.refText,
        phonenesCount: ((payload.result as any)?.words?.[0]?.phonemes?.length || 0),
        level: scoreData.level,
        hasPhonemeAnalysis: !!(scoreData.phonemeAnalysis && scoreData.phonemeAnalysis.length > 0),
        phonemeAnalysisCount: scoreData.phonemeAnalysis?.length || 0
      });
      
      console.log('saveAssessmentScore: apiResponse structure:', JSON.stringify(payload.apiResponse, null, 2));

      if (existingDoc) {
        const current = existingDoc.data();
        const currentBest = typeof current.score === 'number' ? current.score : 0;
        const newScore = payload.score as number;
        console.log(`saveAssessmentScore: Comparing scores - current: ${currentBest}, new: ${newScore}`);
        if (newScore > currentBest) {
          console.log('saveAssessmentScore: New score is higher, updating existing document');
          await updateDoc(existingDoc.ref, payload);
          // Award new-high-score badge
          try {
            await UserService.awardBadge(userId, {
              id: `new_high_score_${languageId.toLowerCase()}_${level}_${slug}`,
              type: 'new_high_score',
              language: languageId.toLowerCase(),
              level,
              targetText: scoreData.targetText,
              score: newScore,
              createdAt: new Date()
            });
          } catch {}
        } else {
          console.log('saveAssessmentScore: New score is not higher, not updating');
        }
      } else {
        console.log('saveAssessmentScore: No existing document found, creating new one');
        // Use normalized slug for deterministic ID across platforms
        const idDoc = doc(assessmentsRef, slug);
        await setDoc(idDoc, payload);
        // First saved score for this target counts as a high score
        try {
          await UserService.awardBadge(userId, {
            id: `new_high_score_${languageId.toLowerCase()}_${level}_${slug}`,
            type: 'new_high_score',
            language: languageId.toLowerCase(),
            level,
            targetText: scoreData.targetText,
            score: payload.score,
            createdAt: new Date()
          });
        } catch {}
      }
    } catch (error) {
      console.error('Error saving assessment score:', error);
      throw error;
    }
  }

  static async awardBadge(
    userId: string,
    badge: {
      id: string;
      type: string;
      language?: string;
      level?: string;
      targetText?: string;
      score?: unknown;
      createdAt?: Date;
    }
  ): Promise<void> {
    try {
      const { setDoc: setDocFn, doc: docFn } = await import('firebase/firestore');
      const badgeId = badge.id || `${badge.type}_${Date.now()}`;
      const badgeRef = docFn(db, 'users', userId, 'achievements', badgeId);
      await setDocFn(badgeRef, {
        ...badge,
        createdAt: badge.createdAt || new Date()
      }, { merge: true });
    } catch (error) {
      console.warn('Failed to award badge:', error);
    }
  }
}
