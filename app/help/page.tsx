"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function HelpCenter() {
  const [scrolled, setScrolled] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const faqSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      questions: [
        {
          q: 'How do I start learning a new language?',
          a: 'Go to the Home page, tap "Add Language", choose the language you want, and begin with your first lesson.'
        },
        {
          q: 'Can I learn multiple languages at the same time?',
          a: 'Yes! You can add more than one language and switch between them anytime in the Language Selector.'
        }
      ]
    },
    {
      id: 'lessons-features',
      title: 'Lessons & Features',
      questions: [
        {
          q: 'What is the Pronunciation Assessment?',
          a: 'It\'s a tool that listens to how you say words and gives feedback to help improve your accent and fluency.'
        },
        {
          q: 'How does the Vocabulary Trainer work?',
          a: 'The Vocabulary Trainer uses flashcards and quizzes to help you practice and remember new words effectively.'
        },
        {
          q: 'Can I translate whole sentences?',
          a: 'Yes! Use the Translation Assistant to practice by typing or speaking a phrase.'
        }
      ]
    },
    {
      id: 'progress-streaks',
      title: 'Progress & Streaks',
      questions: [
        {
          q: 'What happens if I break my learning streak?',
          a: 'Don\'t worry you can always start again! Streaks are there to motivate you, but your overall progress is saved.'
        },
        {
          q: 'Where can I see my progress?',
          a: 'Go to your Profile, and you\'ll see your levels, achievements, and streak history.'
        }
      ]
    },
    {
      id: 'account-profile',
      title: 'Account & Profile',
      questions: [
        {
          q: 'How do I reset my password?',
          a: 'Go to Settings → Account → Profile → Password and follow the instructions.'
        },
        {
          q: 'Can I edit my profile information?',
          a: 'Yes! Just go to Settings → Account → Profile, and you can update your name, email, or chosen languages.'
        }
      ]
    },
    {
      id: 'technical-support',
      title: 'Technical Support',
      questions: [
        {
          q: 'The app is not working properly. What should I do?',
          a: 'First, make sure you\'re connected to the internet. If the problem continues, restart the app or reinstall.'
        },
        {
          q: 'How can I contact support?',
          a: 'You can reach out to us via email at polyglaitool@gmail.com. We\'ll get back to you as soon as possible.'
        }
      ]
    }
  ];

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
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Help Center</h1>
            <p className="text-lg text-gray-600">
              Welcome to the PolyglAI Help Center! Here you&apos;ll find quick answers to common questions about using the app, your account, and learning features.
            </p>
          </div>

          <div className="space-y-6">
            {faqSections.map((section) => (
              <div key={section.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 text-left flex items-center justify-between"
                >
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform duration-300 ${
                      expandedSections[section.id] ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections[section.id] && (
                  <div className="px-6 py-4 bg-white">
                    <div className="space-y-4">
                      {section.questions.map((faq, index) => (
                        <div key={index} className="border-l-4 border-blue-200 pl-4">
                          <h3 className="font-semibold text-gray-900 mb-2">Q: {faq.q}</h3>
                          <p className="text-gray-700 leading-relaxed">A: {faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="mt-12 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Still Need Help?</h2>
            <p className="text-gray-700 mb-4">
              If you couldn&apos;t find the answer you&apos;re looking for, don&apos;t hesitate to reach out to our support team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="mailto:polyglaitool@gmail.com"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-full hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </a>
              <Link
                href="/"
                className="inline-flex items-center px-6 py-3 border-2 border-blue-500 text-blue-600 font-medium rounded-full hover:bg-blue-50 transition-all duration-300"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
