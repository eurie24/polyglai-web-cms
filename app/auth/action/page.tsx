'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  
  useEffect(() => {
    // Handle Firebase default auth action URLs
    if (mode === 'resetPassword' && oobCode) {
      // Redirect to our custom reset password page with the same parameters
      router.push(`/reset-password?mode=${mode}&oobCode=${oobCode}`);
    } else {
      // For any other auth actions or invalid links, go to login
      router.push('/login');
    }
  }, [mode, oobCode, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

export default function AuthAction() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthActionContent />
    </Suspense>
  );
} 