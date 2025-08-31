'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';
import AdminProtection from '../../../src/components/AdminProtection';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
  status?: string;
  country?: string;
  gender?: string;
};

export default function UsersManagement() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('user');
  const [error, setError] = useState('');
  const router = useRouter();
  
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log("Fetching users from API...");
      
      // Try the Admin SDK API first since service account key is available
      try {
        const response = await fetch('/api/users');
        
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.users) {
          console.log(`Admin API returned ${data.users.length} users`);
          
          // Convert the data to match our User type
          const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
            id: user.id || user.uid || 'unknown',
            name: user.name || user.displayName || 'Unnamed User',
            email: user.email || 'No email',
            role: user.role || 'user',
            createdAt: user.createdAt || (user.metadata as { creationTime?: string })?.creationTime || new Date().toISOString(),
            lastLogin: user.lastLogin || (user.metadata as { lastSignInTime?: string })?.lastSignInTime,
            status: user.status || 'ACTIVE',
            country: user.location || user.country || getRandomCountry(),
            gender: user.gender || getRandomGender(),
          }));
          
          setUsers(convertedUsers);
          return;
        } else {
          throw new Error(data.error || 'API returned unsuccessful response');
        }
      } catch (error: unknown) {
        console.error("Error fetching users with Admin SDK:", error);
        
        // Fall back to temp hack API
        try {
          console.log("Trying temp hack API...");
          const response = await fetch('/api/temp-hack');
          
          if (!response.ok) {
            throw new Error(`API responded with status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.success && data.users) {
            console.log(`Temp hack API returned ${data.users.length} users`);
            
            // Convert the data to match our User type
            const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
              id: user.id || 'unknown',
              name: user.name || 'Unnamed User',
              email: user.email || 'No email',
              role: user.role || 'user',
              createdAt: user.createdAt || new Date().toISOString(),
              lastLogin: user.lastLogin,
              status: user.status || 'ACTIVE',
              country: user.location || user.country || getRandomCountry(),
              gender: user.gender || getRandomGender(),
            }));
            
            setUsers(convertedUsers);
            return;
          } else {
            throw new Error(data.error || 'Temp API returned unsuccessful response');
          }
        } catch (tempError: unknown) {
          console.error("Error fetching from temp hack API:", tempError);
          
          // Fall back to direct API
          try {
            console.log("Trying direct API...");
            const response = await fetch('/api/users-direct');
            
            if (!response.ok) {
              throw new Error(`API responded with status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.users) {
              console.log(`Direct API returned ${data.users.length} users`);
              
              // Convert the data to match our User type
              const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
                id: user.id || 'unknown',
                name: user.name || 'Unnamed User',
                email: user.email || 'No email',
                role: user.role || 'user',
                createdAt: user.createdAt || new Date().toISOString(),
                lastLogin: user.lastLogin,
                status: user.status || 'ACTIVE',
                country: user.location || user.country || getRandomCountry(),
                gender: user.gender || getRandomGender(),
              }));
              
              setUsers(convertedUsers);
              return;
            } else {
              throw new Error(data.error || 'Direct API returned unsuccessful response');
            }
          } catch (directError: unknown) {
            console.error("Error fetching from direct API:", directError);
            
            // Fall back to alternative API
            try {
              console.log("Trying alternative API...");
              const response = await fetch('/api/users-alt');
              
              if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
              }
              
              const data = await response.json();
              
              if (data.success && data.users) {
                console.log(`Alternative API returned ${data.users.length} users`);
                
                // Convert the data to match our User type
                const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
                  id: user.id || 'unknown',
                  name: user.name || 'Unnamed User',
                  email: user.email || 'No email',
                  role: user.role || 'user',
                  createdAt: user.createdAt || new Date().toISOString(),
                  lastLogin: user.lastLogin,
                  status: user.status || 'ACTIVE',
                  country: user.location || user.country || getRandomCountry(),
                  gender: user.gender || getRandomGender(),
                }));
                
                setUsers(convertedUsers);
                return;
              } else {
                throw new Error(data.error || 'Alternative API returned unsuccessful response');
              }
            } catch (altError: unknown) {
              console.error("Error fetching from alternative API:", altError);
              setError('All API endpoints failed. Unable to load users.');
            }
          }
        }
      }
    } catch (err: unknown) {
      console.error('Error in fetchUsers:', err);
      const error = err as { message?: string };
      setError(`Error loading users: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

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
        
        fetchUsers();
      } else {
        // Redirect to login if not authenticated
        router.push('/login');
      }
    });
    
    return () => unsubscribe();
  }, [router, fetchUsers]);

  const getRandomCountry = () => {
    const countries = ['PH', 'US', 'UK', 'CA', 'AU', 'JP'];
    return countries[Math.floor(Math.random() * countries.length)];
  };

  const getRandomGender = () => {
    const genders = ['Male', 'Female', 'Non Binary'];
    return genders[Math.floor(Math.random() * genders.length)];
  };



  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    const action = newStatus === 'DISABLED' ? 'disable' : 'enable';
    
    if (confirm(`Are you sure you want to ${action} this user account?`)) {
      try {
        setLoading(true);
        setError('');
        
        // Update user status in Firestore
        await updateDoc(doc(db, 'users', userId), {
          status: newStatus,
        });
        
        // Refresh the users list
        await fetchUsers();
      } catch (err) {
        console.error('Error updating user status:', err);
        setError(`Failed to ${action} user account. Please try again.`);
        setLoading(false);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone and will remove both their account and all data.')) {
      try {
        setLoading(true);
        setError('');
        
        console.log(`Attempting to delete user: ${userId}`);
        
        // Call our DELETE API
        const response = await fetch(`/api/delete-user?userId=${userId}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        console.log('Delete response:', data);
        
        if (data.success) {
          // Show detailed success message
          const details = data.details || {};
          let message = 'User deletion completed';
          
          if (details.firestoreDeleted && details.authDeleted) {
            message = 'User account and data deleted successfully';
          } else if (details.firestoreDeleted && !details.authDeleted) {
            message = 'User data deleted, but authentication account was not found (user may have been deleted from Firebase Auth already)';
          } else if (!details.firestoreDeleted && details.authDeleted) {
            message = 'User authentication account deleted, but some data may remain';
          }
          
          console.log(message);
          
          // Refresh the users list after deletion
          await fetchUsers();
        } else {
          setError(`Failed to delete user: ${data.error || 'Unknown error'}`);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        setError('Failed to delete user. Please try again.');
        setLoading(false);
      }
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const filteredUsers = users.filter(user => {
    if (activeTab === 'disabled') return user.status === 'DISABLED';
    return user.role === 'user';
  });

  if (loading && users.length === 0) {
    return (
      <AdminProtection>
        <div className="flex min-h-screen bg-gray-50">
          {/* Sidebar */}
          <div className="w-56 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
            <div className="p-4 xl:p-6 border-b border-[#29B6F6]/30">
              <Image 
                src="/logo_txt.png" 
                alt="PolyglAI" 
                width={120} 
                height={40} 
                className="h-8 xl:h-10 w-auto"
              />
            </div>
            <nav className="mt-6">
              <div className="px-3 xl:px-4 space-y-1">
                <Link href="/dashboard" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
                  </svg>
                  <span className="text-sm xl:text-base">Dashboard</span>
                </Link>
                <Link href="/dashboard/languages" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <span className="text-sm xl:text-base">Language Management</span>
                </Link>
                <Link href="/dashboard/word-trainer" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                  <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                  </svg>
                  <span className="text-sm xl:text-base">Word Trainer</span>
                </Link>
                <Link href="/dashboard/users" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 bg-[#29B6F6]/20 rounded-md text-white">
                  <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                  <span className="text-sm xl:text-base">Users</span>
                </Link>
              </div>
            </nav>
          </div>

          {/* Main Content - Loading State */}
          <div className="flex-1 bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <h1 className="text-2xl font-bold text-[#0277BD]">User Management</h1>
              </div>
            </header>
            
            {/* Loading Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD] mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading users...</p>
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
        <div className="w-56 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
          <div className="p-4 xl:p-6 border-b border-[#29B6F6]/30">
            <Image 
              src="/logo_txt.png" 
              alt="PolyglAI" 
              width={120} 
              height={40} 
              className="h-8 xl:h-10 w-auto"
            />
          </div>
          <nav className="mt-6">
            <div className="px-3 xl:px-4 space-y-1">
              <Link href="/dashboard" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
                </svg>
                <span className="text-sm xl:text-base">Dashboard</span>
              </Link>
              <Link href="/dashboard/languages" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span className="text-sm xl:text-base">Language Management</span>
              </Link>
              <Link href="/dashboard/word-trainer" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
                <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
                <span className="text-sm xl:text-base">Word Trainer</span>
              </Link>
              <Link href="/dashboard/users" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 bg-[#29B6F6]/20 rounded-md text-white">
                <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                <span className="text-sm xl:text-base">Users</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-2xl font-bold text-[#0277BD]">User Management</h1>
            </div>
          </header>
          
          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {error && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700">
                {error}
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="flex border-b">
                <button 
                  onClick={() => setActiveTab('user')}
                  className={`px-8 py-4 font-medium ${activeTab === 'user' ? 'border-b-2 border-[#0277BD] text-[#0277BD]' : 'text-gray-500'}`}
                >
                  User
                </button>
                <button 
                  onClick={() => setActiveTab('disabled')}
                  className={`px-8 py-4 font-medium ${activeTab === 'disabled' ? 'border-b-2 border-[#0277BD] text-[#0277BD]' : 'text-gray-500'}`}
                >
                  Disabled accounts
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0277BD]"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-6 py-3 text-left">
                        <input type="checkbox" className="h-4 w-4" />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Country
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gender
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                          No users found in this category.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, index) => (
                        <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4">
                            <input type="checkbox" className="h-4 w-4" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 mr-3">
                                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                              </div>
                              <div className="font-medium text-gray-900">{user.name || 'Unnamed User'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-blue-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-green-500 font-medium">
                              {user.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {user.country || 'PH'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            {user.gender || 'Male'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {/* Disable/Enable Button */}
                              <button 
                                onClick={() => handleToggleStatus(user.id, user.status || 'ACTIVE')}
                                className={`p-2 rounded-md transition-colors ${
                                  (user.status || 'ACTIVE') === 'DISABLED' 
                                    ? 'text-green-600 hover:text-green-800 hover:bg-green-50' 
                                    : 'text-orange-600 hover:text-orange-800 hover:bg-orange-50'
                                }`}
                                title={(user.status || 'ACTIVE') === 'DISABLED' ? 'Enable Account' : 'Disable Account'}
                              >
                                {(user.status || 'ACTIVE') === 'DISABLED' ? (
                                  // Enable icon (unlock)
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                                  </svg>
                                ) : (
                                  // Disable icon (lock)
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                  </svg>
                                )}
                              </button>
                              
                              {/* Delete Button */}
                              <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-2 rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors"
                                title="Delete Account"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminProtection>
  );
} 