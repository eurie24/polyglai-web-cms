/**
 * Seed Users Script
 * 
 * This script adds sample users to your Firestore database.
 * To run:
 * 1. Ensure you have firebase-admin package installed (npm install firebase-admin)
 * 2. Set up Firebase service account credentials
 * 3. Run: node scripts/seed-users.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account-key.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Sample users to add
const users = [
  {
    id: 'user1',
    name: 'John Smith',
    email: 'john@example.com',
    gender: 'Male',
    age: 28,
    location: 'New York',
    role: 'user',
    profession: 'Developer',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    languages: ['English', 'Spanish'],
  },
  {
    id: 'user2',
    name: 'Emily Johnson',
    email: 'emily@example.com',
    gender: 'Female',
    age: 32,
    location: 'California',
    role: 'user',
    profession: 'Designer',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    languages: ['English', 'French'],
  },
  {
    id: 'user3',
    name: 'Alex Chen',
    email: 'alex@example.com',
    gender: 'Non-binary',
    age: 24,
    location: 'Texas',
    role: 'user',
    profession: 'Student',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    languages: ['English', 'Chinese'],
  },
  {
    id: 'admin1',
    name: 'Admin User',
    email: 'polyglAITool@gmail.com',
    gender: 'Male',
    age: 30,
    location: 'Philippines',
    role: 'admin',
    profession: 'Administrator',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    languages: ['English', 'Filipino'],
  }
];

// Add users to Firestore
async function seedUsers() {
  try {
    console.log('Starting to seed users...');
    
    const batch = db.batch();
    
    users.forEach(user => {
      const userRef = db.collection('users').doc(user.id);
      batch.set(userRef, user);
    });
    
    // Also add the admin to the admins collection
    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      const adminRef = db.collection('admins').doc(adminUser.id);
      batch.set(adminRef, {
        email: adminUser.email,
        role: 'admin',
        createdAt: adminUser.createdAt
      });
    }
    
    await batch.commit();
    
    console.log('Successfully added users and admin!');
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    process.exit(0);
  }
}

seedUsers(); 