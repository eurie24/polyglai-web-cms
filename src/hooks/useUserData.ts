import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

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
