'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import AdminProtection from '../../src/components/AdminProtection';
import { useUsersData } from '../../src/hooks/useUsersData';

import UserTable from '../../src/components/UserTable';
import DashboardStats from '../../src/components/DashboardStats';
import PerformanceMonitor from '../../src/components/PerformanceMonitor';



export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('demographics');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  
  // Filter states
  const [ageFilter, setAgeFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [professionFilter, setProfessionFilter] = useState<string[]>([]);
  
  // Use optimized data hooks
  const { users, loading, refetch, debugInfo } = useUsersData();


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Check if user is admin
        console.log("Current user:", currentUser.email);
        
        // Use case-insensitive comparison for email check
        const isAdmin = currentUser.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase();
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
    // Filter by gender if gender filter is active
    if (genderFilter.length > 0 && user.gender) {
      if (!genderFilter.includes(user.gender)) {
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



  if (loading) {
    return (
      <AdminProtection>
        <div className="flex min-h-screen bg-gray-50">
          {/* Mobile menu backdrop */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div className="w-64 md:w-64 lg:w-64 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
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
                  <Image 
                    src="/logo_txt.png" 
                    alt="PolyglAI" 
                    width={100} 
                    height={32} 
                    className="h-6 w-auto"
                  />
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
                    <button 
                      onClick={() => setActiveTab('feedbacks')}
                      className={`px-2 sm:px-4 py-2 rounded-md whitespace-nowrap text-sm sm:text-base ${activeTab === 'feedbacks' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                    >
                      <div className="flex items-center">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                        </svg>
                        <span className="hidden sm:inline">Feedbacks</span>
                        <span className="sm:hidden">Feedback</span>
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
        <div className="w-64 md:w-64 lg:w-64 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
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
            </div>
          </nav>
        </div>

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
                    onClick={() => setActiveTab('feedbacks')}
                    className={`px-2 lg:px-3 xl:px-4 py-1 lg:py-2 rounded-md whitespace-nowrap text-xs lg:text-sm xl:text-base ${activeTab === 'feedbacks' ? 'bg-[#29B6F6]/20 text-[#0277BD]' : 'text-gray-800'}`}
                  >
                    <div className="flex items-center">
                      <svg className="w-3 lg:w-4 xl:w-5 h-3 lg:h-4 xl:h-5 mr-1 xl:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                      </svg>
                      <span className="hidden lg:inline">Feedbacks</span>
                      <span className="lg:hidden">Feedback</span>
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
                              setGenderFilter(['Male', 'Female', 'Non Binary', 'Prefer not to say']);
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
                        {['Male', 'Female', 'Non Binary', 'Prefer not to say'].map(gender => {
                          const count = users.filter(u => u.gender === gender).length;
                          
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
                              {user.preferredLanguage || user.languages?.[0] || 'Not set'}
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
                                
                                // Check if user has progress data for their preferred language
                                if (user.progress && user.progress[preferredLang]) {
                                  const langProgress = user.progress[preferredLang];
                                  
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
                                
                                // Estimate total assessments based on language
                                // This could be fetched from a separate API endpoint in a real implementation
                                const assessmentCounts: Record<string, number> = {
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
                                
                                totalAssessments = assessmentCounts[preferredLang.toLowerCase()] || 15;
                                
                                // Calculate progress percentage
                                const progressPercentage = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0;
                                
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-[#0277BD]">{preferredLang}</span>
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
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {/* View Details Button */}
                              <button 
                                className="p-2 rounded-md text-[#0277BD] hover:text-[#0288D1] hover:bg-blue-50 transition-colors"
                                title="View Details"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                              </button>
                              
                              {/* Reset Progress Button */}
                              <button 
                                className="p-2 rounded-md text-orange-600 hover:text-orange-800 hover:bg-orange-50 transition-colors"
                                title="Reset Progress"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
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

            {activeTab === 'feedbacks' && (
              <div>
                <h2 className="text-2xl font-bold mb-6 text-[#0277BD]">User Feedback</h2>
                <div className="bg-white rounded-2xl shadow-sm p-8">
                  <p className="text-gray-800 mb-4">This section will display user feedback when implemented in the database.</p>
                  
                  {/* Placeholder for future feedback data */}
                  <div className="p-4 bg-[#0277BD]/5 rounded-md text-gray-800">
                    <p>No feedback data available yet. Add a &apos;feedback&apos; collection to your Firestore database to display user feedback here.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Performance Monitor */}
        <PerformanceMonitor />
      </div>
    </AdminProtection>
  );
} 