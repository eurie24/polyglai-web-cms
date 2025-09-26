'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import CustomDialog from '../../src/components/CustomDialog';
import { useCustomDialog } from '../../src/hooks/useCustomDialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../src/lib/firebase';
import { WordTrainerService, WordTrainerQuestion } from '../services/word-trainer-service';

function WordTrainerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const languageId = searchParams.get('language') || 'english';

  const [questions, setQuestions] = useState<WordTrainerQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Map<number, string>>(new Map());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const { dialogState, showError, hideDialog } = useCustomDialog();

  // Audio refs
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const incorrectAudioRef = useRef<HTMLAudioElement | null>(null);
  const excellentAudioRef = useRef<HTMLAudioElement | null>(null);
  const poorAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize and preload audio
  useEffect(() => {
    // Try to load persisted preference
    try {
      const saved = localStorage.getItem('polyglai_sound_effects');
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        setSoundEnabled(parsed === true);
      }
    } catch {}

    const makeAudio = (src: string) => {
      const a = typeof window !== 'undefined' ? new Audio(src) : null;
      if (a) {
        a.preload = 'auto';
        a.volume = 1.0;
      }
      return a;
    };

    // These files should be placed under public/sounds/
    correctAudioRef.current = makeAudio('/sounds/correct.mp3');
    incorrectAudioRef.current = makeAudio('/sounds/incorrect.mp3');
    // Prefer mp3 for web; fallback keeps .mp4 path if that's what exists
    excellentAudioRef.current = makeAudio('/sounds/excellent_score.mp3');
    poorAudioRef.current = makeAudio('/sounds/poor_score.mp3');

    return () => {
      // Best-effort cleanup
      [correctAudioRef.current, incorrectAudioRef.current, excellentAudioRef.current, poorAudioRef.current].forEach((a) => {
        if (a) {
          try {
            a.pause();
            // @ts-ignore - clearing src helps some browsers release
            a.src = '';
          } catch {}
        }
      });
    };
  }, []);

  const playSound = useCallback((type: 'correct' | 'incorrect' | 'excellent' | 'poor') => {
    if (!soundEnabled) return;
    try {
      const ref =
        type === 'correct' ? correctAudioRef.current :
        type === 'incorrect' ? incorrectAudioRef.current :
        type === 'excellent' ? excellentAudioRef.current :
        poorAudioRef.current;
      if (ref) {
        // rewind for rapid taps
        ref.currentTime = 0;
        const p = ref.play();
        if (p && typeof p.then === 'function') {
          p.catch(() => {});
        }
      }
    } catch {}
  }, [soundEnabled]);

  const loadQuestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const questionsData = await WordTrainerService.getQuestions(languageId, 10);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Error loading questions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [languageId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }
      loadQuestions();
    });

    return () => unsubscribe();
  }, [router, loadQuestions]);

  const checkAnswer = (answer: string) => {
    if (showAnswer) return; // Prevent multiple answers

    const currentQuestion = questions[currentQuestionIndex];
    const correct = answer === currentQuestion.correctAnswer;

    // Play sound effect
    playSound(correct ? 'correct' : 'incorrect');

    setShowAnswer(true);
    setSelectedAnswer(answer);
    setIsCorrect(correct);

    // Store answer
    const newUserAnswers = new Map(userAnswers);
    newUserAnswers.set(currentQuestionIndex, answer);
    setUserAnswers(newUserAnswers);

    if (correct) {
      setScore(score + 1);
      setTotalPointsEarned(totalPointsEarned + currentQuestion.pointsValue);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowAnswer(false);
      setSelectedAnswer(null);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    try {
      // Calculate points based on correct answers
      const totalQuestions = questions.length;
      const pointsPerQuestion = 5;
      const earnedPoints = totalQuestions > 0 ? (score * pointsPerQuestion) : 0;
      const finalPoints = Math.max(earnedPoints, 1); // Always give at least 1 point

      // Play summary sound based on percentage
      const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
      if (percentage >= 70) {
        playSound('excellent');
      } else {
        playSound('poor');
      }

      // Save result
      const success = await WordTrainerService.saveResult(languageId, finalPoints);

      if (success) {
        setTotalPointsEarned(finalPoints);
        setQuizCompleted(true);
      } else {
        showError('Save Failed', 'Failed to save results. Please try again.');
      }
    } catch (error) {
      console.error('Error finishing quiz:', error);
      showError('Error', 'An error occurred. Please try again.');
    }
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setTotalPointsEarned(0);
    setShowAnswer(false);
    setSelectedAnswer(null);
    setUserAnswers(new Map());
    setQuizCompleted(false);
    setIsLoading(true);
    loadQuestions();
  };

  // Sound preference is loaded from localStorage on mount. UI toggle removed per design.

  const getLanguageDisplayName = (languageCode: string) => {
    const languageNames: { [key: string]: string } = {
      'english': 'English',
      'mandarin': 'Mandarin',
      'spanish': 'Español',
      'japanese': 'Nihongo',
      'korean': 'Hangugeo',
    };
    return languageNames[languageCode.toLowerCase()] || 'English';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Word Trainer...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Questions Available</h2>
          <p className="text-gray-600 mb-4">
            No questions available for {getLanguageDisplayName(languageId)} yet.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Questions need to be added to the Firestore database by an administrator.
          </p>
          <button
            onClick={() => router.push('/user-dashboard')}
            className="bg-[#0277BD] text-white px-6 py-3 rounded-lg font-bold hover:bg-[#01579B] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
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

  if (quizCompleted) {
    const percentage = (score / questions.length) * 100;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          {/* Score Circle */}
          <div className="relative mb-8">
            <div className="w-48 h-48 mx-auto relative">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-white shadow-lg flex flex-col items-center justify-center">
                  <div className="text-4xl font-bold text-[#0277BD]">
                    {score}/{questions.length}
                  </div>
                  <div className="text-lg font-semibold text-gray-600">
                    {Math.round(percentage)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Points Earned */}
          <div className="text-center mb-6">
            <div className="bg-gradient-to-r from-[#29B6F6] to-[#0277BD] text-white px-6 py-3 rounded-full inline-block">
              <span className="text-xl font-bold">You earned {totalPointsEarned} points!</span>
            </div>
          </div>

          {/* Feedback */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <div className="flex items-center">
              <div className="text-3xl mr-4">
                {percentage >= 80 ? '🏆' : percentage >= 60 ? '👍' : percentage >= 40 ? '🤔' : '📚'}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {percentage >= 80 
                    ? 'Excellent work! You mastered this level!'
                    : percentage >= 60 
                    ? 'Good job! You\'re making progress!'
                    : percentage >= 40
                    ? 'Not bad! Keep practicing!'
                    : 'Keep studying and try again!'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={restartQuiz}
              className="flex-1 bg-gray-500 text-white py-3 rounded-xl font-bold hover:bg-gray-600 transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🔄</span>
              Try Again
            </button>
            <button
              onClick={() => router.push('/user-dashboard')}
              className="flex-1 bg-[#0277BD] text-white py-3 rounded-xl font-bold hover:bg-[#01579B] transition-colors flex items-center justify-center"
            >
              <span className="mr-2">🏠</span>
              Complete
            </button>
          </div>
        </div>
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

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Word Trainer - {getLanguageDisplayName(languageId)}
            </h1>
            <button
              onClick={() => router.push('/user-dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div 
              className="bg-gradient-to-r from-[#29B6F6] to-[#0277BD] h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>

          {/* Question Counter and Points */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <div className="bg-[#0277BD] text-white px-4 py-2 rounded-full text-sm font-bold">
              Points: {totalPointsEarned}
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="bg-gradient-to-r from-[#29B6F6] to-[#0277BD] text-white p-6 rounded-xl mb-6">
            <h2 className="text-2xl font-bold text-center">{currentQuestion.question}</h2>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = currentQuestion.correctAnswer === option;
              
              let bgColor = 'bg-white';
              let borderColor = 'border-gray-300';
              let textColor = 'text-gray-900';
              let icon = null;

              if (showAnswer) {
                if (isCorrect) {
                  bgColor = 'bg-green-50';
                  borderColor = 'border-green-500';
                  textColor = 'text-green-700';
                  icon = '✅';
                } else if (isSelected) {
                  bgColor = 'bg-red-50';
                  borderColor = 'border-red-500';
                  textColor = 'text-red-700';
                  icon = '❌';
                }
              } else if (isSelected) {
                bgColor = 'bg-blue-50';
                borderColor = 'border-[#0277BD]';
                textColor = 'text-[#0277BD]';
              }

              return (
                <button
                  key={index}
                  onClick={() => !showAnswer && checkAnswer(option)}
                  disabled={showAnswer}
                  className={`w-full p-4 rounded-xl border-2 transition-all duration-200 ${bgColor} ${borderColor} ${textColor} hover:shadow-md disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-lg">{option}</span>
                    {icon && <span className="text-2xl">{icon}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {showAnswer && currentQuestion.explanation && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center mb-2">
                <span className="text-blue-600 mr-2">💡</span>
                <span className="font-semibold text-blue-800">Explanation</span>
              </div>
              <p className="text-blue-700">{currentQuestion.explanation}</p>
            </div>
          )}

          {/* Result and Next Button */}
          {showAnswer && (
            <div className="mt-6">
              <div className={`p-4 rounded-xl mb-4 text-center font-bold ${
                isCorrect 
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              }`}>
                {isCorrect 
                  ? `Correct! +${currentQuestion.pointsValue} points`
                  : `Incorrect. The correct answer is: ${currentQuestion.correctAnswer}`
                }
              </div>
              
              <button
                onClick={nextQuestion}
                className="w-full bg-[#0277BD] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#01579B] transition-colors"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
              </button>
            </div>
          )}
        </div>
      </div>
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

export default function WordTrainerPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0277BD] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Word Trainer...</p>
        </div>
      </div>
    }>
      <WordTrainerPageContent />
    </Suspense>
  );
}
