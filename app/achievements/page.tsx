'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';
import Image from 'next/image';

interface Badge {
  id: string;
  name: string;
  description: string;
  assetUrl: string;
  requirements?: string[];
  tips?: string[];
}

export default function AchievementsPage() {
  const router = useRouter();
  const [userBadges, setUserBadges] = useState<Record<string, boolean>>({});
  const [availableBadges, setAvailableBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setUser] = useState<User | null>(null);

  // Load user badges from Firestore
  const loadUserBadges = useCallback(async (userId: string) => {
    try {
      // Define the badge IDs that match the Flutter app
      const badgeIds = [
        'rookie_linguist',
        'word_explorer', 
        'voice_breaker',
        'daily_voyager',
        'phrase_master',
        'fluent_flyer',
        'polyglot_in_progress',
        'crown_of_fluency',
        'accuracy_hunter',
        'consistency_keeper',
        'first_steps_scholar',
        'globe_trotter',
        'growth_seeker',
        'weekly_warrior',
        'legend_of_polyglai'
      ];

      const badgeStatus: Record<string, boolean> = {};
      
      // Check each badge in parallel
      const badgeChecks = badgeIds.map(async (badgeId) => {
        try {
          const badgeDoc = await getDoc(doc(db, 'users', userId, 'badges', badgeId));
          if (badgeDoc.exists()) {
            const data = badgeDoc.data();
            // Badge is unlocked if it's earned AND claimed
            badgeStatus[badgeId] = data.isEarned === true && data.isClaimed === true;
          } else {
            badgeStatus[badgeId] = false;
          }
        } catch (error) {
          console.warn(`Error checking badge ${badgeId}:`, error);
          badgeStatus[badgeId] = false;
        }
      });

      await Promise.all(badgeChecks);
      setUserBadges(badgeStatus);
      
      console.log('Loaded user badges:', badgeStatus);
      console.log('Badge paths being used:', badgeIds.map(id => `/badges/${id}.png`));
    } catch (error) {
      console.error('Error loading user badges:', error);
      // Set all badges as locked on error
      setUserBadges({
        'rookie_linguist': false,
        'word_explorer': false,
        'voice_breaker': false,
        'daily_voyager': false,
        'phrase_master': false,
        'fluent_flyer': false,
        'polyglot_in_progress': false,
        'crown_of_fluency': false,
        'accuracy_hunter': false,
        'consistency_keeper': false,
        'first_steps_scholar': false,
        'globe_trotter': false,
        'growth_seeker': false,
        'weekly_warrior': false,
        'legend_of_polyglai': false
      });
    }
  }, []);

  // Load available badges from Firestore
  const loadAvailableBadges = useCallback(async () => {
    try {
      const badgesSnapshot = await getDocs(collection(db, 'badges'));
      const badges: Badge[] = badgesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Badge));
      
      // Sort badges by creation order or by name
      badges.sort((a, b) => a.name.localeCompare(b.name));
      setAvailableBadges(badges);
    } catch (error) {
      console.error('Error loading available badges:', error);
      // Fallback to hardcoded badges if Firestore fails
      const fallbackBadges: Badge[] = [
        {
          id: 'rookie_linguist',
          name: 'Rookie Linguist',
          description: 'Complete your first lesson in any language',
          assetUrl: '/badges/rookie_linguist.png',
          requirements: ['Complete at least 1 lesson in any language'],
          tips: ['Start with beginner level lessons', 'Practice daily for best results']
        },
        {
          id: 'word_explorer',
          name: 'Word Explorer',
          description: 'Learn 10 new vocabulary words using the Word Trainer',
          assetUrl: '/badges/word_explorer.png',
          requirements: ['Answer 10 questions correctly in Word Trainer'],
          tips: ['Use Word Trainer daily', 'Focus on accuracy over speed']
        },
        {
          id: 'voice_breaker',
          name: 'Voice Breaker',
          description: 'Finish your first pronunciation assessment successfully',
          assetUrl: '/badges/voice_breaker.png',
          requirements: ['Complete at least 1 pronunciation assessment'],
          tips: ['Speak clearly and at normal pace', 'Practice pronunciation exercises']
        },
        {
          id: 'daily_voyager',
          name: 'Daily Voyager',
          description: 'Maintain a 3-day learning streak',
          assetUrl: '/badges/daily_voyager.png',
          requirements: ['Maintain a 3-day consecutive learning streak'],
          tips: ['Practice every day', 'Use reminders to maintain consistency']
        },
        {
          id: 'phrase_master',
          name: 'Phrase Master',
          description: 'Translate and practice 25 sentences (intermediate) across different languages',
          assetUrl: '/badges/phrase_master.png',
          requirements: ['Complete 25 translation challenges'],
          tips: ['Focus on sentence structure', 'Practice with different languages']
        },
        {
          id: 'fluent_flyer',
          name: 'Fluent Flyer',
          description: 'Pass 20 pronunciation assessments in one language (both beginner and intermediate)',
          assetUrl: '/badges/fluent_flyer.png',
          requirements: ['Pass 20 pronunciation assessments in one language'],
          tips: ['Focus on one language at a time', 'Practice both beginner and intermediate levels']
        },
        {
          id: 'polyglot_in_progress',
          name: 'Polyglot in Progress',
          description: 'Complete lessons in 3 different languages',
          assetUrl: '/badges/polyglot_in_progress.png',
          requirements: ['Complete lessons in 3 different languages'],
          tips: ['Explore different language families', 'Balance practice across languages']
        },
        {
          id: 'crown_of_fluency',
          name: 'Crown of Fluency',
          description: 'Score 90 or higher in a pronunciation assessment 5 times',
          assetUrl: '/badges/crown_of_fluency.png',
          requirements: ['Score 90+ in pronunciation assessment 5 times'],
          tips: ['Focus on accuracy and fluency', 'Practice challenging words']
        },
        {
          id: 'accuracy_hunter',
          name: 'Accuracy Hunter',
          description: 'Score 100% in Word Trainer',
          assetUrl: '/badges/accuracy_hunter.png',
          requirements: ['Score 100% in Word Trainer'],
          tips: ['Focus on accuracy over speed', 'Take your time with each question']
        },
        {
          id: 'consistency_keeper',
          name: 'Consistency Keeper',
          description: 'Level Up for 15 minutes a day, 5 days in a row',
          assetUrl: '/badges/consistency_keeper.png',
          requirements: ['Level Up for 15 minutes a day, 5 days in a row'],
          tips: ['Set daily reminders', 'Find a consistent time to practice']
        },
        {
          id: 'first_steps_scholar',
          name: 'First Steps Scholar',
          description: 'Complete 3 Word Trainer sessions',
          assetUrl: '/badges/first_steps_scholar.png',
          requirements: ['Complete 3 Word Trainer sessions'],
          tips: ['Start with shorter sessions', 'Build up your vocabulary gradually']
        },
        {
          id: 'globe_trotter',
          name: 'Globe Trotter',
          description: 'Translate a sentence in 5 different languages',
          assetUrl: '/badges/globe_trotter.png',
          requirements: ['Translate a sentence in 5 different languages'],
          tips: ['Explore different language families', 'Practice with various sentence structures']
        },
        {
          id: 'growth_seeker',
          name: 'Growth Seeker',
          description: 'Improve your pronunciation assessment score by 10% compared to your first attempt',
          assetUrl: '/badges/growth_seeker.png',
          requirements: ['Improve pronunciation score by 10% from first attempt'],
          tips: ['Practice pronunciation exercises regularly', 'Focus on problem areas']
        },
        {
          id: 'weekly_warrior',
          name: 'Weekly Warrior',
          description: 'Study at least once every day for 7 days (Level Up)',
          assetUrl: '/badges/weekly_warrior.png',
          requirements: ['Study at least once every day for 7 days'],
          tips: ['Use Level Up feature daily', 'Set achievable daily goals']
        },
        {
          id: 'legend_of_polyglai',
          name: 'Legend of PolyglAI',
          description: 'Unlock all achievements in the app',
          assetUrl: '/badges/legend_of_polyglai.png',
          requirements: ['Unlock all other badges'],
          tips: ['Complete all challenges', 'Maintain consistent practice']
        }
      ];
      setAvailableBadges(fallbackBadges);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        setLoading(true);
        await Promise.all([
          loadUserBadges(user.uid),
          loadAvailableBadges()
        ]);
        setLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, loadUserBadges, loadAvailableBadges]);

  const unlockedCount = Object.values(userBadges).filter(Boolean).length;
  const totalCount = availableBadges.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#29B6F6]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Achievements</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border-2 border-[#2AC3F4] mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-[#2AC3F4] rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Achievement Progress</h2>
              <p className="text-gray-600">
                {unlockedCount} of {totalCount} badges earned
              </p>
            </div>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableBadges
            .sort((a, b) => {
              const aUnlocked = userBadges[a.id] || false;
              const bUnlocked = userBadges[b.id] || false;
              // Unlocked badges first, then locked badges
              if (aUnlocked && !bUnlocked) return -1;
              if (!aUnlocked && bUnlocked) return 1;
              // If both have same status, sort by name
              return a.name.localeCompare(b.name);
            })
            .map((badge) => {
            const isUnlocked = userBadges[badge.id] || false;
            return (
              <div
                key={badge.id}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                {/* Badge Image */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-transparent flex items-center justify-center">
                    <Image
                      src={`/badges/${badge.id}.png`}
                      alt={badge.name}
                      width={80}
                      height={80}
                      className={`w-full h-full object-contain ${isUnlocked ? '' : 'grayscale'}`}
                    />
                  </div>
                </div>

                {/* Badge Info */}
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {badge.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {badge.description}
                  </p>
                  
                  {/* Status */}
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    isUnlocked 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <span className="mr-1">{isUnlocked ? '✅' : '🔒'}</span>
                    {isUnlocked ? 'Unlocked' : 'Locked'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
