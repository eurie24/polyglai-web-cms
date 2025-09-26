'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Tesseract from 'tesseract.js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import CustomDialog from '../../src/components/CustomDialog';
import { useCustomDialog } from '../../src/hooks/useCustomDialog';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';
import { azureSpeechService } from '../services/azure-speech-service';
import { MicrosoftTranslatorService } from '../services/microsoft-translator-service';
import { ProfanityFilterService } from '../../src/services/profanityFilterService';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';
// duplicate imports removed

// Simple in-memory cache for Firestore data
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: unknown, ttl: number = 5 * 60 * 1000) => {
  cache.set(key, { data, timestamp: Date.now(), ttl });
};

// Helper function to get accent information for pronunciation assessment
const getAccentInfo = (languageCode: string): string => {
  const accentMap: Record<string, string> = {
    'english': 'en-US (US accent)',
    'mandarin': 'zh-CN (Simplified)',
    'japanese': 'ja-JP (Japan)',
    'spanish': 'es-ES (Spain)',
    'korean': 'ko-KR (South Korea)',
  };
  
  return accentMap[languageCode.toLowerCase()] || '';
};

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
      const characters = data?.[level.toLowerCase()] as unknown[] | undefined;
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

// Skeleton loading components
const SkeletonCard = () => (
  <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
    <div className="h-8 bg-gray-200 rounded w-1/2"></div>
  </div>
);

