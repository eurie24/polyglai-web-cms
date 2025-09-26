'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AdminSidebar from '../../../src/components/AdminSidebar';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';
import AdminProtection from '../../../src/components/AdminProtection';
import { ADMIN_EMAIL, isAdminEmail } from '../../../src/constants/admin';
import { sendUserDisableNotification, sendUserEnableNotification } from '../../../src/lib/emailService';
import CustomDialog from '../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../src/hooks/useCustomDialog';

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
  const { dialogState, showConfirm, showError, showSuccess, hideDialog } = useCustomDialog();
  
  const fetchUsersWithCacheBust = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log("Fetching users from API with cache busting...");
      const timestamp = Date.now();

      // 1) Try optimized API first with cache busting
      try {
        const response = await fetch(`/api/users-optimized?fresh=1&_=${timestamp}`, { 
          headers: { 
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          } 
        });
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.users) {
          console.log(`Optimized API returned ${data.users.length} users (fresh data)`);
          const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
            id: user.id || user.uid || 'unknown',
            name: user.name || user.displayName || 'Unnamed User',
            email: user.email || 'No email',
            role: user.role || 'user',
            createdAt: user.createdAt || (user.metadata as { creationTime?: string })?.creationTime || new Date().toISOString(),
            lastLogin: user.lastLogin || (user.metadata as { lastSignInTime?: string })?.lastSignInTime,
            status: user.status || 'ACTIVE',
            country: user.location || (user as any).country || getRandomCountry(),
            gender: user.gender || getRandomGender(),
          }));
          setUsers(convertedUsers);
          return;
        }
      } catch (e) {
        console.warn('Optimized API failed, falling back...', e);
      }

      // 2) Try the Admin SDK API with cache busting
      try {
        const response = await fetch(`/api/users?_=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.users) {
          console.log(`Admin API returned ${data.users.length} users (fresh data)`);
          
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
        setError(`Error loading users: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } catch (err: unknown) {
      console.error('Error in fetchUsersWithCacheBust:', err);
      const error = err as { message?: string };
      setError(`Error loading users: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log("Fetching users from API...");

      // 1) Try optimized API first (same as Demographics/User Progress)
      try {
        const response = await fetch('/api/users-optimized', { headers: { 'Cache-Control': 'no-cache' } });
        if (!response.ok) {
          throw new Error(`API responded with status ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.users) {
          console.log(`Optimized API returned ${data.users.length} users`);
          const convertedUsers = data.users.map((user: Record<string, unknown>) => ({
            id: user.id || user.uid || 'unknown',
            name: user.name || user.displayName || 'Unnamed User',
            email: user.email || 'No email',
            role: user.role || 'user',
            createdAt: user.createdAt || (user.metadata as { creationTime?: string })?.creationTime || new Date().toISOString(),
            lastLogin: user.lastLogin || (user.metadata as { lastSignInTime?: string })?.lastSignInTime,
            status: user.status || 'ACTIVE',
            country: user.location || (user as any).country || getRandomCountry(),
            gender: user.gender || getRandomGender(),
          }));
          setUsers(convertedUsers);
          return;
        }
      } catch (e) {
        console.warn('Optimized API failed, falling back...', e);
      }

      // 2) Try the Admin SDK API
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
        
        // 3) Fall back to temp hack API
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
        const isAdmin = isAdminEmail(currentUser.email);
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
    const genders = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
    return genders[Math.floor(Math.random() * genders.length)];
  };

  // Helper function to normalize gender for display
  const normalizeGender = (gender?: string): string => {
    if (!gender) return 'Male';
    const normalized = gender.trim();
    
    // Handle various Non-binary formats
    if (normalized === 'Non - Binary' || normalized === 'Non Binary' || normalized === 'Non-Binary' || normalized === 'Non-binary') {
      return 'Non-binary';
    }
    
    return normalized;
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



  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
    const action = newStatus === 'DISABLED' ? 'disable' : 'enable';
    
    // Find the user to get their email and name for the notification
    const user = users.find(u => u.id === userId);
    const userEmail = user?.email;
    const userName = user?.name;
    
    console.log('User found:', user);
    console.log('User email:', userEmail);
    console.log('User name:', userName);
    
    showConfirm(
      `${action === 'disable' ? 'Disable' : 'Enable'} User Account`,
      `Are you sure you want to ${action} this user account? ${action === 'disable' ? 'The user will be logged out and notified via email.' : 'The user will be notified via email.'}`,
      () => performToggleStatus(userId, action, userEmail, userName),
      undefined,
      action === 'disable' ? 'Disable' : 'Enable',
      'Cancel'
    );
  };

  const performToggleStatus = async (userId: string, action: string, userEmail?: string, userName?: string) => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`Attempting to ${action} user: ${userId}`);
      
      // Call our disable/enable API (without email sending)
      const response = await fetch('/api/disable-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action,
          userEmail,
          userName
        }),
      });
      
      const data = await response.json();
      console.log(`${action} response:`, data);
      
      if (data.success) {
        // Send email notification from client side
        let emailSent = false;
        let emailError = null;
        
        if (userEmail && userEmail.trim() !== '') {
          try {
            console.log(`📧 Sending ${action} notification email to: ${userEmail}`);
            console.log(`📧 User name: ${userName}`);
            
            const emailResult = action === 'disable' 
              ? await sendUserDisableNotification(userEmail.trim(), userName || 'User')
              : await sendUserEnableNotification(userEmail.trim(), userName || 'User');
            
            if (emailResult.success) {
              emailSent = true;
              console.log(`✅ ${action} notification email sent successfully`);
            } else {
              emailError = emailResult.error;
              console.error(`❌ Failed to send ${action} notification email:`, emailResult.error);
            }
          } catch (emailErr) {
            emailError = emailErr instanceof Error ? emailErr.message : 'Unknown email error';
            console.error(`❌ Error sending ${action} notification email:`, emailErr);
          }
        } else {
          console.log(`⚠️ No email provided, skipping email notification`);
        }
        
        // Show detailed success message
        const details = data.details || {};
        let message = `User ${action} completed`;
        
        if (details.authUpdated && details.firestoreUpdated) {
          message = `User account ${action}d successfully`;
          if (emailSent) {
            message += ' and notification email sent';
          } else if (emailError) {
            message += ` (email notification failed: ${emailError})`;
          }
        } else if (details.firestoreUpdated && !details.authUpdated) {
          message = `User data updated, but authentication account was not found`;
        } else if (!details.firestoreUpdated && details.authUpdated) {
          message = `User authentication account ${action}d, but some data may not have been updated`;
        }
        
        console.log(message);
        
        // Force refresh the users list after the operation
        console.log('Refreshing users list...');
        
        // Clear the current users state first to force a fresh fetch
        setUsers([]);
        setLoading(true);
        
        // Wait a moment for Firestore to propagate the changes
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Fetch fresh data with cache busting
        await fetchUsersWithCacheBust();
        
        // Also force a re-render by updating the active tab if needed
        if (action === 'disable' && activeTab !== 'disabled') {
          console.log('Switching to disabled accounts tab to show the disabled user');
          setActiveTab('disabled');
          
          // Show a success message
          setTimeout(() => {
            showSuccess('User Disabled', `${userName || 'User'} has been disabled and moved to the Disabled Accounts tab.`);
          }, 1500);
        }
      } else {
        setError(`Failed to ${action} user: ${data.error || 'Unknown error'}`);
        setLoading(false);
      }
    } catch (err) {
      console.error(`Error ${action}ing user:`, err);
      setError(`Failed to ${action} user. Please try again.`);
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    showConfirm(
      'Delete User Account',
      'Are you sure you want to delete this user? This action cannot be undone and will remove both their account and all data.',
      () => performDeleteUser(userId),
      undefined,
      'Delete',
      'Cancel'
    );
  };

  const performDeleteUser = async (userId: string) => {
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
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const filteredUsers = users.filter(user => {
    // Always exclude admin user by email
    if (isAdminEmail(user.email)) {
      return false;
    }
    
    if (activeTab === 'disabled') return user.status === 'DISABLED';
    return user.role === 'user';
  });

  // Debug logging
  console.log('Current activeTab:', activeTab);
  console.log('Total users:', users.length);
  console.log('Filtered users:', filteredUsers.length);
  console.log('Users with DISABLED status:', users.filter(u => u.status === 'DISABLED').length);
  console.log('All user statuses:', users.map(u => ({ id: u.id, email: u.email, status: u.status })));
  console.log('Users in disabled tab:', users.filter(u => u.status === 'DISABLED').map(u => ({ id: u.id, email: u.email, status: u.status })));

  if (loading && users.length === 0) {
    return (
      <AdminProtection>
        <div className="flex min-h-screen bg-gray-50">
          {/* Sidebar */}
          <div className="w-56 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
            <div className="p-4 xl:p-6 border-b border-[#29B6F6]/30">
              <Link href="/dashboard" aria-label="Go to Dashboard">
                <Image 
                  src="/logo_txt.png" 
                  alt="PolyglAI" 
                  width={120} 
                  height={40} 
                  className="h-8 xl:h-10 w-auto cursor-pointer"
                />
              </Link>
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
        <AdminSidebar active="users" />

        {/* Main Content */}
        <div className="flex-1 bg-gray-50">
          {/* Header */}
          <header className="bg-white shadow">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex justify-between items-center">
                  <Link href="/dashboard" aria-label="Go to Dashboard">
                    <Image src="/logo_txt.png" alt="PolyglAI" width={120} height={40} className="h-8 w-auto cursor-pointer" />
                  </Link>
                
                {/* Export Buttons */}
                <div className="flex space-x-2">
                  <button 
                    onClick={() => {
                      console.log('Manual refresh triggered');
                      setUsers([]);
                      setLoading(true);
                      fetchUsersWithCacheBust();
                    }}
                    className="px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 transition-colors flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh Data
                  </button>
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
                <div className="overflow-x-auto">
                  <table className="min-w-full w-full table-fixed divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                          E-mail
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Date Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Country
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Gender
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            No users found in this category.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 mr-3 flex-shrink-0">
                                  {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="font-medium text-gray-900 truncate">
                                  {user.name || 'Unnamed User'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-blue-500 truncate">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                              {formatDate(user.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`font-medium ${
                                (user.status || 'ACTIVE') === 'DISABLED' 
                                  ? 'text-red-500' 
                                  : 'text-green-500'
                              }`}>
                                {user.status || 'ACTIVE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              <span className="block truncate" title={user.country || 'PH'}>
                                {user.country || 'PH'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-gray-500">
                              <span className="block truncate" title={normalizeGender(user.gender)}>
                                {normalizeGender(user.gender)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
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
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg>
                                  )}
                                </button>
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
                </div>
              )}
            </div>
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
    </AdminProtection>
  );
} 