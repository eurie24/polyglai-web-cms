'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get oobCode from either query param or from mode=resetPassword&oobCode=xxx format
  const oobCode = searchParams.get('oobCode') || searchParams.get('apiKey');
  const mode = searchParams.get('mode');

  // Verify the password reset code when the component mounts
  useEffect(() => {
    const verifyResetCode = async () => {
      // Check if we're in reset password mode
      if (!oobCode || (mode && mode !== 'resetPassword')) {
        setError('Invalid password reset link. Please request a new one.');
        setVerifying(false);
        return;
      }

      try {
        // Verify the reset code and get the associated email
        const email = await verifyPasswordResetCode(auth, oobCode);
        setEmail(email);
        setVerifying(false);
      } catch (err: unknown) {
        console.error('Error verifying reset code:', err);
        setError('This password reset link has expired or is invalid. Please request a new one.');
        setVerifying(false);
      }
    };

    verifyResetCode();
  }, [oobCode, mode]);

  // Handle direct deep links from Firebase emails
  useEffect(() => {
    // If this page was loaded via a deep link from Firebase, extract the oobCode
    // This helps handle the Firebase default reset password URLs
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const deepLinkOobCode = searchParams.get('oobCode');
      const deepLinkMode = searchParams.get('mode');
      
      // If we detect a Firebase-style deep link, verify it
      if (deepLinkOobCode && deepLinkMode === 'resetPassword') {
        // The main useEffect will handle verification with the extracted oobCode
        console.log('Detected Firebase deep link for password reset');
      }
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (!oobCode) {
      setError('Missing reset code. Please try again using the link from your email.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Reset the password using Firebase Auth
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/expired-action-code') {
        setError('This password reset link has expired. Please request a new one.');
      } else if (error.code === 'auth/invalid-action-code') {
        setError('This password reset link is invalid. Please request a new one.');
      } else if (error.code === 'auth/weak-password') {
        setError('Please choose a stronger password.');
      } else {
        setError(error.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom right, #0277BD, #29B6F6)'
      }}>
      
      {/* Background circles */}
      <div className="absolute -top-[5%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#0277BD]"></div>
      <div className="absolute -top-[2%] -right-[20%] w-[50%] h-[50%] rounded-full bg-[#1A237E]"></div>

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-24 relative z-10">
        {/* Logo and tagline */}
        <div className="text-center mb-16 sm:mb-20 md:mb-24">
          <div className="mb-2">
            <Image src="/logo_txt.png" alt="PolyglAI Logo" width={200} height={60} className="mx-auto" />
          </div>
          <p className="text-white font-bold text-sm sm:text-base">
            Learn, Translate, Improve Proficiency
          </p>
        </div>

        {/* Reset password form container */}
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-black">Reset Your Password</h1>
          
          {verifying && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-black">Verifying your reset link...</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4">
              <p className="text-sm text-red-700">{error}</p>
              {(error.includes('expired') || error.includes('invalid')) && (
                <div className="mt-2">
                  <Link href="/login" className="text-blue-600 hover:underline">
                    Return to login
                  </Link>
                </div>
              )}
            </div>
          )}
          
          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4">
              <p className="text-sm text-green-700">Your password has been reset successfully!</p>
              <p className="text-sm text-green-700 mt-2">Redirecting you to the login page...</p>
            </div>
          )}

          {!verifying && !error.includes('expired') && !error.includes('invalid') && !success && (
            <form onSubmit={handleResetPassword}>
              {email && (
                <div className="mb-6">
                  <p className="text-black">
                    Setting new password for <span className="font-medium">{email}</span>
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block mb-2 text-black font-medium">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black"
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-black font-medium">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#29B6F6] text-white font-bold rounded-full hover:bg-[#0288D1] transition-colors duration-200 mb-4"
              >
                {loading ? (
                  <span className="flex justify-center items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Resetting Password...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </button>
              
              <div className="text-center">
                <Link href="/login" className="text-[#0277BD] hover:underline">
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 