'use client';

import { useState, useEffect, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../../../src/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

type Language = {
  id: string;
  name: string;
  code: string;
};

function CreateWordTrainerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    languageId: '',
    pointsValue: 5,
    explanation: '',
  });

  useEffect(() => {
    // Force light mode
    document.documentElement.classList.remove('dark');
    document.body.classList.add('light');
    document.body.classList.remove('dark');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      
      fetchLanguages();
    });

    return () => unsubscribe();
  }, [router]);

  const fetchLanguages = async () => {
    try {
      const languagesRef = collection(db, 'languages');
      const q = query(languagesRef, orderBy('name'));
      const snapshot = await getDocs(q);
      
      const fetchedLanguages: Language[] = [];
      snapshot.forEach((doc) => {
        fetchedLanguages.push({
          id: doc.id,
          ...doc.data() as Omit<Language, 'id'>
        });
      });
      
      setLanguages(fetchedLanguages);
      
      // Set default language from query param or first available
      const langParam = searchParams.get('lang');
      if (langParam) {
        setFormData(prev => ({
          ...prev,
          languageId: langParam.toLowerCase()
        }));
      } else if (fetchedLanguages.length > 0) {
        setFormData(prev => ({
          ...prev,
          languageId: fetchedLanguages[0].id.toLowerCase()
        }));
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching languages:', err);
      setError('Failed to load languages. Please try again later.');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const handleCorrectAnswerChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      correctAnswer: value
    }));
  };

  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      
      // If we're removing the correct answer, reset it
      const newCorrectAnswer = 
        formData.correctAnswer === formData.options[index] 
          ? '' 
          : formData.correctAnswer;
      
      setFormData(prev => ({
        ...prev,
        options: newOptions,
        correctAnswer: newCorrectAnswer
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.question.trim()) {
      setError('Question is required');
      return;
    }
    
    if (!formData.languageId) {
      setError('Language is required');
      return;
    }
    
    if (!formData.correctAnswer) {
      setError('Please select a correct answer');
      return;
    }
    
    if (formData.options.some(option => !option.trim())) {
      setError('All options must have content');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Add to Firestore
      await addDoc(collection(db, 'wordTrainer'), {
        question: formData.question,
        options: formData.options,
        correctAnswer: formData.correctAnswer,
        languageId: formData.languageId.toLowerCase(),
        pointsValue: Number(formData.pointsValue),
        ...(formData.explanation && { explanation: formData.explanation }),
      });
      
      // Redirect back to language-specific list if provided
      const lang = searchParams.get('lang') || formData.languageId;
      if (lang) {
        router.push(`/dashboard/word-trainer?lang=${lang}`);
      } else {
        router.push('/dashboard/word-trainer');
      }
    } catch (err) {
      console.error('Error saving question:', err);
      setError('Failed to save question. Please try again.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD]"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-[#0277BD] shadow-md text-white">
        <div className="p-6 border-b border-[#29B6F6]/30">
          <Link href="/dashboard" aria-label="Go to Dashboard">
            <Image 
              src="/logo_txt.png" 
              alt="PolyglAI" 
              width={140} 
              height={45} 
              className="h-10 w-auto cursor-pointer"
            />
          </Link>
        </div>
        <nav className="mt-6">
          <div className="px-4">
            <Link href="/dashboard" className="flex items-center px-4 py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
              </svg>
              Dashboard
            </Link>
            <Link href="/dashboard/languages" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Add Characters
            </Link>
            <Link href="/dashboard/word-trainer" className="flex items-center px-4 py-3 mt-2 bg-[#29B6F6]/20 rounded-md text-white">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
              Word Trainer
            </Link>
            <Link href="/dashboard/users" className="flex items-center px-4 py-3 mt-2 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              Users
            </Link>
          </div>
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[#0277BD]">Add New Question</h1>
            <Link 
              href="/dashboard/word-trainer"
              className="text-[#0277BD] hover:underline"
            >
              Back to Questions
            </Link>
          </div>
        </header>
        
        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
            {/* Question */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2" htmlFor="question">
                Question*
              </label>
              <input
                type="text"
                id="question"
                name="question"
                value={formData.question}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0277BD]"
                required
              />
            </div>
            
            {/* Language */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2" htmlFor="languageId">
                Language*
              </label>
              <select
                id="languageId"
                name="languageId"
                value={formData.languageId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0277BD]"
                required
              >
                <option value="">Select a language</option>
                {languages.map(language => (
                  <option key={language.id} value={language.id.toLowerCase()}>
                    {language.name}
                  </option>
                ))}
                {/* Add common languages if none are found */}
                {languages.length === 0 && (
                  <>
                    <option value="english">English</option>
                    <option value="mandarin">Mandarin</option>
                    <option value="spanish">Español</option>
                    <option value="japanese">Nihongo</option>
                    <option value="korean">Hangugeo</option>
                  </>
                )}
              </select>
            </div>
            
            
            {/* Points Value */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2" htmlFor="pointsValue">
                Points Value*
              </label>
              <input
                type="number"
                id="pointsValue"
                name="pointsValue"
                value={formData.pointsValue}
                onChange={handleInputChange}
                min="1"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0277BD]"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Points earned when answered correctly (1-100)
              </p>
            </div>
            
            {/* Options */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">
                Options*
              </label>
              
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-center mb-2">
                  <input
                    type="radio"
                    id={`correct-${index}`}
                    name="correctOption"
                    checked={formData.correctAnswer === option}
                    onChange={() => handleCorrectAnswerChange(option)}
                    className="mr-2"
                  />
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0277BD]"
                    required
                  />
                  {formData.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              
              {formData.options.length < 6 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-2 text-[#0277BD] hover:text-[#0288D1]"
                >
                  + Add Option
                </button>
              )}
              
              <p className="text-sm text-gray-500 mt-1">
                Select the radio button next to the correct answer
              </p>
            </div>
            
            {/* Explanation */}
            <div className="mb-6">
              <label className="block text-gray-700 font-medium mb-2" htmlFor="explanation">
                Explanation (Optional)
              </label>
              <textarea
                id="explanation"
                name="explanation"
                value={formData.explanation}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0277BD]"
                rows={3}
                placeholder="Explain why the correct answer is right (shown after answering)"
              ></textarea>
            </div>
            
            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push('/dashboard/word-trainer')}
                className="px-4 py-2 text-gray-700 mr-2"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0277BD] text-white rounded-md hover:bg-[#0288D1] disabled:bg-gray-400"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Question'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function CreateWordTrainerQuestion() {
  return (
    <Suspense fallback={
      <div className="p-6 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD]"></div>
      </div>
    }>
      <CreateWordTrainerContent />
    </Suspense>
  );
} 