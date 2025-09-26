/**
 * Test file for auth error handler
 * This file demonstrates the custom error handling functionality
 */

import { getErrorMessage, getCustomAuthErrorMessage } from './auth-error-handler';

// Test cases for different Firebase auth error scenarios
const testCases = [
  {
    name: 'Invalid credentials',
    error: { code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' },
    context: 'admin' as const,
    expected: 'Invalid admin credentials. Please check your email and password.'
  },
  {
    name: 'User not found',
    error: { code: 'auth/user-not-found', message: 'Firebase: Error (auth/user-not-found).' },
    context: 'user' as const,
    expected: 'Invalid email or password. Please try again.'
  },
  {
    name: 'Wrong password',
    error: { code: 'auth/wrong-password', message: 'Firebase: Error (auth/wrong-password).' },
    context: 'admin' as const,
    expected: 'Invalid admin credentials. Please check your email and password.'
  },
  {
    name: 'Too many requests',
    error: { code: 'auth/too-many-requests', message: 'Firebase: Error (auth/too-many-requests).' },
    context: 'user' as const,
    expected: 'Too many failed login attempts. Please wait a few minutes before trying again.'
  },
  {
    name: 'Network error',
    error: { code: 'auth/network-request-failed', message: 'Firebase: Error (auth/network-request-failed).' },
    context: 'admin' as const,
    expected: 'Network error. Please check your internet connection and try again.'
  },
  {
    name: 'Popup blocked',
    error: { code: 'auth/popup-blocked', message: 'Firebase: Error (auth/popup-blocked).' },
    context: 'user' as const,
    expected: 'Sign-in popup was blocked by your browser. Please allow popups and try again.'
  },
  {
    name: 'User disabled',
    error: { code: 'auth/user-disabled', message: 'Firebase: Error (auth/user-disabled).' },
    context: 'admin' as const,
    expected: 'Admin account has been disabled. Please contact support.'
  },
  {
    name: 'Unknown error',
    error: { code: 'auth/unknown-error', message: 'Firebase: Error (auth/unknown-error).' },
    context: 'user' as const,
    expected: 'Authentication failed. Please try again or contact support if the problem persists.'
  }
];

// Function to run tests (for demonstration purposes)
export function runAuthErrorTests() {
  console.log('🧪 Testing Auth Error Handler...\n');
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((testCase) => {
    const result = getCustomAuthErrorMessage(testCase.error, testCase.context);
    const success = result === testCase.expected;
    
    console.log(`${success ? '✅' : '❌'} ${testCase.name}`);
    console.log(`   Input: ${testCase.error.code}`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Got: ${result}`);
    console.log('');
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Example usage for testing specific scenarios
export function testSpecificErrors() {
  console.log('🔍 Testing specific error scenarios...\n');
  
  // Test the exact error from the user's screenshot
  const invalidCredentialError = { code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' };
  const adminMessage = getErrorMessage(invalidCredentialError, 'admin');
  const userMessage = getErrorMessage(invalidCredentialError, 'user');
  
  console.log('Invalid Credential Error:');
  console.log(`  Admin context: "${adminMessage}"`);
  console.log(`  User context: "${userMessage}"`);
  console.log('');
  
  // Test with non-Firebase error
  const genericError = new Error('Some generic error');
  const genericMessage = getErrorMessage(genericError, 'admin');
  console.log('Generic Error:');
  console.log(`  Message: "${genericMessage}"`);
}

// Export for potential use in development
export { testCases };
