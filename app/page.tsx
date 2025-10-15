"use client";
import Image from "next/image";
import Link from "next/link";
import { useSignInDialog } from "../src/hooks/useSignInDialog";
import { useState, useEffect } from "react";

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { open } = useSignInDialog();

  const features = [
    {
      icon: "🎯",
      title: "AI-Powered Precision",
      description: "Advanced speech recognition with smart learning."
    },
    {
      icon: "🌍",
      title: "Multi-Language Support",
      description: "Learn English, Mandarin, Spanish, Japanese, and Korean."
    },
    {
      icon: "📊",
      title: "Real-Time Feedback",
      description: "Instant pronunciation scoring and improvement tips."
    },
    {
      icon: "🎮",
      title: "Gamified Learning",
      description: "Fun challenges and progress tracking to keep you motivated."
    }
  ];

  useEffect(() => {
    setIsVisible(true);
    
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 4000);

    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setScrolled(window.scrollY > 30);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [features.length]);



  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 animate-pulse"></div>
        <div className="absolute -top-[5%] -right-[15%] w-[50%] h-[50%] rounded-full bg-gradient-to-l from-indigo-500/15 to-purple-500/15 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute bottom-[10%] left-[5%] w-[40%] h-[40%] rounded-full bg-gradient-to-t from-teal-500/10 to-blue-500/10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 right-[5%] w-[30%] h-[30%] rounded-full bg-gradient-to-bl from-cyan-500/10 to-blue-500/10 animate-bounce" style={{ animationDuration: '4s', animationDelay: '2s' }}></div>
      </div>
      
      {/* Floating particles */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => {
          const left = (i * 7.3) % 100;
          const top = (i * 11.7) % 100;
          const animationDelay = (i * 0.3) % 5;
          const animationDuration = 3 + (i * 0.2) % 4;
          
          return (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${animationDelay}s`,
                animationDuration: `${animationDuration}s`
              }}
            />
          );
        })}
      </div>
      
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
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="hover:text-blue-200 transition-all duration-300 hover:scale-105 font-medium">
                Features
              </Link>
              <Link href="#translate" className="hover:text-blue-200 transition-all duration-300 hover:scale-105 font-medium">
                Translate
              </Link>
              <Link href="#about" className="hover:text-blue-200 transition-all duration-300 hover:scale-105 font-medium">
                About
              </Link>
              <div className="relative group">
                <button onClick={() => open('user')} className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-full hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl hover:scale-105">
                  Sign In
                  <svg className="w-4 h-4 ml-2 transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-3 w-52 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 border border-white/20">
                  <button onClick={() => open('user')} className="w-full text-left block px-5 py-4 text-gray-700 hover:bg-blue-50 rounded-t-2xl transition-colors flex items-center space-x-3">
                    <span className="text-xl">👤</span>
                    <span className="font-medium">User Login</span>
                  </button>
                  <button onClick={() => open('admin')} className="w-full text-left block px-5 py-4 text-gray-700 hover:bg-blue-50 rounded-b-2xl border-t border-gray-100 transition-colors flex items-center space-x-3">
                    <span className="text-xl">🔐</span>
                    <span className="font-medium">Admin Login</span>
                  </button>
                </div>
              </div>
            </nav>
            
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
          
          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/10">
              <nav className="flex flex-col space-y-3 pt-4">
                <Link href="#features" className="hover:text-blue-200 transition-colors font-medium">
                  Features
                </Link>
                <Link href="#translate" className="hover:text-blue-200 transition-colors font-medium">
                  Translate
                </Link>
                <Link href="#about" className="hover:text-blue-200 transition-colors font-medium">
                  About
                </Link>
                <div className="pt-2 space-y-2">
                  <button onClick={() => open('user')} className="block w-full text-left px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                    👤 User Login
                  </button>
                  <button onClick={() => open('admin')} className="block w-full text-left px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                    🔐 Admin Login
                  </button>
                </div>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-32 pb-16 relative z-10">
        {/* Animated floating elements */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/3 -right-20 w-60 h-60 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-20 left-1/3 w-48 h-48 bg-cyan-500/20 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-6000"></div>
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div
            className={`lg:w-1/2 transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                Learn, Translate,
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                & Improve Proficiency
              </span>
            </h1>
            <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-lg">
                Speak with confidence using PolyglAI! Our AI-powered speech assessment provides real-time feedback, precise pronunciation scoring, and multilingual support. Perfect for learners and educators unlock your fluency today!
              </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => open('user')}
                className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-2xl hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center"
              >
                Sign in
                <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <a
                href="https://drive.google.com/file/d/1S3VFJk-huZLP2v_sXbmytCJkpuqrAJ1j/view?usp=sharing"
                download
                className="group px-8 py-4 border-2 border-white/30 text-white rounded-2xl hover:bg-white/10 hover:border-white/50 transition-all duration-300 flex items-center justify-center backdrop-blur-sm"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download APK
              </a>
            </div>
          </div>
          <div
            className={`lg:w-1/2 transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            {/* Mockup images - hidden on mobile devices */}
            <div className="relative w-full max-w-4xl mx-auto mt-40 hidden md:block">
              <div className="relative w-full h-[500px]">
                <div className="absolute left-1/2 transform -translate-x-1/2 translate-y-32 w-full">
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* First mockup - positioned to the left with rotation */}
                    <div className="absolute left-0 w-1/2 z-10 transition-all duration-500 hover:z-20 hover:scale-105 -mr-16">
                      <Image
                        src="/app-logo-screen.png"
                        alt="App logo screen"
                        width={350}
                        height={650}
                        className="w-full h-auto max-h-[550px] object-contain -rotate-6 rounded-2xl"
                        priority
                      />
                    </div>
                    
                    {/* Second mockup - positioned to the right with opposite rotation */}
                    <div className="absolute right-0 w-1/2 z-20 transition-all duration-500 hover:z-30 hover:scale-105 -ml-16">
                      <Image
                        src="/step1-mockup.png"
                        alt="Step 1 screen mockup"
                        width={350}
                        height={650}
                        className="w-full h-auto max-h-[550px] object-contain rotate-6 rounded-2xl"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section with Card Background */}
      <section id="features" className="py-20 relative z-10 scroll-mt-20">
        {/* Decorative elements */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl p-8 md:p-12">
            {/* Unique Features Section */}
            <div className="mb-12">
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 mb-8 md:mb-0">
                  <h3 className="text-[#0277BD] font-medium mb-2">Unique Features</h3>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Experience that grows with your learning journey.
                  </h2>
                </div>
                <div className="md:w-1/2">
                  <p className="text-gray-600">
                    Our innovative approach combines AI-driven pronunciation assessment with personalized learning paths to help you achieve fluency faster and more effectively.
                  </p>
                </div>
              </div>
            </div>

            {/* RedirectErrorBoundary */}
            <div className="relative max-w-lg mx-auto bg-white rounded-3xl shadow-md p-8 border border-gray-200 hover:shadow-lg transition-shadow duration-300">
              <div className="relative z-10 flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                </div>
                <div className="text-gray-600 text-sm font-medium">PolyglAI Studio</div>
              </div>
              <div className="relative mb-6">
                <div className="flex items-center justify-center space-x-1 h-20">
                  <div className="bg-gradient-to-t from-blue-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: '4px', height: '41.7903px', animationDelay: '0s' }}></div>
                  <div className="bg-gradient-to-t from-blue-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: '4px', height: '55.9252px', animationDelay: '0.1s' }}></div>
                  <div className="bg-gradient-to-t from-blue-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: '4px', height: '25.477px', animationDelay: '0.2s' }}></div>
                  <div className="bg-gradient-to-t from-blue-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: '4px', height: '35.1511px', animationDelay: '0.3s' }}></div>
                  <div className="bg-gradient-to-t from-blue-400 to-cyan-400 rounded-full transition-all duration-300" style={{ width: '4px', height: '26.0051px', animationDelay: '0.4s' }}></div>
                </div>
              </div>
              <div className="space-y-4">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-3 rounded-xl transition-all duration-500 ${
                      activeFeature === index 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <div className="text-2xl">{feature.icon}</div>
                    <div>
                      <div className="text-gray-900 font-medium">{feature.title}</div>
                      <div className="text-gray-600 text-sm">{feature.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute -top-4 -left-4 w-8 h-8 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-1/2 -right-2 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse"></div>
            </div>
            {/* Features Grid */}
            <div id="features">
              <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Features</h2>
              <div className="grid md:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="border border-gray-200 rounded-lg p-8 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-[#0277BD]/10 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-[#0277BD]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Accuracy Assessment
                  </h3>
                  <p className="text-gray-600">
                    Advanced AI analyzes your pronunciation and provides detailed feedback to help you improve.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="border border-gray-200 rounded-lg p-8 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-[#29B6F6]/10 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-[#29B6F6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Fluency Evaluation
                  </h3>
                  <p className="text-gray-600">
                    Measures how naturally and smoothly you speak in your target language.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="border border-gray-200 rounded-lg p-8 hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-[#1A237E]/10 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-6 h-6 text-[#1A237E]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Multi-Language Support
                  </h3>
                  <p className="text-gray-600">
                    Practice and improve in multiple languages with customized learning paths.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 border-t border-white/10">
        <div className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/logo-text.png"
                  alt="PolyglAI wordmark"
                  width={180}
                  height={40}
                  className="h-10 object-contain"
                />
              </div>
              <p className="text-white/70 mb-6 max-w-md leading-relaxed">
                Empowering global communication through AI-powered language learning. Break barriers, build connections, and unlock your potential.
              </p>
            </div>
            
            {/* Support */}
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <div className="space-y-3">
                {[
                  { name: 'Help Center', href: '/help' },
                  { name: 'Privacy Policy', href: '/privacy' },
                  { name: 'Terms of Service', href: '/terms' }
                ].map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="block text-white/70 hover:text-blue-200 transition-colors duration-300 hover:translate-x-1"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bottom */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-white/60 text-sm mb-4 md:mb-0">
                &copy; 2024 PolyglAI. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
} 