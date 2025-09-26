'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query, 
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../../../src/lib/firebase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import AdminSidebar from '../../../src/components/AdminSidebar';
import CustomDialog from '../../../src/components/CustomDialog';
import { useCustomDialog } from '../../../src/hooks/useCustomDialog';
import * as XLSX from 'xlsx';

type Question = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  languageId: string;
  pointsValue: number;
  explanation?: string;
};

type GroupedQuestions = {
  [languageId: string]: Question[];
};

export default function WordTrainerManagement() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groupedQuestions, setGroupedQuestions] = useState<GroupedQuestions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingDefaults, setIsAddingDefaults] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    success: number;
    errors: string[];
  }>({ success: 0, errors: [] });
  const [previewData, setPreviewData] = useState<{
    [languageId: string]: Array<{
      question: string;
      detectedLanguage: string;
    }>
  } | null>(null);
  
  // Custom dialog hook
  const { dialogState, hideDialog, showConfirm, showSuccess, showError, showWarning } = useCustomDialog();

  const availableLanguages: { id: string; label: string }[] = [
    { id: 'english', label: 'English' },
    { id: 'mandarin', label: 'Mandarin' },
    { id: 'japanese', label: 'Nihongo' },
    { id: 'korean', label: 'Hangugeo' },
    { id: 'spanish', label: 'Español' },
  ];

  useEffect(() => {
    // Set color scheme to light mode
    document.documentElement.classList.remove('dark');
    // Avoid setting inline color scheme to prevent hydration mismatch
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      fetchQuestions();
    });

    return () => unsubscribe();
  }, [router]);

  // Sync selected language with URL (?lang=...)
  useEffect(() => {
    const lang = searchParams.get('lang');
    if (lang) {
      setSelectedLanguageId(lang);
    } else {
      setSelectedLanguageId(null);
    }
  }, [searchParams]);

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
      
      // Group questions by language
      const grouped: GroupedQuestions = {};
      fetchedQuestions.forEach(question => {
        if (!grouped[question.languageId]) {
          grouped[question.languageId] = [];
        }
        
        grouped[question.languageId].push(question);
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
    // Get question data before deletion for cascade delete
    const questionDoc = await getDoc(doc(db, 'wordTrainer', questionId));
    const questionData = questionDoc.data();
    
    showConfirm(
      'Delete Question',
      'Are you sure you want to delete this question? This will also remove all user assessments for this question.',
      async () => {
        try {
          // First, perform cascade deletion of user assessments
          try {
            const cascadeResponse = await fetch('/api/cascade-delete-content', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contentType: 'word',
                contentId: questionId,
                languageId: questionData?.languageId || 'unknown',
                level: questionData?.level || 'unknown',
                contentValue: questionData?.question
              }),
            });
            
            const cascadeResult = await cascadeResponse.json();
            if (cascadeResult.success) {
              console.log('Cascade deletion completed:', cascadeResult.details);
            } else {
              console.warn('Cascade deletion failed:', cascadeResult.error);
            }
          } catch (cascadeError) {
            console.error('Error performing cascade deletion:', cascadeError);
            // Continue with question deletion even if cascade fails
          }
          
          await deleteDoc(doc(db, 'wordTrainer', questionId));
          // Refresh the list
          fetchQuestions();
          
          showSuccess('Question Deleted', 'Question and all related user assessments have been deleted successfully.');
        } catch (err) {
          console.error('Error deleting question:', err);
          setError('Failed to delete question. Please try again.');
        }
      }
    );
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const toggleSelectAllForLanguage = (languageQuestions: Question[]) => {
    const allSelected = languageQuestions.every(q => selectedQuestionIds.has(q.id));
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        languageQuestions.forEach(q => next.delete(q.id));
      } else {
        languageQuestions.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const clearSelections = () => setSelectedQuestionIds(new Set());

  // Helper function to detect language from content
  const detectLanguage = (text: string): string => {
    const trimmedText = text.trim();
    
    // Chinese characters
    if (/[\u4e00-\u9fff]/.test(trimmedText)) {
      return 'mandarin';
    }
    
    // Japanese characters (Hiragana, Katakana, Kanji)
    if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(trimmedText)) {
      return 'japanese';
    }
    
    // Korean characters
    if (/[\uac00-\ud7af]/.test(trimmedText)) {
      return 'korean';
    }
    
    // Arabic characters
    if (/[\u0600-\u06ff]/.test(trimmedText)) {
      return 'arabic';
    }
    
    // Cyrillic characters (Russian, etc.)
    if (/[\u0400-\u04ff]/.test(trimmedText)) {
      return 'russian';
    }
    
    // Spanish indicators
    if (trimmedText.includes('ñ') || trimmedText.includes('¿') || trimmedText.includes('¡') ||
        /[áéíóúü]/.test(trimmedText) || 
        trimmedText.toLowerCase().includes('hola') ||
        trimmedText.toLowerCase().includes('gracias')) {
      return 'spanish';
    }
    
    // French indicators
    if (trimmedText.includes('ç') || trimmedText.includes('à') || trimmedText.includes('é') ||
        trimmedText.includes('è') || trimmedText.includes('ù') || trimmedText.includes('â') ||
        trimmedText.includes('ê') || trimmedText.includes('î') || trimmedText.includes('ô') ||
        trimmedText.includes('û') || trimmedText.toLowerCase().includes('bonjour')) {
      return 'french';
    }
    
    // German indicators
    if (trimmedText.includes('ä') || trimmedText.includes('ö') || trimmedText.includes('ü') ||
        trimmedText.includes('ß') || trimmedText.toLowerCase().includes('hallo') ||
        trimmedText.toLowerCase().includes('danke')) {
      return 'german';
    }
    
    // Default to English for Latin script
    return 'english';
  };

  // Preview file content and language detection
  const previewFileContent = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const rows = jsonData.slice(1) as string[][];
      const preview: {
        [languageId: string]: Array<{
          question: string;
          detectedLanguage: string;
        }>
      } = {};

      rows.slice(0, 10).forEach((row) => { // Preview first 10 rows
        if (!row[0] || row[0].toString().trim() === '') return;

        const question = row[0].toString().trim();
        const detectedLanguage = detectLanguage(question);
        
        if (!preview[detectedLanguage]) {
          preview[detectedLanguage] = [];
        }

        preview[detectedLanguage].push({
          question: question,
          detectedLanguage: detectedLanguage
        });
      });

      setPreviewData(preview);
    } catch (err) {
      console.error('Error previewing file:', err);
    }
  };

  // Handle file selection for bulk upload
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setUploadFile(file);
        setError('');
        await previewFileContent(file);
      } else {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        setUploadFile(null);
        setPreviewData(null);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.size === 0) return;
    showConfirm(
      'Delete Selected Questions',
      `Delete ${selectedQuestionIds.size} selected question(s)? This will also remove all user assessments for these questions. This action cannot be undone.`,
      async () => {
        try {
          // Get question data for cascade deletion
          const questionDataPromises = Array.from(selectedQuestionIds).map(async (questionId) => {
            const questionDoc = await getDoc(doc(db, 'wordTrainer', questionId));
            return {
              id: questionId,
              data: questionDoc.data()
            };
          });
          
          const questionDataList = await Promise.all(questionDataPromises);
          
          // Perform cascade deletion for all selected questions
          const cascadePromises = questionDataList.map(async (question) => {
            try {
              const cascadeResponse = await fetch('/api/cascade-delete-content', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  contentType: 'word',
                  contentId: question.id,
                  languageId: question.data?.languageId || 'unknown',
                  level: question.data?.level || 'unknown',
                  contentValue: question.data?.question
                }),
              });
              
              const cascadeResult = await cascadeResponse.json();
              if (cascadeResult.success) {
                console.log(`Cascade deletion completed for question ${question.id}:`, cascadeResult.details);
              } else {
                console.warn(`Cascade deletion failed for question ${question.id}:`, cascadeResult.error);
              }
            } catch (cascadeError) {
              console.error(`Error performing cascade deletion for question ${question.id}:`, cascadeError);
            }
          });
          
          // Wait for all cascade deletions to complete
          await Promise.all(cascadePromises);
          
          const batch = writeBatch(db);
          selectedQuestionIds.forEach(id => {
            batch.delete(doc(db, 'wordTrainer', id));
          });
          await batch.commit();
          clearSelections();
          await fetchQuestions();
          
          showSuccess('Questions Deleted', `Successfully deleted ${selectedQuestionIds.size} question(s) and all related user assessments.`);
        } catch (err) {
          console.error('Error bulk deleting questions:', err);
          setError('Failed to delete selected questions. Please try again.');
        }
      }
    );
  };

  // Check for existing questions to prevent duplicates
  const checkForDuplicates = async (questionsToCheck: Array<{
    question: string;
    languageId: string;
  }>): Promise<Set<string>> => {
    const existingQuestions = new Set<string>();
    
    try {
      // Get all existing questions from the database
      const questionsRef = collection(db, 'wordTrainer');
      const snapshot = await getDocs(questionsRef);
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const questionKey = `${data.question.toLowerCase().trim()}_${data.languageId}`;
        existingQuestions.add(questionKey);
      });
      
      return existingQuestions;
    } catch (err) {
      console.error('Error checking for duplicates:', err);
      return new Set<string>();
    }
  };

  // Process Excel file and upload to Firestore with automatic language detection
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadResults({ success: 0, errors: [] });

      // Read the Excel file
      const data = await uploadFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip header row and process data
      const rows = jsonData.slice(1) as string[][];
      const categorizedQuestions: {
        [languageId: string]: Array<{
          question: string;
          options: string[];
          correctAnswer: string;
          languageId: string;
          level: string;
          pointsValue: number;
          explanation?: string;
        }>
      } = {};
      const errors: string[] = [];
      const categorizationResults: {
        [languageId: string]: number;
      } = {};
      const duplicateResults: {
        [languageId: string]: number;
      } = {};

      // First, collect all questions to check for duplicates
      const questionsToCheck: Array<{
        question: string;
        languageId: string;
      }> = [];

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        
        if (!row[0] || row[0].toString().trim() === '') {
          errors.push(`Row ${rowNumber}: Question is required`);
          return;
        }

        const question = row[0].toString().trim();
        const detectedLanguage = detectLanguage(question);
        
        questionsToCheck.push({
          question: question,
          languageId: detectedLanguage
        });
      });

      // Check for duplicates
      const existingQuestions = await checkForDuplicates(questionsToCheck);

      // Process each row and categorize by language
      rows.forEach((row, index) => {
        const rowNumber = index + 2; // +2 because we skipped header and arrays are 0-indexed
        
        if (!row[0] || row[0].toString().trim() === '') {
          errors.push(`Row ${rowNumber}: Question is required`);
          return;
        }

        const question = row[0].toString().trim();
        const detectedLanguage = detectLanguage(question);
        
        // Check for duplicates
        const questionKey = `${question.toLowerCase().trim()}_${detectedLanguage}`;
        if (existingQuestions.has(questionKey)) {
          duplicateResults[detectedLanguage] = (duplicateResults[detectedLanguage] || 0) + 1;
          return; // Skip this question as it already exists
        }
        
        // Parse options (columns 1-4 or more)
        const options = [];
        for (let i = 1; i <= 4; i++) {
          if (row[i] && row[i].toString().trim()) {
            options.push(row[i].toString().trim());
          }
        }
        
        if (options.length < 2) {
          errors.push(`Row ${rowNumber}: At least 2 options are required`);
          return;
        }

        // Correct answer (column 5 or marked with *)
        let correctAnswer = '';
        if (row[5] && row[5].toString().trim()) {
          correctAnswer = row[5].toString().trim();
        } else {
          // Look for option marked with * or assume first option
          const markedOption = options.find(opt => opt.includes('*'));
          if (markedOption) {
            correctAnswer = markedOption.replace('*', '').trim();
          } else {
            correctAnswer = options[0]; // Default to first option
          }
        }

        // Level field removed - no longer needed
        
        // Points (column 7 or default to 5)
        const pointsValue = row[7] ? parseInt(row[7].toString()) || 5 : 5;
        
        // Explanation (column 8)
        const explanation = row[8] ? row[8].toString().trim() : '';

        const questionData = {
          question: question,
          options: options,
          correctAnswer: correctAnswer,
          languageId: detectedLanguage,
          pointsValue: pointsValue,
          explanation: explanation || undefined
        };

        if (!categorizedQuestions[detectedLanguage]) {
          categorizedQuestions[detectedLanguage] = [];
        }
        categorizedQuestions[detectedLanguage].push(questionData);
        categorizationResults[detectedLanguage] = (categorizationResults[detectedLanguage] || 0) + 1;
      });

      // Check if we have any valid content
      const totalContent = Object.values(categorizationResults).reduce((sum, count) => sum + count, 0);
      const totalDuplicates = Object.values(duplicateResults).reduce((sum, count) => sum + count, 0);
      
      if (totalContent === 0) {
        if (totalDuplicates > 0) {
          // All content was duplicate
          const duplicateMessage = `All content in the file already exists in the database!\n\n` +
            `🔄 Duplicates found:\n` +
            Object.entries(duplicateResults).map(([lang, count]) => 
              count > 0 ? `• ${lang.charAt(0).toUpperCase() + lang.slice(1)}: ${count} questions` : ''
            ).filter(line => line).join('\n') +
            `\n\nNo new questions were uploaded.`;
          
          showWarning('All Content Already Exists', duplicateMessage, () => {
            setShowBulkUpload(false);
            setUploadFile(null);
            setPreviewData(null);
            setUploadProgress(0);
            setIsUploading(false);
          });
        } else {
          setError('No valid questions found in the file');
        }
        setIsUploading(false);
        return;
      }

      // Upload to appropriate languages
      const batchSize = 500; // Firestore batch limit
      let totalSuccessCount = 0;

      for (const [languageId, questions] of Object.entries(categorizedQuestions)) {
        if (questions.length === 0) continue;

        // Upload questions for this language
        for (let i = 0; i < questions.length; i += batchSize) {
          const batch = writeBatch(db);
          const batchData = questions.slice(i, i + batchSize);

          batchData.forEach(question => {
            const newDocRef = doc(collection(db, 'wordTrainer'));
            batch.set(newDocRef, question);
          });

          try {
            await batch.commit();
            totalSuccessCount += batchData.length;
          } catch (batchError) {
            console.error(`Batch upload error for ${languageId}:`, batchError);
            errors.push(`Failed to upload ${languageId} batch starting at row ${i + 2}`);
          }

          // Update progress
          const progress = Math.round((totalSuccessCount / totalContent) * 100);
          setUploadProgress(Math.min(progress, 100));
        }
      }

      setUploadResults({ success: totalSuccessCount, errors });
      
      if (totalSuccessCount > 0) {
        await fetchQuestions(); // Refresh the questions list
      }

      // Show detailed results
      const duplicateCount = Object.values(duplicateResults).reduce((sum, count) => sum + count, 0);
      const duplicateMessage = duplicateCount > 0 ? 
        `\n\n🔄 Duplicates skipped: ${duplicateCount} questions` : '';
      
      const resultMessage = `Upload completed!\n\n` +
        `📊 Language Categorization Results:\n` +
        Object.entries(categorizationResults).map(([lang, count]) => 
          `• ${lang.charAt(0).toUpperCase() + lang.slice(1)}: ${count} questions`
        ).join('\n') +
        `\n\n✅ Successfully uploaded: ${totalSuccessCount} questions` +
        duplicateMessage +
        `\n❌ Errors: ${errors.length} questions`;

      if (errors.length === 0) {
        showSuccess('Upload Successful', resultMessage, () => {
          setShowBulkUpload(false);
          setUploadFile(null);
        });
      } else {
        showError('Upload Completed with Errors', resultMessage + `\n\nCheck details below for specific errors.`);
      }

    } catch (err) {
      console.error('Error processing file:', err);
      setError('Failed to process the Excel file. Please check the format and try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Download Excel template
  const downloadTemplate = () => {
    const templateData = [
      ['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer', 'Points', 'Explanation'],
      ['What is the opposite of "hot"?', 'Cold', 'Warm', 'Cool', 'Freezing', 'Cold', '5', 'The direct opposite of hot is cold.'],
      ['How do you say "hello" in Spanish?', 'Hola', 'Adiós', 'Gracias', 'Por favor', 'Hola', '5', '"Hola" is the Spanish word for "hello".'],
      ['What does 你好 mean?', 'Hello', 'Goodbye', 'Thank you', 'Please', 'Hello', '5', '你好 (Nǐ hǎo) means "hello" in Mandarin.'],
      ['What is the capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'Paris', '10', 'Paris is the capital and largest city of France.'],
      ['What does こんにちは mean?', 'Good morning', 'Hello', 'Goodbye', 'Thank you', 'Hello', '5', 'こんにちは (Konnichiwa) means "hello" in Japanese.']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    // Auto-size columns
    const colWidths = [
      { wch: 40 }, // Question
      { wch: 20 }, // Option 1
      { wch: 20 }, // Option 2
      { wch: 20 }, // Option 3
      { wch: 20 }, // Option 4
      { wch: 20 }, // Correct Answer
      { wch: 10 }, // Points
      { wch: 30 }  // Explanation
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `word_trainer_template.xlsx`);
  };

  // Close bulk upload modal
  const closeBulkUpload = () => {
    setShowBulkUpload(false);
    setUploadFile(null);
    setUploadProgress(0);
    setUploadResults({ success: 0, errors: [] });
    setPreviewData(null);
    setError('');
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
        showConfirm(
          'Add Default Questions',
          'Questions already exist in the database. Do you want to add default questions anyway? This will not delete existing questions.',
          async () => {
            await addDefaultQuestionsToDatabase();
          },
          () => {
            setIsAddingDefaults(false);
            return;
          }
        );
        return;
      }
      
      await addDefaultQuestionsToDatabase();
    } catch (err) {
      console.error('Error adding default questions:', err);
      setError('Failed to add default questions. Please try again.');
      setIsAddingDefaults(false);
    }
  };

  const addDefaultQuestionsToDatabase = async () => {
    try {
      
      const batch = writeBatch(db);
      
      // Default questions data based on the Flutter service
      const defaultQuestions = [
        // English
        {
          question: 'What is the opposite of "hot"?',
          options: ['Cold', 'Warm', 'Cool', 'Freezing'],
          correctAnswer: 'Cold',
          languageId: 'english',
          pointsValue: 5,
          explanation: 'The direct opposite of hot is cold.',
        },
        {
          question: 'Which word means "a place to live"?',
          options: ['House', 'Car', 'Book', 'Phone'],
          correctAnswer: 'House',
          languageId: 'english',
          pointsValue: 5,
          explanation: 'A house is a structure where people live.',
        },
        {
          question: 'What color is the sky during the day?',
          options: ['Blue', 'Green', 'Black', 'Red'],
          correctAnswer: 'Blue',
          languageId: 'english',
          pointsValue: 5,
          explanation: 'During the day, the sky appears blue due to the scattering of sunlight.',
        },
        {
          question: 'Which animal says "meow"?',
          options: ['Cat', 'Dog', 'Bird', 'Fish'],
          correctAnswer: 'Cat',
          languageId: 'english',
          pointsValue: 5,
          explanation: 'Cats make the sound "meow" when they vocalize.',
        },
        {
          question: 'Which word means "to move slowly"?',
          options: ['Trudge', 'Sprint', 'Dash', 'Jump'],
          correctAnswer: 'Trudge',
          languageId: 'english',
          pointsValue: 10,
          explanation: 'Trudge means to walk or move slowly with heavy steps.',
        },
        {
          question: 'What is a "protagonist" in a story?',
          options: ['Main character', 'Villain', 'Setting', 'Plot twist'],
          correctAnswer: 'Main character',
          languageId: 'english',
          pointsValue: 10,
          explanation: 'The protagonist is the main character in a story or play.',
        },
        
        // Spanish
        {
          question: 'What is "hello" in Spanish?',
          options: ['Hola', 'Adiós', 'Gracias', 'Por favor'],
          correctAnswer: 'Hola',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Hola" is the Spanish word for "hello".',
        },
        {
          question: 'How do you say "thank you" in Spanish?',
          options: ['Gracias', 'Hola', 'Adiós', 'Buenos días'],
          correctAnswer: 'Gracias',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Gracias" is the Spanish word for "thank you".',
        },
        {
          question: 'What does "buenos días" mean?',
          options: ['Good morning', 'Good afternoon', 'Good evening', 'Good night'],
          correctAnswer: 'Good morning',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Buenos días" is the Spanish greeting for "Good morning".',
        },
        
        // Mandarin - Beginner (more questions to match the image)
        {
          question: 'How do you say "hello" in Mandarin?',
          options: ['你好 (Nǐ hǎo)', '谢谢 (Xièxiè)', '再见 (Zàijiàn)', '对不起 (Duìbùqǐ)'],
          correctAnswer: '你好 (Nǐ hǎo)',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"你好 (Nǐ hǎo)" is the standard Mandarin greeting for "hello".',
        },
        {
          question: 'What does "谢谢 (Xièxiè)" mean?',
          options: ['Thank you', 'Hello', 'Goodbye', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"谢谢 (Xièxiè)" means "Thank you" in Mandarin.',
        },
        {
          question: 'What does "用 (yòng)" mean?',
          options: ['Use', 'Go', 'Come', 'Goodbye'],
          correctAnswer: 'Use',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"用 (yòng)" means "to use" in Mandarin.',
        },
        {
          question: 'What does "去 (qù)" mean?',
          options: ['Come', 'Good', 'Go', 'Goodbye'],
          correctAnswer: 'Go',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"去 (qù)" means "to go" in Mandarin.',
        },
        {
          question: 'What does "来 (lái)" mean?',
          options: ['Come', 'Go', 'Use', 'Good'],
          correctAnswer: 'Come',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"来 (lái)" means "to come" in Mandarin.',
        },
        {
          question: 'What does "好 (hǎo)" mean?',
          options: ['Good', 'Use', 'Goodbye', 'Come'],
          correctAnswer: 'Good',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"好 (hǎo)" means "good" or "well" in Mandarin.',
        },
        {
          question: 'What does "我 (wǒ)" mean?',
          options: ['I', 'Me', 'You', 'He'],
          correctAnswer: 'I, Me',
          languageId: 'mandarin',
          pointsValue: 5,
          explanation: '"我 (wǒ)" means "I" or "me" in Mandarin.',
        },
        
        // Japanese - More beginner questions (Nihongo)
        {
          question: 'How do you say "hello" in Japanese?',
          options: ['こんにちは (Konnichiwa)', 'さようなら (Sayounara)', 'ありがとう (Arigatou)', 'お願いします (Onegaishimasu)'],
          correctAnswer: 'こんにちは (Konnichiwa)',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"こんにちは (Konnichiwa)" is the standard Japanese greeting for "hello".',
        },
        {
          question: 'What does "ありがとう (Arigatou)" mean?',
          options: ['Thank you', 'Goodbye', 'Excuse me', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"ありがとう (Arigatou)" means "Thank you" in Japanese.',
        },
        {
          question: 'What does "木 (ki/moku)" mean?',
          options: ['Tree', 'River', 'Woman', 'Mountain'],
          correctAnswer: 'Tree',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"木 (ki / moku)" means "tree" or "wood" in Japanese.',
        },
        {
          question: 'What does "山 (yama)" mean?',
          options: ['Mountain', 'Child', 'Tree', 'River'],
          correctAnswer: 'Mountain',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"山 (yama)" means "mountain" in Japanese.',
        },
        {
          question: 'What does "川 (kawa)" mean?',
          options: ['River', 'Woman', 'Child', 'Mountain'],
          correctAnswer: 'River',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"川 (kawa)" means "river" in Japanese.',
        },
        {
          question: 'What does "女 (onna)" mean?',
          options: ['Woman', 'Tree', 'Child', 'Mountain'],
          correctAnswer: 'Woman',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"女 (onna)" means "woman" in Japanese.',
        },
        {
          question: 'What does "子 (ko/shi)" mean?',
          options: ['Child', 'Woman', 'Mountain', 'River'],
          correctAnswer: 'Child',
          languageId: 'japanese',
          pointsValue: 5,
          explanation: '"子 (ko / shi)" means "child" in Japanese.',
        },
        
        // Korean - More beginner questions (Hangugeo) 
        {
          question: 'How do you say "hello" in Korean?',
          options: ['안녕하세요 (Annyeonghaseyo)', '감사합니다 (Gamsahamnida)', '안녕히 가세요 (Annyeonghi gaseyo)', '미안합니다 (Mianhamnida)'],
          correctAnswer: '안녕하세요 (Annyeonghaseyo)',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '"안녕하세요 (Annyeonghaseyo)" is the standard Korean greeting for "hello".',
        },
        {
          question: 'What does "감사합니다 (Gamsahamnida)" mean?',
          options: ['Thank you', 'Hello', 'Goodbye', 'Sorry'],
          correctAnswer: 'Thank you',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '"감사합니다 (Gamsahamnida)" means "Thank you" in Korean.',
        },
        {
          question: 'What does 물 (mul) mean?',
          options: ['a) fire, b) water, c) hand, d) river'],
          correctAnswer: 'water',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '물 (mul) means water.',
        },
        {
          question: 'What does 불 (bul) mean?',
          options: ['a) water, b) hand, c) fire, d) river'],
          correctAnswer: 'fire',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '불 (bul) means fire.',
        },
        {
          question: 'What does 손 (son) mean?',
          options: ['a) river, b) hand, c) home/house, d) water'],
          correctAnswer: 'hand',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '손 (son) means hand.',
        },
        {
          question: 'What does 강 (gang) mean?',
          options: ['a) hand, b) river, c) water, d) fire'],
          correctAnswer: 'river',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '강 (gang) means river.',
        },
        {
          question: 'What does 집 (jip) mean?',
          options: ['a) fire, b) home/house, c) hand, d) river'],
          correctAnswer: 'house / home',
          languageId: 'korean',
          pointsValue: 5,
          explanation: '집 (jip) means house or home.',
        },
        
        // Spanish - More questions (Español)
        {
          question: 'What does the Spanish word "perro" mean?',
          options: ['A) Cat, B) Bird, C) Dog, D) Fish'],
          correctAnswer: 'C) Dog',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Gracias" is commonly used to express gratitude, meaning "thank you."',
        },
        {
          question: 'What is the meaning of "gracias"?',
          options: ['A) Goodbye, B) Hello, C) Thank you, D) Please'],
          correctAnswer: 'C) Thank you',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Gracias" is commonly used to express gratitude, meaning "thank you."',
        },
        {
          question: 'What does "rojo" mean?',
          options: ['A) Blue, B) Red, C) Green, D) Yellow'],
          correctAnswer: 'B) Red',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Rojo" refers to the color red in Spanish.',
        },
        {
          question: 'What is the translation of "libro"?',
          options: ['A) Pen, B) Notebook, C) Book, D) Table'],
          correctAnswer: 'C) Book',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Libro" means "book," a common noun in everyday vocabulary.',
        },
        {
          question: 'What does "feliz" mean?',
          options: ['A) Sad, B) Angry, C) Happy, D) Sleepy'],
          correctAnswer: 'C) Happy',
          languageId: 'spanish',
          pointsValue: 5,
          explanation: '"Feliz" is the Spanish word for "happy," used to express positive emotion.',
        },
        
        // English - More questions
        {
          question: 'What does the word benevolent mean?',
          options: ['A) Angry, B) Kind, C) Sad, D) Loud'],
          correctAnswer: 'B) Kind',
          languageId: 'english',
          pointsValue: 10,
          explanation: '"Benevolent" describes someone who is kind and generous, often wanting to help others.',
        },
        {
          question: 'What is the meaning of inevitable?',
          options: ['A) Avoidable, B) Delayed, C) Unavoidable, D) Optional'],
          correctAnswer: 'C) Unavoidable',
          languageId: 'english',
          pointsValue: 10,
          explanation: '"Inevitable" means something certain to happen; it cannot be prevented.',
        },
        {
          question: 'What does serene mean?',
          options: ['A) Busy, B) Calm, C) Loud, D) Angry'],
          correctAnswer: 'B) Calm',
          languageId: 'english',
          pointsValue: 10,
          explanation: '"Serene" refers to a state of being peaceful and untroubled.',
        },
        {
          question: 'What is the definition of elated?',
          options: ['A) Bored, B) Tired, C) Joyful, D) Nervous'],
          correctAnswer: 'C) Joyful',
          languageId: 'english',
          pointsValue: 10,
          explanation: '"Elated" means extremely happy or joyful.',
        },
        {
          question: 'What does tedious mean?',
          options: ['A) Exciting, B) Short, C) Boring, D) Creative'],
          correctAnswer: 'C) Boring',
          languageId: 'english',
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
      showSuccess('Default Questions Added', `Successfully added ${defaultQuestions.length} default questions!`);
      
    } catch (err) {
      console.error('Error adding default questions:', err);
      setError('Failed to add default questions. Please try again.');
    } finally {
      setIsAddingDefaults(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:block"><AdminSidebar active="word-trainer" /></div>
      
      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[#0277BD]">
              {selectedLanguageId ? `Word Trainer · ${availableLanguages.find(l => l.id === selectedLanguageId)?.label || capitalizeFirstLetter(selectedLanguageId)}` : 'Word Trainer Management'}
            </h1>
            <div className="flex gap-3">
              {selectedLanguageId && (
                <button
                  onClick={() => { setSelectedLanguageId(null); clearSelections(); router.push('/dashboard/word-trainer'); }}
                  className="border border-[#0277BD] text-[#0277BD] px-4 py-2 rounded-md hover:bg-[#0277BD]/5 transition-colors"
                >
                  Back to Languages
                </button>
              )}
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
              {!selectedLanguageId ? (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-[#0277BD]">Select a language</h2>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="divide-y divide-gray-200">
                      {availableLanguages.map(lang => (
                        <div
                          key={lang.id}
                          className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedLanguageId(lang.id);
                            clearSelections();
                            router.push(`/dashboard/word-trainer?lang=${lang.id}`);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">{lang.label}</h3>
                              <div className="mt-1 text-sm text-gray-500">{(groupedQuestions[lang.id] && groupedQuestions[lang.id].length) || 0} questions</div>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Actions for selected language */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/dashboard/word-trainer/create${selectedLanguageId ? `?lang=${selectedLanguageId}` : ''}`}
                        className="bg-[#0277BD] text-white px-4 py-2 rounded-md hover:bg-[#0288D1] transition-colors"
                      >
                        Add New Question
                      </Link>
                      <button
                        onClick={() => setShowBulkUpload(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                      >
                        Bulk Upload Excel
                      </button>
                      <button
                        onClick={addDefaultQuestions}
                        disabled={isAddingDefaults}
                        className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    </div>
                  </div>

                  {/* Bulk actions bar */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-600">
                      Selected: <span className="font-medium">{selectedQuestionIds.size}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearSelections}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        Clear selection
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={selectedQuestionIds.size === 0}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                      >
                        Delete selected
                      </button>
                    </div>
                  </div>

                  {(!groupedQuestions[selectedLanguageId || ''] || groupedQuestions[selectedLanguageId || ''].length === 0) ? (
                    <div className="bg-white rounded-lg shadow p-6 text-center text-gray-700">
                      No questions for this language yet.
                    </div>
                  ) : (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-3 text-[#0288D1]">
                        Questions ({groupedQuestions[selectedLanguageId || ''].length})
                      </h3>
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={groupedQuestions[selectedLanguageId || ''].every(q => selectedQuestionIds.has(q.id)) && groupedQuestions[selectedLanguageId || ''].length > 0}
                                    onChange={() => toggleSelectAllForLanguage(groupedQuestions[selectedLanguageId || ''])}
                                  />
                                  Select
                                </div>
                              </th>
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
                            {groupedQuestions[selectedLanguageId || ''].map((question) => (
                              <tr key={question.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    checked={selectedQuestionIds.has(question.id)}
                                    onChange={() => toggleQuestionSelection(question.id)}
                                  />
                                </td>
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
                                    href={`/dashboard/word-trainer/edit/${question.id}${selectedLanguageId ? `?lang=${selectedLanguageId}` : ''}`}
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
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Bulk Upload Questions
                </h2>
                <button
                  onClick={closeBulkUpload}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Smart Upload Instructions:</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Download the Excel template to see the required format</li>
                    <li>• Fill in your questions with options, correct answers, and explanations</li>
                    <li>• Upload the completed Excel file (.xlsx or .xls)</li>
                    <li>• <strong>Automatic language detection:</strong> Questions will be categorized by detected language</li>
                    <li>• Mixed language content is supported - each question will be categorized individually</li>
                    <li>• Questions will be added to the appropriate language automatically</li>
                  </ul>
                </div>

                {/* Template Download */}
                <div className="flex justify-center">
                  <button
                    onClick={downloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Download Excel Template
                  </button>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Excel File
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isUploading}
                  />
                  {uploadFile && (
                    <p className="mt-2 text-sm text-green-600">
                      Selected: {uploadFile.name}
                    </p>
                  )}

                  {/* Preview Data */}
                  {previewData && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Preview Language Detection (first 10 questions):</h4>
                      <div className="space-y-3">
                        {Object.entries(previewData).map(([languageId, items]) => (
                          items.length > 0 && (
                            <div key={languageId} className="border-l-4 border-blue-500 pl-3">
                              <h5 className="font-medium text-gray-800 capitalize">
                                {languageId} ({items.length} questions)
                              </h5>
                              <div className="mt-1 space-y-1">
                                {items.map((item, index) => (
                                  <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                                    <span className="font-mono bg-blue-100 px-2 py-1 rounded text-xs">
                                      {item.detectedLanguage}
                                    </span>
                                    <span className="truncate max-w-xs">{item.question}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Upload Results */}
                {uploadResults.success > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-900 mb-2">Upload Results:</h3>
                    <p className="text-green-800">
                      Successfully uploaded {uploadResults.success} questions with automatic language detection!
                    </p>
                  </div>
                )}

                {/* Upload Errors */}
                {uploadResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-medium text-red-900 mb-2">Upload Errors:</h3>
                    <ul className="text-red-800 text-sm space-y-1">
                      {uploadResults.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeBulkUpload}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || isUploading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Questions'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Dialog */}
      {dialogState.isOpen && dialogState.options && (
        <CustomDialog
          isOpen={dialogState.isOpen}
          onClose={hideDialog}
          title={dialogState.options.title}
          message={dialogState.options.message}
          type={dialogState.options.type}
          onConfirm={dialogState.options.onConfirm}
          onCancel={dialogState.options.onCancel}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          showCancel={dialogState.options.type === 'confirm'}
        />
      )}
    </div>
  );
} 