'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
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

interface Challenge {
  id: string;
  name: string;
  description: string;
  badgeSvgPath: string;
  badgeId: string;
  requirements?: string[];
  tips?: string[];
  isUnlocked: boolean;
  isEarned: boolean;
}

// Function to get custom badge icons  
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getBadgeIcon = (badgeId: string) => {
  const iconMap: Record<string, React.ReactElement> = {
    rookie_linguist: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    word_explorer: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      </svg>
    ),
    voice_breaker: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
      </svg>
    ),
    daily_voyager: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
      </svg>
    ),
    phrase_master: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M9,11H15L13.5,15H10.5L9,11M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8Z"/>
      </svg>
    ),
    fluent_flyer: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2L13.09,8.26L22,9L13.09,9.74L12,16L10.91,9.74L2,9L10.91,8.26L12,2Z"/>
      </svg>
    ),
    polyglot_in_progress: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.87,15.07L10.33,12.56L10.36,12.53C12.1,10.59 13.34,8.36 14.07,6H17V4H10V2H8V4H1V6H12.17C11.5,7.92 10.44,9.75 9,11.35C8.07,10.32 7.3,9.19 6.69,8H4.69C5.42,9.63 6.42,11.17 7.67,12.56L2.58,17.58L4,19L9,14L12.11,17.11L12.87,15.07M18.5,10H16.5L12,22H14L15.12,19H19.87L21,22H23L18.5,10M15.88,17L17.5,12.67L19.12,17H15.88Z"/>
      </svg>
    ),
    crown_of_fluency: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M5,16L3,5L8.5,10L12,4L15.5,10L21,5L19,16H5M12,18A2,2 0 0,1 10,16A2,2 0 0,1 12,14A2,2 0 0,1 14,16A2,2 0 0,1 12,18Z"/>
      </svg>
    ),
    legend_of_polyglai: (
      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10Z"/>
      </svg>
    )
  };
  
  return iconMap[badgeId] || (
    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10Z"/>
    </svg>
  );
};

