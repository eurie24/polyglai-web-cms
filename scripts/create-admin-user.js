/**
 * Create Admin User Script
 * 
 * This script creates the admin user account with authentication in Firebase.
 * It creates both the Firebase Auth user and Firestore user document.
 * 
 * Run with: node scripts/create-admin-user.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
let serviceAccount;

try {
  // Try to load service account key from environment variables first
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    console.log('Using environment variables for Firebase Admin SDK');
    serviceAccount = {
      projectId,
      clientEmail,
      privateKey
    };
  } else {
    // Fallback to service account key file
    const serviceAccountPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Service account key file not found!');
      console.error('Please ensure serviceAccountKey.json exists in the web-cms root directory');
      process.exit(1);
    }
    
    serviceAccount = require(serviceAccountPath);
    console.log('✅ Service account key loaded from file');
  }

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
  });

  console.log('✅ Firebase Admin SDK initialized successfully');

} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

// Admin credentials
const adminEmail = 'polyglAITool@gmail.com';
const adminPassword = 'justwanttopasscapstone';
const adminData = {
  id: 'admin_user',
  name: 'PolyglAI Administrator',
  email: adminEmail,
  role: 'admin',
  isAdmin: true,
  createdAt: new Date(),
  lastLogin: new Date(),
  language: 'English',
  settings: {
    emailNotifications: true,
    pushNotifications: true,
    language: 'en'
  }
};

async function createAdminUser() {
  try {
    console.log('🚀 Starting admin user creation...');
    console.log(`📧 Email: ${adminEmail}`);
    
    // Check if user already exists
    try {
      const existingUser = await auth.getUserByEmail(adminEmail);
      console.log('⚠️  User already exists:', existingUser.uid);
      
      // Update the password
      await auth.updateUser(existingUser.uid, {
        password: adminPassword,
        emailVerified: true
      });
      console.log('✅ Admin password updated successfully');
      
      // Also update Firestore document
      const userRef = db.collection('users').doc(existingUser.uid);
      await userRef.set({
        ...adminData,
        uid: existingUser.uid,
        lastModified: new Date()
      }, { merge: true });
      
      console.log('✅ Admin Firestore document updated');
      
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist, create new one
        console.log('📝 Creating new admin user...');
        
        const userRecord = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          emailVerified: true,
          displayName: 'PolyglAI Administrator'
        });
        
        console.log('✅ Admin user created successfully:', userRecord.uid);
        
        // Create Firestore document
        const userRef = db.collection('users').doc(userRecord.uid);
        await userRef.set({
          ...adminData,
          uid: userRecord.uid
        });
        
        console.log('✅ Admin Firestore document created');
        
      } else {
        throw error;
      }
    }
    
    // Also add to admins collection for access control
    const adminsRef = db.collection('admins').doc(adminEmail.replace('@', '_at_'));
    await adminsRef.set({
      email: adminEmail,
      role: 'admin',
      hasAuth: true,
      createdAt: new Date()
    }, { merge: true });
    
    console.log('✅ Admin access record created');
    
    // Create a success message
    console.log('\n🎉 Admin user setup completed successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('🌐 Admin Login URL: http://localhost:3000/admin/login');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('ℹ️  User already exists, attempting to update password...');
      try {
        const existingUser = await auth.getUserByEmail(adminEmail);
        await auth.updateUser(existingUser.uid, {
          password: adminPassword
        });
        console.log('✅ Password updated successfully');
      } catch (updateError) {
        console.error('❌ Failed to update password:', updateError.message);
      }
    } else if (error.code === 'auth/weak-password') {
      console.error('❌ Password is too weak. Please use a stronger password.');
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
  } finally {
    process.exit(0);
  }
}

// Run the script
createAdminUser();
