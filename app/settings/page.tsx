'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { SettingsService } from '../services/settings-service';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import CustomDialog from '../../src/components/CustomDialog';
import { useCustomDialog } from '../../src/hooks/useCustomDialog';

import { auth } from '../../src/lib/firebase';

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSettingsItem, setActiveSettingsItem] = useState('preferences');
  const [microphoneAutoStop, setMicrophoneAutoStop] = useState<boolean>(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(true);
  const { dialogState, showConfirm, showError, showInfo, showSuccess, hideDialog } = useCustomDialog();
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean>(true);
  const [crashReportingEnabled, setCrashReportingEnabled] = useState<boolean>(true);
  const [personalizedAdsEnabled, setPersonalizedAdsEnabled] = useState<boolean>(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('english');
  const [emails, setEmails] = useState<string[]>([]);
  const [isGoogleSignIn, setIsGoogleSignIn] = useState(false);
  const [hasPasswordProvider, setHasPasswordProvider] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  // Help Center state
  const [helpSearch, setHelpSearch] = useState('');
  const faqs = [
    { question: 'How do I start learning a new language?', answer: 'Go to the Home page, tap "Add Language", choose the language you want, and begin with your first lesson.', category: 'Getting Started' },
    { question: 'Can I learn multiple languages at the same time?', answer: 'Yes! You can add more than one language and switch between them anytime in the Language Selector.', category: 'Getting Started' },
    { question: 'What is the Pronunciation Assessment?', answer: "It's a tool that listens to how you say words and gives feedback to help improve your accent and fluency.", category: 'Lessons & Features' },
    { question: 'How does the Vocabulary Trainer work?', answer: 'The Vocabulary Trainer uses flashcards and quizzes to help you practice and remember new words effectively.', category: 'Lessons & Features' },
    { question: 'Can I translate whole sentences?', answer: 'Yes! Use the Translation Assistant to practice by typing or speaking a phrase.', category: 'Lessons & Features' },
    { question: 'What happens if I break my learning streak?', answer: "Don't worry you can always start again! Streaks are there to motivate you, but your overall progress is saved.", category: 'Progress & Streaks' },
    { question: 'Where can I see my progress?', answer: "Go to your Profile, and you'll see your levels, achievements, and streak history.", category: 'Progress & Streaks' },
    { question: 'How do I reset my password?', answer: 'Go to Settings → Account → Profile → Password and follow the instructions.', category: 'Account & Profile' },
    { question: 'Can I edit my profile information?', answer: 'Yes! Just go to Settings → Account → Profile, and you can update your name, email, or chosen languages.', category: 'Account & Profile' },
    { question: 'The app is not working properly. What should I do?', answer: "First, make sure you're connected to the internet. If the problem continues, restart the app or reinstall.", category: 'Technical Support' },
    { question: 'How can I contact support?', answer: "Use the Contact Support quick action below to send us a message. We'll get back to you as soon as possible.", category: 'Technical Support' },
  ];
  const filteredFaqs = faqs.filter(f => {
    const raw = helpSearch.trim();
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const normalizeCategory = (s: string) => normalize(s).replace(/and/g, '');
    const q = normalize(raw);
    const qCat = normalizeCategory(raw);
    if (!q) return true;
    const question = (f.question || '').toLowerCase();
    const answer = (f.answer || '').toLowerCase();
    const category = f.category || '';
    const catNorm = normalizeCategory(category);
    return (
      question.includes(raw.toLowerCase()) ||
      answer.includes(raw.toLowerCase()) ||
      catNorm.includes(qCat)
    );
  });

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const feedbackCategories = ['General','Bug Report','Feature Request','Performance Issue','UI/UX Feedback','Translation Issue'];
  const [feedbackCategory, setFeedbackCategory] = useState<string>('General');
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [hasExistingFeedback, setHasExistingFeedback] = useState<boolean>(false);
  const [loadingExistingFeedback, setLoadingExistingFeedback] = useState<boolean>(true);
  const [isEditingFeedback, setIsEditingFeedback] = useState<boolean>(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'pending' | 'resolved'>('pending');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);

  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      showError('Missing Feedback', 'Please enter your feedback');
      return;
    }
    try {
      setIsSubmittingFeedback(true);
      const userId = auth.currentUser?.uid || 'anonymous';
      const email = auth.currentUser?.email || '';
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          category: feedbackCategory,
          email,
          isAnonymous: false,
          text: feedbackText,
          userId,
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to submit feedback');
      }
      showSuccess('Feedback Submitted', hasExistingFeedback ? 'Your feedback has been updated.' : 'Thank you! Your feedback has been submitted.');
      // Keep the values on screen so user sees their submitted feedback
      setHasExistingFeedback(true);
      setIsEditingFeedback(false);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Load existing feedback to prefill if present
  useEffect(() => {
    const loadExisting = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoadingExistingFeedback(false);
        return;
      }
      try {
        setLoadingExistingFeedback(true);
        const url = `/api/feedback?userId=${encodeURIComponent(user.uid)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (res.ok && json?.success && json?.item) {
          const item = json.item as { rating?: number; category?: string; text?: string; status?: string; resolved?: boolean };
          if (typeof item.rating === 'number') setFeedbackRating(Math.max(1, Math.min(5, item.rating)));
          if (typeof item.category === 'string' && item.category) setFeedbackCategory(item.category);
          if (typeof item.text === 'string') setFeedbackText(item.text);
          // Handle both 'status' field and 'resolved' field for compatibility
          let feedbackStatus: 'resolved' | 'pending' = 'pending';
          if (typeof item.resolved === 'boolean') {
            feedbackStatus = item.resolved ? 'resolved' : 'pending';
          } else {
            const st = (item.status || '').toString().toLowerCase();
            feedbackStatus = st === 'resolved' ? 'resolved' : 'pending';
          }
          setFeedbackStatus(feedbackStatus);
          setHasExistingFeedback(true);
          setIsEditingFeedback(false);
        } else {
          setHasExistingFeedback(false);
          setIsEditingFeedback(true);
        }
      } catch {
        // ignore
      } finally {
        setLoadingExistingFeedback(false);
      }
    };
    const unsub = onAuthStateChanged(auth, () => loadExisting());
    // also try initial
    loadExisting();
    return () => unsub();
  }, []);

  // Live update feedback status when admin resolves it
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const refDoc = doc(db, 'users', user.uid, 'feedback', 'entry');
      const unsub = onSnapshot(refDoc, (snap) => {
        const d = snap.data() as { resolved?: boolean; rating?: number; category?: string; text?: string } | undefined;
        if (!d) return;
        if (typeof d.resolved === 'boolean') setFeedbackStatus(d.resolved ? 'resolved' : 'pending');
        if (typeof d.rating === 'number') setFeedbackRating(Math.max(1, Math.min(5, d.rating)));
        if (typeof d.category === 'string' && d.category) setFeedbackCategory(d.category);
        if (typeof d.text === 'string') setFeedbackText(d.text);
        setHasExistingFeedback(true);
      });
      return () => unsub();
    } catch {
      return;
    }
  }, [auth?.currentUser?.uid]);

  const renderFeedbackReadOnly = () => (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900">Your Rating</div>
          <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${feedbackStatus === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {feedbackStatus === 'resolved' ? 'Resolved' : 'Pending'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={i < feedbackRating ? 'text-amber-500' : 'text-gray-300'}>{i < feedbackRating ? '★' : '☆'}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900 mb-2">Category</div>
        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#29B6F6]/15 text-[#0277BD]">{feedbackCategory}</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-gray-900 mb-2">Your Feedback</div>
        <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 whitespace-pre-wrap">{feedbackText || '-'}</div>
      </div>
      <div>
        <button
          onClick={() => setIsEditingFeedback(true)}
          className="w-full px-4 py-3 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-xl font-semibold"
        >
          Edit Feedback
        </button>
      </div>
    </div>
  );

  const normalizeAssetPath = (p?: string): string => {
    if (!p) return '';
    return p.startsWith('assets/') ? `/${p.replace(/^assets\//, '')}` : p;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    SettingsService.getMicrophoneAutoStop().then(setMicrophoneAutoStop).catch(() => setMicrophoneAutoStop(true));
    SettingsService.getSoundEffectsEnabled().then(setSoundEffectsEnabled).catch(() => setSoundEffectsEnabled(true));
    // Load privacy toggles
    SettingsService.getAnalyticsEnabled().then(setAnalyticsEnabled).catch(() => setAnalyticsEnabled(true));
    SettingsService.getCrashReportingEnabled().then(setCrashReportingEnabled).catch(() => setCrashReportingEnabled(true));
    SettingsService.getPersonalizedAdsEnabled().then(setPersonalizedAdsEnabled).catch(() => setPersonalizedAdsEnabled(false));
  }, []);

  const handleToggleMicrophoneAutoStop = async () => {
    const next = !microphoneAutoStop;
    setMicrophoneAutoStop(next);
    await SettingsService.setMicrophoneAutoStop(next);
  };

  const handleToggleSoundEffects = async () => {
    const next = !soundEffectsEnabled;
    setSoundEffectsEnabled(next);
    await SettingsService.setSoundEffectsEnabled(next);
  };

  const handleToggleAnalytics = async () => {
    const next = !analyticsEnabled;
    setAnalyticsEnabled(next);
    await SettingsService.setAnalyticsEnabled(next);
  };

  const handleToggleCrash = async () => {
    const next = !crashReportingEnabled;
    setCrashReportingEnabled(next);
    await SettingsService.setCrashReportingEnabled(next);
  };

  const handleToggleAds = async () => {
    const next = !personalizedAdsEnabled;
    setPersonalizedAdsEnabled(next);
    await SettingsService.setPersonalizedAdsEnabled(next);
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoadingProfile(true);
        const user = auth.currentUser;
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { name?: string; avatarUrl?: string; preferredLanguage?: string; emails?: string[] } | undefined;
        // Also try profile/info document for preferredLanguage consistency with mobile
        const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
        const profileSnap = await getDoc(profileRef);
        const pData = profileSnap.exists() ? (profileSnap.data() as { preferredLanguage?: string; name?: string; avatarUrl?: string }) : undefined;
        setProfileName(pData?.name || data?.name || user.displayName || '');
        setAvatarUrl(normalizeAssetPath(pData?.avatarUrl || data?.avatarUrl || '/updated avatars/3.svg'));
        const pref = (pData?.preferredLanguage || data?.preferredLanguage || 'english').toLowerCase();
        setPreferredLanguage(pref);
        const list = Array.isArray(data?.emails) ? (data?.emails as string[]) : [];
        const authEmail = user.email;
        const merged = authEmail && !list.includes(authEmail) ? [...list, authEmail] : list;
        setEmails(merged);
        const providers = user.providerData.map(p => p.providerId);
        setIsGoogleSignIn(providers.includes('google.com'));
        setHasPasswordProvider(providers.includes('password'));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load profile', e);
      } finally {
        setLoadingProfile(false);
      }
    };
    if (activeSettingsItem === 'profile') {
      loadProfile();
    }
  }, [activeSettingsItem]);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, 'users', user.uid);
      const avatarUrlNormalized = normalizeAssetPath(avatarUrl);
      await updateDoc(ref, { name: profileName, avatarUrl: avatarUrlNormalized, preferredLanguage });
      // Also upsert to users/{uid}/profile/info for consistency with Flutter client
      const profileRef = doc(db, 'users', user.uid, 'profile', 'info');
      try {
        await setDoc(profileRef, { preferredLanguage, name: profileName, avatarUrl: avatarUrlNormalized }, { merge: true });
      } catch {
        // ignore
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to save profile', e);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddEmail = async () => {
    const user = auth.currentUser;
    if (!user || !newEmail.trim()) return;
    try {
      // Check if the method exists before calling it
      if ('verifyBeforeUpdateEmail' in user && typeof (user as any).verifyBeforeUpdateEmail === 'function') {
        await (user as any).verifyBeforeUpdateEmail(newEmail.trim());
      } else {
        console.warn('verifyBeforeUpdateEmail method not available');
        return;
      }
      // Optimistically track in Firestore under 'emails'
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { emails: arrayUnion(newEmail.trim()) });
      setEmails(prev => prev.includes(newEmail.trim()) ? prev : [...prev, newEmail.trim()]);
      setNewEmail('');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to add email', e);
    }
  };

  const canRemoveEmail = (email: string): boolean => {
    const primary = auth.currentUser?.email || '';
    if (email === primary) {
      // cannot remove primary unless there is another email present
      return emails.filter(e => e !== primary).length > 0;
    }
    return true;
  };

  const handleRemoveEmail = async (email: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const primary = user.email || '';
    if (email === primary && emails.filter(e => e !== primary).length === 0) return;
    try {
      const ref = doc(db, 'users', user.uid);
      await updateDoc(ref, { emails: arrayRemove(email) });
      setEmails(prev => prev.filter(e => e !== email));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to remove email', e);
    }
  };

  const handleSetPassword = async (newPass: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    try {
      // link password provider
      const { EmailAuthProvider, linkWithCredential } = await import('firebase/auth');
      const cred = EmailAuthProvider.credential(user.email, newPass);
      await linkWithCredential(user, cred);
      setHasPasswordProvider(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to set password', e);
    }
  };

  const handleChangePassword = async (currentPass: string, newPass: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) return;
    try {
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const cred = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to change password', e);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut(auth);
      router.push('/login');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Error signing out', e);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      
      // Get the current user's ID token
      const user = auth.currentUser;
      if (!user) {
        showError('Authentication Error', 'You must be logged in to delete your account');
        return;
      }

      const idToken = await user.getIdToken();
      
      // Call the delete account API
      const response = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete account');
      }

      // Show success message
      showSuccess('Account Deleted', 'Your account has been successfully deleted. You will be redirected to the login page.');
      
      // Sign out and redirect after a short delay
      setTimeout(async () => {
        try {
          await signOut(auth);
          router.push('/login');
        } catch (e) {
          // Even if sign out fails, redirect to login
          router.push('/login');
        }
      }, 2000);

    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to delete account. Please try again.';
      
      if (error.message?.includes('requires-recent-login') || 
          error.message?.includes('recent authentication')) {
        errorMessage = 'Account deletion requires recent authentication. Please sign out and sign in again, then try deleting your account.';
      } else if (error.message?.includes('Invalid or expired token')) {
        errorMessage = 'Your session has expired. Please sign in again and try deleting your account.';
      }
      
      showError('Delete Account Failed', errorMessage);
    } finally {
      setIsDeletingAccount(false);
    }
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
              <div key={i} className="h-12 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Main Content Skeleton */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse"></div>
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
              ))}
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
                className="w-5 h-5"
              />
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        
        <nav className="mt-6">
          <div className="px-4 space-y-1">
            {/* Account Settings */}
            <div className="mb-4">
              {!isSidebarCollapsed && (
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</h3>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveSettingsItem('preferences')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSettingsItem === 'preferences' 
                      ? 'bg-[#0277BD] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                  {!isSidebarCollapsed && 'Preferences'}
                </button>
                
                <button
                  onClick={() => setActiveSettingsItem('profile')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSettingsItem === 'profile' 
                      ? 'bg-[#0277BD] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {!isSidebarCollapsed && 'Profile'}
                </button>
                
                <button
                  onClick={() => setActiveSettingsItem('privacy')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSettingsItem === 'privacy' 
                      ? 'bg-[#0277BD] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {!isSidebarCollapsed && 'Privacy'}
                </button>
              </div>
            </div>

            {/* Support Settings */}
            <div className="mb-4">
              {!isSidebarCollapsed && (
                <h3 className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Support</h3>
              )}
              <div className="space-y-1">
                <button
                  onClick={() => setActiveSettingsItem('help')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSettingsItem === 'help' 
                      ? 'bg-[#0277BD] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {!isSidebarCollapsed && 'Help Center'}
                </button>
                
                <button
                  onClick={() => setActiveSettingsItem('feedback')}
                  className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSettingsItem === 'feedback' 
                      ? 'bg-[#0277BD] text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  {!isSidebarCollapsed && 'Feedback'}
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        <div className={`absolute bottom-0 ${isSidebarCollapsed ? 'w-20' : 'w-64'} p-4 border-t border-gray-200`}>
          <Link
            href="/user-dashboard"
            className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors`}
          >
            <svg className={`w-5 h-5 ${isSidebarCollapsed ? '' : 'mr-3'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
            {!isSidebarCollapsed && 'Back to Dashboard'}
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'p-4 lg:p-8' : 'p-8'}`}>
        <div className={`${isSidebarCollapsed ? 'max-w-7xl' : 'max-w-4xl'} mx-auto`}>
          <h1 className={`font-bold text-gray-900 mb-8 ${
            isSidebarCollapsed ? 'text-2xl lg:text-3xl' : 'text-3xl'
          }`}>
            {activeSettingsItem === 'preferences' && 'Preferences'}
            {activeSettingsItem === 'profile' && 'Profile Settings'}
            {activeSettingsItem === 'privacy' && 'Privacy Settings'}
            {activeSettingsItem === 'help' && 'Help Center'}
            {activeSettingsItem === 'feedback' && 'Feedback'}
          </h1>

          {/* Preferences Settings */}
          {activeSettingsItem === 'preferences' && (
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio & Speech</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Microphone Auto-Stop</h3>
                        <p className="text-sm text-gray-500">Automatically stop recording when you finish speaking</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-[#0277BD] focus:ring-[#0277BD] border-gray-300 rounded"
                        checked={microphoneAutoStop}
                        onChange={handleToggleMicrophoneAutoStop}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Sound Effects</h3>
                        <p className="text-sm text-gray-500">Enable click tones and result sounds throughout the app</p>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-[#0277BD] focus:ring-[#0277BD] border-gray-300 rounded"
                        checked={soundEffectsEnabled}
                        onChange={handleToggleSoundEffects}
                      />
                    </div>
                  </div>
                </div>
              </section>

            </div>
          )}

          {/* Edit Profile */}
          {activeSettingsItem === 'profile' && (
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Profile</h2>
                  <div className="space-y-4">
                    {/* Avatar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Avatar</label>
                      <div className="grid grid-cols-6 gap-3">
                        {['/updated avatars/3.svg','/updated avatars/4.svg','/updated avatars/5.svg','/updated avatars/6.svg','/updated avatars/7.svg','/updated avatars/8.svg'].map((src) => (
                          <button
                            key={src}
                            onClick={() => setAvatarUrl(src)}
                            className={`border rounded-lg p-1 hover:shadow flex items-center justify-center ${avatarUrl===src?'border-[#29B6F6] ring-2 ring-[#29B6F6]':''}`}
                          >
                            <Image src={src} alt="avatar" width={56} height={56} className="w-14 h-14 object-contain rounded mx-auto" />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent"
                        placeholder="Enter your display name"
                      />
                    </div>
                    {/* Preferred Language */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Language</label>
                      <select
                        value={preferredLanguage}
                        onChange={(e) => setPreferredLanguage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent"
                      >
                        {(() => {
                          const flags: Record<string, string> = {
                            english: '🇺🇸',
                            mandarin: '🇨🇳',
                            japanese: '🇯🇵',
                            spanish: '🇪🇸',
                            korean: '🇰🇷',
                          };
                          return ['english','mandarin','japanese','spanish','korean'].map(l => (
                            <option key={l} value={l}>
                              {`${flags[l] ?? ''} ${l.charAt(0).toUpperCase()+l.slice(1)}`}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || loadingProfile || !profileName.trim()}
                      className="px-5 py-2 rounded-lg bg-[#29B6F6] hover:bg-[#0277BD] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {savingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </section>

              {/* Email Management */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Email</h2>
                  <div className="space-y-3">
                    <input
                      type="email"
                      value={auth.currentUser?.email || (emails[0] ?? '')}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500">Email is managed by your account provider.</p>
                  </div>
                </div>
              </section>

              {/* Password */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Password</h2>
                  {isGoogleSignIn && !hasPasswordProvider ? (
                    <PasswordSetup onSet={handleSetPassword} />
                  ) : (
                    <PasswordChange onChange={handleChangePassword} />
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Privacy Settings */}
          {activeSettingsItem === 'privacy' && (
            <div className="space-y-6">
              

              {/* Account Data */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Data</h2>
                  <div className="divide-y rounded-lg border">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => {
                        showConfirm(
                          'Delete Account',
                          'Are you sure you want to permanently delete your account?\n\nThis action will permanently delete:\n• Your profile and personal information\n• All learning progress and achievements\n• Translation history and saved data\n• All app settings and preferences\n\nThis action cannot be undone.',
                          () => handleDeleteAccount(),
                          undefined,
                          'Delete Account',
                          'Cancel'
                        );
                      }}
                      disabled={isDeletingAccount}
                    >
                      <div>
                        <div className="text-sm text-red-600">
                          {isDeletingAccount ? 'Deleting Account...' : 'Delete My Account'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {isDeletingAccount ? 'Please wait while we delete your account' : 'Permanently delete your account and data'}
                        </div>
                      </div>
                      {isDeletingAccount ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <span className="text-gray-400">›</span>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              {/* Legal */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Legal</h2>
                  <div className="divide-y rounded-lg border">
                    <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50" onClick={() => setShowPrivacyModal(true)}>
                      <div>
                        <div className="text-sm text-gray-900">Privacy Policy</div>
                        <div className="text-xs text-gray-500">Read our privacy policy</div>
                      </div>
                      <span className="text-gray-400">›</span>
                    </button>
                    <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50" onClick={() => setShowTermsModal(true)}>
                      <div>
                        <div className="text-sm text-gray-900">Terms of Service</div>
                        <div className="text-xs text-gray-500">Read our terms of service</div>
                      </div>
                      <span className="text-gray-400">›</span>
                    </button>
                  </div>
                </div>
              </section>

              {showPrivacyModal && (
                <Modal onClose={() => setShowPrivacyModal(false)} title="PolyglAI Privacy Policy">
                  <div style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <p className="text-sm text-gray-700 mb-4">PolyglAI values your privacy. This policy explains how we collect, use, and protect your information when you use our app.</p>
                  <PolicySection title="1. Information We Collect" content={
                    `When you create an account and use PolyglAI, we may collect:\n\nDuring Onboarding:\n• Language Selection (to personalize your lessons)\n• Age (to provide age-appropriate learning features and comply with regulations)\n• Gender (optional, for personalization only)\n• Profession (to better understand our user community)\n• Location (to offer relevant language packs and track regional usage)\n• How you heard about PolyglAI (for internal analytics and app improvement)\n\nDuring App Use:\n• Account details (name, email, password)\n• Learning data (languages you study, lessons completed, scores, streaks, achievements)\n• Device information (basic details like app version, device type, and operating system for performance monitoring)\n\nWe do not collect payment or financial information since PolyglAI is free to use.`
                  } />
                  <PolicySection title="2. How We Use Your Information" content={
                    `We use your information to:\n• Personalize your learning experience\n• Track your progress, streaks, and achievements\n• Improve app features and design based on user demographics\n• Monitor app performance and fix bugs\n• Understand how users discover PolyglAI (to improve outreach)\n• Send important notifications (e.g., updates to terms or new features)\n\nWe do not sell or share your data with third parties for advertising.`
                  } />
                  <PolicySection title="3. Data Security" content={
                    `Your data is stored securely and protected against unauthorized access.\nWhile we work hard to keep your information safe, no system is 100% secure, so we cannot guarantee complete protection.`
                  } />
                  <PolicySection title="4. Children's Privacy" content={
                    `PolyglAI can be used by learners of all ages. However, if you are under 13, we recommend using the app with parental guidance.`
                  } />
                  <PolicySection title="5. Third-Party Services" content={
                    `PolyglAI may use third-party services (such as analytics tools) to help improve the app. These services only collect non-identifiable usage data.`
                  } />
                  <PolicySection title="6. Your Choices" content={
                    `You can update or delete your onboarding details (language, age, gender, profession, location, referral source) in Settings → Account → Profile.\nYou may request permanent deletion of your account and data through the Feedback option under Support.`
                  } />
                  <PolicySection title="7. Changes to This Policy" content={
                    `We may update this Privacy Policy from time to time. If we make significant changes, we'll notify you in the app.`
                  } />
                  <PolicySection title="8. Support & Feedback" content={
                    `If you have questions about this Privacy Policy, you can reach us through the Feedback option under Settings → Support.`
                  } />
                  <div className="mt-5 text-xs text-gray-500 italic">Last Revised: August 30, 2025</div>
                  <div className="mt-6"><button className="w-full px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg" onClick={() => setShowPrivacyModal(false)}>I Understand</button></div>
                  </div>
                </Modal>
              )}

              {showTermsModal && (
                <Modal onClose={() => setShowTermsModal(false)} title="PolyglAI Terms of Use">
                  <div style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <p className="text-sm text-gray-700 mb-4">Welcome to PolyglAI! By using our app, you agree to the following terms. Please read them carefully.</p>
                  <PolicySection title="1. Purpose of PolyglAI" content={`PolyglAI is a free language learning app designed to help users practice vocabulary, pronunciation, and translation across multiple languages.`} />
                  <PolicySection title="2. Age Requirement" content={`PolyglAI is designed for learners of all ages. However, if you are under 13, we recommend using the app with parental guidance. By using PolyglAI, you confirm that you meet this requirement or have permission from a parent/guardian.`} />
                  <PolicySection title="3. User Responsibilities" content={`You agree to use PolyglAI for personal, non-commercial learning.\nDo not misuse the app (e.g., hacking, spreading harmful content, or violating laws).`} />
                  <PolicySection title="4. Account & Privacy" content={`You are responsible for keeping your login information safe.\nAny personal information you provide (such as your name, email, or chosen languages) will be kept secure and used only to improve your learning experience.\nWe will never sell your data to third parties.`} />
                  <PolicySection title="5. Content" content={`Vocabulary, lessons, and translations are provided for educational purposes.\nWe aim for accuracy, but PolyglAI may not always provide perfect translations. Please use your judgment when applying them in real-life contexts.`} />
                  <PolicySection title="6. Availability" content={`PolyglAI is offered "as is." While we work hard to keep everything running smoothly, we cannot guarantee the app will always be available without interruptions.`} />
                  <PolicySection title="7. Intellectual Property & Trademarks" content={`The name PolyglAI, the PolyglAI logo, and all related marks are trademarks of PolyglAI.\nYou may not copy, distribute, or modify our branding, content, or design without permission.\nAll other trademarks, product names, or company names mentioned within the app are the property of their respective owners.`} />
                  <PolicySection title="8. Changes to Terms" content={`We may update these terms from time to time. If we do, we'll notify you in the app so you can review the changes.`} />
                  <PolicySection title="9. Support & Feedback" content={`If you need help, please check the Help Center under Settings → Support. You can also send us suggestions or report issues through the Feedback option.`} />
                  <div className="mt-5 text-xs text-gray-500 italic">Last Revised: August 30, 2025</div>
                  <div className="mt-6"><button className="w-full px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg" onClick={() => setShowTermsModal(false)}>I Understand</button></div>
                  </div>
                </Modal>
              )}
            </div>
          )}

          {/* Help Center */}
          {activeSettingsItem === 'help' && (
            <div className="space-y-6">
              {/* Search Bar */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <input
                    type="text"
                    value={helpSearch}
                    onChange={(e) => setHelpSearch(e.target.value)}
                    placeholder="Search for help..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent placeholder-gray-400"
                  />
                </div>
              </section>

              

              

              {/* FAQ Section */}
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Frequently Asked Questions (FAQs)</h3>
                  {filteredFaqs.length === 0 ? (
                    <div className="text-sm text-gray-500">No results found</div>
                  ) : (
                    <div className="space-y-3">
                      {filteredFaqs.map((faq, idx) => (
                        <FaqItem key={`${faq.question}-${idx}`} question={faq.question} answer={faq.answer} category={faq.category} />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Feedback */}
          {activeSettingsItem === 'feedback' && (
            <div className="space-y-6">
              <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6 space-y-8">
                  {loadingExistingFeedback ? (
                    <div className="text-sm text-gray-600">Loading your feedback…</div>
                  ) : hasExistingFeedback && !isEditingFeedback ? (
                    renderFeedbackReadOnly()
                  ) : (
                    <>
                  {/* Rating */}
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-3">How would you rate your experience?</div>
                    <div className="flex items-center gap-2">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setFeedbackRating(n)}
                          className="text-2xl"
                          aria-label={`Rate ${n}`}
                        >
                          {n <= feedbackRating ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Category</div>
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent"
                    >
                      {feedbackCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Anonymous submission removed */}

                  {/* Feedback Text */}
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-2">Your Feedback</div>
                    <textarea
                      rows={6}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={"Tell us what you think about the app, what could be improved, or report any issues you've encountered..."}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent placeholder-gray-400"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex gap-3">
                    <button
                      onClick={submitFeedback}
                      disabled={isSubmittingFeedback}
                      className="w-full px-4 py-3 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-xl font-semibold disabled:opacity-50"
                    >
                      {isSubmittingFeedback ? 'Saving...' : (hasExistingFeedback ? 'Update Feedback' : 'Submit Feedback')}
                    </button>
                    {hasExistingFeedback && (
                      <button
                        type="button"
                        onClick={() => setIsEditingFeedback(false)}
                        className="px-4 py-3 border rounded-xl font-semibold"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Sign Out Button - Always visible at bottom */}
          <div className="pt-6 border-t border-gray-200">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-[#29B6F6] hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {isSigningOut ? 'Signing Out...' : 'SIGN OUT'}
            </button>
          </div>
        </div>
      </div>
      
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

function PasswordSetup({ onSet }: { onSet: (newPass: string) => void }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = pwd.length >= 8 && pwd === confirm && !saving;
  return (
    <div className="space-y-3">
      <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent" />
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent" />
      <div className="text-xs">
        {pwd.length > 0 && pwd.length < 8 && (
          <span className="text-red-600">Password should be at least 8 characters.</span>
        )}
        {pwd.length >= 8 && confirm.length > 0 && pwd !== confirm && (
          <span className="text-red-600">Passwords do not match.</span>
        )}
      </div>
      <button
        disabled={!canSave}
        onClick={async () => { setSaving(true); try { await onSet(pwd); setPwd(''); setConfirm(''); } finally { setSaving(false); } }}
        className="px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Set up password'}
      </button>
      <p className="text-xs text-gray-500">You signed in with Google. Set a password to also sign in via email.</p>
    </div>
  );
}

function PasswordChange({ onChange }: { onChange: (currentPass: string, newPass: string) => void }) {
  const [current, setCurrent] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const canSave = current.length >= 1 && pwd.length >= 8 && pwd === confirm && !saving;
  return (
    <div className="space-y-3">
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent" />
      <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent" />
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0277BD] focus:border-transparent" />
      <div className="text-xs">
        {pwd.length > 0 && pwd.length < 8 && (
          <span className="text-red-600">Password should be at least 8 characters.</span>
        )}
        {pwd.length >= 8 && confirm.length > 0 && pwd !== confirm && (
          <span className="text-red-600">Passwords do not match.</span>
        )}
      </div>
      <button
        disabled={!canSave}
        onClick={async () => { setSaving(true); try { await onChange(current, pwd); setCurrent(''); setPwd(''); setConfirm(''); } finally { setSaving(false); } }}
        className="px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Change password'}
      </button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-blue-50/50 rounded-t-2xl">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>
        <div className="p-6 overflow-auto text-gray-800 text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function PolicySection({ title, content }: { title: string; content: string }) {
  return (
    <div className="mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
      <div className="text-[#29B6F6] font-semibold mb-1">{title}</div>
      <pre className="whitespace-pre-wrap text-gray-700 text-sm leading-6" style={{ fontFamily: 'Orbitron, sans-serif' }}>{content}</pre>
    </div>
  );
}

function FaqItem({ question, answer, category }: { question: string; answer: string; category?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50" onClick={() => setOpen(!open)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            {category && <div className="text-xs text-[#29B6F6] mb-1">{category}</div>}
            <div className="text-sm font-medium text-gray-900">{question}</div>
          </div>
          <div className="text-gray-400">{open ? '−' : '+'}</div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-gray-600 leading-6 whitespace-pre-wrap">{answer}</div>
      )}
    </div>
  );
}