export default function ChallengesPage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showModal, setShowModal] = useState(false);

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
      return badges;
    } catch (error) {
      console.error('Error loading available badges:', error);
      // Fallback to hardcoded badges if Firestore fails
      return [
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
          id: 'legend_of_polyglai',
          name: 'Legend of PolyglAI',
          description: 'Unlock all achievements in the app',
          assetUrl: '/badges/legend_of_polyglai.png',
          requirements: ['Unlock all other badges'],
          tips: ['Complete all challenges', 'Maintain consistent practice']
        }
      ];
    }
  }, []);

  // Load challenges with badge status
  const loadChallenges = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      
      const badges = await loadAvailableBadges();
      
      // Load badge statuses in parallel
      const challengePromises = badges.map(async (badge) => {
        try {
          const badgeDoc = await getDoc(doc(db, 'users', userId, 'badges', badge.id));
          let isUnlocked = false;
          let isEarned = false;
          
          if (badgeDoc.exists()) {
            const data = badgeDoc.data();
            isEarned = data.isEarned === true;
            isUnlocked = data.isEarned === true && data.isClaimed === true;
          }
          
          return {
            id: badge.id,
            name: badge.name,
            description: badge.description,
            badgeSvgPath: badge.assetUrl,
            badgeId: badge.id,
            requirements: badge.requirements,
            tips: badge.tips,
            isUnlocked,
            isEarned,
          } as Challenge;
        } catch (error) {
          console.warn(`Error checking badge ${badge.id}:`, error);
          return {
            id: badge.id,
            name: badge.name,
            description: badge.description,
            badgeSvgPath: badge.assetUrl,
            badgeId: badge.id,
            requirements: badge.requirements,
            tips: badge.tips,
            isUnlocked: false,
            isEarned: false,
          } as Challenge;
        }
      });

      const challengeResults = await Promise.all(challengePromises);
      setChallenges(challengeResults);
    } catch (error) {
      console.error('Error loading challenges:', error);
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }, [loadAvailableBadges]);

  // Claim a badge
  const claimBadge = async (badgeId: string) => {
    if (!user) return false;
    
    try {
      await updateDoc(doc(db, 'users', user.uid as string, 'badges', badgeId), {
        isClaimed: true,
        claimedAt: new Date(),
      });
      
      // Update local state
      setChallenges(prev => prev.map(challenge => 
        challenge.id === badgeId 
          ? { ...challenge, isUnlocked: true }
          : challenge
      ));
      
      return true;
    } catch (error) {
      console.error('Error claiming badge:', error);
      return false;
    }
  };

  const showChallengeDetails = (challenge: Challenge) => {
    setSelectedChallenge(challenge);
    setShowModal(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user as unknown as Record<string, unknown>);
        await loadChallenges(user.uid);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router, loadChallenges]);

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
              <h1 className="text-2xl font-bold text-gray-900">Challenges</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Challenges List */}
        <div className="space-y-4">
          {challenges
            .sort((a, b) => {
              // First priority: unlocked badges
              if (a.isUnlocked && !b.isUnlocked) return -1;
              if (!a.isUnlocked && b.isUnlocked) return 1;
              // Second priority: earned badges
              if (a.isEarned && !b.isEarned) return -1;
              if (!a.isEarned && b.isEarned) return 1;
              // If both have same status, sort by name
              return a.name.localeCompare(b.name);
            })
            .map((challenge) => (
            <div
              key={challenge.id}
              onClick={() => showChallengeDetails(challenge)}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-2 border-[#2AC3F4]"
            >
              <div className="flex items-center">
                {/* Badge Icon */}
                <div className="w-16 h-16 rounded-lg overflow-hidden mr-4 bg-transparent flex items-center justify-center">
                  <Image
                    src={`/badges/${challenge.badgeId}.png`}
                    alt={challenge.name}
                    width={64}
                    height={64}
                    className={`w-full h-full object-contain ${
                      challenge.isUnlocked || challenge.isEarned ? '' : 'grayscale'
                    }`}
                  />
                </div>

                {/* Challenge Info */}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {challenge.name}
                  </h3>
                  <p className="text-gray-600 mb-2">
                    {challenge.description}
                  </p>
                  <div className="flex items-center">
                    <span className={`mr-2 ${
                      challenge.isUnlocked 
                        ? 'text-green-600' 
                        : challenge.isEarned 
                          ? 'text-orange-600' 
                          : 'text-gray-400'
                    }`}>
                      {challenge.isUnlocked 
                        ? '✅' 
                        : challenge.isEarned 
                          ? '🏆' 
                          : '🔒'
                      }
                    </span>
                    <span className={`text-sm font-medium ${
                      challenge.isUnlocked 
                        ? 'text-green-600' 
                        : challenge.isEarned 
                          ? 'text-orange-600' 
                          : 'text-gray-500'
                    }`}>
                      {challenge.isUnlocked 
                        ? 'Unlocked' 
                        : challenge.isEarned 
                          ? 'Earned - Claim Now!' 
                          : 'Locked'
                      }
                    </span>
                  </div>
                </div>

                {/* Arrow Icon */}
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Challenge Details Modal */}
      {showModal && selectedChallenge && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#2AC3F4] to-[#29B6F6] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  {selectedChallenge.name}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Badge Display */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden mb-4 bg-transparent flex items-center justify-center">
                  <Image
                    src={`/badges/${selectedChallenge.badgeId}.png`}
                    alt={selectedChallenge.name}
                    width={80}
                    height={80}
                    className={`w-full h-full object-contain ${
                      selectedChallenge.isUnlocked || selectedChallenge.isEarned ? '' : 'grayscale'
                    }`}
                  />
                </div>
                <p className="text-gray-600">
                  {selectedChallenge.description}
                </p>
              </div>

              {/* Requirements */}
              {selectedChallenge.requirements && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-[#2AC3F4] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Requirements
                  </h3>
                  <ul className="space-y-2">
                    {selectedChallenge.requirements.map((req, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-[#2AC3F4] rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span className="text-gray-700">{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tips */}
              {selectedChallenge.tips && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 text-[#2AC3F4] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Tips
                  </h3>
                  <ul className="space-y-2">
                    {selectedChallenge.tips.map((tip, index) => (
                      <li key={index} className="flex items-start">
                        <div className="w-2 h-2 bg-[#2AC3F4] rounded-full mt-2 mr-3 flex-shrink-0"></div>
                        <span className="text-gray-700">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 border-t bg-gray-50">
              {selectedChallenge.isEarned && !selectedChallenge.isUnlocked && (
                <button
                  onClick={async () => {
                    const success = await claimBadge(selectedChallenge.id);
                    if (success) {
                      setShowModal(false);
                      // You could add a toast notification here
                    }
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors mb-3"
                >
                  Claim Badge
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="w-full bg-[#2AC3F4] hover:bg-[#29B6F6] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
