/**
 * Custom error handler for Firebase authentication errors
 * Maps Firebase error codes to user-friendly messages
 */

export interface FirebaseAuthError {
  code?: string;
  message?: string;
}

/**
 * Maps Firebase authentication error codes to custom user-friendly messages
 */
export function getCustomAuthErrorMessage(error: FirebaseAuthError, context: 'admin' | 'user' = 'user'): string {
  const errorCode = error.code;
  
  // Common authentication errors
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      if (context === 'admin') {
        return 'Invalid admin credentials. Please check your email and password.';
      }
      return 'Invalid email or password. Please try again.';
      
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
      
    case 'auth/user-disabled':
      if (context === 'admin') {
        return 'Admin account has been disabled. Please contact support.';
      }
      return 'Your account has been disabled. Please contact support.';
      
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please wait a few minutes before trying again.';
      
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
      
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.';
      
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups and try again.';
      
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
      
    case 'auth/invalid-action-code':
      return 'Invalid or expired reset link. Please request a new password reset.';
      
    case 'auth/expired-action-code':
      return 'Password reset link has expired. Please request a new one.';
      
    case 'auth/weak-password':
      return 'Password is too weak. Please choose a stronger password.';
      
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
      
    case 'auth/operation-not-allowed':
      if (context === 'admin') {
        return 'Admin authentication method not enabled. Please contact support.';
      }
      return 'This sign-in method is not enabled. Please try a different method.';
      
    case 'auth/requires-recent-login':
      return 'This operation requires recent authentication. Please sign in again.';
      
    case 'auth/invalid-verification-code':
      return 'Invalid verification code. Please try again.';
      
    case 'auth/invalid-verification-id':
      return 'Invalid verification. Please try again.';
      
    case 'auth/missing-verification-code':
      return 'Verification code is required.';
      
    case 'auth/missing-verification-id':
      return 'Verification ID is missing.';
      
    case 'auth/code-expired':
      return 'Verification code has expired. Please request a new one.';
      
    case 'auth/quota-exceeded':
      return 'Service temporarily unavailable. Please try again later.';
      
    case 'auth/app-deleted':
      return 'Application has been deleted. Please contact support.';
      
    case 'auth/keychain-error':
      return 'Keychain error. Please try again or contact support.';
      
    case 'auth/internal-error':
      return 'Internal error occurred. Please try again.';
      
    case 'auth/invalid-credential':
      if (context === 'admin') {
        return 'Invalid admin credentials. Please verify your login details.';
      }
      return 'Invalid credentials. Please check your email and password.';
      
    case 'auth/invalid-user-token':
      return 'Your session has expired. Please sign in again.';
      
    case 'auth/user-mismatch':
      return 'User mismatch. Please sign out and try again.';
      
    case 'auth/user-token-expired':
      return 'Your session has expired. Please sign in again.';
      
    case 'auth/web-storage-unsupported':
      return 'Your browser does not support web storage. Please use a different browser.';
      
    case 'auth/credential-already-in-use':
      return 'This credential is already associated with a different account.';
      
    case 'auth/timeout':
      return 'Request timed out. Please check your connection and try again.';
      
    default:
      // For unknown errors, provide a generic message
      console.warn('Unhandled Firebase auth error:', error);
      if (context === 'admin') {
        return 'Admin authentication failed. Please verify your credentials and try again.';
      }
      return 'Authentication failed. Please try again or contact support if the problem persists.';
  }
}

/**
 * Checks if an error is a Firebase authentication error
 */
export function isFirebaseAuthError(error: unknown): error is FirebaseAuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    (error as any).code.startsWith('auth/')
  );
}

/**
 * Gets a user-friendly error message from any error object
 */
export function getErrorMessage(error: unknown, context: 'admin' | 'user' = 'user'): string {
  if (isFirebaseAuthError(error)) {
    return getCustomAuthErrorMessage(error, context);
  }
  
  // Handle other types of errors
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // Default fallback
  if (context === 'admin') {
    return 'Admin authentication failed. Please try again.';
  }
  return 'Authentication failed. Please try again.';
}
