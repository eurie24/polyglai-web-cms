'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc,
  doc,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  languageId: string;
  level: string;
  pointsValue: number;
  explanation?: string;
};

type GroupedQuestions = {
  [languageId: string]: {
    [level: string]: Question[];
  }
};

export default function WordTrainerManagement() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groupedQuestions, setGroupedQuestions] = useState<GroupedQuestions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingDefaults, setIsAddingDefaults] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Set color scheme to light mode
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      fetchQuestions();
    });

    return () => unsubscribe();
  }, [router]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      const questionsRef = collection(db, 'wordTrainer');
      const questionsSnapshot = await getDocs(questionsRef);
      
      const fetchedQuestions: Question[] = [];
      questionsSnapshot.forEach((doc) => {
        fetchedQuestions.push({
          id: doc.id,
          ...doc.data() as Omit<Question, 'id'>
        });
      });

      setQuestions(fetchedQuestions);
      
      // Group questions by language and level
      const grouped: GroupedQuestions = {};
      fetchedQuestions.forEach(question => {
        if (!grouped[question.languageId]) {
          grouped[question.languageId] = {};
        }
        
        if (!grouped[question.languageId][question.level]) {
          grouped[question.languageId][question.level] = [];
        }
        
        grouped[question.languageId][question.level].push(question);
      });
      
      setGroupedQuestions(grouped);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions. Please try again later.');
      setIsLoading(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteDoc(doc(db, 'wordTrainer', questionId));
        // Refresh the list
        fetchQuestions();
      } catch (err) {
        console.error('Error deleting question:', err);
        setError('Failed to delete question. Please try again.');
      }
    }
  };

  const capitalizeFirstLetter = (string: string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const addDefaultQuestions = async () => {
    try {
      setIsAddingDefaults(true);
      
      // Check if there are already questions in the database
      const questionsRef = collection(db, 'wordTrainer');
      const snapshot = await getDocs(questionsRef);
      
      if (snapshot.docs.length > 0) {
        const confirmOverwrite = window.confirm(
          'Questions already exist in the database. Do you want to add default questions anyway? This will not delete existing questions.'
        );
        if (!confirmOverwrite) {
          setIsAddingDefaults(false);
          return;
        }
      }
      
      const batch = writeBatch(db);
      
      // Default questions data based on the Flutter service
      const defaultQuestions = [
        // English - Beginner
        {
          question: 'What is the opposite of "hot"?',
          options: ['Cold', 'Warm', 'Cool', 'Freezing'],
          correctAnswer: 'Cold',
          languageId: 'english',
          level: 'beginner',
          pointsValue: 5,
          explanation: 'The direct opposite of hot is cold.',
        },
        {
          question: 'Which word means "a place to live"?',
          options: ['House', 'Car', 'Book', 'Phone'],
          correctAnswer: 'House',
          languageId: 'english',
          level: 'beginner',
          pointsValue: 5,
          explanation: 'A house is a structure where people live.',
        },
        {
          question: 'What color is the sky during the day?',
          options: ['Blue', 'Green', 'Black', 'Red'],
          correctAnswer: 'Blue',
          languageId: 'english',
          level: 'beginner',
          pointsValue: 5,
          explanation: 'During the day, the sky appears blue due to the scattering of sunlight.',
        },
        {
          question: 'Which animal says "meow"?',
          options: ['Cat', 'Dog', 'Bird', 'Fish'],
          correctAnswer: 'Cat',
          languageId: 'english',
          level: 'beginner',
          pointsValue: 5,
          explanation: 'Cats make the sound "meow" when they vocalize.',
        },
        
        // English - Intermediate
        {
          question: 'Which word means "to move slowly"?',
          options: ['Trudge', 'Sprint', 'Dash', 'Jump'],
          correctAnswer: 'Trudge',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: 'Trudge means to walk or move slowly with heavy steps.',
        },
        {
          question: 'What is a "protagonist" in a story?',
          options: ['Main character', 'Villain', 'Setting', 'Plot twist'],
          correctAnswer: 'Main character',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: 'The protagonist is the main character in a story or play.',
        },
        
        // Spanish - Beginner
        {
          question: 'What is "hello" in Spanish?',
          options: ['Hola', 'Adiós', 'Gracias', 'Por favor'],
          correctAnswer: 'Hola',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Hola" is the Spanish word for "hello".',
        },
        {
          question: 'How do you say "thank you" in Spanish?',
          options: ['Gracias', 'Hola', 'Adiós', 'Buenos días'],
          correctAnswer: 'Gracias',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Gracias" is the Spanish word for "thank you".',
        },
        {
          question: 'What does "buenos días" mean?',
          options: ['Good morning', 'Good afternoon', 'Good evening', 'Good night'],
          correctAnswer: 'Good morning',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Buenos días" is the Spanish greeting for "Good morning".',
        },
        
        // Mandarin - Beginner (more questions to match the image)
        {
          question: 'How do you say "hello" in Mandarin?',
          options: ['你好 (Nǐ hǎo)', '谢谢 (Xièxiè)', '再见 (Zàijiàn)', '对不起 (Duìbùqǐ)'],
          correctAnswer: '你好 (Nǐ hǎo)',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"你好 (Nǐ hǎo)" is the standard Mandarin greeting for "hello".',
        },
        {
          question: 'What does "谢谢 (Xièxiè)" mean?',
          options: ['Thank you', 'Hello', 'Goodbye', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"谢谢 (Xièxiè)" means "Thank you" in Mandarin.',
        },
        {
          question: 'What does "用 (yòng)" mean?',
          options: ['Use', 'Go', 'Come', 'Goodbye'],
          correctAnswer: 'Use',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"用 (yòng)" means "to use" in Mandarin.',
        },
        {
          question: 'What does "去 (qù)" mean?',
          options: ['Come', 'Good', 'Go', 'Goodbye'],
          correctAnswer: 'Go',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"去 (qù)" means "to go" in Mandarin.',
        },
        {
          question: 'What does "来 (lái)" mean?',
          options: ['Come', 'Go', 'Use', 'Good'],
          correctAnswer: 'Come',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"来 (lái)" means "to come" in Mandarin.',
        },
        {
          question: 'What does "好 (hǎo)" mean?',
          options: ['Good', 'Use', 'Goodbye', 'Come'],
          correctAnswer: 'Good',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"好 (hǎo)" means "good" or "well" in Mandarin.',
        },
        {
          question: 'What does "我 (wǒ)" mean?',
          options: ['I', 'Me', 'You', 'He'],
          correctAnswer: 'I, Me',
          languageId: 'mandarin',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"我 (wǒ)" means "I" or "me" in Mandarin.',
        },
        
        // Japanese - More beginner questions (Nihongo)
        {
          question: 'How do you say "hello" in Japanese?',
          options: ['こんにちは (Konnichiwa)', 'さようなら (Sayounara)', 'ありがとう (Arigatou)', 'お願いします (Onegaishimasu)'],
          correctAnswer: 'こんにちは (Konnichiwa)',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"こんにちは (Konnichiwa)" is the standard Japanese greeting for "hello".',
        },
        {
          question: 'What does "ありがとう (Arigatou)" mean?',
          options: ['Thank you', 'Goodbye', 'Excuse me', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"ありがとう (Arigatou)" means "Thank you" in Japanese.',
        },
        {
          question: 'What does "木 (ki/moku)" mean?',
          options: ['Tree', 'River', 'Woman', 'Mountain'],
          correctAnswer: 'Tree',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"木 (ki / moku)" means "tree" or "wood" in Japanese.',
        },
        {
          question: 'What does "山 (yama)" mean?',
          options: ['Mountain', 'Child', 'Tree', 'River'],
          correctAnswer: 'Mountain',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"山 (yama)" means "mountain" in Japanese.',
        },
        {
          question: 'What does "川 (kawa)" mean?',
          options: ['River', 'Woman', 'Child', 'Mountain'],
          correctAnswer: 'River',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"川 (kawa)" means "river" in Japanese.',
        },
        {
          question: 'What does "女 (onna)" mean?',
          options: ['Woman', 'Tree', 'Child', 'Mountain'],
          correctAnswer: 'Woman',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"女 (onna)" means "woman" in Japanese.',
        },
        {
          question: 'What does "子 (ko/shi)" mean?',
          options: ['Child', 'Woman', 'Mountain', 'River'],
          correctAnswer: 'Child',
          languageId: 'japanese',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"子 (ko / shi)" means "child" in Japanese.',
        },
        
        // Korean - More beginner questions (Hangugeo) 
        {
          question: 'How do you say "hello" in Korean?',
          options: ['안녕하세요 (Annyeonghaseyo)', '감사합니다 (Gamsahamnida)', '안녕히 가세요 (Annyeonghi gaseyo)', '미안합니다 (Mianhamnida)'],
          correctAnswer: '안녕하세요 (Annyeonghaseyo)',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"안녕하세요 (Annyeonghaseyo)" is the standard Korean greeting for "hello".',
        },
        {
          question: 'What does "감사합니다 (Gamsahamnida)" mean?',
          options: ['Thank you', 'Hello', 'Goodbye', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"감사합니다 (Gamsahamnida)" means "Thank you" in Korean.',
        },
        {
          question: 'What does 물 (mul) mean?',
          options: ['a) fire, b) water, c) hand, d) river'],
          correctAnswer: 'water',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '물 (mul) means water.',
        },
        {
          question: 'What does 불 (bul) mean?',
          options: ['a) water, b) hand, c) fire, d) river'],
          correctAnswer: 'fire',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '불 (bul) means fire.',
        },
        {
          question: 'What does 손 (son) mean?',
          options: ['a) river, b) hand, c) home/house, d) water'],
          correctAnswer: 'hand',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '손 (son) means hand.',
        },
        {
          question: 'What does 강 (gang) mean?',
          options: ['a) hand, b) river, c) water, d) fire'],
          correctAnswer: 'river',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '강 (gang) means river.',
        },
        {
          question: 'What does 집 (jip) mean?',
          options: ['a) fire, b) home/house, c) hand, d) river'],
          correctAnswer: 'house / home',
          languageId: 'korean',
          level: 'beginner',
          pointsValue: 5,
          explanation: '집 (jip) means house or home.',
        },
        
        // Spanish - More questions (Español)
        {
          question: 'What does the Spanish word "perro" mean?',
          options: ['A) Cat, B) Bird, C) Dog, D) Fish'],
          correctAnswer: 'C) Dog',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Gracias" is commonly used to express gratitude, meaning "thank you."',
        },
        {
          question: 'What is the meaning of "gracias"?',
          options: ['A) Goodbye, B) Hello, C) Thank you, D) Please'],
          correctAnswer: 'C) Thank you',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Gracias" is commonly used to express gratitude, meaning "thank you."',
        },
        {
          question: 'What does "rojo" mean?',
          options: ['A) Blue, B) Red, C) Green, D) Yellow'],
          correctAnswer: 'B) Red',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Rojo" refers to the color red in Spanish.',
        },
        {
          question: 'What is the translation of "libro"?',
          options: ['A) Pen, B) Notebook, C) Book, D) Table'],
          correctAnswer: 'C) Book',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Libro" means "book," a common noun in everyday vocabulary.',
        },
        {
          question: 'What does "feliz" mean?',
          options: ['A) Sad, B) Angry, C) Happy, D) Sleepy'],
          correctAnswer: 'C) Happy',
          languageId: 'spanish',
          level: 'beginner',
          pointsValue: 5,
          explanation: '"Feliz" is the Spanish word for "happy," used to express positive emotion.',
        },
        
        // English - More questions
        {
          question: 'What does the word benevolent mean?',
          options: ['A) Angry, B) Kind, C) Sad, D) Loud'],
          correctAnswer: 'B) Kind',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: '"Benevolent" describes someone who is kind and generous, often wanting to help others.',
        },
        {
          question: 'What is the meaning of inevitable?',
          options: ['A) Avoidable, B) Delayed, C) Unavoidable, D) Optional'],
          correctAnswer: 'C) Unavoidable',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: '"Inevitable" means something certain to happen; it cannot be prevented.',
        },
        {
          question: 'What does serene mean?',
          options: ['A) Busy, B) Calm, C) Loud, D) Angry'],
          correctAnswer: 'B) Calm',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: '"Serene" refers to a state of being peaceful and untroubled.',
        },
        {
          question: 'What is the definition of elated?',
          options: ['A) Bored, B) Tired, C) Joyful, D) Nervous'],
          correctAnswer: 'C) Joyful',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: '"Elated" means extremely happy or joyful.',
        },
        {
          question: 'What does tedious mean?',
          options: ['A) Exciting, B) Short, C) Boring, D) Creative'],
          correctAnswer: 'C) Boring',
          languageId: 'english',
          level: 'intermediate',
          pointsValue: 10,
          explanation: '"Tedious" describes something that is too long, slow, or dull.',
        },
      ];
      
      // Add all default questions to the batch
      defaultQuestions.forEach((questionData) => {
        const docRef = doc(collection(db, 'wordTrainer'));
        batch.set(docRef, questionData);
      });
      
      // Commit the batch
      await batch.commit();
      
      // Refresh the questions list
      await fetchQuestions();
      
      setIsAddingDefaults(false);
      
      // Show success message
      alert(`Successfully added ${defaultQuestions.length} default questions!`);
      
    } catch (err) {
      console.error('Error adding default questions:', err);
      setError('Failed to add default questions. Please try again.');
      setIsAddingDefaults(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 xl:w-64 bg-[#0277BD] shadow-md text-white shrink-0">
        <div className="p-4 xl:p-6 border-b border-[#29B6F6]/30">
          <Image 
            src="/logo_txt.png" 
            alt="PolyglAI" 
            width={120} 
            height={40} 
            className="h-8 xl:h-10 w-auto"
          />
        </div>
        <nav className="mt-6">
          <div className="px-3 xl:px-4 space-y-1">
            <Link href="/dashboard" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7"></path>
              </svg>
              <span className="text-sm xl:text-base">Dashboard</span>
            </Link>
            <Link href="/dashboard/languages" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span className="text-sm xl:text-base">Language Management</span>
            </Link>
            <Link href="/dashboard/word-trainer" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 bg-[#29B6F6]/20 rounded-md text-white">
              <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
              </svg>
              <span className="text-sm xl:text-base">Word Trainer</span>
            </Link>
            <Link href="/dashboard/users" className="flex items-center px-3 xl:px-4 py-2 xl:py-3 text-white hover:bg-[#29B6F6]/20 rounded-md">
              <svg className="w-4 xl:w-5 h-4 xl:h-5 mr-2 xl:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              <span className="text-sm xl:text-base">Users</span>
            </Link>
          </div>
        </nav>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[#0277BD]">Word Trainer Management</h1>
            <div className="flex gap-3">
              <button
                onClick={addDefaultQuestions}
                disabled={isAddingDefaults}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAddingDefaults ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Default Questions
                  </>
                )}
              </button>
              <Link 
                href="/dashboard/word-trainer/create"
                className="bg-[#0277BD] text-white px-4 py-2 rounded-md hover:bg-[#0288D1] transition-colors"
              >
                Add New Question
              </Link>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD]"></div>
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-blue-50 p-6 rounded-lg text-center">
              <p className="text-lg mb-4">No questions found. Add your first question to get started!</p>
              <Link 
                href="/dashboard/word-trainer/create"
                className="bg-[#0277BD] text-white px-4 py-2 rounded-md hover:bg-[#0288D1] transition-colors"
              >
                Add Question
              </Link>
            </div>
          ) : (
            <div>
              {Object.entries(groupedQuestions).map(([languageId, levels]) => (
                <div key={languageId} className="mb-8">
                  <h2 className="text-xl font-semibold mb-4 text-[#0277BD] border-b pb-2">
                    {capitalizeFirstLetter(languageId)}
                  </h2>
                  
                  {Object.entries(levels).map(([level, levelQuestions]) => (
                    <div key={level} className="mb-6">
                      <h3 className="text-lg font-medium mb-3 text-[#0288D1]">
                        {capitalizeFirstLetter(level)} ({levelQuestions.length})
                      </h3>
                      
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Question
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Points
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {levelQuestions.map((question) => (
                              <tr key={question.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-normal">
                                  <div className="text-sm font-medium text-gray-900">{question.question}</div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    Answer: <span className="font-medium text-green-600">{question.correctAnswer}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {question.pointsValue} pts
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <Link
                                    href={`/dashboard/word-trainer/edit/${question.id}`}
                                    className="text-[#0277BD] hover:text-[#0288D1] mr-4"
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    onClick={() => handleDeleteQuestion(question.id)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 