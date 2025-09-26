'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import CustomDialog from '../../src/components/CustomDialog';
import { useCustomDialog } from '../../src/hooks/useCustomDialog';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';

type UserProfile = {
  name: string;
  email: string;
  preferredLanguage: string;
  uid: string;
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
  
  // Translation state
  const [translationMode, setTranslationMode] = useState('text');
  const [sourceLanguage, setSourceLanguage] = useState('English');
  const [targetLanguage, setTargetLanguage] = useState('Español');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [transliterationText, setTransliterationText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [characterLimit] = useState(100);
  const [showSourceLangSelector, setShowSourceLangSelector] = useState(false);
  const [showTargetLangSelector, setShowTargetLangSelector] = useState(false);
  const { dialogState, showError, hideDialog } = useCustomDialog();
  
  // File translation state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTranslationResult, setFileTranslationResult] = useState('');

  // Language mappings
  const languageMap = {
    'English': { code: 'en', flag: '/flags/usa_icon.png' },
    'Español': { code: 'es', flag: '/flags/spain_icon.png' },
    'Mandarin': { code: 'zh-cn', flag: '/flags/china_icon.png' },
    'Nihongo': { code: 'ja', flag: '/flags/japan_icon.png' },
    'Hangugeo': { code: 'ko', flag: '/flags/skorea_icon.png' },
  };

  const languages = Object.keys(languageMap);
  
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

  const loadUserData = async (userId: string) => {
    try {
      setLoading(true);

      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      let profile: UserProfile | null = null;
      let prefLang = 'english';

      if (userDoc.exists()) {
        const userData = userDoc.data();
        profile = {
          name: userData.name || userData.displayName || 'User',
          email: userData.email || '',
          preferredLanguage: userData.preferredLanguage || 'english',
          uid: userId
        };
        prefLang = userData.preferredLanguage || 'english';
      }

      // If no profile in main doc, try profile/info subcollection
      if (!profile) {
        const profileDoc = await getDoc(doc(db, 'users', userId, 'profile', 'info'));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          profile = {
            name: profileData.name || 'User',
            email: profileData.email || '',
            preferredLanguage: profileData.preferredLanguage || 'english',
            uid: userId
          };
          prefLang = profileData.preferredLanguage || 'english';
        }
      }

      // Get language progress
      const langDoc = await getDoc(doc(db, 'users', userId, 'languages', prefLang.toLowerCase()));
      let points = 0;

      if (langDoc.exists()) {
        const langData = langDoc.data();
        points = langData.points || 0;
      }

      // Get assessment counts
      const assessmentsQuery = await getDocs(
        collection(db, 'users', userId, 'languages', prefLang.toLowerCase(), 'assessmentsData')
      );

      let beginnerCount = 0;
      let intermediateCount = 0;
      let advancedCount = 0;
      let assessmentPoints = 0;

      assessmentsQuery.docs.forEach(doc => {
        const data = doc.data();
        if (data.level === 'beginner') beginnerCount++;
        if (data.level === 'intermediate') intermediateCount++;
        if (data.level === 'advanced') advancedCount++;
        if (data.score) {
          assessmentPoints += parseInt(data.score) || 0;
        }
      });

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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Translation functions
  const translateText = async () => {
    if (!inputText.trim()) return;
    
    setIsTranslating(true);
    try {
      // Simulate translation API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock translation result
      const mockTranslation = `Translated: ${inputText}`;
      setOutputText(mockTranslation);
      
      // Mock transliteration for certain languages
      if (targetLanguage === 'Japanese' || targetLanguage === 'Korean' || targetLanguage === 'Mandarin') {
        setTransliterationText(`Pronunciation guide for: ${inputText}`);
      } else {
        setTransliterationText('');
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const startListening = () => {
    if (!isListening) {
      setIsListening(true);
      // Mock speech recognition
      setTimeout(() => {
        setInputText('Sample speech input');
        setIsListening(false);
      }, 2000);
    } else {
      setIsListening(false);
    }
  };

  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakText = (text: string) => {
    if (!text || !text.trim()) return;
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onerror = () => setIsSpeaking(false);
    utterance.onend = () => setIsSpeaking(false);
    setIsSpeaking(true);
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
        showError('File Too Large', 'File size exceeds 5MB limit');
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
      // Simulate file processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock file translation result
      const mockResult = `Translated content from ${selectedFile.name}:\n\nThis is the translated content of the uploaded file. The translation would contain the processed text from the original file converted to the target language.`;
      setFileTranslationResult(mockResult);
    } catch (error) {
      console.error('File translation error:', error);
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

  const buildLevelProgressBar = (label: string, current: number, total: number, color: string) => {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    
    return (
      <div className="flex-1 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
        <div className="text-center">
          <div className={`w-full h-2 bg-gray-200 rounded-full mb-2`}>
            <div 
              className={`h-2 rounded-full transition-all duration-300`}
              style={{ 
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: color
              }}
            ></div>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
          <p className="text-xs text-gray-600">{current}/{total}</p>
          <p className="text-xs text-gray-500">({Math.round(percentage)}%)</p>
        </div>
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
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <Image 
            src="/logo_txt.png" 
            alt="PolyglAI" 
            width={140} 
            height={45} 
            className="h-10 w-auto"
          />
        </div>
        
        <nav className="mt-6">
          <div className="px-4 space-y-2">
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'dashboard' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              </svg>
              Dashboard
            </button>
            
            <button
              onClick={() => setActiveSection('translate')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'translate' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              Snap & Go
            </button>
            
            <button
              onClick={() => setActiveSection('level-up')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'level-up' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Level Up
            </button>
            
            <button
              onClick={() => setActiveSection('word-trainer')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'word-trainer' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Word Trainer
            </button>
            
            <button
              onClick={() => setActiveSection('profile')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                activeSection === 'profile' 
                  ? 'bg-[#0277BD] text-white' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </button>
          </div>
        </nav>
        
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeSection === 'dashboard' && (
          <div className="max-w-4xl">
            {/* Greeting */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Hello, {userProfile?.name || 'User'}
              </h1>
              <p className="text-gray-600">Start your proficiency journey</p>
            </div>

            {/* Progress Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center mb-6">
                {/* Progress Circle */}
                <div className="relative w-20 h-20 mr-6">
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
                      strokeDasharray={`${Math.min((languagePoints / 1000) * 100, 100)}, 100`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-[#0277BD]">{languagePoints}</span>
                  </div>
                </div>
                
                {/* Progress Info */}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {getLanguageDisplayName(preferredLanguage)} Progress
                  </h2>
                  <p className="text-gray-600">Complete challenges to gain experience</p>
                </div>
              </div>

              {/* Level Progress Bars */}
              <div className={`grid gap-4 ${preferredLanguage?.toLowerCase() === 'english' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {buildLevelProgressBar('Beginner', beginnerAssessmentCount, beginnerTotalItems, '#0277BD')}
                {buildLevelProgressBar('Intermediate', intermediateAssessmentCount, intermediateTotalItems, '#1A237E')}
                {preferredLanguage?.toLowerCase() === 'english' && (
                  buildLevelProgressBar('Advanced', advancedAssessmentCount, advancedTotalItems, '#4A148C')
                )}
              </div>
            </div>

            {/* Start Learning Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Start Leveling Up</h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-[#29B6F6] rounded-full flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">
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
                    <button className="w-full px-4 py-3 border-2 border-[#0277BD] text-[#0277BD] rounded-lg hover:bg-[#0277BD] hover:text-white transition-colors font-medium">
                      Beginner Assessment
                    </button>
                    <button className="w-full px-4 py-3 border-2 border-[#0277BD] text-[#0277BD] rounded-lg hover:bg-[#0277BD] hover:text-white transition-colors font-medium">
                      Intermediate Assessment
                    </button>
                    {preferredLanguage?.toLowerCase() === 'english' && (
                      <button className="w-full px-4 py-3 border-2 border-[#0277BD] text-[#0277BD] rounded-lg hover:bg-[#0277BD] hover:text-white transition-colors font-medium">
                        Advanced Assessment
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Word Trainer Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Word Trainer</h2>
              
              <div className="bg-gradient-to-br from-[#29B6F6] to-[#0D47A1] rounded-xl p-6 text-white">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">Test your vocabulary knowledge</h3>
                </div>
                
                <div className="space-y-3">
                  <button className="w-full bg-white text-[#0277BD] py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors">
                    Beginner Challenge
                  </button>
                  <div className="text-center">
                    <span className="text-white/80">or</span>
                  </div>
                  <button className="w-full bg-white text-[#0277BD] py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors">
                    Intermediate Challenge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'translate' && (
          <div className="max-w-6xl">
            
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
                    <div className="flex-1">
                      <button
                        onClick={() => setShowSourceLangSelector(true)}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <img src="/flag-placeholder.png" alt="" className="w-6 h-6" />
                        <span className="font-semibold">{sourceLanguage}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="mx-4">
                      <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-[#0277BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      <button
                        onClick={() => setShowTargetLangSelector(true)}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors ml-auto"
                      >
                        <span className="font-semibold">{targetLanguage}</span>
                        <img src="/flag-placeholder.png" alt="" className="w-6 h-6" />
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input Text Area */}
                <div className="bg-[#F2F4FA] rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">{sourceLanguage}</h3>
                      <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M8.464 8.464a5 5 0 017.072 0M6.636 6.636a9 9 0 0112.728 0" />
                        </svg>
                      </button>
                    </div>
                    <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
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
                      <button
                        onClick={startListening}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                          isListening 
                            ? 'bg-red-500 shadow-lg' 
                            : 'bg-gradient-to-br from-[#4D8AF0] to-[#3367D6] shadow-lg hover:shadow-xl'
                        }`}
                      >
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                      <span className="text-sm text-gray-600">{inputText.length}/{characterLimit}</span>
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
                    <div className="flex-1">
                      <button
                        onClick={() => setShowSourceLangSelector(true)}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <img src="/flag-placeholder.png" alt="" className="w-6 h-6" />
                        <span className="font-semibold">{sourceLanguage}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className="mx-4">
                      <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <svg className="w-6 h-6 text-[#0277BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1">
                      <button
                        onClick={() => setShowTargetLangSelector(true)}
                        className="flex items-center space-x-2 bg-white rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors ml-auto"
                      >
                        <span className="font-semibold">{targetLanguage}</span>
                        <img src="/flag-placeholder.png" alt="" className="w-6 h-6" />
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
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
                    <button className="bg-[#3367D6] hover:bg-[#2557C7] text-white px-6 py-2 rounded-lg font-semibold transition-colors">
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
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Level Up</h1>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600 text-center py-8">Level up features coming soon...</p>
            </div>
          </div>
        )}

        {activeSection === 'word-trainer' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Word Trainer</h1>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600 text-center py-8">Word trainer features coming soon...</p>
            </div>
          </div>
        )}

        {activeSection === 'profile' && (
          <div className="max-w-4xl">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile Settings</h1>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input 
                    type="text" 
                    value={userProfile?.name || ''} 
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input 
                    type="email" 
                    value={userProfile?.email || ''} 
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Language</label>
                  <input 
                    type="text" 
                    value={getLanguageDisplayName(preferredLanguage)} 
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Language Selector Modals */}
      {showSourceLangSelector && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Source Language</h3>
              <button
                onClick={() => setShowSourceLangSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setSourceLanguage(lang);
                    setShowSourceLangSelector(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-6 h-6" />
                  <span className="font-medium">{lang}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTargetLangSelector && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Select Target Language</h3>
              <button
                onClick={() => setShowTargetLangSelector(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => {
                    setTargetLanguage(lang);
                    setShowTargetLangSelector(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <img src={languageMap[lang as keyof typeof languageMap]?.flag} alt={lang} className="w-6 h-6" />
                  <span className="font-medium">{lang}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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
