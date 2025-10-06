const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Badge asset URL updates
const badgeUpdates = [
  {
    id: 'accuracy_hunter',
    assetUrl: 'assets/badges/accuracy_hunter.svg'
  },
  {
    id: 'consistency_keeper',
    assetUrl: 'assets/badges/consistency_keeper.svg'
  },
  {
    id: 'first_steps_scholar',
    assetUrl: 'assets/badges/first_steps_scholar.svg'
  },
  {
    id: 'globe_trotter',
    assetUrl: 'assets/badges/globe_trotter.svg'
  },
  {
    id: 'growth_seeker',
    assetUrl: 'assets/badges/growth_seeker.svg'
  },
  {
    id: 'weekly_warrior',
    assetUrl: 'assets/badges/weekly_warrior.svg'
  }
];

async function updateBadgeAssets() {
  console.log('🔄 Starting badge asset URL update process...');
  
  try {
    const batch = db.batch();
    let updatedCount = 0;
    
    for (const badgeUpdate of badgeUpdates) {
      const badgeRef = db.collection('badges').doc(badgeUpdate.id);
      
      // Check if badge exists
      const existingBadge = await badgeRef.get();
      if (!existingBadge.exists) {
        console.log(`⚠️  Badge ${badgeUpdate.id} does not exist, skipping...`);
        continue;
      }
      
      batch.update(badgeRef, {
        assetUrl: badgeUpdate.assetUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updatedCount++;
      console.log(`✅ Prepared update for badge: ${badgeUpdate.id} -> ${badgeUpdate.assetUrl}`);
    }
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`🎉 Successfully updated ${updatedCount} badge asset URLs in Firestore!`);
    } else {
      console.log('ℹ️  No badges to update');
    }
    
    console.log('📊 Badge asset update process completed!');
    
  } catch (error) {
    console.error('❌ Error updating badge assets:', error);
    process.exit(1);
  }
  
  // Exit the process
  process.exit(0);
}

// Run the update
updateBadgeAssets();
