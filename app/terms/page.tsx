"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function TermsOfUse() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setScrolled(window.scrollY > 30);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className={`fixed w-full z-50 text-white transition-all duration-500 ${
        scrolled 
          ? 'backdrop-blur-lg bg-slate-900/95 border-b border-white/10 shadow-xl py-2' 
          : 'backdrop-blur-sm bg-transparent border-b border-transparent py-4'
      }`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="PolyglAI home" className="flex items-center group">
              <Image
                src="/logo-text.png"
                alt="PolyglAI wordmark"
                width={180}
                height={40}
                className="h-10 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
            
            <Link
              href="/"
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-full hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 pt-32 pb-16">
        <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Use</h1>
          
          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-lg mb-6">
              Welcome to PolyglAI, an AI-powered multilingual mobile and web application designed to support pronunciation assessment, translation, and vocabulary training in five major languages: English, Mandarin, Japanese (Nihongo), Korean (Hangugeo), and Spanish (Español). By downloading, accessing, or using PolyglAI, you agree to comply with and be bound by the following Terms of Use. Please read them carefully before continuing.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Purpose of PolyglAI</h2>
            <p className="mb-6">
              PolyglAI is an educational tool developed for language learning and pronunciation improvement through artificial intelligence. The app integrates Microsoft Azure Speech AI, Natural Language Processing (NLP), Computer Vision (OCR), and Document Intelligence technologies to provide interactive and data-driven language learning. The system is intended for personal and educational use only and may not be used for commercial purposes without written consent from the developers.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Eligibility and Age Requirement</h2>
            <p className="mb-6">
              PolyglAI is designed for learners of all ages. However, in compliance with the Children&apos;s Online Privacy Protection Act (COPPA) and related international standards, users under 13 years old are required to use the app under parental or guardian supervision. By using PolyglAI, you confirm that you meet this requirement or have obtained consent from a parent or legal guardian.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Responsibilities</h2>
            <p className="mb-4">By using PolyglAI, you agree to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Use the app solely for language learning and personal development.</li>
              <li>Avoid activities that could harm, disrupt, or misuse the system, including hacking, reverse engineering, or spreading malicious content.</li>
              <li>Respect intellectual property rights, refrain from uploading inappropriate materials, and follow all applicable laws in your country of use.</li>
            </ul>
            <p className="mb-6">
              Violations of these terms may result in the suspension or termination of your account without prior notice.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Account Registration and Security</h2>
            <p className="mb-6">
              Users are responsible for safeguarding their login credentials and maintaining the confidentiality of their account information. Any activity performed under a user&apos;s account is the user&apos;s responsibility. If unauthorized access is suspected, users must notify the developers immediately.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Data and Privacy Protection</h2>
            <p className="mb-6">
              PolyglAI collects only essential data to improve user experience, including demographic details provided during onboarding (age, gender, profession, and location). Data is stored securely and used strictly for analytics purposes not personalization. Personal data is never sold or shared with third parties without consent.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Content and Educational Materials</h2>
            <p className="mb-6">
              All translations, pronunciations, and vocabulary materials are provided for educational use. While the developers strive for accuracy, translations or AI-generated content may occasionally contain errors. Users are advised to apply personal discretion and cross-reference critical translations in professional or formal use.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Accessibility and Availability</h2>
            <p className="mb-6">
              PolyglAI is provided &quot;as is&quot; and &quot;as available.&quot; The developers aim to maintain consistent functionality but cannot guarantee uninterrupted access due to technical maintenance, server downtime, or updates.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Intellectual Property Rights</h2>
            <p className="mb-6">
              The PolyglAI name, logo, and all related content including the user interface, design elements, and learning materials are the intellectual property of the developers. Users may not copy, modify, distribute, or reproduce any part of the application without written authorization.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Feedback and Support</h2>
            <p className="mb-6">
              Users are encouraged to share feedback, report bugs, or suggest improvements through the in-app Feedback section or Help Center. Submitted feedback may be used to enhance future versions of PolyglAI without compensation.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Updates and Modifications</h2>
            <p className="mb-6">
              PolyglAI reserves the right to update these Terms of Use periodically. Changes will be communicated within the application, and continued use after such updates indicates acceptance of the new terms.
            </p>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Last Revised: October 14, 2025
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
