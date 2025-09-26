/**
 * Profanity Counter Service for Web CMS
 * 
 * This service tracks and counts profanity usage by users and saves it to Firestore.
 * It works alongside the ProfanityFilterService to provide comprehensive monitoring.
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  runTransaction,
  writeBatch,
  serverTimestamp,
  increment,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../lib/firebase';

export interface ProfanityRecord {
  id?: string;
  userId: string;
  text: string;
  context: string;
  language: string;
  detectedWords: string[];
  wordCount: number;
  timestamp: unknown;
  date: string;
  createdAt: unknown;
}

export interface UserProfanityStats {
  totalCount: number;
  lastDetected: unknown;
  dailyStats: unknown[];
  languageStats: unknown[];
}

export interface GlobalProfanityStats {
  totalProfanityCount: number;
  usersWithProfanity: number;
  totalUsers: number;
  languageStats: Record<string, number>;
  contextStats: Record<string, number>;
  recentRecordsCount: number;
}

export class ProfanityCounterService {
  /**
   * Records profanity usage when detected
   */
  static async recordProfanityUsage({
    text,
    context = 'translation',
    language = 'unknown',
    detectedWords,
  }: {
    text: string;
    context?: string;
    language?: string;
    detectedWords?: string[];
  }): Promise<void> {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.log('ProfanityCounterService: No authenticated user, skipping profanity recording');
        return;
      }

      const userId = user.uid;
      const timestamp = serverTimestamp();
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      console.log(`ProfanityCounterService: Recording profanity for user ${userId}, context: ${context}, language: ${language}`);

      // Get detected words if not provided
      const words = detectedWords || [];

      // 1. Record individual incident
      await addDoc(collection(db, 'profanity_records'), {
        userId,
        text,
        context,
        language: language || 'unknown',
        detectedWords: words,
        timestamp,
        wordCount: text.split(' ').length,
      });

      // 2. Update user's profanity counter (main user document)
      const userRef = doc(db, 'users', userId);
      
      // First, get the current user document to check if it exists
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        // User document exists, just update profanity fields
        // Count incidents (1 per profanity detection), not words
        await updateDoc(userRef, {
          profanityCount: increment(1), // Count 1 incident, not word count
          lastProfanityDetected: timestamp,
          updatedAt: timestamp,
        });
      } else {
        // User document doesn't exist, create it with basic info
        await setDoc(userRef, {
          name: user.displayName || 'Unknown User',
          email: user.email || 'unknown@example.com',
          profanityCount: 1, // Count 1 incident, not word count
          lastProfanityDetected: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // 3. Update user's daily profanity count (subcollection)
      const userDailyRef = doc(db, 'users', userId, 'daily_profanity', date);
      await setDoc(userDailyRef, {
        date: date,
        count: increment(1), // Count 1 incident, not word count
        firstDetected: timestamp,
        lastUpdated: timestamp,
      }, { merge: true });

      // 4. Update user's language-specific profanity count (subcollection)
      if (language) {
        const userLanguageRef = doc(db, 'users', userId, 'language_profanity', language.toLowerCase());
        await setDoc(userLanguageRef, {
          language: language.toLowerCase(),
          count: increment(1), // Count 1 incident, not word count
          firstDetected: timestamp,
          lastUpdated: timestamp,
        }, { merge: true });
      }

      // 5. Update global admin statistics
      const adminStatsRef = doc(db, 'admin_stats', 'profanity_counter');
      await setDoc(adminStatsRef, {
        totalProfanityCount: increment(1), // Count 1 incident, not word count
        lastDetected: timestamp,
      }, { merge: true });

      // 6. Update global daily profanity count (store in main admin document)
      await setDoc(adminStatsRef, {
        [`dailyProfanity_${date}`]: increment(1), // Count 1 incident, not word count
        lastDetected: timestamp,
      }, { merge: true });

      // 7. Update global language-specific profanity count (store in main admin document)
      if (language) {
        await setDoc(adminStatsRef, {
          [`languageProfanity_${language.toLowerCase()}`]: increment(1), // Count 1 incident, not word count
          lastDetected: timestamp,
        }, { merge: true });
      }

      console.log(`ProfanityCounterService: Successfully recorded profanity usage: ${words.length} words detected in ${context}`);
    } catch (error) {
      console.error('ProfanityCounterService: Error recording profanity usage:', error);
      console.error('ProfanityCounterService: Error details:', (error as Error).toString());
      if ((error as Error).toString().includes('permission-denied')) {
        console.error('ProfanityCounterService: Permission denied - check Firestore rules');
      }
    }
  }

  /**
   * Updates the global profanity counter
   */
  private static async updateGlobalProfanityCounter(wordCount: number): Promise<void> {
    try {
      const globalRef = doc(db, 'admin_stats', 'profanity_counter');
      
      await runTransaction(db, async (transaction) => {
        const globalDoc = await transaction.get(globalRef);
        
        if (globalDoc.exists()) {
          const currentCount = globalDoc.data()?.totalCount || 0;
          transaction.update(globalRef, {
            totalCount: currentCount + wordCount,
            lastUpdated: serverTimestamp(),
          });
        } else {
          transaction.set(globalRef, {
            totalCount: wordCount,
            firstDetected: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error updating global profanity counter:', error);
    }
  }

  /**
   * Updates the daily profanity counter
   */
  private static async updateDailyProfanityCounter(wordCount: number): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const dailyRef = doc(db, 'admin_stats', 'daily_profanity', today);

      await runTransaction(db, async (transaction) => {
        const dailyDoc = await transaction.get(dailyRef);
        
        if (dailyDoc.exists()) {
          const currentCount = dailyDoc.data()?.count || 0;
          transaction.update(dailyRef, {
            count: currentCount + wordCount,
            lastUpdated: serverTimestamp(),
          });
        } else {
          transaction.set(dailyRef, {
            date: today,
            count: wordCount,
            firstDetected: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error updating daily profanity counter:', error);
    }
  }

  /**
   * Updates the language-specific profanity counter
   */
  private static async updateLanguageProfanityCounter(language: string, wordCount: number): Promise<void> {
    try {
      const languageRef = doc(db, 'admin_stats', 'language_profanity', language.toLowerCase());

      await runTransaction(db, async (transaction) => {
        const languageDoc = await transaction.get(languageRef);
        
        if (languageDoc.exists()) {
          const currentCount = languageDoc.data()?.count || 0;
          transaction.update(languageRef, {
            count: currentCount + wordCount,
            lastUpdated: serverTimestamp(),
          });
        } else {
          transaction.set(languageRef, {
            language: language.toLowerCase(),
            count: wordCount,
            firstDetected: serverTimestamp(),
            lastUpdated: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error updating language profanity counter:', error);
    }
  }

  /**
   * Gets global profanity statistics
   */
  static async getGlobalProfanityStats(): Promise<GlobalProfanityStats | null> {
    try {
      // Get global profanity counter
      const globalRef = doc(db, 'admin_stats', 'profanity_counter');
      const globalDoc = await getDoc(globalRef);
      
      const totalProfanityCount = globalDoc.exists() ? globalDoc.data()?.totalCount || 0 : 0;

      // Get daily profanity data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dailyQuery = query(
        collection(db, 'admin_stats', 'daily_profanity'),
        where('date', '>=', thirtyDaysAgo.toISOString().split('T')[0]),
        orderBy('date', 'desc')
      );
      await getDocs(dailyQuery);

      // Get language-specific profanity data
      // const languageQuery = query(collection(db, 'admin_stats', 'language_profanity'));
      // await getDocs(languageQuery);

      // Get recent profanity records for context analysis
      const recentRecordsQuery = query(
        collection(db, 'profanity_records'),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );
      const recentRecordsSnapshot = await getDocs(recentRecordsQuery);

      const languageStats: Record<string, number> = {};
      const contextStats: Record<string, number> = {};

      recentRecordsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const language = data.language || 'unknown';
        const context = data.context || 'unknown';
        
        languageStats[language] = (languageStats[language] || 0) + 1;
        contextStats[context] = (contextStats[context] || 0) + 1;
      });

      return {
        totalProfanityCount,
        usersWithProfanity: 0, // Not applicable for web CMS
        totalUsers: 0, // Not applicable for web CMS
        languageStats,
        contextStats,
        recentRecordsCount: recentRecordsSnapshot.docs.length,
      };
    } catch (error) {
      console.error('Error getting global profanity stats:', error);
      return null;
    }
  }

  /**
   * Gets profanity records with pagination
   */
  static async getProfanityRecords(
    limitCount: number = 50,
    startAfterDoc?: DocumentSnapshot
  ): Promise<QuerySnapshot> {
    try {
      let queryRef = query(
        collection(db, 'profanity_records'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      if (startAfterDoc) {
        queryRef = query(
          collection(db, 'profanity_records'),
          orderBy('timestamp', 'desc'),
          startAfter(startAfterDoc),
          limit(limitCount)
        );
      }

      return await getDocs(queryRef);
    } catch (error) {
      console.error('Error getting profanity records:', error);
      throw error;
    }
  }

  /**
   * Gets daily profanity statistics
   */
  static async getDailyProfanityStats(days: number = 30): Promise<unknown[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const dailyQuery = query(
        collection(db, 'admin_stats', 'daily_profanity'),
        where('date', '>=', startDate.toISOString().split('T')[0]),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(dailyQuery);
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting daily profanity stats:', error);
      return [];
    }
  }

  /**
   * Gets language-specific profanity statistics
   */
  static async getLanguageProfanityStats(): Promise<unknown[]> {
    try {
      const languageQuery = query(collection(db, 'admin_stats', 'language_profanity'));
      const snapshot = await getDocs(languageQuery);
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting language profanity stats:', error);
      return [];
    }
  }

  /**
   * Resets all profanity counters (admin only)
   */
  static async resetAllProfanityCounters(): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      // Reset global counter
      const globalRef = doc(db, 'admin_stats', 'profanity_counter');
      batch.update(globalRef, {
        totalCount: 0,
        lastUpdated: serverTimestamp(),
      });

      // Delete daily profanity records
      const dailyQuery = await getDocs(collection(db, 'admin_stats', 'daily_profanity'));
      dailyQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete language profanity records
      const languageQuery = await getDocs(collection(db, 'admin_stats', 'language_profanity'));
      languageQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete profanity records
      const recordsQuery = await getDocs(collection(db, 'profanity_records'));
      recordsQuery.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log('All profanity counters reset successfully');
    } catch (error) {
      console.error('Error resetting profanity counters:', error);
      throw error;
    }
  }

  /**
   * Gets profanity usage trends over time
   */
  static async getProfanityTrends(days: number = 30): Promise<{
    daily: Array<{ date: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
    monthly: Array<{ month: string; count: number }>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const dailyQuery = query(
        collection(db, 'admin_stats', 'daily_profanity'),
        where('date', '>=', startDate.toISOString().split('T')[0]),
        orderBy('date', 'asc')
      );
      
      const snapshot = await getDocs(dailyQuery);
      const dailyData = snapshot.docs.map(doc => ({
        date: doc.data().date,
        count: doc.data().count || 0
      }));

      // Group by week
      const weeklyData: Array<{ week: string; count: number }> = [];
      const weeklyMap = new Map<string, number>();
      
      dailyData.forEach(day => {
        const date = new Date(day.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + day.count);
      });
      
      weeklyMap.forEach((count, week) => {
        weeklyData.push({ week, count });
      });

      // Group by month
      const monthlyData: Array<{ month: string; count: number }> = [];
      const monthlyMap = new Map<string, number>();
      
      dailyData.forEach(day => {
        const date = new Date(day.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + day.count);
      });
      
      monthlyMap.forEach((count, month) => {
        monthlyData.push({ month, count });
      });

      return {
        daily: dailyData,
        weekly: weeklyData.sort((a, b) => a.week.localeCompare(b.week)),
        monthly: monthlyData.sort((a, b) => a.month.localeCompare(b.month))
      };
    } catch (error) {
      console.error('Error getting profanity trends:', error);
      return { daily: [], weekly: [], monthly: [] };
    }
  }

  /**
   * Get user profanity statistics
   */
  static async getUserProfanityStats(userId: string): Promise<{
    totalCount: number;
    dailyCount: number;
    languageCount: number;
    lastDetected: unknown;
  }> {
    try {
      // Get user document
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return { totalCount: 0, dailyCount: 0, languageCount: 0, lastDetected: null };
      }
      
      const userData = userDoc.data();
      const totalCount = userData.profanityCount || 0;
      const lastDetected = userData.lastProfanityDetected || null;
      
      // Get today's daily count
      const today = new Date().toISOString().split('T')[0];
      const dailyRef = doc(db, 'users', userId, 'daily_profanity', today);
      const dailyDoc = await getDoc(dailyRef);
      const dailyCount = dailyDoc.exists() ? (dailyDoc.data()?.count || 0) : 0;
      
      // Get language-specific counts (sum of all languages)
      const languageQuery = query(collection(db, 'users', userId, 'language_profanity'));
      const languageSnapshot = await getDocs(languageQuery);
      const languageCount = languageSnapshot.docs.reduce((total, doc) => {
        return total + (doc.data().count || 0);
      }, 0);
      
      return {
        totalCount,
        dailyCount,
        languageCount,
        lastDetected
      };
    } catch (error) {
      console.error('Error getting user profanity stats:', error);
      return { totalCount: 0, dailyCount: 0, languageCount: 0, lastDetected: null };
    }
  }
}
