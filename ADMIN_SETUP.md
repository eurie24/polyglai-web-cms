# Firebase Admin Dashboard Setup Guide

This guide will help you set up admin access to your Firebase database from the web-cms admin dashboard.

## 1. Generate a Firebase Service Account Key

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`polyglai-5591c`)
3. Click on the gear icon (⚙️) next to "Project Overview" to open Project settings
4. Go to the "Service accounts" tab
5. Click "Generate new private key" button
6. Save the downloaded JSON file as `serviceAccountKey.json` in the root of your `web-cms` folder

## 2. Start the Development Server

After placing the service account key file, start the development server:

```bash
npm run dev
```

## 3. Access the Admin Dashboard

1. Go to http://localhost:3000/dashboard
2. Log in with your admin email (`polyglAITool@gmail.com`)
3. You should now see all users from your Firebase database

## Troubleshooting

If you're still having issues:

1. **Check Console Logs**: Open browser developer tools and check for any errors

2. **Verify Service Account Permissions**: Make sure the service account has proper permissions in Firebase. You might need to adjust your Firebase Security Rules.

3. **Direct Access Fallback**: The dashboard will attempt to use direct Firestore access if the admin API fails. Check if this method works.

4. **Fix Firestore Rules**: Ensure your Firestore rules allow admin access. Example rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin function - checks if user email is the admin email
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'polyglAITool@gmail.com';
    }
    
    // Allow authenticated users to read/write their own user data
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
      
      // Allow access to subcollections under a user document
      match /{subcollection}/{document=**} {
        allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
        allow write: if request.auth != null && (request.auth.uid == userId || isAdmin());
      }
    }
  }
}
```

## Understanding Firebase Admin SDK

The Firebase Admin SDK bypasses security rules and accesses Firebase services with full admin privileges. This is why it requires a service account key. Unlike client-side Firebase access, which is restricted by security rules, server-side admin access can read/write any data in your project.

For security, the Admin SDK should only be used in server-side code, never exposed to the client browser. 