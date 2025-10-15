'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getErrorMessage } from '../lib/auth-error-handler';

type Mode = 'user' | 'admin';

export default function SignInDialog({
  isOpen,
  onClose,
  mode,
}: { isOpen: boolean; onClose: () => void; mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const isAdminMode = mode === 'admin';
  const adminEmail = 'polyglAITool@gmail.com';

  useEffect(() => {
    if (!isOpen) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (isAdminMode) {
          if (user.email?.toLowerCase() === adminEmail.toLowerCase()) {
            router.push('/dashboard');
            onClose();
          } else {
            auth.signOut();
            setError('Access denied. This is an admin-only area.');
          }
        } else {
          if (user.email?.toLowerCase() === adminEmail.toLowerCase()) {
            auth.signOut();
            setError('Please use the admin sign-in.');
          } else {
            router.push('/user-dashboard');
            onClose();
          }
        }
      }
    });
    return () => unsub();
  }, [isOpen, isAdminMode, router, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    if (isAdminMode && email.toLowerCase() !== adminEmail.toLowerCase()) {
      setError('Invalid admin credentials.');
      return;
    }
    if (!isAdminMode && email.toLowerCase() === adminEmail.toLowerCase()) {
      setError('Use the admin sign-in option.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (isAdminMode) {
        if (cred.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
          setError('Access denied.');
          await auth.signOut();
          setLoading(false);
          return;
        }
        router.push('/dashboard');
      } else {
        if (cred.user.email?.toLowerCase() === adminEmail.toLowerCase()) {
          await auth.signOut();
          setError('Please use the admin sign-in.');
          setLoading(false);
          return;
        }
        router.push('/user-dashboard');
      }
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, isAdminMode ? 'admin' : 'user'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        client_id: '384494047717-mbt8equ74qv39lgi6m5p9j1iffer0r1m.apps.googleusercontent.com',
        prompt: 'select_account',
      });
      const result = await signInWithPopup(auth, provider);
      if (isAdminMode) {
        if (result.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
          setError('Access denied. Only authorized administrators can access this area.');
          await auth.signOut();
          setLoading(false);
          return;
        }
        router.push('/dashboard');
      } else {
        // Check firestore profile existence
        const userDocRef = doc(db, 'users', result.user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await auth.signOut();
            router.push('/login?error=signupViaMobile');
            setLoading(false);
            return;
          }
        } catch {
          await auth.signOut();
          router.push('/login?error=signupViaMobile');
          setLoading(false);
          return;
        }
        if (result.user.email?.toLowerCase() === adminEmail.toLowerCase()) {
          await auth.signOut();
          setError('Please use the admin sign-in.');
          setLoading(false);
          return;
        }
        router.push('/user-dashboard');
      }
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, isAdminMode ? 'admin' : 'user'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required');
      return;
    }
    if (isAdminMode && email.toLowerCase() !== adminEmail.toLowerCase()) {
      setError('Password reset is only available for authorized admin accounts.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const actionCodeSettings = {
        url: window.location.origin + '/reset-password',
        handleCodeInApp: true,
      } as const;
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccessMessage('Password reset email sent! Please check your inbox.');
      setTimeout(() => {
        setIsForgotPassword(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, isAdminMode ? 'admin' : 'user'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6 text-black">
            {isForgotPassword ? 'Reset Password' : isAdminMode ? 'Admin Login' : 'User Login'}
          </h1>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleResetPassword}>
              <p className="mb-4 text-black">Enter your email address to reset your password</p>
              <label className="block mb-2 text-black font-medium">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mb-6 px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black" placeholder={isAdminMode ? adminEmail : 'helloworld@gmail.com'} required />
              <button type="submit" disabled={loading} className="w-full py-4 bg-[#29B6F6] text-white font-bold rounded-full hover:bg-[#0288D1] transition-colors duration-200 mb-6">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <div className="text-center">
                <button type="button" onClick={() => setIsForgotPassword(false)} className="text-[#0277BD] hover:underline">
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 text-black font-medium">{isAdminMode ? 'Admin Email Address' : 'Email address'}</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black" placeholder={isAdminMode ? adminEmail : 'helloworld@gmail.com'} required />
              </div>
              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <label className="text-black font-medium">Password</label>
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-black hover:text-[#0277BD]">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black" placeholder="••••••••" required />
                  <button type="button" className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-600" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-[#29B6F6] text-white font-bold rounded-full hover:bg-[#0288D1] transition-colors duration-200 mb-6">
                {loading ? (isAdminMode ? 'Signing in...' : 'Logging in...') : (isAdminMode ? '🔐 Access Admin Dashboard' : 'Log in')}
              </button>
              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-4 text-black text-sm">Or sign in with</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
              <div className="flex justify-center">
                <button type="button" onClick={handleGoogleSignIn} disabled={loading} className="w-40 h-12 flex justify-center items-center border border-gray-300 rounded-full hover:bg-gray-50 transition-colors duration-200">
                  <Image src="/google.svg" alt="Google Logo" width={24} height={24} />
                </button>
              </div>
            </form>
          )}

          {/* Removed administrator login link in user mode */}
        </div>
      </div>
    </div>
  );
}


