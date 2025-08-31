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
import { auth } from '../../src/lib/firebase';

export default function Login() {
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
    console.log("Setting up auth state listener...");
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed:", user ? `User logged in: ${user.email}` : "No user");
      
      if (user) {
        // Check if user is admin - redirect to admin login
        if (user.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
          router.push('/admin/login');
        } else {
          // For regular users, redirect to user dashboard
          router.push('/user-dashboard');
        }
      }
    });

    // Check if there's an error parameter in the URL
    const errorParam = searchParams.get('error');
    if (errorParam === 'adminOnly') {
      setError('Admin access required. Please use the admin login.');
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
    
    // Check if the email is the admin email - redirect to admin login
    if (email.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
      router.push('/admin/login');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User login successful for:", userCredential.user.email);
      
      // Check if the user is trying to access admin area
      if (userCredential.user.email === 'polyglAITool@gmail.com') {
        await auth.signOut();
        router.push('/admin/login');
        return;
      }
      
      // For regular users, redirect to user dashboard
      router.push('/user-dashboard');
    } catch (err: unknown) {
      console.error('Login error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError('Invalid email or password');
      } else {
        setError(error.message || 'Failed to log in');
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

    setLoading(true);
    setError('');
    
    try {
      // Set the action code settings to redirect to our custom reset page
      const actionCodeSettings = {
        url: window.location.origin + '/reset-password',
        handleCodeInApp: true
      };
      
      // Send reset email with custom redirect
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      setSuccessMessage('Password reset email sent! Please check your inbox.');
      setTimeout(() => {
        setIsForgotPassword(false);
        setSuccessMessage('');
      }, 5000);
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address');
      } else {
        setError(error.message || 'Failed to send reset email');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      console.log("Starting Google sign-in...");
      
      const provider = new GoogleAuthProvider();
      // Add Web Client ID explicitly
      provider.setCustomParameters({
        client_id: '384494047717-mbt8equ74qv39lgi6m5p9j1iffer0r1m.apps.googleusercontent.com',
        prompt: 'select_account'
      });
      
      // Use popup instead of redirect for more reliable completion
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in successful:", result.user.email);
      
      // Check if the signed-in user is the admin - redirect to admin login
      if (result.user.email?.toLowerCase() === 'polyglAITool@gmail.com'.toLowerCase()) {
        await auth.signOut();
        router.push('/admin/login');
        return;
      }
      
      // For regular users, redirect to user dashboard
      router.push('/user-dashboard');
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const error = err as { message?: string };
      setError(`Google sign-in failed: ${error.message || 'Unknown error'}`);
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

        {/* Auth form container */}
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg p-8">
          <h1 className="text-2xl font-bold mb-6 text-black">
            {isForgotPassword ? 'Reset Password' : 'User Login'}
          </h1>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleResetPassword}>
              <p className="mb-4 text-black">Enter your email address to reset your password</p>

              <label className="block mb-2 text-black font-medium">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mb-6 px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="helloworld@gmail.com"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#29B6F6] text-white font-bold rounded-full hover:bg-[#0288D1] transition-colors duration-200 mb-6"
              >
                {loading ? (
                  <span className="flex justify-center items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-[#0277BD] hover:underline"
                >
                  Back to login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block mb-2 text-black font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="helloworld@gmail.com"
                  required
                />
              </div>

              <div className="mb-4">
                <div className="flex justify-between mb-2">
                  <label className="text-black font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-black hover:text-[#0277BD]"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-100 rounded-full border-none focus:ring-2 focus:ring-blue-500 text-black"
                    placeholder="••••••••"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#29B6F6] text-white font-bold rounded-full hover:bg-[#0288D1] transition-colors duration-200 mb-6"
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
                  'Log in'
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-4 text-black">Or Login with</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>

              {/* Google Sign-in Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-40 h-12 flex justify-center items-center border border-gray-300 rounded-full hover:bg-gray-50 transition-colors duration-200"
                >
                  <Image src="/google.svg" alt="Google Logo" width={24} height={24} />
                </button>
              </div>

              <div className="text-center mt-6">
                <Link href="/signup" className="text-[#0277BD] hover:underline">
                  Don&apos;t have an account? Sign up
                </Link>
              </div>
              
              <div className="text-center mt-4 pt-4 border-t border-gray-200">
                <Link href="/admin/login" className="text-[#0277BD] hover:underline font-medium">
                  🔐 Administrator Login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
} 