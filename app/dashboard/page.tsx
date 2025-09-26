'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import AdminSidebar from '../../src/components/AdminSidebar';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import AdminProtection from '../../src/components/AdminProtection';
import { useUsersData } from '../../src/hooks/useUsersData';
import { isAdminEmail } from '../../src/constants/admin';
import { collection, query, getDocs, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import CustomDialog from '../../src/components/CustomDialog';
import { useCustomDialog } from '../../src/hooks/useCustomDialog';

import UserTable from '../../src/components/UserTable';
import DashboardStats from '../../src/components/DashboardStats';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';

interface ProfanityRecord {
  id: string;
  userId: string;
  text: string;
  context: string;
  language: string;
  detectedWords: string[];
  timestamp: number | { seconds: number; nanoseconds?: number };
  wordCount: number;
}

interface UserWithProfanity {
  id: string;
  name: string;
  email: string;
  profanityCount: number;
  lastProfanityDetected: string | { seconds: number; nanoseconds?: number } | null;
  isDisabled: boolean;
  recentProfanity: ProfanityRecord[];
}

// Map stored language identifiers to display names for the User Progress tab
const formatLanguageName = (raw: string): string => {
  if (!raw) return '';
  const normalized = String(raw).trim();
  const key = normalized.toLowerCase();
  const map: Record<string, string> = {
    // canonical codes
    'english': 'English',
    'mandarin': 'Mandarin',
    'spanish': 'Español',
    'japanese': 'Nihongo',
    'korean': 'Hangugeo',
    // already-display strings (pass-through)
    'english (us)': 'English',
    'english (uk)': 'English',
    'english (au)': 'English',
    'english (ca)': 'English',
    'english (in)': 'English',
    'english (ie)': 'English',
    'english (nz)': 'English',
    'english (za)': 'English',
    'spanish (es)': 'Español',
    'spanish (mx)': 'Español',
    'spanish (ar)': 'Español',
    'spanish (co)': 'Español',
    'spanish (pe)': 'Español',
    'spanish (ve)': 'Español',
    'spanish (cl)': 'Español',
    'spanish (ec)': 'Español',
    'spanish (uy)': 'Español',
    'spanish (py)': 'Español',
    'spanish (bo)': 'Español',
    'spanish (hn)': 'Español',
    'spanish (sv)': 'Español',
    'spanish (ni)': 'Español',
    'spanish (pr)': 'Español',
    'spanish (do)': 'Español',
    'spanish (cr)': 'Español',
    'spanish (pa)': 'Español',
    'spanish (gt)': 'Español',
    'spanish (cu)': 'Español',
    'chinese (mandarin, simplified)': 'Mandarin',
    'chinese (mandarin, traditional)': 'Mandarin',
    'chinese (cantonese, traditional)': 'Mandarin',
    // exact display names we may already receive
    'español': 'Español',
    'nihongo': 'Nihongo',
    'hangugeo': 'Hangugeo',
  };
  return map[key] || normalized;
};

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('demographics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  
// Filter states
const [ageFilter, setAgeFilter] = useState<string[]>([]);
const [locationFilter, setLocationFilter] = useState<string[]>([]);
const [genderFilter, setGenderFilter] = useState<string[]>([]);
const [professionFilter, setProfessionFilter] = useState<string[]>([]);

// Helper function to normalize gender values for consistent matching
const normalizeGender = (gender?: string): string => {
  if (!gender) return '';
  const normalized = gender.trim();
  
  // Handle various Non-binary formats
  if (normalized === 'Non - Binary' || normalized === 'Non Binary' || normalized === 'Non-Binary' || normalized === 'Non-binary') {
    return 'Non-binary';
  }
  
  return normalized;
};

// Helper function to check if user gender matches filter
const doesGenderMatch = (userGender: string | undefined, filterGender: string): boolean => {
  const normalizedUserGender = normalizeGender(userGender);
  const normalizedFilterGender = normalizeGender(filterGender);
  
  return normalizedUserGender === normalizedFilterGender;
};
  
  // Use optimized data hooks
  const { users, loading, refetch, debugInfo } = useUsersData();

  // Cache of userId -> progress object loaded via /api/user-progress/[userId]
  const [userProgressMap, setUserProgressMap] = useState<Record<string, Record<string, unknown>>>({});
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedProgress, setExpandedProgress] = useState<Record<string, unknown> | null>(null);
  const [loadingExpanded, setLoadingExpanded] = useState<boolean>(false);

  // Notifications state
  const [profanityUsers, setProfanityUsers] = useState<UserWithProfanity[]>([]);
  const [selectedProfanityUser, setSelectedProfanityUser] = useState<UserWithProfanity | null>(null);
  const [showProfanityDetails, setShowProfanityDetails] = useState(false);
  const [profanityFilter, setProfanityFilter] = useState<'all' | 'high' | 'recent'>('all');
  const [profanityActionLoading, setProfanityActionLoading] = useState<string | null>(null);
  const { dialogState, showConfirm, showSuccess, showError, hideDialog } = useCustomDialog();


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Check if user is admin
        console.log("Current user:", currentUser.email);
        
      // Use case-insensitive comparison for email check
      const isAdmin = isAdminEmail(currentUser.email || '');
        console.log("Admin email check:", isAdmin);
        
        if (!isAdmin) {
          router.push('/login?error=adminOnly');
          return;
        }
        

      } else {
        // Redirect to login if not authenticated
        router.push('/login');
      }
    });
    
    return () => unsubscribe();
  }, [router]);


  
  // Memoized filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
    // Always exclude admin user by email
    if (isAdminEmail(user.email)) {
      return false;
    }
    
    // Filter by gender if gender filter is active
    if (genderFilter.length > 0 && user.gender) {
      const isIncluded = genderFilter.some(filterGender => 
        doesGenderMatch(user.gender, filterGender)
      );
      if (!isIncluded) {
        return false;
      }
    }
    
    // Filter by age if age filter is active
    if (ageFilter.length > 0 && user.age) {
      let ageMatches = false;
      for (const ageRange of ageFilter) {
        if (typeof user.age === 'string') {
          const ageStr = String(user.age);
          if (ageStr === ageRange) {
            ageMatches = true;
            break;
          }
          if (ageRange === 'Under 18' && (ageStr.includes('Under 18') || ageStr.toLowerCase().includes('under 18'))) {
            ageMatches = true;
            break;
          }
          if (ageRange === '18-24' && (ageStr.includes('18 - 24') || ageStr.includes('18-24'))) {
            ageMatches = true;
            break;
          }
          if (ageRange === '25-34' && (ageStr.includes('25 - 34') || ageStr.includes('25-34'))) {
            ageMatches = true;
            break;
          }
          if (ageRange === '35-44' && (ageStr.includes('35 - 44') || ageStr.includes('35-44'))) {
            ageMatches = true;
            break;
          }
          if (ageRange === '45+' && (ageStr.includes('45+') || ageStr.includes('45 +') || ageStr.includes('45'))) {
            ageMatches = true;
            break;
          }
        } else if (typeof user.age === 'number') {
          if (ageRange === 'Under 18' && user.age < 18) {
            ageMatches = true;
            break;
          }
          if (ageRange === '18-24' && user.age >= 18 && user.age <= 24) {
            ageMatches = true;
            break;
          }
          if (ageRange === '25-34' && user.age >= 25 && user.age <= 34) {
            ageMatches = true;
            break;
          }
          if (ageRange === '35-44' && user.age >= 35 && user.age <= 44) {
            ageMatches = true;
            break;
          }
          if (ageRange === '45+' && user.age >= 45) {
            ageMatches = true;
            break;
          }
        }
      }
      if (!ageMatches) {
        return false;
      }
    }
    
    // Filter by location if location filter is active
    if (locationFilter.length > 0 && user.location) {
      if (!locationFilter.includes(user.location)) {
        return false;
      }
    }
    
    // Filter by profession if profession filter is active
    if (professionFilter.length > 0 && user.profession) {
      if (!professionFilter.includes(user.profession)) {
        return false;
      }
    }
    
    return true;
  });
  }, [users, ageFilter, locationFilter, genderFilter, professionFilter]);

  // Lazy-load progress for users shown in the list if not already present
  useEffect(() => {
    // Only fetch when on the User Progress tab
    if (activeTab !== 'features') return;

    const controller = new AbortController();
    const signal = controller.signal;

    const loadMissingProgress = async () => {
      const toFetch = filteredUsers
        .filter(u => !u.progress && !userProgressMap[u.id])
        .map(u => u.id);

      if (toFetch.length === 0) return;

      // Limit concurrent requests to avoid flooding
      const concurrency = 5;
      for (let i = 0; i < toFetch.length; i += concurrency) {
        const batch = toFetch.slice(i, i + concurrency);
        const results = await Promise.allSettled(batch.map(async (userId) => {
          const res = await fetch(`/api/user-progress/${userId}`, { signal, headers: { 'Cache-Control': 'max-age=600' } });
          if (!res.ok) throw new Error(`progress ${res.status}`);
          const json = await res.json();
          if (json && json.success && json.progress) {
            return { userId, progress: json.progress as Record<string, unknown> };
          }
          throw new Error('no progress');
        }));

        const updates: Record<string, Record<string, unknown>> = {};
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value) {
            updates[r.value.userId] = r.value.progress;
          }
        });
        if (Object.keys(updates).length > 0) {
          setUserProgressMap(prev => ({ ...prev, ...updates }));
        }
      }
    };

    loadMissingProgress().catch(err => {
      console.error('Failed loading user progress batch:', err);
    });

    return () => controller.abort();
  }, [activeTab, filteredUsers, userProgressMap]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleGenderFilter = (gender: string) => {
    if (genderFilter.includes(gender)) {
      setGenderFilter(genderFilter.filter(g => g !== gender));
    } else {
      setGenderFilter([...genderFilter, gender]);
    }
  };

  const clearFilters = () => {
    setAgeFilter([]);
    setLocationFilter([]);
    setGenderFilter([]);
    setProfessionFilter([]);
  };

  const handleExport = async (format: 'excel' | 'csv') => {
    try {
      const response = await fetch(`/api/export-data?format=${format}&type=users`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `polyglai_users_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      showError('Export Failed', 'Failed to export data. Please try again.');
    }
  };

  // Notifications functions
  const loadProfanityUsers = async () => {
    try {
      console.log('Loading profanity users...');
      
      // Get all users and filter those with profanity count > 0
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      
      console.log(`Total users found: ${usersSnapshot.docs.length}`);
      
      const usersWithProfanity: UserWithProfanity[] = [];
      const allUsers: Record<string, unknown>[] = []; // For debugging
      
      // Process each user
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const profanityCount = userData.profanityCount || 0;
        
        // Debug logging
        console.log(`User ${userId}:`, {
          name: userData.name || userData.displayName,
          email: userData.email,
          profanityCount: profanityCount,
          lastProfanityDetected: userData.lastProfanityDetected,
          isDisabled: userData.isDisabled,
          hasProfanityCount: 'profanityCount' in userData
        });
        
        allUsers.push({
          id: userId,
          name: userData.name || userData.displayName || 'Unknown',
          email: userData.email || 'Unknown',
          profanityCount: profanityCount,
          lastProfanityDetected: userData.lastProfanityDetected || null,
          isDisabled: userData.isDisabled || false
        });
        
        // Only include users with profanity violations
        if (profanityCount > 0) {
          console.log(`User ${userId} has profanity count: ${profanityCount}`);
          
          // Get ALL profanity records for this user to see what's actually in the database
          const profanityQuery = query(
            collection(db, 'profanity_records'),
            where('userId', '==', userId)
          );
          
          const profanitySnapshot = await getDocs(profanityQuery);
          console.log(`Found ${profanitySnapshot.docs.length} profanity records for user ${userId}`);
          
          const allProfanity: ProfanityRecord[] = profanitySnapshot.docs.map(doc => {
            const data = doc.data();
            console.log(`Profanity record ${doc.id}:`, {
              text: data.text,
              timestamp: data.timestamp,
              context: data.context,
              language: data.language
            });
            return {
              id: doc.id,
              ...data
            } as ProfanityRecord;
          });
          
          // Sort by timestamp in memory and take the 5 most recent
          const recentProfanity = allProfanity
            .sort((a, b) => {
              const aTime = typeof a.timestamp === 'number' ? new Date(a.timestamp * 1000) : (a.timestamp && typeof a.timestamp === 'object' && 'seconds' in a.timestamp ? new Date(a.timestamp.seconds * 1000) : new Date(0));
              const bTime = typeof b.timestamp === 'number' ? new Date(b.timestamp * 1000) : (b.timestamp && typeof b.timestamp === 'object' && 'seconds' in b.timestamp ? new Date(b.timestamp.seconds * 1000) : new Date(0));
              return bTime.getTime() - aTime.getTime();
            })
            .slice(0, 5);
          
          console.log(`Recent profanity for user ${userId}:`, recentProfanity.length, 'records');
          
          usersWithProfanity.push({
            id: userId,
            name: userData.name || userData.displayName || 'Unknown',
            email: userData.email || 'Unknown',
            profanityCount: profanityCount,
            lastProfanityDetected: userData.lastProfanityDetected || null,
            isDisabled: userData.isDisabled || false,
            recentProfanity: recentProfanity
          });
        }
      }

      // Sort by profanity count (highest first)
      usersWithProfanity.sort((a, b) => b.profanityCount - a.profanityCount);
      
      console.log(`Users with profanity: ${usersWithProfanity.length}`);
      console.log(`All users for debugging:`, allUsers);
      
      // If no users with profanity, show all users for debugging
      if (usersWithProfanity.length === 0) {
        console.log('No users with profanity found. Showing all users for debugging:');
        console.log(allUsers);
      }
      
      setProfanityUsers(usersWithProfanity);
    } catch (error) {
      console.error('Error loading profanity users:', error);
    }
  };

  const handleDisableUser = async (userId: string, disable: boolean) => {
    try {
      setProfanityActionLoading(userId);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isDisabled: disable,
        disabledAt: disable ? new Date().toISOString() : null,
        disabledBy: disable ? auth.currentUser?.uid : null
      });

      // Update local state
      setProfanityUsers(prev => prev.map(user => 
        user.id === userId 
          ? { ...user, isDisabled: disable }
          : user
      ));

      console.log(`User ${userId} ${disable ? 'disabled' : 'enabled'} successfully`);
    } catch (error) {
      console.error(`Error ${disable ? 'disabling' : 'enabling'} user:`, error);
      showError('Action Failed', `Failed to ${disable ? 'disable' : 'enable'} user. Please try again.`);
    } finally {
      setProfanityActionLoading(null);
    }
  };

  const formatTimestamp = (timestamp: unknown) => {
    if (!timestamp) return 'Unknown';
    try {
      // Handle both Firestore timestamp objects and regular dates
      const date = (timestamp as { toDate?: () => Date }).toDate ? (timestamp as { toDate: () => Date }).toDate() : new Date(timestamp as string | number);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const performResetProgress = async (userId: string, userName: string) => {
    try {
      setLoadingExpanded(true);
      console.log('Resetting progress for user:', userId);
      
      const response = await fetch('/api/reset-user-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        showSuccess(
          'Progress Reset',
          `Successfully reset all progress for ${userName}!\n\nDeleted ${result.details?.deletedDocuments || 0} documents from ${result.details?.deletedCollections || 0} collections.`
        );
        
        // Clear the user progress from local state
        setUserProgressMap(prev => {
          const newMap = { ...prev };
          delete newMap[userId];
          return newMap;
        });
        
        // Refresh the users data to show updated progress
        refetch();
      } else {
        showError('Reset Failed', `Failed to reset progress: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resetting user progress:', error);
      showError('Reset Failed', 'Failed to reset progress. Please try again.');
    } finally {
      setLoadingExpanded(false);
    }
  };

  // Load profanity users when notifications tab is active
  useEffect(() => {
    if (activeTab === 'notifications') {
      loadProfanityUsers();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <AdminProtection>
        <div className="flex min-h-screen bg-gray-50">
          {/* Mobile menu backdrop */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/10 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className="w-64 md:w-64 lg:w-64 xl:w-64 h-screen sticky top-0 bg-[#0277BD] shadow-md text-white shrink-0 overflow-hidden">
            <div className="p-6 border-b border-[#29B6F6]/30">
              <Image 
                src="/logo_txt.png" 
                alt="PolyglAI" 
                width={140} 
                height={45} 
                className="h-10 w-auto"
              />
            </div>
            <nav className="mt-6">
              <div className="px-4">
                <Link href="/dashboard" className="flex items-center px-4 py-3 bg-[#29B6F6]/20 rounded-md text-white">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
                  </svg>
                  Dashboard
                </Link>
                <Link href="/dashboard/languages" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Language Management
                </Link>
                <Link href="/dashboard/word-trainer" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  Word Trainer
                </Link>
                <Link href="/dashboard/users" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                  Users
                </Link>
                <Link href="/dashboard/feedbacks" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                  </svg>
                  Feedbacks
                </Link>
              </div>
            </nav>
          </div>

          {/* Main Content - Loading State */}
          <div className="flex-1 min-w-0 lg:ml-0">
            {/* Mobile header */}
            <div className="lg:hidden bg-white shadow-sm border-b border-[#29B6F6]/20">
              <div className="px-4 py-4 flex items-center justify-between">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
                  </svg>
                </button>
                <h1 className="text-lg font-bold text-[#0277BD]">
                  <Link href="/dashboard" aria-label="Go to Dashboard">
                    <Image 
                      src="/logo_txt.png" 
                      alt="PolyglAI" 
                      width={100} 
                      height={32} 
                      className="h-6 w-auto cursor-pointer"
                    />
                  </Link>
                </h1>
                <div className="w-10"></div> {/* Spacer for centering */}
              </div>
            </div>

            {/* Top Navigation */}
            <div className="bg-white shadow-sm border-b border-[#29B6F6]/20">
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-12 sm:h-16">
                  <div className="flex space-x-2 sm:space-x-4 overflow-x-auto">
                    <button 
                      onClick={() => setActiveTab('demographics')}
                      className={`px-2 sm:px-4 py-2 rounded-md whitespace-nowrap text-sm sm:text-base ${activeTab === 'demographics' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2.5 2.5 0 01-2.5 2.5H7.5A2.5 2.5 0 015 19.5v-7.5A2 2 0 017 10h0"></path>
                        </svg>
                        <span className="hidden sm:inline">Demographics</span>
                        <span className="sm:hidden">Demo</span>
                      </div>
                    </button>
                    <button 
                      onClick={() => setActiveTab('features')}
                      className={`px-2 sm:px-4 py-2 rounded-md whitespace-nowrap text-sm sm:text-base ${activeTab === 'features' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
                        </svg>
                        <span className="hidden sm:inline">User Progress</span>
                        <span className="sm:hidden">Progress</span>
                      </div>
                    </button>
                  </div>
                  <div className="hidden sm:block">
                    <button 
                      onClick={handleSignOut}
                      className="text-[#1A237E] hover:text-red-600 text-sm sm:text-base"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Content Area */}
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
              <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-4 text-gray-800 text-sm sm:text-base">Loading dashboard...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminProtection>
    );
  }

  return (
    <AdminProtection>
      <div className="flex min-h-screen bg-gray-50">
        {/* Sidebar */}
        <AdminSidebar active="dashboard" />

        {/* Main Content */}
        <div className="flex-1 bg-gradient-to-br from-[#0277BD]/10 to-[#29B6F6]/5 min-w-0">
          {/* Top Navigation */}
          <div className="bg-white shadow-sm border-b border-[#29B6F6]/20">
            <div className="px-3 lg:px-4 xl:px-8">
              <div className="flex justify-between items-center h-12 lg:h-14 xl:h-16">
                <div className="flex space-x-2 lg:space-x-3 xl:space-x-4 overflow-x-auto">
                  <button 
                    onClick={() => setActiveTab('demographics')}
                    className={`px-2 lg:px-3 xl:px-4 py-1 lg:py-2 rounded-md whitespace-nowrap text-xs lg:text-sm xl:text-base ${activeTab === 'demographics' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                  >
                    <div className="flex items-center">
                      <svg className="w-3 lg:w-4 xl:w-5 h-3 lg:h-4 xl:h-5 mr-1 xl:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2.5 2.5 0 01-2.5 2.5H7.5A2.5 2.5 0 015 19.5v-7.5A2 2 0 017 10h0"></path>
                      </svg>
                      <span className="hidden lg:inline">Demographics</span>
                      <span className="lg:hidden">Demo</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => setActiveTab('features')}
                    className={`px-2 lg:px-3 xl:px-4 py-1 lg:py-2 rounded-md whitespace-nowrap text-xs lg:text-sm xl:text-base ${activeTab === 'features' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                  >
                    <div className="flex items-center">
                      <svg className="w-3 lg:w-4 xl:w-5 h-3 lg:h-4 xl:h-5 mr-1 xl:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"></path>
                      </svg>
                      <span className="hidden lg:inline">User Progress</span>
                      <span className="lg:hidden">Progress</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => setActiveTab('notifications')}
                    className={`px-2 lg:px-3 xl:px-4 py-1 lg:py-2 rounded-md whitespace-nowrap text-xs lg:text-sm xl:text-base ${activeTab === 'notifications' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                  >
                    <div className="flex items-center">
                      <svg className="w-3 lg:w-4 xl:w-5 h-3 lg:h-4 xl:h-5 mr-1 xl:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4.5 5A2.5 2.5 0 002 7.5v.5a3 3 0 003 3h.5l-.5.5a7.5 7.5 0 1015 0L20 11h.5a3 3 0 003-3v-.5A2.5 2.5 0 0021 5M12 22c-1.5 0-2.5-1-2.5-2.5h5c0 1.5-1 2.5-2.5 2.5z"></path>
                      </svg>
                      <span className="hidden lg:inline">Notifications</span>
                      <span className="lg:hidden">Alerts</span>
                    </div>
                  </button>
                </div>
                <div className="hidden lg:block">
                  <button 
                    onClick={handleSignOut}
                    className="text-[#1A237E] hover:text-red-600 text-xs lg:text-sm xl:text-base"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="px-3 lg:px-4 xl:px-8 py-4 lg:py-6 xl:py-8 max-w-full">
            {/* Debug Info Banner */}
            {debugInfo && (
              <div className="mb-4 p-3 bg-[#29B6F6]/10 text-[#0277BD] rounded-md">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <div className="flex items-center mb-2 sm:mb-0">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className="text-sm sm:text-base">{debugInfo}</span>
                  </div>
                  <div className="sm:ml-auto">
                    <button 
                      onClick={refetch}
                      className="px-3 py-1 bg-[#29B6F6] text-white rounded-md text-sm hover:bg-[#0288D1]"
                    >
                      Refresh Users
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'demographics' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-[#0277BD]">List of active people</h2>
                
                {/* Optimized data visualization section */}
                <DashboardStats users={users} />

                <div className="flex mb-4 space-x-2">
                  <button 
                    className="px-4 py-2 rounded-lg bg-[#29B6F6] text-white hover:bg-[#0288D1] transition-colors"
                  >
                    Active Users
                  </button>
                  
                  {/* Export Buttons */}
                  <div className="flex space-x-2 ml-auto">
                    <button 
                      onClick={() => handleExport('excel')}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      Export Excel
                    </button>
                    <button 
                      onClick={() => handleExport('csv')}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-medium text-[#0277BD]">Filter Users</h3>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 border border-[#29B6F6]/30 rounded-lg text-[#0277BD] hover:bg-[#29B6F6]/10 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl shadow-md">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">Age</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              // Add all age filters
                              setAgeFilter(['Under 18', '18-24', '25-34', '35-44', '45+']);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={() => {
                              // Clear age filters
                              setAgeFilter([]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      {/* Age filter options */}
                      <div className="space-y-2 ml-2">
                        {['Under 18', '18-24', '25-34', '35-44', '45+'].map(ageGroup => {
                          const count = users.filter(u => {
                            // Handle both string category and numeric age values
                            if (typeof u.age === 'string') {
                              const ageStr = String(u.age);
                              
                              // Direct match with the category
                              if (ageStr === ageGroup) return true;
                              
                              // Handle "XX - XX years old" format
                              if (ageGroup === 'Under 18' && (ageStr.includes('Under 18') || ageStr.toLowerCase().includes('under 18'))) return true;
                              if (ageGroup === '18-24' && (ageStr.includes('18 - 24') || ageStr.includes('18-24'))) return true;
                              if (ageGroup === '25-34' && (ageStr.includes('25 - 34') || ageStr.includes('25-34'))) return true;
                              if (ageGroup === '35-44' && (ageStr.includes('35 - 44') || ageStr.includes('35-44'))) return true;
                              if (ageGroup === '45+' && (ageStr.includes('45+') || ageStr.includes('45 +') || ageStr.includes('45'))) return true;
                              
                              return false;
                            } else                           if (typeof u.age === 'number') {
                            if (ageGroup === 'Under 18') return u.age < 18;
                            if (ageGroup === '18-24') return u.age >= 18 && u.age <= 24;
                            if (ageGroup === '25-34') return u.age >= 25 && u.age <= 34;
                            if (ageGroup === '35-44') return u.age >= 35 && u.age <= 44;
                            if (ageGroup === '45+') return u.age >= 45;
                          }
                            return false;
                          }).length;
                          
                          return (
                            <div key={ageGroup} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`age-${ageGroup}`}
                                checked={ageFilter.includes(ageGroup)}
                                onChange={() => {
                                  if (ageFilter.includes(ageGroup)) {
                                    setAgeFilter(ageFilter.filter(a => a !== ageGroup));
                                  } else {
                                    setAgeFilter([...ageFilter, ageGroup]);
                                  }
                                }}
                                className="w-4 h-4 text-[#29B6F6] rounded focus:ring-[#0288D1]"
                              />
                              <label htmlFor={`age-${ageGroup}`} className="ml-2 text-sm text-gray-800 flex-1">
                                {ageGroup}
                              </label>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="border-t border-gray-200 my-4"></div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">Gender</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              // Add all gender filters
                              setGenderFilter(['Male', 'Female', 'Non-binary', 'Prefer not to say']);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={() => {
                              // Clear gender filters
                              setGenderFilter([]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      
                      {/* Gender filter options */}
                      <div className="space-y-2 ml-2">
                        {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(gender => {
                          const count = users.filter(u => doesGenderMatch(u.gender, gender)).length;
                          
                          return (
                            <div key={gender} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`gender-${gender}`}
                                checked={genderFilter.includes(gender)}
                                onChange={() => toggleGenderFilter(gender)}
                                className="w-4 h-4 text-[#29B6F6] rounded focus:ring-[#0288D1]"
                              />
                              <label htmlFor={`gender-${gender}`} className="ml-2 text-sm text-gray-800 flex-1">
                                {gender}
                              </label>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">Location</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              // Add all location filters
                              const locations = Array.from(new Set(users.map(u => u.location).filter(Boolean)));
                              setLocationFilter(locations as string[]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={() => {
                              // Clear location filters
                              setLocationFilter([]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      
                      {/* Location filter options */}
                      <div className="max-h-40 overflow-y-auto space-y-2 ml-2 pr-2">
                        {/* Use predefined locations from Flutter app instead of dynamically generated */}
                        {['Asia - Pacific', 'Americas', 'Europe', 'Africa', 'Middle East'].map(location => {
                          const count = users.filter(u => u.location === location).length;
                          
                          return (
                            <div key={location} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`loc-${location}`}
                                checked={locationFilter.includes(location)}
                                onChange={() => {
                                  if (locationFilter.includes(location)) {
                                    setLocationFilter(locationFilter.filter(l => l !== location));
                                  } else {
                                    setLocationFilter([...locationFilter, location]);
                                  }
                                }}
                                className="w-4 h-4 text-[#29B6F6] rounded focus:ring-[#0288D1]"
                              />
                              <label htmlFor={`loc-${location}`} className="ml-2 text-sm text-gray-800 flex-1 truncate">
                                {location}
                              </label>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="border-t border-gray-200 my-4"></div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-gray-900">Profession</span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              // Add all profession filters
                              const professions = Array.from(new Set(users.map(u => u.profession).filter(Boolean)));
                              setProfessionFilter(professions as string[]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={() => {
                              // Clear profession filters
                              setProfessionFilter([]);
                            }}
                            className="text-xs text-[#0288D1] hover:underline"
                          >
                            None
                          </button>
                        </div>
                      </div>
                      
                      {/* Profession filter options */}
                      <div className="max-h-40 overflow-y-auto space-y-2 ml-2 pr-2">
                        {/* Use predefined professions from Flutter app instead of dynamically generated */}
                        {['Student', 'Educator', 'Professional', 'Technology', 'Arts & Entertainment', 'Other'].map(profession => {
                          const count = users.filter(u => u.profession === profession).length;
                          
                          return (
                            <div key={profession} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`prof-${profession}`}
                                checked={professionFilter.includes(profession)}
                                onChange={() => {
                                  if (professionFilter.includes(profession)) {
                                    setProfessionFilter(professionFilter.filter(p => p !== profession));
                                  } else {
                                    setProfessionFilter([...professionFilter, profession]);
                                  }
                                }}
                                className="w-4 h-4 text-[#29B6F6] rounded focus:ring-[#0288D1]"
                              />
                              <label htmlFor={`prof-${profession}`} className="ml-2 text-sm text-gray-800 flex-1 truncate">
                                {profession}
                              </label>
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <span className="font-medium text-[#0277BD]">Found: {filteredUsers.length}</span>
                </div>

                {/* Optimized User Table */}
                                    <UserTable
                      users={filteredUsers}
                      loading={loading}
                    />
                                </div>
            )}

            {activeTab === 'features' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-[#0277BD]">User Progress</h2>
                <div className="bg-white rounded-2xl shadow-sm p-8">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-[#0277BD]/10">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider">
                          Username
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider">
                          Preferred Language
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#0277BD] uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user, index) => (
                        <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 mr-3">
                                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                              </div>
                              <div className="text-sm font-medium text-gray-900">{user.name || 'Unknown'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-800">
                              {formatLanguageName((user.preferredLanguage || user.languages?.[0] || '').toString()) || 'Unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-800">
                              {(() => {
                                const preferredLang = user.preferredLanguage || user.languages?.[0];
                                
                                if (!preferredLang) {
                                  return <span className="text-gray-500">No preferred language set</span>;
                                }
                                
                                // Get assessment data for the user's preferred language
                                let completedAssessments = 0;
                                let totalAssessments = 0;
                                
                                // Prefer progress from user object; fallback to lazily loaded map
                                const progressSource = (user.progress as Record<string, unknown> | undefined) || userProgressMap[user.id];
                                let langProgress: unknown = undefined;
                                if (progressSource) {
                                  const keys = Object.keys(progressSource as Record<string, unknown>);
                                  const matchedKey = keys.find(k => k.toLowerCase() === String(preferredLang).toLowerCase());
                                  if (matchedKey) {
                                    langProgress = (progressSource as Record<string, unknown>)[matchedKey];
                                  }
                                }
                                if (langProgress) {
                                  
                                  // Get the actual assessment count from the fetched data
                                  if (typeof langProgress === 'object' && langProgress !== null) {
                                    // Use the assessmentCount field we added in the API
                                    completedAssessments = (langProgress as { assessmentCount?: number; wordAssessment?: number; completedAssessments?: number }).assessmentCount || 
                                                         (langProgress as { assessmentCount?: number; wordAssessment?: number; completedAssessments?: number }).wordAssessment || 
                                                         (langProgress as { assessmentCount?: number; wordAssessment?: number; completedAssessments?: number }).completedAssessments || 0;
                                    
                                    // If no direct count, try to count from assessments array
                                    if (completedAssessments === 0 && (langProgress as { assessments?: unknown[] }).assessments) {
                                      completedAssessments = Array.isArray((langProgress as { assessments?: unknown[] }).assessments) ? 
                                                           (langProgress as { assessments: unknown[] }).assessments.length : 0;
                                    }
                                    
                                    // If still no count, try to count from assessmentsByLevel
                                    if (completedAssessments === 0 && (langProgress as { assessmentsByLevel?: Record<string, unknown> }).assessmentsByLevel) {
                                      const assessmentsByLevel = (langProgress as { assessmentsByLevel: Record<string, unknown> }).assessmentsByLevel;
                                      completedAssessments = Object.values(assessmentsByLevel).reduce((total: number, levelAssessments: unknown) => {
                                        return total + (Array.isArray(levelAssessments) ? levelAssessments.length : 0);
                                      }, 0);
                                    }
                                  } else if (typeof langProgress === 'number') {
                                    completedAssessments = langProgress;
                                  }
                                }
                                
                                // If the per-user progress API returned counts, use them
                                // We expect shape: { assessmentCounts: { beginner, intermediate, advanced }, itemCounts: { ... } }
                                if (typeof langProgress === 'object' && langProgress !== null) {
                                  const ap = (langProgress as { assessmentCounts?: Record<string, number> }).assessmentCounts;
                                  const ic = (langProgress as { itemCounts?: Record<string, number> }).itemCounts;
                                  if (ap && ic) {
                                    const completed = (ap['beginner'] || 0) + (ap['intermediate'] || 0) + (preferredLang.toLowerCase() === 'english' ? (ap['advanced'] || 0) : 0);
                                    const total = (ic['beginner'] || 0) + (ic['intermediate'] || 0) + (preferredLang.toLowerCase() === 'english' ? (ic['advanced'] || 0) : 0);
                                    if (total > 0) {
                                      completedAssessments = completed;
                                      totalAssessments = total;
                                    }
                                  }
                                }
                                // Fallback estimate only if nothing from API
                                if (totalAssessments === 0) {
                                  const estimatedTotals: Record<string, number> = {
                                    'english': 25,
                                    'spanish': 20,
                                    'french': 18,
                                    'german': 16,
                                    'mandarin': 22,
                                    'japanese': 20,
                                    'korean': 18,
                                    'italian': 15,
                                    'portuguese': 17,
                                    'dutch': 14,
                                    'russian': 19,
                                    'arabic': 21,
                                    'hindi': 16,
                                    'chinese': 22
                                  };
                                  totalAssessments = estimatedTotals[preferredLang.toLowerCase()] || 15;
                                }
                                
                                // Calculate progress percentage
                                const progressPercentage = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;
                                
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-[#0277BD]">{formatLanguageName(String(preferredLang))}</span>
                                      <span className="text-xs text-gray-600">
                                        {completedAssessments}/{totalAssessments} assessments
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-[#0277BD] h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                                      ></div>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {progressPercentage.toFixed(0)}% complete
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                            <div className="flex items-center justify-start space-x-2">
                              {/* View Details Button */}
                              <button 
                                className="p-2 rounded-md text-[#0277BD] hover:text-[#0288D1] hover:bg-blue-50 transition-colors"
                                title="View Details"
                                onClick={async () => {
                                  if (expandedUserId === user.id) { setExpandedUserId(null); setExpandedProgress(null); return; }
                                  try {
                                    setLoadingExpanded(true);
                                    setExpandedUserId(user.id);
                                    const res = await fetch(`/api/user-progress/${user.id}/all`, { headers: { 'Cache-Control': 'no-cache' } });
                                    const json = await res.json();
                                    if (json?.success) setExpandedProgress(json.progress as Record<string, unknown>);
                                  } finally {
                                    setLoadingExpanded(false);
                                  }
                                }}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                              </button>
                              
                              {/* Reset Progress Button */}
                              <button 
                                className="p-2 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                title="Reset All Progress - This will delete all assessments, achievements, and challenges"
                                onClick={() => {
                                  showConfirm(
                                    'Reset All User Progress',
                                    `Are you sure you want to reset ALL progress for ${user.name || 'this user'}?\n\nThis will permanently delete:\n• All completed assessments\n• All achievements and badges\n• All challenges and streaks\n• All progress data\n\nThis action cannot be undone!`,
                                    () => performResetProgress(user.id, user.name || 'this user'),
                                    undefined,
                                    'Reset Progress',
                                    'Cancel'
                                  );
                                }}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'feedbacks' && null}

            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-[#0277BD]">Profanity Notifications</h2>
                <p className="text-gray-600 mb-6">Monitor and manage users with profanity violations</p>

                {/* Filters */}
                <div className="bg-white shadow-sm border border-[#29B6F6]/20 rounded-lg mb-6">
                  <div className="px-6 py-4">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-700">Filter:</span>
                      <div className="flex space-x-2">
                        {[
                          { key: 'all', label: 'All Users', count: profanityUsers.length },
                          { key: 'high', label: 'High Risk (10+)', count: profanityUsers.filter(u => u.profanityCount >= 10).length },
                          { key: 'recent', label: 'Recent Activity', count: profanityUsers.filter(u => {
                            const oneDayAgo = new Date();
                            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                            if (!u.lastProfanityDetected) return false;
                            try {
                              const lastDetected = (u.lastProfanityDetected as unknown as { toDate?: () => Date }).toDate ? 
                                (u.lastProfanityDetected as unknown as { toDate: () => Date }).toDate() : 
                                new Date(u.lastProfanityDetected as string | number);
                              return lastDetected > oneDayAgo;
                            } catch {
                              return false;
                            }
                          }).length }
                        ].map(({ key, label, count }) => (
                          <button
                            key={key}
                            onClick={() => setProfanityFilter(key as 'all' | 'high' | 'recent')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              profanityFilter === key
                                ? 'bg-[#29B6F6] text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {label} ({count})
                          </button>
                        ))}
                      </div>
                      <div className="ml-auto">
                        <button
                          onClick={loadProfanityUsers}
                          className="px-4 py-2 bg-[#29B6F6] text-white rounded-lg hover:bg-[#0288D1] transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Users List */}
                {(() => {
                  const filteredUsers = profanityUsers.filter(user => {
                    switch (profanityFilter) {
                      case 'high':
                        return user.profanityCount >= 10;
                      case 'recent':
                        const oneDayAgo = new Date();
                        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
                        if (!user.lastProfanityDetected) return false;
                        try {
                          const lastDetected = (user.lastProfanityDetected as unknown as { toDate?: () => Date }).toDate ? 
                            (user.lastProfanityDetected as unknown as { toDate: () => Date }).toDate() : 
                            new Date(user.lastProfanityDetected as string | number);
                          return lastDetected > oneDayAgo;
                        } catch {
                          return false;
                        }
                      default:
                        return true;
                    }
                  });

                  if (filteredUsers.length === 0) {
                    return (
                      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                        <div className="text-gray-400 mb-4">
                          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No profanity violations found</h3>
                        <p className="text-gray-600 mb-4">
                          {profanityFilter === 'all' 
                            ? 'No users have used profanity in the app.'
                            : `No users match the "${profanityFilter}" filter criteria.`
                          }
                        </p>
                        <div className="text-sm text-gray-500">
                          <p>Debug info: Check browser console for detailed logs.</p>
                          <p>Total users loaded: {profanityUsers.length}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                          <div className="p-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                                  <span className="text-red-600 font-bold text-lg">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                                  <p className="text-sm text-gray-600">{user.email}</p>
                                  <div className="flex items-center space-x-4 mt-1">
                                    <span className="text-sm text-red-600 font-medium">
                                      {user.profanityCount} profanity violations
                                    </span>
                                    <span className="text-sm text-gray-500">
                                      Last: {formatTimestamp(user.lastProfanityDetected)}
                                    </span>
                                    {user.isDisabled && (
                                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                        DISABLED
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => {
                                    setSelectedProfanityUser(user);
                                    setShowProfanityDetails(true);
                                  }}
                                  className="px-4 py-2 text-[#29B6F6] border border-[#29B6F6] rounded-lg hover:bg-[#29B6F6]/10 transition-colors"
                                >
                                  View Details
                                </button>
                                
                                {user.isDisabled ? (
                                  <button
                                    onClick={() => handleDisableUser(user.id, false)}
                                    disabled={profanityActionLoading === user.id}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                  >
                                    {profanityActionLoading === user.id ? 'Enabling...' : 'Enable User'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDisableUser(user.id, true)}
                                    disabled={profanityActionLoading === user.id}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                  >
                                    {profanityActionLoading === user.id ? 'Disabling...' : 'Disable User'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          {expandedUserId && (
            <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#0277BD]">All Languages Progress</h3>
                <button className="text-sm text-gray-600" onClick={() => { setExpandedUserId(null); setExpandedProgress(null); }}>Close</button>
              </div>
              {loadingExpanded ? (
                <div className="py-6 text-gray-700">Loading...</div>
              ) : !expandedProgress ? (
                <div className="py-6 text-gray-500">No data</div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  {Object.entries(expandedProgress).map(([lang, data]) => {
                    const d = data as { points?: number; level?: string; completedAssessments?: number; assessmentCounts?: Record<string, number>; itemCounts?: Record<string, number> };
                    const counts = d.assessmentCounts || {};
                    const items = d.itemCounts || {};
                    return (
                      <div key={lang} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-gray-900">{formatLanguageName(String(lang))}</div>
                        </div>
                        <div className="text-sm text-gray-800">Points: {d.points || 0}</div>
                        <div className="text-sm text-gray-800">Completed: {d.completedAssessments || 0}</div>
                        <div className="mt-2 text-xs text-gray-700">
                          <div>Beginner: {counts['beginner'] || 0} / {items['beginner'] || 0}</div>
                          <div>Intermediate: {counts['intermediate'] || 0} / {items['intermediate'] || 0}</div>
                          {lang.toLowerCase() === 'english' && (
                            <div>Advanced: {counts['advanced'] || 0} / {items['advanced'] || 0}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profanity Details Modal */}
        {showProfanityDetails && selectedProfanityUser && (
          <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Profanity Details - {selectedProfanityUser.name}
                  </h3>
                  <button
                    onClick={() => setShowProfanityDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800">Total Violations</h4>
                    <p className="text-2xl font-bold text-red-600">{selectedProfanityUser.profanityCount}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800">Last Detected</h4>
                    <p className="text-sm text-blue-600">{formatTimestamp(selectedProfanityUser.lastProfanityDetected)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-800">Account Status</h4>
                    <p className={`text-sm font-medium ${selectedProfanityUser.isDisabled ? 'text-red-600' : 'text-green-600'}`}>
                      {selectedProfanityUser.isDisabled ? 'DISABLED' : 'ACTIVE'}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Recent Profanity Records</h4>
                    <button
                      onClick={() => {
                        // Reload profanity users to get fresh data
                        loadProfanityUsers();
                        // Close and reopen modal to refresh data
                        setShowProfanityDetails(false);
                        setTimeout(() => {
                          setShowProfanityDetails(true);
                        }, 100);
                      }}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                  {selectedProfanityUser.recentProfanity.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No recent records found</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedProfanityUser.recentProfanity.map((record, index) => (
                        <div key={record.id} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-600">
                              #{index + 1} - {record.context}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(record.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-800 mb-2">{record.text}</p>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-red-600">
                              Language: {record.language}
                            </span>
                            <span className="text-orange-600">
                              Words: {record.detectedWords?.join(', ') || 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowProfanityDetails(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                  {selectedProfanityUser.isDisabled ? (
                    <button
                      onClick={() => {
                        handleDisableUser(selectedProfanityUser.id, false);
                        setShowProfanityDetails(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Enable User
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleDisableUser(selectedProfanityUser.id, true);
                        setShowProfanityDetails(false);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Disable User
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
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
      </div>
    </AdminProtection>
  );
} 