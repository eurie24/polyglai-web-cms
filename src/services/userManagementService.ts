import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UserAction {
  id: string;
  userId: string;
  action: 'disable' | 'enable';
  reason: string;
  timestamp: Date;
  adminId: string;
}

export class UserManagementService {
  /**
   * Disable a user account
   */
  static async disableUser(userId: string, reason: string = 'Profanity violations', adminId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isDisabled: true,
        disabledAt: new Date().toISOString(),
        disabledBy: adminId,
        disabledReason: reason
      });

      // Log the action
      await this.logUserAction(userId, 'disable', reason, adminId);
      
      console.log(`User ${userId} disabled successfully by admin ${adminId}`);
    } catch (error) {
      console.error('Error disabling user:', error);
      throw error;
    }
  }

  /**
   * Enable a user account
   */
  static async enableUser(userId: string, adminId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isDisabled: false,
        enabledAt: new Date().toISOString(),
        enabledBy: adminId,
        disabledAt: null,
        disabledBy: null,
        disabledReason: null
      });

      // Log the action
      await this.logUserAction(userId, 'enable', 'Account re-enabled', adminId);
      
      console.log(`User ${userId} enabled successfully by admin ${adminId}`);
    } catch (error) {
      console.error('Error enabling user:', error);
      throw error;
    }
  }

  /**
   * Log user management actions
   */
  private static async logUserAction(userId: string, action: 'disable' | 'enable', reason: string, adminId: string): Promise<void> {
    try {
      // We'll just log to console for now, but this could be stored in Firestore
      console.log('User Management Action:', {
        userId,
        action,
        reason,
        adminId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging user action:', error);
    }
  }

  /**
   * Check if user is disabled
   */
  static async isUserDisabled(userId: string): Promise<boolean> {
    try {
      const userQuery = query(collection(db, 'users'), where('__name__', '==', userId));
      const userSnapshot = await getDocs(userQuery);
      
      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data();
        return userData.isDisabled === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking user status:', error);
      return false;
    }
  }

  /**
   * Get users with high profanity counts
   */
  static async getHighRiskUsers(threshold: number = 10): Promise<unknown[]> {
    try {
      // Get profanity records to identify high-risk users
      const profanityQuery = query(
        collection(db, 'profanity_records'),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );
      
      const profanitySnapshot = await getDocs(profanityQuery);
      const profanityRecords = profanitySnapshot.docs.map(doc => doc.data());

      // Count profanity by user
      const userCounts = new Map<string, number>();
      profanityRecords.forEach(record => {
        const count = userCounts.get(record.userId) || 0;
        userCounts.set(record.userId, count + 1);
      });

      // Filter users above threshold
      const highRiskUserIds = Array.from(userCounts.entries())
        .filter(([, count]) => count >= threshold)
        .map(([, count]) => ({ count }));

      return highRiskUserIds;
    } catch (error) {
      console.error('Error getting high-risk users:', error);
      return [];
    }
  }
}
