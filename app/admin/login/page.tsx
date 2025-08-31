'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../../../src/lib/firebase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for auth state changes
  useEffect(() => {
    console.log("Setting up admin auth state listener...");
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Admin auth state changed:", user ? `User logged in: ${user.email}` : "No user");
      
      if (user) {
        // Check if user is admin
        if (user.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
          router.push('/dashboard');
        } else {
          // Sign out non-admin users
          auth.signOut();
          setError('Access denied. This is an admin-only area.');
        }
      }
    });

    // Check if there's an error parameter in the URL
    const errorParam = searchParams.get('error');
    if (errorParam === 'adminOnly') {
      setError('Admin access required. Please use admin credentials.');
    }

    // Clean up subscription
    return () => unsubscribe();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email === '' || password === '') {
      setError('Please enter both email and password.');
      return;
    }
    
    // Check if the email is the admin email
    if (email.toLowerCase() !== 'polyglAITool@gmail.com'.toLowerCase()) {
      setError('Invalid admin credentials. Only authorized administrators can access this area.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Admin login successful for:", userCredential.user.email);
      
      // Double-check admin authorization
      if (userCredential.user.email?.toLowerCase() !== 'polyglAITool@gmail.com'.toLowerCase()) {
        setError('Access denied. Invalid admin credentials.');
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Admin login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid admin credentials');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Failed to log in');
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }

    // Only allow password reset for admin email
    if (email.toLowerCase() !== 'polyglAITool@gmail.com'.toLowerCase()) {
      setError('Password reset is only available for authorized admin accounts.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/reset-password',
        handleCodeInApp: true
      };
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccessMessage('Password reset email sent to admin account. Please check your inbox.');
      setTimeout(() => {
        setIsForgotPassword(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: any) {
      console.error('Admin password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Admin account not found');
      } else {
        setError(err.message || 'Failed to send reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      console.log("Starting admin Google sign-in...");
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        client_id: '384494047717-mbt8equ74qv39lgi6m5p9j1iffer0r1m.apps.googleusercontent.com',
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth, provider);
      console.log("Admin Google sign-in attempt:", result.user.email);
      
      // Check if the signed-in user is the admin
      if (result.user.email?.toLowerCase() !== 'polyglAITool@gmail.com'.toLowerCase()) {
        setError('Access denied. Only authorized administrators can access this area.');
        await auth.signOut();
        setLoading(false);
        return;
      }
      
      // If admin, proceed to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Admin Google sign-in error:', err);
      setError(`Admin authentication failed: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom right, #1A237E, #0277BD, #29B6F6)'
      }}>
      
      {/* Background circles with admin theme */}
      <div className="absolute -top-[5%] -left-[5%] w-[40%] h-[40%] rounded-full bg-[#1A237E] opacity-80"></div>
      <div className="absolute -top-[2%] -right-[20%] w-[50%] h-[50%] rounded-full bg-[#0D47A1] opacity-60"></div>
      <div className="absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-[#0277BD] opacity-40"></div>

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20 lg:py-24 relative z-10">
        {/* Admin branding */}
        <div className="text-center mb-16 sm:mb-20 md:mb-24">
          <div className="mb-4">
            <Image src="/logo_txt.png" alt="PolyglAI Logo" width={200} height={60} className="mx-auto" />
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-full px-6 py-2 inline-block mb-4">
            <p className="text-white font-bold text-lg">
              🔐 Admin Portal
            </p>
          </div>
          <p className="text-white/90 font-medium text-sm sm:text-base">
            Authorized Administrator Access Only
          </p>
        </div>

        {/* Auth form container */}
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-[#1A237E] to-[#0277BD] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isForgotPassword ? 'Reset Admin Password' : 'Admin Login'}
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              {isForgotPassword ? 'Reset your administrator password' : 'Sign in to access the admin dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleResetPassword}>
              <p className="mb-4 text-gray-700">Enter your admin email address to reset your password</p>

              <label className="block mb-2 text-gray-700 font-medium">Admin Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-6 px-5 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="polyglAITool@gmail.com"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#1A237E] to-[#0277BD] text-white font-bold rounded-xl hover:from-[#0D47A1] hover:to-[#0288D1] transition-all duration-200 mb-6 shadow-lg"
              >
                {loading ? (
                  <span className="flex justify-center items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Reset Link...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-[#0277BD] hover:text-[#0288D1] font-medium hover:underline"
                >
                  ← Back to Admin Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 text-gray-700 font-medium">Admin Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="polyglAITool@gmail.com"
                  required
                />
              </div>

              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <label className="text-gray-700 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[#0277BD] hover:text-[#0288D1] text-sm font-medium hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-5 flex items-center text-gray-500 hover:text-gray-700"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-[#1A237E] to-[#0277BD] text-white font-bold rounded-xl hover:from-[#0D47A1] hover:to-[#0288D1] transition-all duration-200 mb-6 shadow-lg"
              >
                {loading ? (
                  <span className="flex justify-center items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  '🔐 Access Admin Dashboard'
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-4 text-gray-500 text-sm">Or sign in with</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              {/* Google Sign-in Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full h-12 flex justify-center items-center border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                >
                  <Image src="/google.svg" alt="Google Logo" width={24} height={24} className="mr-3" />
                  <span className="text-gray-700 font-medium">Continue with Google</span>
                </button>
              </div>

              <div className="text-center mt-6 pt-6 border-t border-gray-200">
                <Link href="/login" className="text-[#0277BD] hover:text-[#0288D1] font-medium hover:underline">
                  ← Regular User Login
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/70 text-sm">
            Secure admin access to PolyglAI management system
          </p>
        </div>
      </div>
    </div>
  );
} 