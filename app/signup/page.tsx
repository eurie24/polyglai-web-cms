'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/lib/firebase';

export default function Signup() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login?error=signupViaMobile');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #0277BD, #29B6F6)'}}>
      <div className="max-w-md mx-auto bg-white rounded-3xl shadow-lg p-8 text-center">
        <Image src="/logo_txt.png" alt="PolyglAI Logo" width={160} height={48} className="mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-4 text-black">Signup unavailable on web</h1>
        <p className="text-black mb-6">To create a new account, please sign up using the PolyglAI mobile app.</p>
        <Link href="/login" className="text-[#0277BD] hover:underline">Go to Login</Link>
      </div>
    </div>
  );
}