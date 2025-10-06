const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// New badges to upload
const newBadges = [
  {
    id: 'accuracy_hunter',
    name: 'Accuracy Hunter',
    description: 'Score 100% in Word Trainer',
    requirements: [
      'Score 100% in Word Trainer',
      'Achieve perfect accuracy in vocabulary training'
    ],
    tips: [
      'Focus on accuracy over speed',
      'Take your time with each question',
      'Review difficult words before attempting'
    ],
    assetUrl: 'assets/badges/accuracy_hunter.svg',
    category: 'accuracy',
    rarity: 'rare',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'consistency_keeper',
    name: 'Consistency Keeper',
    description: 'Level Up for 15 minutes a day, 5 days in a row',
    requirements: [
      'Level Up for 15 minutes a day',
      'Maintain this routine for 5 consecutive days',
      'Use the Level Up feature consistently'
    ],
    tips: [
      'Set daily reminders',
      'Find a consistent time to practice',
      'Track your progress daily'
    ],
    assetUrl: 'assets/badges/consistency_keeper.svg',
    category: 'consistency',
    rarity: 'epic',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'first_steps_scholar',
    name: 'First Steps Scholar',
    description: 'Complete 3 Word Trainer sessions',
    requirements: [
      'Complete 3 separate Word Trainer sessions',
      'Finish each session successfully',
      'Build initial vocabulary foundation'
    ],
    tips: [
      'Start with shorter sessions',
      'Build up your vocabulary gradually',
      'Focus on learning new words each session'
    ],
    assetUrl: 'assets/badges/first_steps_scholar.svg',
    category: 'beginner',
    rarity: 'common',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'globe_trotter',
    name: 'Globe Trotter',
    description: 'Translate a sentence in 5 different languages',
    requirements: [
      'Translate sentences in 5 different languages',
      'Complete translation challenges',
      'Explore multiple language families'
    ],
    tips: [
      'Explore different language families',
      'Practice with various sentence structures',
      'Focus on understanding context'
    ],
    assetUrl: 'assets/badges/globe_trotter.svg',
    category: 'multilingual',
    rarity: 'rare',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'growth_seeker',
    name: 'Growth Seeker',
    description: 'Improve your pronunciation assessment score by 10% compared to your first attempt',
    requirements: [
      'Improve pronunciation score by 10% from first attempt',
      'Show measurable progress in pronunciation',
      'Demonstrate learning and improvement'
    ],
    tips: [
      'Practice pronunciation exercises regularly',
      'Focus on problem areas',
      'Record and compare your progress'
    ],
    assetUrl: 'assets/badges/growth_seeker.svg',
    category: 'improvement',
    rarity: 'epic',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Study at least once every day for 7 days (Level Up)',
    requirements: [
      'Study at least once every day for 7 days',
      'Use Level Up feature daily',
      'Maintain consistent daily practice'
    ],
    tips: [
      'Use Level Up feature daily',
      'Set achievable daily goals',
      'Track your daily progress'
    ],
    assetUrl: 'assets/badges/weekly_warrior.svg',
    category: 'streak',
    rarity: 'rare',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function uploadBadges() {
  console.log('🚀 Starting badge upload process...');
  
  try {
    const batch = db.batch();
    let uploadedCount = 0;
    
    for (const badge of newBadges) {
      const badgeRef = db.collection('badges').doc(badge.id);
      
      // Check if badge already exists
      const existingBadge = await badgeRef.get();
      if (existingBadge.exists) {
        console.log(`⚠️  Badge ${badge.id} already exists, skipping...`);
        continue;
      }
      
      batch.set(badgeRef, badge);
      uploadedCount++;
      console.log(`✅ Prepared badge: ${badge.name} (${badge.id})`);
    }
    
    if (uploadedCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully uploaded ${uploadedCount} new badges to Firestore!`);
    } else {
      console.log('ℹ️  No new badges to upload (all badges already exist)');
    }
    
    console.log('📊 Badge upload process completed!');
    
  } catch (error) {
    console.error('❌ Error uploading badges:', error);
    process.exit(1);
  }
  
  // Exit the process
  process.exit(0);
}

// Run the upload
uploadBadges();