const SkeletonStats = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {[1, 2, 3, 4].map((i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// Extend Window interface for Speech Recognition (keeping for compatibility)
declare global {
  interface Window {
    webkitSpeechRecognition: unknown;
    SpeechRecognition: unknown;
  }
}

type UserProfile = {
  name: string;
  email: string;
  preferredLanguage: string;
  uid: string;
  avatarUrl?: string;
  createdAt?: unknown;
};

// Helper function to format joined date text
const getJoinedDateText = (createdAt: unknown) => {
  if (!createdAt) return 'Joined recently';

  try {
    // Handle different Timestamp formats from Firestore
    let createdDate: Date;
    
    const createdAtAsAny = createdAt as { toDate?: () => Date; seconds?: number };
    if (createdAtAsAny.toDate && typeof createdAtAsAny.toDate === 'function') {
      // Firestore Timestamp object
      createdDate = createdAtAsAny.toDate();
    } else if (createdAtAsAny.seconds) {
      // Firestore Timestamp with seconds property
      createdDate = new Date(createdAtAsAny.seconds * 1000);
    } else if (typeof createdAt === 'string') {
      createdDate = new Date(createdAt);
    } else {
      createdDate = new Date(createdAt as string | number);
    }

    const now = new Date();
    const differenceInMs = now.getTime() - createdDate.getTime();
    const differenceInDays = Math.floor(differenceInMs / (1000 * 60 * 60 * 24));

    // Format the date in a user-friendly way
    if (differenceInDays < 1) {
      return 'Joined today';
    } else if (differenceInDays === 1) {
      return 'Joined yesterday';
    } else if (differenceInDays < 30) {
      return `Joined ${differenceInDays} days ago`;
    } else if (differenceInDays < 365) {
      const months = Math.floor(differenceInDays / 30);
      if (months === 1) {
        return 'Joined 1 month ago';
      } else {
        return `Joined ${months} months ago`;
      }
    } else {
      const years = Math.floor(differenceInDays / 365);
      if (years === 1) {
        return 'Joined 1 year ago';
      } else {
        return `Joined ${years} years ago`;
      }
    }
  } catch (error) {
    console.error('Error formatting joined date:', error);
    return 'Joined recently';
  }
};

function UserDashboardContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('english');
  const [languagePoints, setLanguagePoints] = useState(0);
  const [usageStats, setUsageStats] = useState<{ streakDays: number; lessonsCompleted: number; assessmentCount: number; totalPoints: number }>({ streakDays: 0, lessonsCompleted: 0, assessmentCount: 0, totalPoints: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [beginnerAssessmentCount, setBeginnerAssessmentCount] = useState(0);
  const [intermediateAssessmentCount, setIntermediateAssessmentCount] = useState(0);
  const [beginnerTotalItems, setBeginnerTotalItems] = useState(0);
  const [intermediateTotalItems, setIntermediateTotalItems] = useState(0);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Badge state
  const [userBadges, setUserBadges] = useState<Record<string, boolean>>({});
  const [badgeLoading, setBadgeLoading] = useState(true);
  
  // Custom dialog state
  const { dialogState, showConfirm, showError, showInfo, showSuccess, hideDialog } = useCustomDialog();
  
  // Translation state
  const [translationMode, setTranslationMode] = useState('text');
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [transliterationText, setTransliterationText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [characterLimit] = useState(100);
  const [showSourceLangSelector, setShowSourceLangSelector] = useState(false);
  const [showTargetLangSelector, setShowTargetLangSelector] = useState(false);
  // Remove duplicate hook usage; showError already available above
  
  // File translation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_fileTranslationResult, setFileTranslationResult] = useState('');
  const [fileTranslatedText, setFileTranslatedText] = useState('');
  const [fileTransliterationText, setFileTransliterationText] = useState('');

  const [featuredLanguage, setFeaturedLanguage] = useState<{ id: string; name: string; flag: string } | null>(null);
  const [otherLanguages, setOtherLanguages] = useState<{ id: string; name: string; flag: string }[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<{ id: string; name: string; flag: string } | null>(null);
  
  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('/updated avatars/3.svg');
  const normalizeAssetPath = (p?: string): string => {
    if (!p) return '';
    return p.startsWith('assets/') ? `/${p.replace(/^assets\//, '')}` : p;
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Speech recognition state
  const [speechRecognition, setSpeechRecognition] = useState<unknown | null>(null);
  const [speechStatus, setSpeechStatus] = useState<string>('');
  const [speechFailed, setSpeechFailed] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Language mappings
  const languageMap: { [key: string]: { code: string; flag: string } } = {
    'English': { code: 'en', flag: '/flags/usa_icon.png' },
    'Español': { code: 'es', flag: '/flags/spain_icon.png' },
    'Mandarin': { code: 'zh-cn', flag: '/flags/china_icon.png' },
    'Nihongo': { code: 'ja', flag: '/flags/japan_icon.png' },
    'Hangugeo': { code: 'ko', flag: '/flags/skorea_icon.png' },
  };

  const languages = Object.keys(languageMap);

  // Preferred locales for Text-to-Speech per app language
  const ttsLanguageMap: Record<string, string> = {
    English: 'en-US',
    Español: 'es-ES',
    Mandarin: 'zh-CN',
    Nihongo: 'ja-JP',
    Hangugeo: 'ko-KR',
  };

  // OCR language codes for Tesseract
  const ocrLanguageMap: Record<string, string> = {
    English: 'eng',
    Español: 'spa',
    Mandarin: 'chi_sim',
    Nihongo: 'jpn',
    Hangugeo: 'kor',
  };

  // LibreTranslate language codes
  const libreLangMap: Record<string, string> = {
    English: 'en',
    Español: 'es',
    Mandarin: 'zh',
    Nihongo: 'ja',
    Hangugeo: 'ko',
  };

  // Reverse mapping from language codes to display names
  const codeToLanguageName: Record<string, string> = {
    'en': 'English',
    'es': 'Español',
    'zh-cn': 'Mandarin',
    'ja': 'Nihongo',
    'ko': 'Hangugeo',
  };

  // Level Up language data
  const levelUpLanguages = useMemo(() => [
    {
      name: 'ENGLISH',
      flag: '/flags/Usa.svg',
      code: 'english',
    },
    {
      name: 'MANDARIN',
      flag: '/flags/China.svg',
      code: 'mandarin',
    },
    {
      name: 'HANGUGEO',
      flag: '/flags/Korea.svg',
      code: 'korean',
    },
    {
      name: 'NIHONGO',
      flag: '/flags/Japan.svg',
      code: 'japanese',
    },
    {
      name: 'ESPAÑOL',
      flag: '/flags/Spain.svg',
      code: 'spanish',
    },
  ], []);
  
  const router = useRouter();

  // Load user badges from Firestore
  const loadUserBadges = useCallback(async (userId: string) => {
    try {
      setBadgeLoading(true);
      
      const badgeCacheKey = `badges_${userId}`;
      const cachedBadges = getCachedData(badgeCacheKey);
      
      if (cachedBadges && (cachedBadges as { data: unknown }).data) {
        setUserBadges((cachedBadges as { data: Record<string, boolean> }).data);
        setBadgeLoading(false);
        return;
      }
      
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
      
      // Cache badges for 5 minutes
      setCachedData(badgeCacheKey, badgeStatus, 5 * 60 * 1000);
      
      console.log('Loaded user badges:', badgeStatus);
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
        'legend_of_polyglai': false
      });
    } finally {
      setBadgeLoading(false);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      setLoading(true);

      // Load essential data in parallel for faster initial render with caching
      const userCacheKey = `user_${userId}`;
      const profileCacheKey = `profile_${userId}`;
      
      const [userDoc, profileDoc] = await Promise.all([
        (async () => {
          const cached = getCachedData(userCacheKey);
          if (cached) return cached;
          const userDocResult = await getDoc(doc(db, 'users', userId));
          setCachedData(userCacheKey, userDocResult, 2 * 60 * 1000); // 2 minutes cache
          return userDocResult;
        })(),
        (async () => {
          const cached = getCachedData(profileCacheKey);
          if (cached) return cached;
          const profileDocResult = await getDoc(doc(db, 'users', userId, 'profile', 'info'));
          setCachedData(profileCacheKey, profileDocResult, 2 * 60 * 1000); // 2 minutes cache
          return profileDocResult;
        })()
      ]);

      let profile: UserProfile | null = null;
      let prefLang = 'english';

      // Check main user document first
      if ((userDoc as { exists: () => boolean }).exists()) {
        const userData = (userDoc as { data: () => Record<string, unknown> }).data();
        const rawPreferredLanguage = (userData.preferredLanguage as string) || 'english';
        profile = {
          name: (userData.name as string) || (userData.displayName as string) || 'User',
          email: (userData.email as string) || '',
          preferredLanguage: rawPreferredLanguage,
          uid: userId,
          avatarUrl: normalizeAssetPath((userData.avatarUrl as string) || (userData.avatarURL as string) || (userData.photoURL as string) || '/updated avatars/3.svg'),
          createdAt: userData.createdAt
        };
        prefLang = mapDisplayNameToCode(rawPreferredLanguage);
      }
      // Fallback to profile subcollection
      else if ((profileDoc as { exists: () => boolean }).exists()) {
        const profileData = (profileDoc as { data: () => Record<string, unknown> }).data();
        const rawPreferredLanguage = (profileData.preferredLanguage as string) || 'english';
        profile = {
          name: (profileData.name as string) || 'User',
          email: (profileData.email as string) || '',
          preferredLanguage: rawPreferredLanguage,
          uid: userId,
          avatarUrl: normalizeAssetPath((profileData.avatarUrl as string) || (profileData.avatarURL as string) || '/updated avatars/3.svg'),
          createdAt: profileData.createdAt
        };
        prefLang = mapDisplayNameToCode(rawPreferredLanguage);
      }

      // Set profile and preferred language immediately for faster UI render
      setUserProfile(profile);
      setPreferredLanguage(prefLang);

      // Load usage stats in parallel with other data
      const loadUsageStats = async () => {
        try {
          const usageCacheKey = `usage_${userId}`;
          const cachedUsage = getCachedData(usageCacheKey);
          
          if (cachedUsage && (cachedUsage as { data: unknown }).data) {
            const data = (cachedUsage as { data: Record<string, unknown> }).data;
            const streakDays = Number((data.streakDays as number | undefined) ?? (data.currentStreak as number | undefined) ?? 0);
            const lessonsCompleted = Number((data.lessonsCompleted as number | undefined) ?? (data.totalLessons as number | undefined) ?? 0);
            const totalPoints = Number(data.totalPoints || 0);
            const assessmentCount = Number(data.assessmentCount || 0);
            setUsageStats({ streakDays, lessonsCompleted, assessmentCount, totalPoints });
            return;
          }
          
          // Try both usage document paths in parallel
          const [usageDocLower, usageDocUpper] = await Promise.all([
            getDoc(doc(db, 'users', userId, 'stats', 'usage')),
            getDoc(doc(db, 'users', userId, 'stats', 'Usage'))
          ]);
          
          const usageDoc = usageDocLower.exists() ? usageDocLower : usageDocUpper;
          
          if (usageDoc.exists()) {
            const data = usageDoc.data() as { [key: string]: unknown };
            const streakDays = Number((data.streakDays as number | undefined) ?? (data.currentStreak as number | undefined) ?? 0);
            const lessonsCompleted = Number((data.lessonsCompleted as number | undefined) ?? (data.totalLessons as number | undefined) ?? 0);
            
            // Get base points and language data in parallel
            const [basePointsDoc, langsSnap] = await Promise.all([
              getDoc(doc(db, 'users', userId)),
              getDocs(collection(db, 'users', userId, 'languages'))
            ]);
            
            const basePoints = basePointsDoc.exists() ? Number((basePointsDoc.data() as { totalPoints?: number }).totalPoints ?? 0) : 0;
            
            // Calculate word trainer points
            let wordTrainerPoints = 0;
            const languageIds: string[] = [];
            langsSnap.forEach(l => {
              const d = l.data() as Record<string, unknown>;
              const p = d.points;
              const n = typeof p === 'number' ? p : (typeof p === 'string' ? parseInt(p, 10) : 0);
              wordTrainerPoints += (isNaN(n as number) ? 0 : (n as number));
              languageIds.push(l.id);
            });
            
            // Compute Lessons Passed using dynamic character counts
            let lessonsCompletedComputed = 0;
            try {
              for (const lang of languageIds) {
                for (const level of ['beginner', 'intermediate'] as const) {
                  try {
                    const assessmentsSnap = await getDocs(
                      collection(db, 'users', userId, 'languages', lang.toLowerCase(), 'assessmentsByLevel', level, 'assessments')
                    );
                    let completedAssessments = 0;
                    assessmentsSnap.forEach(d => {
                      const scoreVal = (d.data() as { score?: unknown }).score ?? 0;
                      const scoreNum = typeof scoreVal === 'number' ? scoreVal : (typeof scoreVal === 'string' ? parseInt(scoreVal, 10) : 0);
                      if (!isNaN(scoreNum) && scoreNum > 0) completedAssessments++;
                    });
                    
                    // Get the total number of characters/words available for this language and level
                    const totalAssessments = await getTotalAssessmentsForLevel(lang, level);
                    
                    // A lesson is completed when user has completed ALL available assessments with score > 0
                    if (completedAssessments >= totalAssessments && totalAssessments > 0) {
                      lessonsCompletedComputed++;
                    }
                  } catch {}
                }
              }
            } catch {}
            
            // Count assessments across all languages and levels (not just preferred language)
            let highScoreCount = 0;
            for (const lang of languageIds) {
              for (const level of ['beginner', 'intermediate'] as const) {
                try {
                  const assessmentsSnap = await getDocs(
                    collection(db, 'users', userId, 'languages', lang.toLowerCase(), 'assessmentsByLevel', level, 'assessments')
                  );
                  assessmentsSnap.forEach(d => {
                    const data = d.data() as Record<string, unknown>;
                    const scoreVal = data.score;
                    const scoreNum = typeof scoreVal === 'number' ? scoreVal : (typeof scoreVal === 'string' ? parseInt(scoreVal, 10) : 0);
                    if (!isNaN(scoreNum) && scoreNum >= 0) highScoreCount++;
                  });
                } catch {}
              }
            }
            
            const totalPoints = basePoints + wordTrainerPoints;
            const finalLessons = lessonsCompleted > 0 ? lessonsCompleted : lessonsCompletedComputed;
            const usageData = { streakDays, lessonsCompleted: finalLessons, assessmentCount: highScoreCount, totalPoints };
            setUsageStats(usageData);
            setCachedData(usageCacheKey, usageData, 1 * 60 * 1000); // 1 minute cache for usage stats
          } else {
            const defaultData = { streakDays: 0, lessonsCompleted: 0, assessmentCount: 0, totalPoints: 0 };
            setUsageStats(defaultData);
            setCachedData(usageCacheKey, defaultData, 1 * 60 * 1000);
          }
        } catch (e) {
          console.error('Error fetching usage stats:', e);
          setUsageStats({ streakDays: 0, lessonsCompleted: 0, assessmentCount: 0, totalPoints: 0 });
        }
      };

      // Start loading usage stats in background
      loadUsageStats();

      // Remove per-language points aggregation here; handled in usageStats above

      // Load assessment counts and character totals in background (non-blocking)
      const loadAssessmentData = async () => {
        try {
          const assessmentCacheKey = `assessments_${userId}_${prefLang}`;
          const cachedAssessment = getCachedData(assessmentCacheKey);
          
          if (cachedAssessment && (cachedAssessment as { data: unknown }).data) {
            const data = (cachedAssessment as { data: Record<string, unknown> }).data;
            setBeginnerAssessmentCount(Number(data.beginnerCount) || 0);
            setIntermediateAssessmentCount(Number(data.intermediateCount) || 0);
            setBeginnerTotalItems(Number(data.beginnerTotal) || 0);
            setIntermediateTotalItems(Number(data.intermediateTotal) || 0);
            setLanguagePoints(Number(data.assessmentPoints) || 0);
            return;
          }
          
          const [beginnerAssessments, intermediateAssessments, beginnerChars, intermediateChars] = await Promise.all([
            getDocs(collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsByLevel', 'beginner', 'assessments')),
            getDocs(collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsByLevel', 'intermediate', 'assessments')),
            getDocs(collection(db, 'languages', prefLang.toLowerCase(), 'characters', 'beginner', 'items')),
            getDocs(collection(db, 'languages', prefLang.toLowerCase(), 'characters', 'intermediate', 'items'))
          ]);

          let beginnerCount = 0;
          let intermediateCount = 0;
          let assessmentPoints = 0;

          beginnerAssessments.docs.forEach(doc => {
            const data = doc.data();
            const score = parseInt(data.score) || 0;
            if (score > 0) {
              beginnerCount++;
              assessmentPoints += score;
            }
          });

          intermediateAssessments.docs.forEach(doc => {
            const data = doc.data();
            const score = parseInt(data.score) || 0;
            if (score > 0) {
              intermediateCount++;
              assessmentPoints += score;
            }
          });

          const beginnerTotal = beginnerChars.docs.length;
          const intermediateTotal = intermediateChars.docs.length;

          const assessmentData = {
            beginnerCount,
            intermediateCount,
            beginnerTotal,
            intermediateTotal,
            assessmentPoints
          };

          setBeginnerAssessmentCount(beginnerCount);
          setIntermediateAssessmentCount(intermediateCount);
          setBeginnerTotalItems(beginnerTotal);
          setIntermediateTotalItems(intermediateTotal);
          setLanguagePoints(assessmentPoints);
          
          // Cache the assessment data for 3 minutes
          setCachedData(assessmentCacheKey, assessmentData, 3 * 60 * 1000);
        } catch (e) {
          console.error('Error fetching assessment data:', e);
          // Set defaults
          setBeginnerAssessmentCount(0);
          setIntermediateAssessmentCount(0);
          setBeginnerTotalItems(0);
          setIntermediateTotalItems(0);
          setLanguagePoints(0);
        }
      };

      // Start loading assessment data in background
      loadAssessmentData();
      
      // Set target language to user's preferred language
      if (profile) {
        setTargetLanguage(profile.preferredLanguage);
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
          router.push('/admin/login');
          return;
        }
        loadUserData(user.uid);
        try {
          const profileDocRef = doc(db, 'users', user.uid, 'profile', 'info');
          const mainDocRef = doc(db, 'users', user.uid);
          const unsubMain = onSnapshot(mainDocRef, (snap) => {
            const d = snap.data() as { avatarUrl?: string; name?: string } | undefined;
            if (d && (d.avatarUrl || d.name)) {
              setUserProfile(prev => prev ? ({ ...prev, name: d.name || prev.name, avatarUrl: d.avatarUrl || prev.avatarUrl }) : prev);
            }
          });
          const unsubProfile = onSnapshot(profileDocRef, (snap) => {
            if (snap.exists()) {
              const d = snap.data() as { avatarUrl?: string; name?: string };
              if (d && (d.avatarUrl || d.name)) {
                setUserProfile(prev => prev ? ({ ...prev, name: d.name || prev.name, avatarUrl: d.avatarUrl || prev.avatarUrl }) : prev);
              }
            }
          });
          (window as { __polyglaiUserListeners?: unknown[] }).__polyglaiUserListeners = [unsubMain, unsubProfile];
        } catch {}
        // Load badges lazily after initial data load
        setTimeout(() => loadUserBadges(user.uid), 1000);
      } else {
        router.push('/login');
      }
    });
    return () => {
      try {
        const arr: Array<() => void> | undefined = (window as { __polyglaiUserListeners?: Array<() => void> }).__polyglaiUserListeners;
        if (Array.isArray(arr)) arr.forEach((fn) => { try { fn(); } catch {} });
      } catch {}
      unsubscribe();
    };
  }, [router, loadUserData, loadUserBadges]);

  // Load available TTS voices (some browsers populate asynchronously)
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices && voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  // Setup Level Up languages based on user's preferred language
  const setupLevelUpLanguages = useCallback(() => {
    const userPrefLanguage = preferredLanguage.toLowerCase();
    const featured = levelUpLanguages.find(lang => lang.code === userPrefLanguage) || levelUpLanguages[0];
    const others = levelUpLanguages.filter(lang => lang.code !== userPrefLanguage);
    
    setFeaturedLanguage(featured ? { id: featured.code, name: featured.name, flag: featured.flag } : null);
    setOtherLanguages(others.map(lang => ({ id: lang.code, name: lang.name, flag: lang.flag })));
  }, [preferredLanguage, levelUpLanguages]);

  // Initialize active section from query param on first render
  useEffect(() => {
    const section = (searchParams?.get('section') || '').toLowerCase();
    if (section === 'level-up' || section === 'translate' || section === 'profile' || section === 'dashboard') {
      setActiveSection(section);
    } else {
      // If no section parameter, default to dashboard and update URL
      setActiveSection('dashboard');
      const url = new URL(window.location.href);
      url.searchParams.set('section', 'dashboard');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when activeSection changes
  useEffect(() => {
    if (activeSection && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('section', activeSection);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeSection]);

  // Setup Level Up languages when preferred language changes
  useEffect(() => {
    setupLevelUpLanguages();
  }, [preferredLanguage, setupLevelUpLanguages]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSourceLangSelector(false);
      setShowTargetLangSelector(false);
    };

    if (showSourceLangSelector || showTargetLangSelector) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSourceLangSelector, showTargetLangSelector]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognition) {
        (speechRecognition as { stop: () => void }).stop();
      }
    };
  }, [speechRecognition]);

  

  const getLanguageDisplayName = (languageCode: string) => {
    const languageNames: { [key: string]: string } = {
      'english': 'English',
      'mandarin': 'Mandarin',
      'spanish': 'Español',
      'japanese': 'Nihongo',
      'korean': 'Hangugeo',
    };
    return languageNames[languageCode.toLowerCase()] || 'English';
  };

  // Helper method to map display names to language codes for backward compatibility (matching Flutter version)
  const mapDisplayNameToCode = (languageValue: string) => {
    if (!languageValue) return 'english';
    
    const normalized = languageValue.trim();
    
    // Check if it's already a code (lowercase)
    const validCodes = ['english', 'mandarin', 'spanish', 'japanese', 'korean'];
    if (validCodes.includes(normalized.toLowerCase())) {
      return normalized.toLowerCase();
    }
    
    // Map display names to codes
    const displayNameToCode: { [key: string]: string } = {
      'English': 'english',
      'Mandarin': 'mandarin', 
      'Español': 'spanish',
      'Nihongo': 'japanese',
      'Hangugeo': 'korean',
    };
    
    return displayNameToCode[normalized] || 'english';
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Edit profile functions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditProfileOpen = () => {
    if (userProfile) {
      setEditName(userProfile.name || '');
      setEditAvatar(normalizeAssetPath(userProfile.avatarUrl || '/updated avatars/3.svg'));
    }
    setShowEditProfile(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditProfileSave = async () => {
    if (!userProfile?.uid) return;
    
    setIsSavingProfile(true);
    try {
      // Update user profile in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        name: editName.trim(),
        avatarUrl: editAvatar,
        avatarURL: editAvatar,
        lastLoginAt: new Date()
      });

      // Also persist to profile/info subdocument for backward compatibility
      const profileInfoRef = doc(db, 'users', userProfile.uid, 'profile', 'info');
      await setDoc(profileInfoRef, {
        name: editName.trim(),
        avatarUrl: editAvatar,
        avatarURL: editAvatar,
        email: userProfile.email || '',
        updatedAt: new Date()
      }, { merge: true });

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        name: editName.trim(),
        avatarUrl: editAvatar
      } : null);

      setShowEditProfile(false);
      
      // Show success message
      showSuccess('Profile Updated', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      showError('Update Failed', 'Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleEditProfileCancel = () => {
    setShowEditProfile(false);
    setEditName('');
    setEditAvatar('/updated avatars/3.svg');
  };

  // Translation functions
  const translateText = async () => {
    if (!inputText.trim()) return;
    
    // Check for inappropriate content first
    const contentValidation = ProfanityFilterService.validateContent(inputText, {
      context: 'translation',
      language: sourceLanguage,
      recordProfanity: true
    });
    if (!contentValidation.isValid) {
      // Show error dialog for profanity content
      showConfirm(
        'Content Blocked',
        contentValidation.errorMessage || 'Content validation failed',
        () => {
          // Clear the output fields when content is blocked
          setOutputText('');
          setTransliterationText('');
        },
        () => {
          // Focus back on text input
          const textInput = document.querySelector('textarea[placeholder="Enter text to translate"]') as HTMLTextAreaElement;
          if (textInput) {
            textInput.focus();
          }
        },
        'OK'
      );
      return;
    }
    
    setIsTranslating(true);
    try {
      // Check if Microsoft Translator is configured
      if (!MicrosoftTranslatorService.isConfigured()) {
        throw new Error('Microsoft Translator not configured. Please set NEXT_PUBLIC_AZURE_TRANSLATOR_SUBSCRIPTION_KEY and NEXT_PUBLIC_AZURE_TRANSLATOR_REGION in your .env.local file');
      }

      // Get language codes from the language names
      const sourceLangCode = languageMap[sourceLanguage]?.code || 'en';
      const targetLangCode = languageMap[targetLanguage]?.code || 'en';

      // Use combined translation and transliteration for supported languages
      if (MicrosoftTranslatorService.supportsTransliteration(targetLangCode)) {
        const result = await MicrosoftTranslatorService.translateWithTransliteration({
          text: inputText,
          fromLanguage: sourceLangCode,
          toLanguage: targetLangCode,
        });

        setOutputText(result.translation);
        setTransliterationText(result.transliteration || '');
      } else {
        // For languages that don't support transliteration, just translate
        const translatedText = await MicrosoftTranslatorService.translateText({
          text: inputText,
          fromLanguage: sourceLangCode,
          toLanguage: targetLangCode,
        });

        setOutputText(translatedText);
        setTransliterationText(''); // Clear any previous transliteration
      }
      
    } catch (error) {
      console.error('Translation error:', error);
      // Show error to user
      showError('Translation Failed', `${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsTranslating(false);
    }
  };



  // Check if browser supports speech recognition
  // Helper function to check if Azure Speech Service is supported
  const isSpeechRecognitionSupported = () => {
    const isConfigured = azureSpeechService.isConfigured();
    if (!isConfigured) {
      console.log('❌ Azure Speech Service not configured. Check your .env.local file.');
    }
    return isConfigured;
  };

  // Test Azure Speech Service capability
  const testSpeechRecognitionCapability = async (): Promise<boolean> => {
    try {
      console.log('Testing Azure Speech Service connection...');
      const isConnected = await azureSpeechService.testConnection();
      console.log('Azure Speech Service connection test result:', isConnected);
      return isConnected;
    } catch (error) {
      console.log('Azure Speech Service test failed:', error);
      return false;
    }
  };



  // Alternative speech recognition using MediaRecorder API
  const startAlternativeSpeechRecognition = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Request microphone access
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            const mediaRecorder = new MediaRecorder(stream);
            const audioChunks: Blob[] = [];
            
            mediaRecorder.ondataavailable = (event) => {
              audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
              // Stop all tracks
              stream.getTracks().forEach(track => track.stop());
              
              // Try to convert audio to text using external service
              try {
                const text = await convertAudioToText();
                resolve(text);
              } catch {
                // If conversion fails, just return success message
                resolve('Audio recorded successfully. Speech-to-text conversion failed, but you can type manually.');
              }
            };
            
            // Start recording
            mediaRecorder.start();
            
            // Update status with manual stop option
            setSpeechStatus('Recording... Click microphone again to stop');
            
            // Store the mediaRecorder instance so user can stop it manually
            (window as { currentMediaRecorder?: MediaRecorder }).currentMediaRecorder = mediaRecorder;
            
            // Auto-stop after 15 seconds if user doesn't stop manually
            setTimeout(() => {
              if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                (window as { currentMediaRecorder?: MediaRecorder }).currentMediaRecorder = undefined;
              }
            }, 15000);
            
          })
          .catch(error => {
            reject(new Error('Microphone access denied: ' + error.message));
          });
          
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error('Alternative speech recognition failed: ' + errorMessage));
      }
    });
  };

  // Convert audio to text using external service
  const convertAudioToText = async (): Promise<string> => {
    try {
      // Try using Web Speech API with a different approach
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      if (SpeechRecognition) {
        return new Promise((resolve, reject) => {
          const recognition = (new (SpeechRecognition as unknown as { new(): unknown })()) as {
            lang: string;
            continuous: boolean;
            interimResults: boolean;
            maxAlternatives: number;
            state: string;
            onresult: (event: { results: unknown }) => void;
            onerror: (event: { error?: string }) => void;
            onend: () => void;
            start: () => void;
            stop: () => void;
          };
          recognition.lang = 'en-US';
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          
          recognition.onresult = (event: { results: unknown }) => {
            const results = event.results as unknown[] || [];
            const firstResult = results[0] as unknown[] || [];
            const firstAlternative = firstResult[0] as { transcript?: string };
            resolve(firstAlternative?.transcript ?? '');
          };
          
          recognition.onerror = (event: { error?: string }) => {
            reject(new Error('Speech recognition failed: ' + event.error));
          };
          
          recognition.onend = () => {
            reject(new Error('Speech recognition ended without result'));
          };
          
          // Try to start recognition
          try {
            recognition.start();
            // Give it a short time to work
            setTimeout(() => {
              if (recognition.state === 'starting' || recognition.state === 'recording') {
                recognition.stop();
              }
            }, 5000);
          } catch {
            reject(new Error('Failed to start speech recognition'));
          }
        });
      } else {
        throw new Error('Speech recognition not available');
      }
    } catch (error) {
      throw new Error('Audio conversion failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };



  const startListening = async () => {
    // Check if Azure Speech Service is configured
    if (!isSpeechRecognitionSupported()) {
      showError('Azure Speech Not Configured', 'Please create .env.local with Azure credentials, then restart. See AZURE_SETUP.md.');
      return;
    }
    
    // Check if we've already failed speech recognition and should use fallback
    if (speechFailed) {
      showConfirm(
        'Speech Recognition Failed',
        'Speech recognition previously failed on this device. This often happens when Azure Speech Service is not accessible.\n\nWould you like to try speech recognition again, or would you prefer to use the text input instead?',
        () => {
          // Reset the failed state and try again
          setSpeechFailed(false);
        },
        () => {
          // Focus on text input
          const textInput = document.querySelector('textarea[placeholder="Enter text to translate"]') as HTMLTextAreaElement;
          if (textInput) {
            textInput.focus();
          }
        },
        'Try Again',
        'Use Text Input'
      );
      return;
    }

    // Test Azure Speech Service capability first
    setSpeechStatus('Testing Azure Speech Service...');
    const isCapable = await testSpeechRecognitionCapability();
    
    if (!isCapable) {
      console.log('Azure Speech Service capability test failed - offering alternative methods');
      
      // Offer user choice between alternative methods
      showConfirm(
        'Azure Speech Service Not Accessible',
        'Azure Speech Service is not accessible on this device.\n\nWould you like to try an alternative recording method, or would you prefer to type your text manually?',
        async () => {
          // Try alternative speech recognition
          try {
            setSpeechStatus('Starting alternative recording...');
            const result = await startAlternativeSpeechRecognition();
          
            // Show result
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50 max-w-sm';
            notification.innerHTML = `
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium">Alternative Recording Complete</p>
                  <p class="text-sm mt-1">${result}</p>
                  <button onclick="this.parentElement.parentElement.parentElement.remove()" class="mt-2 text-green-600 hover:text-green-500 text-sm font-medium">Dismiss</button>
                </div>
              </div>
            `;
            document.body.appendChild(notification);
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
              if (notification.parentElement) {
                notification.remove();
              }
            }, 8000);
            
          } catch (error) {
            console.error('Alternative speech recognition failed:', error);
            setSpeechStatus('Alternative method failed');
            
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-sm';
            notification.innerHTML = `
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium">Alternative Method Failed</p>
                  <p class="text-sm mt-1">${error instanceof Error ? error.message : 'Unknown error'}</p>
                  <button onclick="this.parentElement.parentElement.parentElement.remove()" class="mt-2 text-red-600 hover:text-red-500 text-sm font-medium">Dismiss</button>
                </div>
              </div>
            `;
            document.body.appendChild(notification);
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
              if (notification.parentElement) {
                notification.remove();
              }
            }, 8000);
          }
        },
        () => {
          // User chose text input
          setSpeechFailed(true);
          setSpeechStatus('');
          
          // Focus on text input
          setTimeout(() => {
              const textInput = document.querySelector('textarea[placeholder="Enter text to translate"]') as HTMLTextAreaElement;
              if (textInput) {
                textInput.focus();
              }
          }, 500);
        },
        'Try Alternative',
        'Use Text Input'
      );
      
      return;
    }

    // Start Azure Speech Service
    if (!isListening) {
      setIsListening(true);
      setSpeechStatus('Initializing Azure Speech Service...');
      
      try {
      // Set language based on source language
      const speechLanguageMap = {
        'English': 'en-US',
        'Español': 'es-ES', 
        'Mandarin': 'zh-CN',
        'Nihongo': 'ja-JP',
        'Hangugeo': 'ko-KR'
      };
      
        const selectedLang = speechLanguageMap[sourceLanguage as keyof typeof speechLanguageMap] || 'en-US';
        console.log('Starting Azure Speech Service with language:', selectedLang);
        
        // Start Azure Speech Service
        const stopRecording = await azureSpeechService.startSpeechRecognition(
          selectedLang,
          (text: string) => {
            // Success callback
            console.log('Azure Speech Service result:', text);
          setSpeechStatus('Processing...');

          // Limit to character limit
            const limitedText = text.length > characterLimit
              ? text.substring(0, characterLimit)
              : text;
            
            console.log('Transcript:', text);
            console.log('Limited text:', limitedText);

          setInputText(limitedText);
          setIsListening(false);
          setSpeechRecognition(null);
          setSpeechStatus('');
          },
          (error: string) => {
            // Error callback
            console.error('Azure Speech Service error:', error);
            setSpeechStatus('Error: ' + error);
          setIsListening(false);
          setSpeechRecognition(null);
            setSpeechFailed(true);
          },
          (status: string) => {
            // Status callback - don't change listening state here
            console.log('Azure status update:', status);
            setSpeechStatus(status);
            
            // Keep recording state true until we get a result or error
            if (status.includes('Recording')) {
              setIsListening(true);
            }
          }
        );
        
        // Store the stop function
        setSpeechRecognition({ stop: stopRecording });
        
        // Don't set listening to false here - let the status callbacks handle it
        console.log('Azure Speech Service started successfully');
        
      } catch (error) {
        console.error('Failed to start Azure Speech Service:', error);
        setSpeechStatus('Failed to start recording. Please try again.');
        setIsListening(false);
        setSpeechRecognition(null);
        setSpeechFailed(true);
      }
    } else {
      // Stop current recording if already listening
      if (speechRecognition && (speechRecognition as { stop?: () => void }).stop) {
        (speechRecognition as { stop: () => void }).stop();
      setSpeechRecognition(null);
      setSpeechStatus('');
      }
      setIsListening(false);
    }
  };

  const speakText = (text: string) => {
    if (!text || !text.trim()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showInfo('Not Supported', 'Text-to-speech is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;

    // Stop any current speech first to avoid queueing
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Choose locale and best voice for target language
    const locale = ttsLanguageMap[targetLanguage] || 'en-US';
    utterance.lang = locale;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to select a voice matching the locale
    const pickBestVoice = () => {
      const voices = availableVoices.length > 0 ? availableVoices : synth.getVoices();
      if (!voices || voices.length === 0) return null;

      // Exact match first
      let voice = voices.find(v => v.lang?.toLowerCase() === locale.toLowerCase());
      if (voice) return voice;

      // Fallback: match language prefix (e.g., zh-, es-)
      const langPrefix = locale.split('-')[0].toLowerCase();
      voice = voices.find(v => v.lang?.toLowerCase().startsWith(langPrefix));
      return voice || null;
    };

    const selectedVoice = pickBestVoice();
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onerror = () => {
      console.error('TTS utterance error');
      setIsSpeaking(false);
    };
    utterance.onend = () => setIsSpeaking(false);

    // If voices are not yet loaded, wait briefly and try once more
    if ((!availableVoices || availableVoices.length === 0) && synth.getVoices().length === 0) {
      setTimeout(() => {
        const retryVoices = synth.getVoices();
        if (retryVoices && retryVoices.length > 0) {
          const retryVoice = retryVoices.find(v => v.lang?.toLowerCase() === locale.toLowerCase())
            || retryVoices.find(v => v.lang?.toLowerCase().startsWith(locale.split('-')[0].toLowerCase()))
            || null;
          if (retryVoice) utterance.voice = retryVoice;
        }
        setIsSpeaking(true);
        synth.speak(utterance);
      }, 250);
      return;
    }

    setIsSpeaking(true);
    synth.speak(utterance);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Allow PDF again (handled via server API)
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        showError('File Too Large', 'File size exceeds 5MB limit');
        return;
      }
      
      setSelectedFile(file);
      setFileTranslationResult('');
      setFileTranslatedText('');
      setFileTransliterationText('');
      
      // Auto-detect language from the file content
      try {
        const extractedText = await extractTextFromFile(file);
        if (extractedText && extractedText.trim().length > 0) {
          await detectAndSetSourceLanguage(extractedText);
        }
      } catch (error) {
        console.warn('Failed to detect language from file:', error);
        // Continue without language detection
      }
    }
  };

  const translateFile = async () => {
    if (!selectedFile) return;
    
    setIsTranslating(true);
    setFileTranslationResult(''); // Clear previous results
    setFileTranslatedText('');
    setFileTransliterationText('');
    
    try {
      // Extract text from file
      const rawText = await extractTextFromFile(selectedFile);

      if (!rawText || rawText.trim().length === 0) {
        showInfo('No Text Detected', 'If you uploaded an image, please ensure it contains clear text.');
        return;
      }

      // Check for inappropriate content in extracted text
      const contentValidation = ProfanityFilterService.validateContent(rawText, {
        context: 'file_upload',
        language: sourceLanguage,
        recordProfanity: true
      });
      if (!contentValidation.isValid) {
        // Show error dialog for profanity content
        showConfirm(
          'Content Blocked',
          contentValidation.errorMessage || 'Content validation failed',
          () => {
            // Clear the file translation results when content is blocked
            setFileTranslationResult('');
            setFileTranslatedText('');
            setFileTransliterationText('');
          },
          () => {
            // Focus back on file input
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) {
              fileInput.focus();
            }
          },
          'OK'
        );
        return;
      }

      // Check if source and target languages are the same
      if (sourceLanguage === targetLanguage) {
        showInfo('Invalid Selection', 'Source and target languages cannot be the same.');
        return;
      }

      // Show translating message
      setFileTranslationResult('Translating...');
      
      // Get language codes from the language names
      const sourceLangCode = languageMap[sourceLanguage]?.code || 'en';
      const targetLangCode = languageMap[targetLanguage]?.code || 'en';
      
      let translatedText = '';
      let transliterationText = '';
      
      // Check if Microsoft Translator is configured
      if (MicrosoftTranslatorService.isConfigured()) {
        // Use Microsoft Translator with transliteration support
        if (MicrosoftTranslatorService.supportsTransliteration(targetLangCode)) {
          const result = await MicrosoftTranslatorService.translateWithTransliteration({
            text: rawText,
            fromLanguage: sourceLangCode,
            toLanguage: targetLangCode,
          });
          
          translatedText = result.translation;
          transliterationText = result.transliteration || '';
        } else {
          // For languages that don't support transliteration, just translate
          translatedText = await MicrosoftTranslatorService.translateText({
            text: rawText,
            fromLanguage: sourceLangCode,
            toLanguage: targetLangCode,
          });
        }
      } else {
        // Fallback to LibreTranslate/Google Translate if Microsoft Translator not configured
        translatedText = await translateViaLibre(rawText, sourceLanguage, targetLanguage);
      }
      
      // Store translated text and transliteration separately
      setFileTranslatedText(translatedText);
      setFileTransliterationText(transliterationText);
      setFileTranslationResult(translatedText); // Keep for download functionality
      
    } catch (error) {
      console.error('File translation error:', error);
      const errorMessage = (error as Error)?.message || 'Failed to translate the file.';
      
      // Show error message to user
      setFileTranslationResult(`Error: ${errorMessage}\n\nPlease try again or check your internet connection.`);
      showError('Operation Failed', errorMessage);
    } finally {
      setIsTranslating(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadTranslation = () => {
    if (!fileTranslatedText || !selectedFile) return;
    
    // Create a more descriptive filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `translated_${sourceLanguage}_to_${targetLanguage}_${timestamp}.txt`;
    
    // Include transliteration if available
    const content = fileTranslatedText + (fileTransliterationText ? `\n\nPronunciation: ${fileTransliterationText}` : '');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const swapLanguages = () => {
    const temp = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(temp);
    // Also swap the input and output text
    const tempText = inputText;
    setInputText(outputText);
    setOutputText(tempText);
    setTransliterationText('');
  };

  // Try translating text via LibreTranslate public instance; fallback to Google Translate if unavailable
  const translateViaLibre = async (text: string, source: string, target: string): Promise<string> => {
    try {
      const sourceCode = libreLangMap[source] || 'auto';
      const targetCode = libreLangMap[target] || 'en';
      
      // Try LibreTranslate first
      const resp = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: sourceCode, target: targetCode, format: 'text' }),
      });
      
      if (!resp.ok) throw new Error(`LibreTranslate API error: ${resp.status}`);
      
      const data = await resp.json();
      if (data && data.translatedText) {
        console.log('LibreTranslate successful');
        return data.translatedText as string;
      }
      throw new Error('No translatedText from LibreTranslate');
    } catch (error) {
      console.warn('LibreTranslate failed:', error);
      
      // Fallback to Google Translate
      try {
        return await translateViaGoogle(text, source, target);
      } catch (googleError) {
        console.error('Both LibreTranslate and Google Translate failed:', googleError);
        throw new Error('Translation failed. Please check your internet connection and try again.');
      }
    }
  };

  // Fallback translation using Google Translate
  const translateViaGoogle = async (text: string, source: string, target: string): Promise<string> => {
    try {
      const sourceCode = libreLangMap[source] || 'auto';
      const targetCode = libreLangMap[target] || 'en';
      
      // Use Google Translate API (free tier)
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Google Translate API error: ${response.status}`);
      
      const data = await response.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        console.log('Google Translate successful');
        return data[0].map((item: unknown[]) => item[0]).join('');
      }
      throw new Error('No translation from Google Translate');
    } catch (error) {
      console.error('Google Translate failed:', error);
      throw error;
    }
  };

  const extractTextFromImage = async (file: File, langHint: string): Promise<string> => {
    const lang = ocrLanguageMap[langHint] || 'eng';
    const { data } = await Tesseract.recognize(file, lang);
    const raw = (data.text || '').trim();
    // Heuristics to filter out random OCR garbage from images without text
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
    const words: Array<{ text?: string; confidence?: number }> = Array.isArray((data as unknown as Record<string, unknown>)?.words) ? 
      (data as unknown as Record<string, unknown>)?.words as Array<{ text?: string; confidence?: number }> : [];
    const highConfWordExists = words.some(w => (w?.confidence || 0) >= 70 && (w?.text || '').trim().length >= 2);
    const meaningful = raw
      // keep common unicode letter ranges (Latin-1, CJK, Hiragana/Katakana, Hangul) and digits/spaces
      .replace(/[^A-Za-z0-9\u00C0-\u017F\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\s]/g, '')
      .trim();
    const meaningfulChars = meaningful.replace(/\s+/g, '').length;
    if (meaningfulChars < 5 && !highConfWordExists) {
      return '';
    }
    if (confidence < 50 && !highConfWordExists) {
      return '';
    }
    return raw;
  };

  // Extract text content from a PDF file using pdf.js in the browser
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    // Use legacy build and disable worker to avoid CDN/CSP issues
    const pdfModule: unknown = await import('pdfjs-dist/legacy/build/pdf');
    const pdfjsLib: unknown = (pdfModule && (pdfModule as { default?: unknown }).default) ? (pdfModule as { default: unknown }).default : pdfModule;
    const loadingTask = (pdfjsLib as unknown as { getDocument: (params: { data: ArrayBuffer; useWorker: boolean }) => { promise: Promise<unknown> } }).getDocument({ data: arrayBuffer, useWorker: false });
    const pdf = (await loadingTask.promise) as { numPages: number; getPage: (pageNum: number) => { getTextContent: () => { items: Array<{ str?: string }> } } };
    // Enforce single-page PDFs only
    if (pdf.numPages > 1) {
      throw new Error('PDF not supported: more than 1 page. Please upload a single-page PDF.');
    }
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items || [])
        .map((item: { str?: string }) => (item && item.str ? item.str : ''))
        .join(' ');
      fullText += (pageNum > 1 ? '\n\n' : '') + pageText;
    }
    // Enforce 1000 character limit for PDF text
    if (fullText.trim().length > 1000) {
      throw new Error('PDF not supported: exceeds 1000 characters. Please upload a shorter PDF.');
    }
    return fullText.trim();
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      return extractTextFromImage(file, sourceLanguage);
    }
    // Delegate .pdf, .rtf, and .txt to server API for reliable parsing and limits
    if (
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/docx' ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.type === 'application/rtf' ||
      file.type === 'text/rtf' ||
      file.name.toLowerCase().endsWith('.rtf') ||
      file.type === 'text/plain' ||
      file.name.toLowerCase().endsWith('.txt')
    ) {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/extract-text', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to extract text');
      }
      const text = (data?.text || '').trim();
      return text;
    }
    throw new Error('Unsupported file type. Please upload a PDF, RTF, image, or .txt file.');
  };

  // Detect language of the extracted text and update source language
  const detectAndSetSourceLanguage = async (text: string) => {
    try {
      let detectedLanguageCode: string;
      
      if (MicrosoftTranslatorService.isConfigured()) {
        // Use Microsoft Translator for accurate detection
        detectedLanguageCode = await MicrosoftTranslatorService.detectLanguage(text);
      } else {
        // Use fallback pattern matching
        detectedLanguageCode = MicrosoftTranslatorService.fallbackLanguageDetection(text);
      }
      
      // Convert language code to display name and update source language
      const detectedLanguageName = codeToLanguageName[detectedLanguageCode];
      if (detectedLanguageName) {
        setSourceLanguage(detectedLanguageName);
        console.log('🔍 Auto-detected source language:', detectedLanguageName);
      }
    } catch (error) {
      console.warn('Language detection failed:', error);
      // Don't show error to user, just continue with current source language
    }
  };

  // Handle language selection for Level Up
  const handleLanguageSelect = (language: { code: string; name: string; flag: string }) => {
    // Toggle inline difficulty selector under the clicked language card
    if (selectedLanguage?.id === language.code) {
      setSelectedLanguage(null);
    } else {
      setSelectedLanguage({ id: language.code, name: language.name, flag: language.flag });
    }
  };

  // Handle difficulty selection
  const handleDifficultySelect = (difficulty: string) => {
    // Navigate to web eval with prefilled params
    const getSampleText = (langCode: string, levelCode: string): string => {
      const samples: Record<string, { beginner: string; intermediate: string; advanced?: string }> = {
        english: {
          beginner: 'money',
          intermediate: 'I\'m not sure',
          advanced: 'Practice makes perfect when learning new languages.'
        },
        mandarin: {
          beginner: '你好',
          intermediate: '早上好'
        },
        japanese: {
          beginner: 'こんにちは',
          intermediate: 'おはようございます'
        },
        spanish: {
          beginner: 'hola',
          intermediate: 'buenos días'
        },
        korean: {
          beginner: '안녕하세요',
          intermediate: '좋은 아침입니다'
        }
      };
      const lang = samples[langCode] || samples.english;
      const key = (levelCode === 'advanced' && lang.advanced) ? 'advanced' : (levelCode as 'beginner' | 'intermediate');
      return (lang as { [key: string]: string })[key] || 'money';
    };

    const langCode = (selectedLanguage?.id || preferredLanguage || 'english').toLowerCase();
    const text = getSampleText(langCode, difficulty);
    const url = `/eval?language=${encodeURIComponent(langCode)}&level=${encodeURIComponent(difficulty)}&text=${encodeURIComponent(text)}`;
    router.push(url);
    setSelectedLanguage(null);
  };



  const buildLevelProgressBar = (label: string, current: number, total: number, color: string) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    return (
      <div className="flex-1 p-3 rounded-lg" style={{ backgroundColor: color }}>
        <div className="text-center">
          <h3 className="font-bold text-white text-xs mb-1">{label}</h3>
          <div className="flex items-center justify-center space-x-1">
            <span className="text-white text-sm">{current}/{total}</span>
            <span className="text-white/70 text-xs">({Math.round(percentage)}%)</span>
        </div>
      </div>
      
      {/* Performance Monitor */}
      <PerformanceMonitor />
    </div>
  );
};

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar Skeleton */}
        <div className="w-64 h-screen sticky top-0 bg-white shadow-lg">
          <div className="p-4 border-b border-gray-200">
            <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Main Content Skeleton */}
        <div className="flex-1 p-8">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
          </div>
          
          <SkeletonStats />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} h-screen sticky top-0 bg-white shadow-lg relative transition-all duration-300 ease-in-out overflow-hidden`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="overflow-hidden">
            {!isSidebarCollapsed && (
              <Image 
                src="/logo_name.png" 
                alt="PolyglAI" 
                width={140} 
                height={45} 
                className="h-10 w-auto"
              />
            )}
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title={isSidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {isSidebarCollapsed ? (
              <Image
                src="/polyglai_logo.png"
                alt="Expand"
                width={20}
                height={20}
                className="h-5 w-5"
              />
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16M4 6h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
        
        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'dashboard' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              </svg>
              {!isSidebarCollapsed && 'Dashboard'}
            </button>
            
            <button
              onClick={() => setActiveSection('translate')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'translate' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {!isSidebarCollapsed && 'Snap & Go'}
            </button>
            
            <button
              onClick={() => setActiveSection('level-up')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'level-up' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {!isSidebarCollapsed && 'Level Up'}
            </button>
            
            
            
            <button
              onClick={() => setActiveSection('profile')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'profile' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {!isSidebarCollapsed && 'Profile'}
            </button>
          </div>
        </nav>
        
        <div className={`absolute bottom-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'} p-4 border-t border-gray-200`}>
          <Link
            href="/settings"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors`}
          >
            <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!isSidebarCollapsed && 'Settings'}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'p-4 lg:p-8' : 'p-8'}`}>
        {activeSection === 'dashboard' && (
          <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-4xl'} mx-auto`}>
            {/* Greeting */}
            <div className="mb-8">
              <h1 className={`font-bold text-gray-900 mb-2 ${
                isSidebarCollapsed ? 'text-2xl lg:text-3xl' : 'text-3xl'
              }`}>
                Hello, {userProfile?.name || 'User'}
              </h1>
              <p className="text-gray-600">Start your proficiency journey</p>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className={`flex items-center mb-6 ${
                isSidebarCollapsed ? 'flex-col lg:flex-row text-center lg:text-left' : 'flex-row'
              }`}>
                {/* Progress Circle - Assessment Completion Percentage */}
                <div className={`relative ${isSidebarCollapsed ? 'w-20 h-20 mb-4 lg:mb-0 lg:mr-6' : 'w-20 h-20 mr-6'}`}>
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#0277BD"
                      strokeWidth="2"
                      strokeDasharray={`${Math.min(((() => {
                        // Calculate assessment completion percentage (beginner + intermediate only)
                        const totalBeginnerIntermediate = (beginnerTotalItems || 0) + (intermediateTotalItems || 0);
                        const completedBeginnerIntermediate = (beginnerAssessmentCount || 0) + (intermediateAssessmentCount || 0);
                        const percentage = totalBeginnerIntermediate > 0 
                          ? (completedBeginnerIntermediate / totalBeginnerIntermediate) * 100
                          : 0;
                        return Math.min(percentage, 100);
                      })()), 100)}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-[#0277BD]">
                      {(() => {
                        // Calculate assessment completion percentage (beginner + intermediate only)
                        const totalBeginnerIntermediate = (beginnerTotalItems || 0) + (intermediateTotalItems || 0);
                        const completedBeginnerIntermediate = (beginnerAssessmentCount || 0) + (intermediateAssessmentCount || 0);
                        const percentage = totalBeginnerIntermediate > 0 
                          ? (completedBeginnerIntermediate / totalBeginnerIntermediate) * 100
                          : 0;
                        return `${Math.round(percentage)}%`;
                      })()}
                    </span>
                  </div>
                </div>
                
                {/* Progress Info */}
                <div className={`${isSidebarCollapsed ? 'lg:flex-1' : 'flex-1'}`}>
                  <h2 className={`font-bold text-gray-900 mb-1 ${
                    isSidebarCollapsed ? 'text-lg lg:text-xl' : 'text-xl'
                  }`}>
                    {getLanguageDisplayName(preferredLanguage)} Assessments
                  </h2>
                  <p className="text-gray-600">Assessment completion progress</p>
                </div>
              </div>

              {/* Level Progress Bars */}
              <div className={`grid gap-4 ${
                isSidebarCollapsed 
                  ? 'grid-cols-1 lg:grid-cols-2'
                  : 'grid-cols-2'
              }`}>
                {buildLevelProgressBar('Beginner', beginnerAssessmentCount || 0, beginnerTotalItems || 0, '#0277BD')}
                {buildLevelProgressBar('Intermediate', intermediateAssessmentCount || 0, intermediateTotalItems || 0, '#1A237E')}
              </div>
            </div>

            {/* Start Learning Section */}
            <div className="mb-8">
              <h2 className={`font-bold text-gray-900 mb-6 ${
                isSidebarCollapsed ? 'text-xl lg:text-2xl' : 'text-2xl'
              }`}>Start Leveling Up</h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className={`flex items-center mb-4 ${
                  isSidebarCollapsed ? 'flex-col lg:flex-row text-center lg:text-left' : 'flex-row'
                }`}>
                  <div className={`w-12 h-12 bg-[#29B6F6] rounded-full flex items-center justify-center ${
                    isSidebarCollapsed ? 'mb-4 lg:mb-0 lg:mr-4' : 'mr-4'
                  }`}>
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className={`${isSidebarCollapsed ? 'lg:flex-1 mb-4 lg:mb-0' : 'flex-1'}`}>
                    <h3 className={`font-bold text-gray-900 ${
                      isSidebarCollapsed ? 'text-lg lg:text-xl' : 'text-xl'
                    }`}>
                      {getLanguageDisplayName(preferredLanguage)}
                    </h3>
                    <p className="text-gray-600">Build your skills through daily practice</p>
                  </div>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg 
                      className={`w-5 h-5 text-[#0277BD] transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {isExpanded && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-gray-200">
                    {getAccentInfo(preferredLanguage) && (
                      <p className="text-sm text-gray-600 text-center mb-2">
                        {getAccentInfo(preferredLanguage)}
                      </p>
                    )}
                    <button 
                      onClick={() => handleDifficultySelect('beginner')}
                      className="w-full px-4 py-3 border-2 border-[#0277BD] text-[#0277BD] rounded-lg hover:bg-[#0277BD] hover:text-white transition-colors font-medium"
                    >
                      Beginner
                    </button>
                    <button 
                      onClick={() => handleDifficultySelect('intermediate')}
                      className="w-full px-4 py-3 border-2 border-[#0277BD] text-[#0277BD] rounded-lg hover:bg-[#0277BD] hover:text-white transition-colors font-medium"
                    >
                      Intermediate
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Word Trainer Section */}
            <div className="mb-8">
              <h2 className={`font-bold text-gray-900 mb-6 ${
                isSidebarCollapsed ? 'text-xl lg:text-2xl' : 'text-2xl'
              }`}>Word Trainer</h2>
              
              <div className="bg-gradient-to-br from-[#29B6F6] to-[#0D47A1] rounded-xl p-6 text-white">
                <div className={`flex items-center mb-4 ${
                  isSidebarCollapsed ? 'flex-col lg:flex-row text-center lg:text-left' : 'flex-row'
                }`}>
                  <div className={`w-12 h-12 bg-white rounded-full flex items-center justify-center ${
                    isSidebarCollapsed ? 'mb-4 lg:mb-0 lg:mr-4' : 'mr-4'
                  }`}>
                    <svg className="w-6 h-6 text-[#29B6F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className={`${isSidebarCollapsed ? 'lg:flex-1 mb-4 lg:mb-0' : 'flex-1'}`}>
                    <h3 className={`font-bold ${
                      isSidebarCollapsed ? 'text-lg lg:text-xl' : 'text-xl'
                    }`}>
                      Test your vocabulary knowledge
                    </h3>
                    <p className="text-white/90">Practice with multiple choice questions</p>
                  </div>
                </div>
                
                <div className="bg-white/20 rounded-lg p-4 mb-4">
                  <h4 className="font-bold mb-2">Features:</h4>
                  <ul className="text-sm space-y-1 text-white/90">
                    <li>• Multiple choice questions</li>
                    <li>• Instant feedback and explanations</li>
                    <li>• Points and progress tracking</li>
                  </ul>
                </div>
                
                <button 
                  onClick={() => {
                    const url = `/word-trainer?language=${encodeURIComponent(preferredLanguage)}`;
                    router.push(url);
                  }}
                  className="w-full bg-white text-[#29B6F6] px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Start Word Trainer
                </button>
              </div>
            </div>


            {/* What's New Section - Always allow Advanced English evaluation */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">What&apos;s New</h2>

              <div className="rounded-xl border border-gray-200 p-6 bg-gradient-to-br from-[#29B6F6] to-[#0277BD] text-white shadow-sm">
                <div className="flex items-start mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">Advanced English Evaluation</h3>
                    <p className="text-white/90">Try our new unscripted pronunciation assessment.</p>
                  </div>
                </div>

                <div className="bg-white/20 rounded-lg p-4 mb-4">
                  <div className="text-sm font-semibold mb-1">New Features</div>
                  <ul className="text-sm leading-6 text-white/95 list-disc pl-5">
                    <li>Unscripted conversation evaluation</li>
                    <li>Advanced pronunciation analysis</li>
                    <li>Real-time content assessment</li>
                  </ul>
                </div>

                <button
                  onClick={() => router.push('/eval?language=english&level=advanced')}
                  className="w-full bg-white text-[#29B6F6] hover:bg-gray-100 py-3 rounded-lg font-bold transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm7-3a7 7 0 01-14 0M12 19v2m-4 0h8" />
                  </svg>
                  Try Advanced English
                </button>
              </div>
            </div>

          </div>
        )}

        {activeSection === 'translate' && (
          <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
            
            {/* Translation Mode Selector */}
            <div className="flex mb-6 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setTranslationMode('text')}
                className={`px-6 py-2 rounded-md transition-all ${
                  translationMode === 'text'
                    ? 'bg-[#0277BD] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Text Translation
              </button>
              <button
                onClick={() => setTranslationMode('file')}
                className={`px-6 py-2 rounded-md transition-all ${
                  translationMode === 'file'
                    ? 'bg-[#0277BD] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                File Translation
              </button>
              <button
                onClick={() => setTranslationMode('camera')}
                className={`px-6 py-2 rounded-md transition-all ${
                  translationMode === 'camera'
                    ? 'bg-[#0277BD] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Camera translate
              </button>
            </div>

            {/* Text Translation */}
            {translationMode === 'text' && (
              <div className="space-y-6">
                {/* Language Selection */}
                <div className="bg-[#F2F4FA] rounded-3xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSourceLangSelector(!showSourceLangSelector);
                          setShowTargetLangSelector(false);
                        }}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors w-full"
                      >
                        <img src={languageMap[sourceLanguage as keyof typeof languageMap]?.flag} alt={sourceLanguage} className="w-6 h-6" />
                        <span className="font-semibold text-gray-900">{sourceLanguage}</span>
                        <svg className={`w-4 h-4 ml-auto transition-transform ${showSourceLangSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Source Language Dropdown */}
                      {showSourceLangSelector && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
                          {languages.map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setSourceLanguage(lang);
                                setShowSourceLangSelector(false);
                              }}
                              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-5 h-5" />
                              <span className="font-medium text-gray-900">{lang}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="mx-4">
                      <button onClick={swapLanguages} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-[#0277BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTargetLangSelector(!showTargetLangSelector);
                          setShowSourceLangSelector(false);
                        }}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors w-full"
                      >
                        <span className="font-semibold text-gray-900">{targetLanguage}</span>
                        <img src={languageMap[targetLanguage as keyof typeof languageMap]?.flag} alt={targetLanguage} className="w-6 h-6" />
                        <svg className={`w-4 h-4 ml-auto transition-transform ${showTargetLangSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Target Language Dropdown */}
                      {showTargetLangSelector && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
                          {languages.map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setTargetLanguage(lang);
                                setShowTargetLangSelector(false);
                              }}
                              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-5 h-5" />
                              <span className="font-medium text-gray-900">{lang}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Text Area */}
                <div className="bg-[#F2F4FA] rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">{sourceLanguage}</h3>
                      <button 
                        onClick={() => speakText(inputText)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        {isSpeaking ? (
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                            <rect x="14" y="5" width="4" height="14" rx="1"></rect>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l-6 6H2v2h3l6 6V5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9a3 3 0 010 6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7a7 7 0 010 10" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(inputText)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  

                  
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                    <textarea
                      value={inputText}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setInputText(newValue);
                        
                        // Clear output if input contains inappropriate content
                        if (newValue && ProfanityFilterService.containsProfanity(newValue)) {
                          setOutputText('');
                          setTransliterationText('');
                        }
                      }}
                      placeholder="Enter text to translate"
                      className="w-full h-40 bg-transparent border-none outline-none resize-none text-gray-900 placeholder-gray-500"
                      maxLength={characterLimit}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center space-x-3">
                      
                      {/* Reset Speech Recognition Button */}
                      {speechFailed && (
                        <button
                          onClick={() => {
                            setSpeechFailed(false);
                            setSpeechStatus('');
                          }}
                          className="px-3 py-2 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600"
                          title="Reset speech recognition"
                        >
                          Reset
                        </button>
                      )}
                      
                      <button
                        onClick={startListening}
                        disabled={isTranslating}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          isListening 
                            ? 'bg-red-500 shadow-lg animate-pulse' 
                            : speechFailed
                              ? 'bg-orange-500 shadow-lg hover:shadow-xl'
                            : 'bg-gradient-to-br from-[#4D8AF0] to-[#3367D6] shadow-lg hover:shadow-xl'
                        }`}
                        title={
                          isListening 
                            ? 'Recording... Click to stop' 
                            : speechFailed 
                              ? 'Speech recognition failed. Click to try again or use Reset button.'
                              : 'Click to start voice input'
                        }
                      >
                        {isListening ? (
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h12v12H6z"/>
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-gray-600">{inputText.length}/{characterLimit}</span>
                      {isListening && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-500 text-sm font-medium">
                          {speechStatus || 'Listening...'}
                        </span>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={translateText}
                      disabled={!inputText.trim() || isTranslating}
                      className="bg-[#3367D6] hover:bg-[#2557C7] disabled:bg-gray-300 text-white px-8 py-3 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed"
                    >
                      {isTranslating ? 'Translating...' : 'Translate'}
                    </button>
                  </div>
                </div>

                {/* Output Text Area */}
                <div className="bg-[#F2F4FA] rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">{targetLanguage}</h3>
                      <button 
                        onClick={() => speakText(outputText)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        {isSpeaking ? (
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                            <rect x="14" y="5" width="4" height="14" rx="1"></rect>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l-6 6H2v2h3l6 6V5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9a3 3 0 010 6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7a7 7 0 010 10" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(outputText)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 min-h-40">
                    {outputText ? (
                      <div className="space-y-3">
                        <p className="text-gray-900">{outputText}</p>
                        {transliterationText && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-blue-700 text-sm font-medium mb-1">Pronunciation:</p>
                            <p className="text-blue-900 italic">{transliterationText}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Translation will appear here</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* File Translation */}
            {translationMode === 'file' && (
              <div className="space-y-6">
                {/* Language Selection */}
                <div className="bg-[#F2F4FA] rounded-3xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowSourceLangSelector(!showSourceLangSelector);
                          setShowTargetLangSelector(false);
                        }}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors w-full"
                      >
                        <img src={languageMap[sourceLanguage as keyof typeof languageMap]?.flag} alt={sourceLanguage} className="w-6 h-6" />
                        <span className="font-semibold text-gray-900">{sourceLanguage}</span>
                        <svg className={`w-4 h-4 ml-auto transition-transform ${showSourceLangSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Source Language Dropdown */}
                      {showSourceLangSelector && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
                          {languages.map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setSourceLanguage(lang);
                                setShowSourceLangSelector(false);
                              }}
                              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-5 h-5" />
                              <span className="font-medium text-gray-900">{lang}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="mx-4">
                      <button onClick={swapLanguages} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-[#0277BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex-1 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTargetLangSelector(!showTargetLangSelector);
                          setShowSourceLangSelector(false);
                        }}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors w-full"
                      >
                        <span className="font-semibold text-gray-900">{targetLanguage}</span>
                        <img src={languageMap[targetLanguage as keyof typeof languageMap]?.flag} alt={targetLanguage} className="w-6 h-6" />
                        <svg className={`w-4 h-4 ml-auto transition-transform ${showTargetLangSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* Target Language Dropdown */}
                      {showTargetLangSelector && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 z-10 max-h-60 overflow-y-auto">
                          {languages.map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setTargetLanguage(lang);
                                setShowTargetLangSelector(false);
                              }}
                              className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors text-left first:rounded-t-xl last:rounded-b-xl"
                            >
                              <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-5 h-5" />
                              <span className="font-medium text-gray-900">{lang}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* File Upload Area */}
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-[#0277BD] transition-colors">
                  <input
                    type="file"
                    accept=".txt,.rtf,.docx,.pdf,.jpg,.jpeg,.png,.bmp,.tiff"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="mx-auto w-16 h-16 bg-[#0277BD] rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload File (Max 5MB)</h3>
                    <p className="text-gray-600 mb-4">Supports TXT, PDF, DOCX, and image files</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById('file-upload') as HTMLInputElement | null;
                        el?.click();
                      }}
                      className="bg-[#3367D6] hover:bg-[#2557C7] text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                    >
                      Choose File
                    </button>
                  </label>
                </div>

                {/* Selected File Info */}
                {selectedFile && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                          <p className="text-sm text-gray-600">{formatFileSize(selectedFile.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={translateFile}
                        disabled={isTranslating}
                        className="bg-[#3367D6] hover:bg-[#2557C7] disabled:bg-gray-300 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
                      >
                        {isTranslating ? 'Translating...' : 'Translate File'}
                      </button>
                    </div>
                  </div>
                )}

                {/* File Translation Output */}
                {fileTranslatedText && (
                  <div className="bg-[#F2F4FA] rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-gray-900">Translated Content</h3>
                        <button 
                          onClick={() => speakText(fileTranslatedText)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          {isSpeaking ? (
                            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                              <rect x="14" y="5" width="4" height="14" rx="1"></rect>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5l-6 6H2v2h3l6 6V5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9a3 3 0 010 6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7a7 7 0 010 10" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => copyToClipboard(fileTranslatedText)}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button 
                          onClick={downloadTranslation}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <div className="space-y-3">
                        <p className="text-gray-900 whitespace-pre-wrap">{fileTranslatedText}</p>
                        {fileTransliterationText && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-blue-700 text-sm font-medium mb-1">Pronunciation:</p>
                            <p className="text-blue-900 italic whitespace-pre-wrap">{fileTransliterationText}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera translate */}
            {translationMode === 'camera' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
                  <div className="mx-auto w-16 h-16 bg-[#0277BD] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h4l2-3h6l2 3h4a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V9a2 2 0 012-2zm9 3a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Mobile-only feature</h3>
                  <p className="text-gray-600">Camera translate is only available in the PolyglAI mobile app. Please use the app to access this feature.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'level-up' && (
          <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Level Up</h1>
            <p className="text-gray-600 mb-8 text-center">
              Test Your Skills, Unlock New Levels, And Master Your Proficiency One Challenge At A Time!
            </p>
            
            <div className={`flex gap-8 ${
              isSidebarCollapsed ? 'flex-col xl:flex-row' : 'flex-col lg:flex-row'
            }`}>
              {/* Featured Language Card - Left Side */}
              <div className={`${isSidebarCollapsed ? 'xl:flex-1' : 'flex-1'}`}>
                {featuredLanguage && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8 hover:shadow-md transition-shadow">
                    <div 
                      onClick={() => handleLanguageSelect({ code: featuredLanguage.id, name: featuredLanguage.name, flag: featuredLanguage.flag })}
                      className="flex flex-col items-center cursor-pointer"
                    >
                      <img 
                        src={featuredLanguage.flag} 
                        alt={featuredLanguage.name}
                        className="w-48 h-48 lg:w-64 lg:h-64 object-contain mb-4 lg:mb-6"
                      />
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">{featuredLanguage.name}</h2>
                    </div>

                    {/* Inline Difficulty Selector INSIDE the card with animation */}
                    <div 
                      className={`overflow-hidden transition-all duration-300 ${selectedLanguage && selectedLanguage.id === featuredLanguage.id ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'} `}
                    >
                      <div className="border-t border-gray-200 pt-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 text-center">Select Difficulty</h3>
                        {getAccentInfo(selectedLanguage?.id || featuredLanguage?.id || preferredLanguage || '') && (
                          <p className="text-sm text-gray-600 text-center mb-3">
                            {getAccentInfo(selectedLanguage?.id || featuredLanguage?.id || preferredLanguage || '')}
                          </p>
                        )}
                        <div className="space-y-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDifficultySelect('beginner'); }}
                            className="w-full bg-green-100 hover:bg-green-200 text-green-800 font-bold py-3 px-4 rounded-lg transition-colors"
                          >
                            Beginner
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDifficultySelect('intermediate'); }}
                            className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-3 px-4 rounded-lg transition-colors"
                          >
                            Intermediate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Other Languages Section - Right Side */}
              <div className={`${isSidebarCollapsed ? 'xl:flex-1' : 'flex-1'}`}>
                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">OTHER LANGUAGES</h3>
                </div>

                {/* Other Language Cards - Vertical Stack */}
                <div className="space-y-4">
                  {otherLanguages.map((language, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <div
                        onClick={() => handleLanguageSelect({ code: language.id, name: language.name, flag: language.flag })}
                        className="flex items-center space-x-4 cursor-pointer"
                      >
                        <img 
                          src={language.flag} 
                          alt={language.name}
                          className="w-12 h-12 lg:w-16 lg:h-16 object-contain"
                        />
                        <h3 className="text-base lg:text-lg font-bold text-gray-900">{language.name}</h3>
                      </div>

                      {/* Inline Difficulty Selector per Language INSIDE the same card */}
                      <div className={`overflow-hidden transition-all duration-300 ${selectedLanguage && selectedLanguage.id === language.id ? 'max-h-64 opacity-100 mt-3' : 'max-h-0 opacity-0'} `}>
                        <div className="border-t border-gray-200 pt-3">
                          <h4 className="text-md font-bold text-gray-900 mb-2 text-center">Select Difficulty</h4>
                          {getAccentInfo(language.id) && (
                            <p className="text-xs text-gray-600 text-center mb-2">
                              {getAccentInfo(language.id)}
                            </p>
                          )}
                          <div className="space-y-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDifficultySelect('beginner'); }}
                              className="w-full bg-green-100 hover:bg-green-200 text-green-800 font-bold py-2.5 px-4 rounded-lg transition-colors"
                            >
                              Beginner
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDifficultySelect('intermediate'); }}
                              className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-2.5 px-4 rounded-lg transition-colors"
                            >
                              Intermediate
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Removed full-screen Difficulty Selection Dialog in favor of inline dropdowns */}
          </div>
        )}

        {/* Word Trainer section removed */}

        {activeSection === 'profile' && (
            <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
            {/* Profile Header - Large Rectangle Avatar */}
            <div className="mb-8">
              {/* Large Rectangle Avatar */}
              <div className="w-full h-130 mb-6 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src={showEditProfile ? editAvatar : (userProfile?.avatarUrl || "/updated avatars/3.svg")} 
                  alt="Profile Avatar"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              {/* Inline Avatar Selection (shown when editing) */}
              {showEditProfile && (
                <div className="px-5 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose an avatar</h3>
                  <div className="grid grid-cols-6 gap-3">
                    {[
                      '/updated avatars/3.svg',
                      '/updated avatars/4.svg',
                      '/updated avatars/5.svg',
                      '/updated avatars/6.svg',
                      '/updated avatars/7.svg',
                      '/updated avatars/8.svg',
                    ].map((avatar) => (
                      <button
                        key={avatar}
                        onClick={() => setEditAvatar(avatar)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-colors ${editAvatar === avatar ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}
                        aria-label={`Select ${avatar}`}
                      >
                        <img src={avatar} alt="Avatar option" className="w-14 h-14 object-cover" />
                        {editAvatar === avatar && (
                          <svg className="w-5 h-5 text-blue-500 absolute top-1 right-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* User Info Row */}
              <div className="flex items-start justify-between px-5">
                <div className="flex-1">
                  {!showEditProfile ? (
                    <>
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {userProfile?.name || 'User'}
                      </h1>
                      <p className="text-gray-600 text-lg">{getJoinedDateText(userProfile?.createdAt)}</p>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full max-w-md px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                        placeholder="Enter your name"
                      />
                    </>
                  )}
                </div>
                
                {/* Action Buttons: Removed inline Edit Profile; direct users to Settings > Profile */}
              </div>
            </div>

            {/* Overview Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Overview</h2>
              
              {/* Stats Cards Grid - 2x2 layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* Day Streak */}
                <button
                  onClick={() => showInfo('Day Streak', 'Your daily learning streak! Use the app every day to maintain your streak. You can restore a broken streak up to 3 times if you forget to use the app.')}
                  className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200 text-left hover:shadow transition-shadow"
                >
                  <div className="flex items-center">
                    <img src="/updated stats/streak.svg" alt="Streak" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{usageStats?.streakDays ?? 0}</p>
                      <p className="text-xs text-gray-600">Day Streak</p>
                    </div>
                  </div>
                </button>

                {/* Lessons Passed */}
                <button
                  onClick={() => showInfo('Lessons Passed', "Total number of lessons you've completed across all languages. Each lesson helps you improve your language skills and earn points.")}
                  className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200 text-left hover:shadow transition-shadow"
                >
                  <div className="flex items-center">
                    <img src="/updated stats/lessons.svg" alt="Lessons" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{usageStats?.lessonsCompleted ?? 0}</p>
                      <p className="text-xs text-gray-600">Lessons Passed</p>
                    </div>
                  </div>
                </button>

                {/* Assessments */}
                <button
                  onClick={() => showInfo('Assessments', 'Total pronunciation assessments completed. These help track your speaking progress and pronunciation accuracy in different languages.')}
                  className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200 text-left hover:shadow transition-shadow"
                >
                  <div className="flex items-center">
                    <img src="/updated stats/assessments.svg" alt="Assessments" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{usageStats?.assessmentCount ?? 0}</p>
                      <p className="text-xs text-gray-600">Assessments</p>
                    </div>
                  </div>
                </button>

                {/* Points */}
                <button
                  onClick={() => showInfo('Points', 'Your total points earned from all activities! Points are awarded for completing assessments, lessons, challenges, and maintaining streaks.')}
                  className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200 text-left hover:shadow transition-shadow"
                >
                  <div className="flex items-center">
                    <img src="/updated stats/points.svg" alt="Points" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{usageStats?.totalPoints ?? languagePoints}</p>
                      <p className="text-xs text-gray-600">Points</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Achievements Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Achievements</h2>
                  {!badgeLoading && (
                    <p className="text-sm text-gray-600 mt-1">
                      {userBadges ? Object.values(userBadges).filter(Boolean).length : 0} out of 9 badges unlocked
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => router.push('/achievements')}
                  className="text-[#29B6F6] font-semibold text-sm hover:text-[#0277BD] transition-colors"
                >
                  VIEW ALL
                </button>
              </div>
              
              {/* Achievement badges preview with names */}
              <div className="h-30 flex justify-evenly">
                {badgeLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#29B6F6]"></div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 mx-2">
                      <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden bg-transparent">
                        <img 
                          src="/badges/rookie_linguist.png" 
                          alt="Rookie Linguist"
                          className={`w-full h-full object-contain ${userBadges?.rookie_linguist ? '' : 'grayscale'}`}
                        />
                      </div>
                      <div className="mt-2 text-center text-xs font-medium text-gray-700 truncate">Rookie Linguist</div>
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden bg-transparent">
                        <img 
                          src="/badges/word_explorer.png" 
                          alt="Word Explorer"
                          className={`w-full h-full object-contain ${userBadges?.word_explorer ? '' : 'grayscale'}`}
                        />
                      </div>
                      <div className="mt-2 text-center text-xs font-medium text-gray-700 truncate">Word Explorer</div>
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden bg-transparent">
                        <img 
                          src="/badges/voice_breaker.png" 
                          alt="Voice Breaker"
                          className={`w-full h-full object-contain ${userBadges?.voice_breaker ? '' : 'grayscale'}`}
                        />
                      </div>
                      <div className="mt-2 text-center text-xs font-medium text-gray-700 truncate">Voice Breaker</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Challenges Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Challenges</h2>
                <button 
                  onClick={() => router.push('/challenges')}
                  className="text-[#29B6F6] font-semibold text-sm hover:text-[#0277BD] transition-colors"
                >
                  VIEW ALL
                </button>
              </div>
              
              {/* Challenge cards preview: show up to 3 unlocked */}
              <div className="space-y-3">
                {badgeLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#29B6F6]"></div>
                  </div>
                ) : (
                  (() => {
                    const allChallenges = [
                      { key: 'rookie_linguist', name: 'Rookie Linguist', desc: 'Complete your first lesson in any language', img: '/badges/rookie_linguist.png' },
                      { key: 'word_explorer', name: 'Word Explorer', desc: 'Learn 10 new vocabulary words using the Word Trainer', img: '/badges/word_explorer.png' },
                      { key: 'voice_breaker', name: 'Voice Breaker', desc: 'Finish your first pronunciation assessment successfully', img: '/badges/voice_breaker.png' },
                      { key: 'daily_voyager', name: 'Daily Voyager', desc: 'Maintain a 3-day learning streak', img: '/badges/daily_voyager.png' },
                      { key: 'phrase_master', name: 'Phrase Master', desc: 'Translate and practice 25 sentences (intermediate)', img: '/badges/phrase_master.png' },
                      { key: 'fluent_flyer', name: 'Fluent Flyer', desc: 'Pass 20 pronunciation assessments in one language', img: '/badges/fluent_flyer.png' },
                      { key: 'polyglot_in_progress', name: 'Polyglot in Progress', desc: 'Complete lessons in 3 different languages', img: '/badges/polyglot_in_progress.png' },
                      { key: 'crown_of_fluency', name: 'Crown of Fluency', desc: 'Score 90+ in an assessment 5 times', img: '/badges/crown_of_fluency.png' },
                      { key: 'legend_of_polyglai', name: 'Legend of PolyglAI', desc: 'Unlock all achievements in the app', img: '/badges/legend_of_polyglai.png' },
                    ];
                    const locked = allChallenges.filter(c => !(userBadges as Record<string, unknown>)?.[c.key]);
                    const toShow = locked.slice(0, 3);
                    if (toShow.length === 0) {
                      return (
                        <div className="text-sm text-gray-600">All challenges unlocked! Great job.</div>
                      );
                    }
                    return toShow.map((c) => (
                      <div key={c.key} className="bg-white rounded-xl p-4 shadow-sm border-2 border-[#2AC3F4]">
                        <div className="flex items-center">
                          <div className="w-12 h-12 rounded-lg shadow-sm overflow-hidden mr-3 bg-transparent">
                            <img src={c.img} alt={c.name} className="w-full h-full object-contain grayscale" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-gray-900 mb-1">{c.name}</h4>
                            <p className="text-xs text-gray-600 mb-1">{c.desc}</p>
                          </div>
                          <div className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <div className="flex items-center">
                              <span className="mr-1">🔒</span>
                              Locked
                            </div>
                          </div>
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sliding panel and backdrop removed in favor of inline editing */}

      {/* Performance Monitor */}
      <PerformanceMonitor />
      
      {/* Custom Dialog */}
      {dialogState.isOpen && dialogState.options && (
        <CustomDialog
          isOpen={dialogState.isOpen}
          onClose={hideDialog}
          title={dialogState.options.title}
          message={dialogState.options.message}
          type={dialogState.options.type}
          onConfirm={dialogState.options.onConfirm}
          onCancel={dialogState.options.onCancel}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          showCancel={dialogState.options.type === 'confirm'}
        />
      )}
      {/* Custom Dialog */}
      {dialogState.isOpen && dialogState.options && (
        <CustomDialog
          isOpen={dialogState.isOpen}
          onClose={hideDialog}
          title={dialogState.options.title}
          message={dialogState.options.message}
          type={dialogState.options.type}
          onConfirm={dialogState.options.onConfirm}
          onCancel={dialogState.options.onCancel}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          showCancel={dialogState.options.type === 'confirm'}
        />
      )}
    </div>
  );
}

export default function UserDashboard() {
  return (
    <Suspense fallback={
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD]"></div>
      </div>
    }>
      <UserDashboardContent />
    </Suspense>
  );
}