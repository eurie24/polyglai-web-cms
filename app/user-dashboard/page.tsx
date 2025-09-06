'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Tesseract from 'tesseract.js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';
import { azureSpeechService } from '../services/azure-speech-service';
import { MicrosoftTranslatorService } from '../services/microsoft-translator-service';
import { useUserData } from '../../src/hooks/useUserData';
import UserStatsCard from '../../src/components/UserStatsCard';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';

// Extend Window interface for Speech Recognition (keeping for compatibility)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
  }
}

type UserProfile = {
  name: string;
  email: string;
  preferredLanguage: string;
  uid: string;
  avatarUrl?: string;
};

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<string>('english');
  const [languagePoints, setLanguagePoints] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [beginnerAssessmentCount, setBeginnerAssessmentCount] = useState(0);
  const [intermediateAssessmentCount, setIntermediateAssessmentCount] = useState(0);
  const [advancedAssessmentCount, setAdvancedAssessmentCount] = useState(0);
  const [beginnerTotalItems, setBeginnerTotalItems] = useState(10);
  const [intermediateTotalItems, setIntermediateTotalItems] = useState(10);
  const [advancedTotalItems, setAdvancedTotalItems] = useState(10);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Translation state
  const [translationMode, setTranslationMode] = useState('text');
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [transliterationText, setTransliterationText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [characterLimit] = useState(100);
  const [showSourceLangSelector, setShowSourceLangSelector] = useState(false);
  const [showTargetLangSelector, setShowTargetLangSelector] = useState(false);
  
  // File translation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTranslationResult, setFileTranslationResult] = useState('');

  const [featuredLanguage, setFeaturedLanguage] = useState<{ id: string; name: string; flag: string } | null>(null);
  const [otherLanguages, setOtherLanguages] = useState<{ id: string; name: string; flag: string }[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<{ id: string; name: string; flag: string } | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState('achievements');
  
  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPreferredLanguage, setEditPreferredLanguage] = useState('english');
  const [editAvatar, setEditAvatar] = useState('/updated avatars/3.svg');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Speech recognition state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [speechRecognition, setSpeechRecognition] = useState<any | null>(null);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Check if user is admin - redirect to admin login
        if (user.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
          router.push('/admin/login');
          return;
        }
        
        loadUserData(user.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

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
        speechRecognition.stop();
      }
    };
  }, [speechRecognition]);

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      let profile: UserProfile | null = null;
      let prefLang = 'english';

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const rawPreferredLanguage = userData.preferredLanguage || 'english';
        profile = {
          name: userData.name || userData.displayName || 'User',
          email: userData.email || '',
          preferredLanguage: rawPreferredLanguage,
          uid: userId,
          avatarUrl: userData.avatarUrl || userData.photoURL || '/updated avatars/3.svg'
        };
        prefLang = mapDisplayNameToCode(rawPreferredLanguage);
      }

      // If no profile in main doc, try profile/info subcollection
      if (!profile) {
        const profileDoc = await getDoc(doc(db, 'users', userId, 'profile', 'info'));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          const rawPreferredLanguage = profileData.preferredLanguage || 'english';
          profile = {
            name: profileData.name || 'User',
            email: profileData.email || '',
            preferredLanguage: rawPreferredLanguage,
            uid: userId,
            avatarUrl: profileData.avatarUrl || '/updated avatars/3.svg'
          };
          prefLang = mapDisplayNameToCode(rawPreferredLanguage);
        }
      }

      // Get language progress
      const langDoc = await getDoc(doc(db, 'users', userId, 'languages', prefLang.toLowerCase()));
      let points = 0;

      if (langDoc.exists()) {
        const langData = langDoc.data();
        points = langData.points || 0;
      }

      // Get assessment counts from assessmentsByLevel structure (matching Flutter version)
      let beginnerCount = 0;
      let intermediateCount = 0;
      let advancedCount = 0;
      let assessmentPoints = 0;

      try {
        // Get beginner assessments
        const beginnerAssessments = await getDocs(
          collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsByLevel', 'beginner', 'assessments')
        );
        beginnerAssessments.docs.forEach(doc => {
          const data = doc.data();
          const score = parseInt(data.score) || 0;
          if (score > 0) {
            beginnerCount++;
            assessmentPoints += score;
          }
        });

        // Get intermediate assessments
        const intermediateAssessments = await getDocs(
          collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsByLevel', 'intermediate', 'assessments')
        );
        intermediateAssessments.docs.forEach(doc => {
          const data = doc.data();
          const score = parseInt(data.score) || 0;
          if (score > 0) {
            intermediateCount++;
            assessmentPoints += score;
          }
        });

        // Get advanced assessments (only for English)
        if (prefLang.toLowerCase() === 'english') {
          const advancedAssessments = await getDocs(
            collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsByLevel', 'advanced', 'assessments')
          );
          advancedAssessments.docs.forEach(doc => {
            const data = doc.data();
            const score = parseInt(data.score) || 0;
            if (score > 0) {
              advancedCount++;
              assessmentPoints += score;
            }
          });
        }
      } catch (e) {
        console.error('Error fetching assessments:', e);
        // Fallback to old structure if assessmentsByLevel doesn't exist
        try {
          const assessmentsQuery = await getDocs(
            collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsData')
          );

          assessmentsQuery.docs.forEach(doc => {
            const data = doc.data();
            if (data.level === 'beginner') beginnerCount++;
            if (data.level === 'intermediate') intermediateCount++;
            if (data.level === 'advanced') advancedCount++;
            if (data.score) {
              assessmentPoints += parseInt(data.score) || 0;
            }
          });
        } catch (fallbackError) {
          console.error('Error with fallback assessment query:', fallbackError);
        }
      }

      // Get character counts for progress calculation
      let beginnerTotal = 10;
      let intermediateTotal = 10;
      let advancedTotal = 10;

      try {
        // Count documents in beginner subcollection
        const beginnerChars = await getDocs(collection(db, 'languages', prefLang.toLowerCase(), 'characters', 'beginner', 'items'));
        beginnerTotal = beginnerChars.docs.length;

        // Count documents in intermediate subcollection
        const intermediateChars = await getDocs(collection(db, 'languages', prefLang.toLowerCase(), 'characters', 'intermediate', 'items'));
        intermediateTotal = intermediateChars.docs.length;

        // Count documents in advanced subcollection (only for English)
        if (prefLang.toLowerCase() === 'english') {
          const advancedChars = await getDocs(collection(db, 'languages', prefLang.toLowerCase(), 'characters', 'advanced', 'items'));
          advancedTotal = advancedChars.docs.length;
        }
      } catch (e) {
        console.error('Error fetching character counts:', e);
      }

      setUserProfile(profile);
      setPreferredLanguage(prefLang);
      setLanguagePoints(points + assessmentPoints);
      
      // Set target language to user's preferred language
      if (profile) {
        setTargetLanguage(profile.preferredLanguage);
      }
      setBeginnerAssessmentCount(beginnerCount);
      setIntermediateAssessmentCount(intermediateCount);
      setAdvancedAssessmentCount(advancedCount);
      setBeginnerTotalItems(beginnerTotal);
      setIntermediateTotalItems(intermediateTotal);
      setAdvancedTotalItems(advancedTotal);

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Edit profile functions
  const handleEditProfileOpen = () => {
    if (userProfile) {
      setEditName(userProfile.name || '');
      setEditPreferredLanguage(userProfile.preferredLanguage || 'english');
      setEditAvatar(userProfile.avatarUrl || '/updated avatars/3.svg');
    }
    setShowEditProfile(true);
  };

  const handleEditProfileSave = async () => {
    if (!userProfile?.uid) return;
    
    setIsSavingProfile(true);
    try {
      // Update user profile in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        name: editName.trim(),
        preferredLanguage: editPreferredLanguage,
        avatarUrl: editAvatar,
        lastLoginAt: new Date()
      });

      // Also persist to profile/info subdocument for backward compatibility
      const profileInfoRef = doc(db, 'users', userProfile.uid, 'profile', 'info');
      await setDoc(profileInfoRef, {
        name: editName.trim(),
        preferredLanguage: editPreferredLanguage,
        avatarUrl: editAvatar,
        email: userProfile.email || '',
        updatedAt: new Date()
      }, { merge: true });

      // Update local state
      setUserProfile(prev => prev ? {
        ...prev,
        name: editName.trim(),
        preferredLanguage: editPreferredLanguage,
        avatarUrl: editAvatar
      } : null);

      // Update preferred language for translation
      setPreferredLanguage(editPreferredLanguage);
      setTargetLanguage(editPreferredLanguage);

      setShowEditProfile(false);
      
      // Show success message
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleEditProfileCancel = () => {
    setShowEditProfile(false);
    setEditName('');
    setEditPreferredLanguage('english');
    setEditAvatar('/updated avatars/3.svg');
  };

  // Translation functions
  const translateText = async () => {
    if (!inputText.trim()) return;
    
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
      alert(`Translation failed: ${error instanceof Error ? error.message : String(error)}`);
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
          const recognition = new SpeechRecognition();
          recognition.lang = 'en-US';
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.maxAlternatives = 1;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
          };
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recognition.onerror = (event: any) => {
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
      alert('Azure Speech Service not configured!\n\nPlease:\n1. Create a .env.local file in your web-cms directory\n2. Add your Azure credentials\n3. Restart the development server\n\nSee AZURE_SETUP.md for detailed instructions.');
      return;
    }
    
    // Check if we've already failed speech recognition and should use fallback
    if (speechFailed) {
      const userResponse = confirm(
        'Speech recognition previously failed on this device. This often happens when Azure Speech Service is not accessible.\n\n' +
        'Would you like to try speech recognition again, or would you prefer to use the text input instead?'
      );
      if (!userResponse) {
        // Focus on text input
        const textInput = document.querySelector('textarea[placeholder="Enter text to translate"]') as HTMLTextAreaElement;
        if (textInput) {
          textInput.focus();
      }
      return;
      }
      // Reset the failed state and try again
      setSpeechFailed(false);
    }

    // Test Azure Speech Service capability first
    setSpeechStatus('Testing Azure Speech Service...');
    const isCapable = await testSpeechRecognitionCapability();
    
    if (!isCapable) {
      console.log('Azure Speech Service capability test failed - offering alternative methods');
      
      // Offer user choice between alternative methods
      const userChoice = confirm(
        'Azure Speech Service is not accessible on this device.\n\n' +
        'Would you like to try an alternative recording method, or would you prefer to type your text manually?\n\n' +
        'Click "OK" to try alternative recording, "Cancel" to use text input.'
      );
      
      if (userChoice) {
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
      } else {
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
      }
      
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
      if (speechRecognition && speechRecognition.stop) {
        speechRecognition.stop();
      setSpeechRecognition(null);
      setSpeechStatus('');
      }
      setIsListening(false);
    }
  };

  const speakText = (text: string) => {
    if (!text || !text.trim()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;

    // Stop any current speech first to avoid queueing
    if (synth.speaking || synth.pending) {
      synth.cancel();
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
    };

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
        synth.speak(utterance);
      }, 250);
      return;
    }

    synth.speak(utterance);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
      console.log('Copied to clipboard');
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit');
        return;
      }
      setSelectedFile(file);
      setFileTranslationResult('');
    }
  };

  const translateFile = async () => {
    if (!selectedFile) return;
    
    setIsTranslating(true);
    try {
      const rawText = await extractTextFromFile(selectedFile);

      if (!rawText) {
        alert('No text detected. If you uploaded an image, please ensure it contains clear text.');

        return;
      }

      const translated = await translateViaLibre(rawText, sourceLanguage, targetLanguage);
      setFileTranslationResult(`Translated content from ${selectedFile.name}:\n\n${translated}`);
    } catch (error) {
      console.error('File translation error:', error);
      alert((error as Error)?.message || 'Failed to translate the file.');
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
    if (!fileTranslationResult) return;
    
    const blob = new Blob([fileTranslationResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translated_${selectedFile?.name || 'file'}.txt`;
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

  // Try translating text via LibreTranslate public instance; fallback to original text if unavailable
  const translateViaLibre = async (text: string, source: string, target: string): Promise<string> => {
    try {
      const sourceCode = libreLangMap[source] || 'auto';
      const targetCode = libreLangMap[target] || 'en';
      const resp = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: sourceCode, target: targetCode, format: 'text' }),
      });
      if (!resp.ok) throw new Error('LibreTranslate failed');
      const data = await resp.json();
      if (data && data.translatedText) return data.translatedText as string;
      throw new Error('No translatedText');
    } catch {
      console.warn('LibreTranslate failed, returning original text');
      return text;
    }
  };

  const extractTextFromImage = async (file: File, langHint: string): Promise<string> => {
    const lang = ocrLanguageMap[langHint] || 'eng';
    const { data } = await Tesseract.recognize(file, lang);
    return (data.text || '').trim();
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    if (file.type.startsWith('image/')) {
      return extractTextFromImage(file, sourceLanguage);
    }
    if (file.type === 'text/plain') {
      const text = await file.text();
      return text.trim();
    }
    throw new Error('Unsupported file type. Please upload an image or .txt file.');
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

    const langCode = selectedLanguage?.id || 'english';
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white shadow-lg relative transition-all duration-300 ease-in-out`}>
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
              {!isSidebarCollapsed && 'Translate'}
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
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors`}
          >
            <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isSidebarCollapsed && 'Sign Out'}
          </button>
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
                        const totalBeginnerIntermediate = beginnerTotalItems + intermediateTotalItems;
                        const completedBeginnerIntermediate = beginnerAssessmentCount + intermediateAssessmentCount;
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
                        const totalBeginnerIntermediate = beginnerTotalItems + intermediateTotalItems;
                        const completedBeginnerIntermediate = beginnerAssessmentCount + intermediateAssessmentCount;
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
                {buildLevelProgressBar('Beginner', beginnerAssessmentCount, beginnerTotalItems, '#0277BD')}
                {buildLevelProgressBar('Intermediate', intermediateAssessmentCount, intermediateTotalItems, '#1A237E')}
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
                    const url = `/word-trainer?language=${encodeURIComponent(preferredLanguage)}&level=beginner`;
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

            {/* What's New Section */}
            <div className="mb-8">
              <h2 className={`font-bold text-gray-900 mb-6 ${
                isSidebarCollapsed ? 'text-xl lg:text-2xl' : 'text-2xl'
              }`}>What's New</h2>
              
              <div className="bg-gradient-to-br from-[#29B6F6] to-[#0277BD] rounded-xl p-6 text-white">
                <div className={`flex items-center mb-4 ${
                  isSidebarCollapsed ? 'flex-col lg:flex-row text-center lg:text-left' : 'flex-row'
                }`}>
                  <div className={`w-12 h-12 bg-white rounded-full flex items-center justify-center ${
                    isSidebarCollapsed ? 'mb-4 lg:mb-0 lg:mr-4' : 'mr-4'
                  }`}>
                    <svg className="w-6 h-6 text-[#29B6F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className={`${isSidebarCollapsed ? 'lg:flex-1 mb-4 lg:mb-0' : 'flex-1'}`}>
                    <h3 className={`font-bold ${
                      isSidebarCollapsed ? 'text-lg lg:text-xl' : 'text-xl'
                    }`}>
                      Advanced English Evaluation
                    </h3>
                    <p className="text-white/90">Try our new unscripted pronunciation assessment</p>
                  </div>
                </div>
                
                <div className="bg-white/20 rounded-lg p-4 mb-4">
                  <h4 className="font-bold mb-2">New Features:</h4>
                  <ul className="text-sm space-y-1 text-white/90">
                    <li>• Unscripted conversation evaluation</li>
                    <li>• Advanced pronunciation analysis</li>
                    <li>• Real-time content assessment</li>
                  </ul>
                </div>
                
                <button 
                  onClick={() => {
                    if (preferredLanguage?.toLowerCase() !== 'english') {
                      alert('Advanced English evaluation is only available for English language users');
                      return;
                    }
                    handleDifficultySelect('advanced');
                  }}
                  className="w-full bg-white text-[#29B6F6] px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Try Advanced English
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'translate' && (
          <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-6xl'} mx-auto`}>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Translate</h1>
            
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
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 0 1 0 7.072m2.828-9.9a9 9 0 0 1 0 14.142M8.464 8.464a5 5 0 0 0 7.072 0M6.636 6.636a9 9 0 0 1 12.728 0" />
                        </svg>
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
                      onChange={(e) => setInputText(e.target.value)}
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
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 0 1 0 7.072m2.828-9.9a9 9 0 0 1 0 14.142M8.464 8.464a5 5 0 0 0 7.072 0M6.636 6.636a9 9 0 0 1 12.728 0" />
                        </svg>
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
                    accept=".txt,.pdf,.docx,.jpg,.jpeg,.png,.bmp,.tiff"
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
                {fileTranslationResult && (
                  <div className="bg-[#F2F4FA] rounded-3xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Translated Content</h3>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => copyToClipboard(fileTranslationResult)}
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
                      <pre className="whitespace-pre-wrap text-gray-900 text-sm">{fileTranslationResult}</pre>
                    </div>
                  </div>
                )}
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
                      <p className="text-gray-600 text-lg">Joined August 2025</p>
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
                      <div className="max-w-xl">
                        <label className="block text-sm font-medium text-gray-700 mb-3">Preferred Language</label>
                        <div className="space-y-2">
                          {[
                            { code: 'english', name: 'English', flag: '🇺🇸' },
                            { code: 'mandarin', name: 'Mandarin', flag: '🇨🇳' },
                            { code: 'spanish', name: 'Español', flag: '🇪🇸' },
                            { code: 'japanese', name: 'Nihongo', flag: '🇯🇵' },
                            { code: 'korean', name: 'Hangugeo', flag: '🇰🇷' },
                          ].map((language) => (
                            <button
                              key={language.code}
                              onClick={() => setEditPreferredLanguage(language.code)}
                              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                                editPreferredLanguage === language.code
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              type="button"
                            >
                              <span className="text-xl">{language.flag}</span>
                              <span className={`font-medium ${
                                editPreferredLanguage === language.code ? 'text-blue-700' : 'text-gray-700'
                              }`}>
                                {language.name}
                              </span>
                              {editPreferredLanguage === language.code && (
                                <svg className="w-5 h-5 text-blue-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Action Buttons */}
                {!showEditProfile ? (
                  <button 
                    onClick={handleEditProfileOpen}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleEditProfileCancel}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditProfileSave}
                      disabled={isSavingProfile || !editName.trim()}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                      type="button"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Overview Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Overview</h2>
              
              {/* Stats Cards Grid - 2x2 layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* Day Streak */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200">
                  <div className="flex items-center">
                    <img src="/updated stats/streak.svg" alt="Streak" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">7</p>
                      <p className="text-xs text-gray-600">Day Streak</p>
                    </div>
                  </div>
                </div>

                {/* Lessons Passed */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200">
                  <div className="flex items-center">
                    <img src="/updated stats/lessons.svg" alt="Lessons" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">0</p>
                      <p className="text-xs text-gray-600">Lessons Passed</p>
                    </div>
                  </div>
                </div>

                {/* Assessments */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200">
                  <div className="flex items-center">
                    <img src="/updated stats/assessments.svg" alt="Assessments" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">0</p>
                      <p className="text-xs text-gray-600">Assessments</p>
                    </div>
                  </div>
                </div>

                {/* Points */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-blue-200">
                  <div className="flex items-center">
                    <img src="/updated stats/points.svg" alt="Points" className="w-7 h-7 mr-3" />
                    <div>
                      <p className="text-lg font-bold text-gray-900">{languagePoints}</p>
                      <p className="text-xs text-gray-600">Points</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Achievements Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Achievements</h2>
                <button className="text-[#29B6F6] font-semibold text-sm hover:text-[#0277BD] transition-colors">
                  VIEW ALL
                </button>
              </div>
              
              {/* Achievement badges preview */}
              <div className="h-30 flex justify-evenly">
                <div className="flex-1 mx-2">
                  <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden">
                    <img 
                      src="/badges/rookie_linguist.svg" 
                      alt="Rookie Linguist"
                      className="w-full h-full object-contain grayscale"
                    />
                  </div>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden">
                    <img 
                      src="/badges/word_explorer.svg" 
                      alt="Word Explorer"
                      className="w-full h-full object-contain grayscale"
                    />
                  </div>
                </div>
                <div className="flex-1 mx-2">
                  <div className="w-full h-24 rounded-2xl shadow-md overflow-hidden">
                    <img 
                      src="/badges/voice_breaker.svg" 
                      alt="Voice Breaker"
                      className="w-full h-full object-contain grayscale"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Challenges Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Challenges</h2>
                <button className="text-[#29B6F6] font-semibold text-sm hover:text-[#0277BD] transition-colors">
                  VIEW ALL
                </button>
              </div>
              
              {/* Challenge cards preview */}
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-[#2AC3F4]">
                  <div className="flex items-center">
                    {/* Badge icon */}
                    <div className="w-12 h-12 rounded-lg shadow-sm overflow-hidden mr-3">
                      <img 
                        src="/badges/rookie_linguist.svg" 
                        alt="Rookie Linguist"
                        className="w-full h-full object-contain grayscale"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm text-gray-900 mb-1">Rookie Linguist</h4>
                      <p className="text-xs text-gray-600 mb-1">Complete your first lesson in any language</p>
                    </div>
                    
                    {/* Status indicator */}
                    <div className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                      <div className="flex items-center">
                        <span className="mr-1">🔒</span>
                        Locked
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sliding panel and backdrop removed in favor of inline editing */}

      {/* Performance Monitor */}
      <PerformanceMonitor />
    </div>
  );
}