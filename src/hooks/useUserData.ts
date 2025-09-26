import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, collection, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface UserProfile {
  name: string;
  email: string;
  preferredLanguage: string;
  uid: string;
}

interface UserStats {
  totalPoints: number;
  streakDays: number;
  assessmentCount: number;
  lessonsCompleted: number;
  challengesCompleted: number;
  wordTrainerCorrectAnswers: number;
  highScoreAssessments: number;
  languagesWithLessons: number;
}

interface CachedData {
  profile: UserProfile | null;
  stats: UserStats;
  timestamp: number;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map<string, CachedData>();

// Helper function to get total character count for a language and level
async function getTotalAssessmentsForLevel(language: string, level: string): Promise<number> {
  try {
    // First try to get from the characters collection (new format)
    const charactersSnapshot = await getCountFromServer(
      collection(db, 'languages', language.toLowerCase(), 'characters', level.toLowerCase(), 'items')
    );
    
    if (charactersSnapshot.data().count > 0) {
      console.log(`Found ${charactersSnapshot.data().count} characters for ${language} ${level}`);
      return charactersSnapshot.data().count;
    }
    
    // Fallback: try the original characters collection format
    const originalDoc = await getDoc(doc(db, 'characters', language.toLowerCase()));
    
    if (originalDoc.exists()) {
      const data = originalDoc.data();
      const characters = data?.[level.toLowerCase()] as any[] | undefined;
      if (characters && characters.length > 0) {
        console.log(`Found ${characters.length} characters for ${language} ${level} (original format)`);
        return characters.length;
      }
    }
    
    // Final fallback: return a reasonable default based on level
    const defaultCount = level.toLowerCase() === 'beginner' ? 10 : 15;
    console.log(`Using default count ${defaultCount} for ${language} ${level}`);
    return defaultCount;
  } catch (e) {
    console.error(`Error getting total assessments for ${language} ${level}:`, e);
    // Return a reasonable default
    return level.toLowerCase() === 'beginner' ? 10 : 15;
  }
}

export function useUserData(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalPoints: 0,
    streakDays: 0,
    assessmentCount: 0,
    lessonsCompleted: 0,
    challengesCompleted: 0,
    wordTrainerCorrectAnswers: 0,
    highScoreAssessments: 0,
    languagesWithLessons: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check cache first
      const cached = cache.get(userId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setProfile(cached.profile);
        setStats(cached.stats);
        setIsLoading(false);
        return;
      }

      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      let userProfile: UserProfile | null = null;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        userProfile = {
          name: userData.name || userData.displayName || 'User',
          email: userData.email || '',
          preferredLanguage: userData.preferredLanguage || 'english',
          uid: userId
        };
      }

      // If no profile in main doc, try profile/info subcollection
      if (!userProfile) {
        const profileDoc = await getDoc(doc(db, 'users', userId, 'profile', 'info'));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          userProfile = {
            name: profileData.name || 'User',
            email: profileData.email || '',
            preferredLanguage: profileData.preferredLanguage || 'english',
            uid: userId
          };
        }
      }

      // Load user stats
      const usageDoc = await getDoc(doc(db, 'users', userId, 'stats', 'usage'));
      const userStats: UserStats = {
        totalPoints: 0,
        streakDays: 0,
        assessmentCount: 0,
        lessonsCompleted: 0,
        challengesCompleted: 0,
        wordTrainerCorrectAnswers: 0,
        highScoreAssessments: 0,
        languagesWithLessons: 0,
      };

      if (usageDoc.exists()) {
        const data = usageDoc.data();
        userStats.totalPoints = data.totalPoints || 0;
        userStats.streakDays = data.streakDays || 0;
        userStats.assessmentCount = data.assessmentCount || 0;
        userStats.lessonsCompleted = data.lessonsCompleted || 0;
        userStats.challengesCompleted = data.challengesCompleted || 0;
        userStats.wordTrainerCorrectAnswers = data.wordTrainerCorrectAnswers || 0;
        userStats.highScoreAssessments = data.highScoreAssessments || 0;
        userStats.languagesWithLessons = data.languagesWithLessons || 0;
      }

      // Fallback: compute Lessons Passed using dynamic character counts
      if (!userStats.lessonsCompleted || userStats.lessonsCompleted === 0) {
        const computedLessons = await (async () => {
          try {
            const languagesSnap = await getDocs(collection(db, 'users', userId, 'languages'));
            let totalLessonsCompleted = 0;
            for (const langDoc of languagesSnap.docs) {
              const languageId = langDoc.id;
              for (const level of ['beginner', 'intermediate'] as const) {
                const assessmentsSnap = await getDocs(
                  collection(db, 'users', userId, 'languages', languageId, 'assessmentsByLevel', level, 'assessments')
                );
                let completedAssessments = 0;
                assessmentsSnap.forEach(d => {
                  const score = (d.data() as any).score ?? 0;
                  if (typeof score === 'number' ? score > 0 : parseInt(String(score)) > 0) {
                    completedAssessments++;
                  }
                });
                
                // Get the total number of characters/words available for this language and level
                const totalAssessments = await getTotalAssessmentsForLevel(languageId, level);
                
                // A lesson is completed when user has completed ALL available assessments with score > 0
                if (completedAssessments >= totalAssessments && totalAssessments > 0) {
                  totalLessonsCompleted++;
                }
              }
            }
            return totalLessonsCompleted;
          } catch (e) {
            console.error('Error computing lessons:', e);
            return 0;
          }
        })();
        if (computedLessons > 0) {
          userStats.lessonsCompleted = computedLessons;
        }
      }

      // Update cache
      cache.set(userId, {
        profile: userProfile,
        stats: userStats,
        timestamp: Date.now()
      });

      setProfile(userProfile);
      setStats(userStats);

    } catch (err) {
      console.error('Error loading user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const refreshData = useCallback(() => {
    cache.delete(userId);
    loadUserData();
  }, [userId, loadUserData]);

  useEffect(() => {
    if (userId) {
      loadUserData();
    }
  }, [userId, loadUserData]);

  return {
    profile,
    stats,
    isLoading,
    error,
    refreshData
  };
}
