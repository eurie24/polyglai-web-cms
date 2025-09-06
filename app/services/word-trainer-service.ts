import { collection, getDocs, doc, setDoc, getDoc, query, limit, where } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';

export interface WordTrainerQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  pointsValue: number;
  language: string;
  level: string;
}

export class WordTrainerService {
  /**
   * Get questions for a specific language and level
   */
  static async getQuestions(
    languageId: string,
    level: string,
    limitCount: number = 10
  ): Promise<WordTrainerQuestion[]> {
    try {
      const questionsRef = collection(db, 'wordTrainer');
      const q = query(
        questionsRef,
        where('languageId', '==', languageId.toLowerCase()),
        where('level', '==', level.toLowerCase()),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      
      const questions: WordTrainerQuestion[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        questions.push({
          id: doc.id,
          question: data.question || '',
          options: data.options || [],
          correctAnswer: data.correctAnswer || '',
          explanation: data.explanation,
          pointsValue: data.pointsValue || 10,
          language: data.languageId || languageId,
          level: data.level || level,
        });
      });
      
      return questions;
    } catch (error) {
      console.error('Error fetching word trainer questions:', error);
      return [];
    }
  }

  /**
   * Save quiz result to user's language progress
   */
  static async saveResult(
    languageId: string,
    points: number,
    // result correctness not used yet; points capture outcome
  ): Promise<boolean> {
    try {
      // Get current user
      const { auth } = await import('../../src/lib/firebase');
      const user = auth.currentUser;
      
      if (!user) {
        console.error('No user logged in');
        return false;
      }

      const userId = user.uid;
      const languageDoc = doc(db, 'users', userId, 'languages', languageId.toLowerCase());
      
      // Get current language data
      const languageSnapshot = await getDoc(languageDoc);
      let currentPoints = 0;
      
      if (languageSnapshot.exists()) {
        const data = languageSnapshot.data();
        currentPoints = data.points || 0;
      }
      
      // Update points
      await setDoc(languageDoc, {
        points: currentPoints + points,
        lastUpdated: new Date(),
      }, { merge: true });
      
      return true;
    } catch (error) {
      console.error('Error saving word trainer result:', error);
      return false;
    }
  }

  /**
   * Check if word trainer database has any questions
   */
  static async hasQuestions(): Promise<boolean> {
    try {
      const questionsRef = collection(db, 'wordTrainer');
      const snapshot = await getDocs(query(questionsRef, limit(1)));
      return !snapshot.empty;
    } catch (error) {
      console.error('Error checking word trainer database:', error);
      return false;
    }
  }

  /**
   * Initialize word trainer database with sample questions only if empty
   */
  static async initializeWordTrainerDatabase(): Promise<void> {
    try {
      // Check if database already has questions
      const hasExistingQuestions = await this.hasQuestions();
      if (hasExistingQuestions) {
        console.log('Word trainer database already has questions, skipping initialization');
        return;
      }

      console.log('Word trainer database is empty, initializing with sample questions...');
      
      // Only create sample questions if the database is completely empty
      // This ensures we don't overwrite existing questions
      const sampleQuestions = [
        {
          question: "What is the English word for 'hello'?",
          options: ["Hello", "Goodbye", "Thank you", "Please"],
          correctAnswer: "Hello",
          explanation: "Hello is the standard greeting in English.",
          pointsValue: 10,
          languageId: "english",
          level: "beginner"
        },
        {
          question: "Which word means 'good'?",
          options: ["Bad", "Good", "Big", "Small"],
          correctAnswer: "Good",
          explanation: "Good is the opposite of bad.",
          pointsValue: 10,
          languageId: "english",
          level: "beginner"
        },
        {
          question: "¿Cuál es la palabra en español para 'hello'?",
          options: ["Hola", "Adiós", "Gracias", "Por favor"],
          correctAnswer: "Hola",
          explanation: "Hola es el saludo estándar en español.",
          pointsValue: 10,
          languageId: "spanish",
          level: "beginner"
        }
      ];

      // Add sample questions to Firestore using the correct structure
      for (const question of sampleQuestions) {
        const questionRef = doc(collection(db, 'wordTrainer'));
        await setDoc(questionRef, question);
      }
      
      console.log('Word trainer database initialized with sample questions');
    } catch (error) {
      console.error('Error initializing word trainer database:', error);
    }
  }
}
