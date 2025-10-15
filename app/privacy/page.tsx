"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function PrivacyPolicy() {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none text-gray-700">
            <p className="text-lg mb-6">
              This Privacy Policy explains how PolyglAI collects, uses, stores, and protects your information when you use our mobile and web applications. By accessing PolyglAI, you consent to the data practices described below.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              PolyglAI collects limited personal and technical information necessary for app functionality and improvement, including:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li><strong>User-Provided Data:</strong> Information you voluntarily provide during onboarding (e.g., name, age, gender, language preference, location, profession).</li>
              <li><strong>Usage Data:</strong> Interactions with modules (pronunciation assessments, word trainer, translations, etc.) for analytics and system enhancement.</li>
              <li><strong>Device Information:</strong> Non-identifiable technical data such as browser type, OS version, and device model for compatibility optimization.</li>
            </ul>
            <p className="mb-6">
              No biometric, financial, or sensitive personal data is collected.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Purpose of Data Collection</h2>
            <p className="mb-4">All collected data serves the following purposes:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>To analyze app performance and improve user experience.</li>
              <li>To track learning progress, assessment accuracy, and engagement analytics.</li>
              <li>To provide technical support and fix reported issues.</li>
              <li>To ensure security, prevent misuse, and maintain compliance with data regulations.</li>
            </ul>
            <p className="mb-6">
              PolyglAI does not use data for personalized advertising or third-party marketing.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Data Storage and Security</h2>
            <p className="mb-6">
              All data is securely stored using Microsoft Azure Cloud Infrastructure, which complies with ISO/IEC 27001 and GDPR standards. Encryption (SSL/TLS) and access controls are implemented to protect data from unauthorized access, alteration, or loss.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Sharing and Disclosure</h2>
            <p className="mb-4">PolyglAI does not sell, rent, or trade user information. Data may be shared only under the following circumstances:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>When required by law or court order.</li>
              <li>With service providers assisting in technical maintenance, bound by strict confidentiality agreements.</li>
              <li>For aggregated analytics reports, where no personally identifiable information is disclosed.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Data Retention and Deletion</h2>
            <p className="mb-6">
              User data is retained only for as long as necessary to fulfill its purpose. Users can permanently delete their accounts and all associated data through the Privacy Settings → Delete My Account option. Once deleted, data cannot be recovered.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Children&apos;s Data</h2>
            <p className="mb-6">
              For users under 13 years of age, only minimal data necessary for functionality (e.g., progress tracking, language preference) is collected. PolyglAI does not request or store sensitive information from minors. Parents or guardians may request account deletion or data review at any time.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. User Rights</h2>
            <p className="mb-4">Users have the right to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>Access and review the data stored in their accounts.</li>
              <li>Request data correction or deletion.</li>
              <li>Withdraw consent to data processing.</li>
              <li>Be informed of any data breaches in accordance with applicable laws.</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Third-Party Integrations</h2>
            <p className="mb-6">
              PolyglAI uses Microsoft Azure Cognitive Services and Google Authentication for secure access. These third-party providers comply with international privacy standards and only process user data to the extent required for authentication and AI-based analysis.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Policy Updates</h2>
            <p className="mb-6">
              PolyglAI may update this Privacy Policy periodically to reflect changes in data handling practices or legal requirements. Users will be notified of any updates through in-app notifications or email (if provided). Continued use of PolyglAI indicates acceptance of the updated policy.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Contact Information</h2>
            <p className="mb-6">
              For inquiries regarding this policy, data use, or account management, users may contact the PolyglAI Development Team via email at: <a href="mailto:polyglaitool@gmail.com" className="text-blue-600 hover:text-blue-800">polyglaitool@gmail.com</a>
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
