'use client';

import { useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

// Admin email constant
const ADMIN_EMAIL = 'polyglAITool@gmail.com';

type AdminProtectionProps = {
  children: ReactNode;
};

export default function AdminProtection({ children }: AdminProtectionProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // No user logged in, redirect to admin login
        setLoading(false);
        router.push('/admin/login');
        return;
      }
      
      // Check if email matches admin email (case-insensitive)
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        // Admin user, allow access
        setIsAuthorized(true);
        setLoading(false);
      } else {
        // Not admin, redirect to admin login with error
        setLoading(false);
        router.push('/admin/login?error=adminOnly');
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-800">Verifying access...</p>
        </div>
      </div>
    );
  }

  // If user is not authorized, don't render children while redirecting
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500">You don&apos;t have permission to access this page. Redirecting...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 