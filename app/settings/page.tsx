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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSettingsItem, setActiveSettingsItem] = useState('preferences');
  const [microphoneAutoStop, setMicrophoneAutoStop] = useState<boolean>(true);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(true);
  const { dialogState, showConfirm, showError, showSuccess, hideDialog } = useCustomDialog();
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleAnalytics = async () => {
    const next = !analyticsEnabled;
    setAnalyticsEnabled(next);
    await SettingsService.setAnalyticsEnabled(next);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleToggleCrash = async () => {
    const next = !crashReportingEnabled;
    setCrashReportingEnabled(next);
    await SettingsService.setCrashReportingEnabled(next);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      console.error('Failed to save profile', e);
    } finally {
      setSavingProfile(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddEmail = async () => {
    const user = auth.currentUser;
    if (!user || !newEmail.trim()) return;
    try {
      // Check if the method exists before calling it
      if ('verifyBeforeUpdateEmail' in user && typeof (user as { verifyBeforeUpdateEmail?: unknown }).verifyBeforeUpdateEmail === 'function') {
        await ((user as { verifyBeforeUpdateEmail: (email: string) => Promise<void> }).verifyBeforeUpdateEmail)(newEmail.trim());
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
      console.error('Failed to add email', e);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const canRemoveEmail = (email: string): boolean => {
    const primary = auth.currentUser?.email || '';
    if (email === primary) {
      // cannot remove primary unless there is another email present
      return emails.filter(e => e !== primary).length > 0;
    }
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      console.error('Failed to change password', e);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut(auth);
      router.push('/login');
    } catch (e) {
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
        } catch {
          // Even if sign out fails, redirect to login
          router.push('/login');
        }
      }, 2000);

    } catch (error: unknown) {
      console.error('Error deleting account:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to delete account. Please try again.';
      
      const errorMessageMatch = (error as { message?: string }).message || '';
      if (errorMessageMatch.includes('requires-recent-login') || 
          errorMessageMatch.includes('recent authentication')) {
        errorMessage = 'Account deletion requires recent authentication. Please sign out and sign in again, then try deleting your account.';
      } else if (errorMessageMatch.includes('Invalid or expired token')) {
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
      {/* Sidebar - desktop (lg+) */}
      <div className={`hidden lg:block ${isSidebarCollapsed ? 'w-20' : 'w-64'} h-screen sticky top-0 bg-white shadow-lg relative transition-all duration-300 ease-in-out overflow-hidden`}>
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

      {/* Mobile menu backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[12000] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed z-[13000] top-0 left-0 w-64 h-full bg-white lg:hidden"
          role="dialog" aria-modal="true"
        >
          <div className="w-64 h-screen bg-white shadow-lg relative overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <Image 
                src="/logo_name.png" 
                alt="PolyglAI" 
                width={140} 
                height={40} 
                className="h-8 w-auto"
              />
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="mt-4 px-2">
              <button
                onClick={() => { setActiveSettingsItem('preferences'); setSidebarOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeSettingsItem === 'preferences' 
                    ? 'bg-[#0277BD] text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Preferences
              </button>
              <button
                onClick={() => { setActiveSettingsItem('profile'); setSidebarOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeSettingsItem === 'profile' 
                    ? 'bg-[#0277BD] text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A13.937 13.937 0 0112 15c2.5 0 4.847.655 6.879 1.804M15 11a3 3 0 10-6 0 3 3 0 006 0z" />
                </svg>
                Profile
              </button>
              <button
                onClick={() => { setActiveSettingsItem('account'); setSidebarOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeSettingsItem === 'account' 
                    ? 'bg-[#0277BD] text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Account
              </button>
              <button
                onClick={() => { setActiveSettingsItem('privacy'); setSidebarOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeSettingsItem === 'privacy' 
                    ? 'bg-[#0277BD] text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Privacy
              </button>
              <button
                onClick={() => { setActiveSettingsItem('help'); setSidebarOpen(false); }}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeSettingsItem === 'help' 
                    ? 'bg-[#0277BD] text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help Center
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${isSidebarCollapsed ? 'p-4 lg:p-8' : 'p-4 md:p-8'}`}>
        {/* Mobile top bar with centered logo + hamburger */}
        <div className="lg:hidden sticky top-0 z-[11000] px-4 py-3 bg-white border-b border-gray-200">
          <div className="grid grid-cols-3 items-center">
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
                aria-label="Open menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-center">
              <Image 
                src="/polyglai_logo.png" 
                alt="PolyglAI" 
                width={40} 
                height={40} 
                className="h-8 w-8"
              />
            </div>
            <div />
          </div>
        </div>
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
                  <p className="text-sm text-gray-700 mb-4">This Privacy Policy explains how PolyglAI collects, uses, stores, and protects your information when you use our mobile and web applications. By accessing PolyglAI, you consent to the data practices described below.</p>
                  <PolicySection title="1. Information We Collect" content={
                    `PolyglAI collects limited personal and technical information necessary for app functionality and improvement, including:\n\nUser-Provided Data: Information you voluntarily provide during onboarding (e.g., name, age, gender, language preference, location, profession).\nUsage Data: Interactions with modules (pronunciation assessments, word trainer, translations, etc.) for analytics and system enhancement.\nDevice Information: Non-identifiable technical data such as browser type, OS version, and device model for compatibility optimization.\n\nNo biometric, financial, or sensitive personal data is collected.`
                  } />
                  <PolicySection title="2. Purpose of Data Collection" content={
                    `All collected data serves the following purposes:\n• To analyze app performance and improve user experience.\n• To track learning progress, assessment accuracy, and engagement analytics.\n• To provide technical support and fix reported issues.\n• To ensure security, prevent misuse, and maintain compliance with data regulations.\n\nPolyglAI does not use data for personalized advertising or third-party marketing.`
                  } />
                  <PolicySection title="3. Data Storage and Security" content={
                    `All data is securely stored using Microsoft Azure Cloud Infrastructure, which complies with ISO/IEC 27001 and GDPR standards. Encryption (SSL/TLS) and access controls are implemented to protect data from unauthorized access, alteration, or loss.`
                  } />
                  <PolicySection title="4. Data Sharing and Disclosure" content={
                    `PolyglAI does not sell, rent, or trade user information. Data may be shared only under the following circumstances:\n• When required by law or court order.\n• With service providers assisting in technical maintenance, bound by strict confidentiality agreements.\n• For aggregated analytics reports, where no personally identifiable information is disclosed.`
                  } />
                  <PolicySection title="5. Data Retention and Deletion" content={
                    `User data is retained only for as long as necessary to fulfill its purpose. Users can permanently delete their accounts and all associated data through the Privacy Settings → Delete My Account option. Once deleted, data cannot be recovered.`
                  } />
                  <PolicySection title="6. Children’s Data" content={
                    `For users under 13 years of age, only minimal data necessary for functionality (e.g., progress tracking, language preference) is collected. PolyglAI does not request or store sensitive information from minors. Parents or guardians may request account deletion or data review at any time.`
                  } />
                  <PolicySection title="7. User Rights" content={
                    `Users have the right to:\n• Access and review the data stored in their accounts.\n• Request data correction or deletion.\n• Withdraw consent to data processing.\n• Be informed of any data breaches in accordance with applicable laws.`
                  } />
                  <PolicySection title="8. Third-Party Integrations" content={
                    `PolyglAI uses Microsoft Azure Cognitive Services and Google Authentication for secure access. These third-party providers comply with international privacy standards and only process user data to the extent required for authentication and AI-based analysis.`
                  } />
                  <PolicySection title="9. Policy Updates" content={
                    `PolyglAI may update this Privacy Policy periodically to reflect changes in data handling practices or legal requirements. Users will be notified of any updates through in-app notifications or email (if provided). Continued use of PolyglAI indicates acceptance of the updated policy.`
                  } />
                  <PolicySection title="10. Contact Information" content={
                    `For inquiries regarding this policy, data use, or account management, users may contact the PolyglAI Development Team via email at: polyglaitool@gmail.com`
                  } />
                  <div className="mt-5 text-xs text-gray-500 italic">Last Revised: October 14, 2025</div>
                  <div className="mt-6"><button className="w-full px-4 py-2 bg-[#29B6F6] hover:bg-[#0277BD] text-white rounded-lg" onClick={() => setShowPrivacyModal(false)}>I Understand</button></div>
                  </div>
                </Modal>
              )}

              {showTermsModal && (
                <Modal onClose={() => setShowTermsModal(false)} title="PolyglAI Terms of Use">
                  <div style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  <p className="text-sm text-gray-700 mb-4">Welcome to PolyglAI, an AI-powered multilingual mobile and web application designed to support pronunciation assessment, translation, and vocabulary training in five major languages: English, Mandarin, Japanese (Nihongo), Korean (Hangugeo), and Spanish (Español). By downloading, accessing, or using PolyglAI, you agree to comply with and be bound by the following Terms of Use. Please read them carefully before continuing.</p>
                  <PolicySection title="1. Purpose of PolyglAI" content={`PolyglAI is an educational tool developed for language learning and pronunciation improvement through artificial intelligence. The app integrates Microsoft Azure Speech AI, Natural Language Processing (NLP), Computer Vision (OCR), and Document Intelligence technologies to provide interactive and data-driven language learning. The system is intended for personal and educational use only and may not be used for commercial purposes without written consent from the developers.`} />
                  <PolicySection title="2. Eligibility and Age Requirement" content={`PolyglAI is designed for learners of all ages. However, in compliance with the Children’s Online Privacy Protection Act (COPPA) and related international standards, users under 13 years old are required to use the app under parental or guardian supervision. By using PolyglAI, you confirm that you meet this requirement or have obtained consent from a parent or legal guardian.`} />
                  <PolicySection title="3. User Responsibilities" content={`By using PolyglAI, you agree to:\n• Use the app solely for language learning and personal development.\n• Avoid activities that could harm, disrupt, or misuse the system, including hacking, reverse engineering, or spreading malicious content.\n• Respect intellectual property rights, refrain from uploading inappropriate materials, and follow all applicable laws in your country of use.\n\nViolations of these terms may result in the suspension or termination of your account without prior notice.`} />
                  <PolicySection title="4. Account Registration and Security" content={`Users are responsible for safeguarding their login credentials and maintaining the confidentiality of their account information. Any activity performed under a user’s account is the user’s responsibility. If unauthorized access is suspected, users must notify the developers immediately.`} />
                  <PolicySection title="5. Data and Privacy Protection" content={`PolyglAI collects only essential data to improve user experience, including demographic details provided during onboarding (age, gender, profession, and location). Data is stored securely and used strictly for analytics purposes not personalization. Personal data is never sold or shared with third parties without consent.`} />
                  <PolicySection title="6. Content and Educational Materials" content={`All translations, pronunciations, and vocabulary materials are provided for educational use. While the developers strive for accuracy, translations or AI-generated content may occasionally contain errors. Users are advised to apply personal discretion and cross-reference critical translations in professional or formal use.`} />
                  <PolicySection title="7. Accessibility and Availability" content={`PolyglAI is provided “as is” and “as available.” The developers aim to maintain consistent functionality but cannot guarantee uninterrupted access due to technical maintenance, server downtime, or updates.`} />
                  <PolicySection title="8. Intellectual Property Rights" content={`The PolyglAI name, logo, and all related content including the user interface, design elements, and learning materials are the intellectual property of the developers. Users may not copy, modify, distribute, or reproduce any part of the application without written authorization.`} />
                  <PolicySection title="9. Feedback and Support" content={`Users are encouraged to share feedback, report bugs, or suggest improvements through the in-app Feedback section or Help Center. Submitted feedback may be used to enhance future versions of PolyglAI without compensation.`} />
                  <PolicySection title="10. Updates and Modifications" content={`PolyglAI reserves the right to update these Terms of Use periodically. Changes will be communicated within the application, and continued use after such updates indicates acceptance of the new terms.`} />
                  <div className="mt-5 text-xs text-gray-500 italic">Last Revised: October 14, 2025</div>
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


