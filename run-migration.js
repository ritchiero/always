#!/usr/bin/env node
/**
 * Run migration to add userId to all recordings
 * Execute with: node run-migration.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./functions/service-account.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'always-f6dda',
});

const db = admin.firestore();

async function migrateRecordings() {
  console.log('🔄 Starting migration...\n');

  try {
    // Get all recordings
    const recordingsRef = db.collection('recordings');
    const snapshot = await recordingsRef.get();

    console.log(`📊 Found ${snapshot.size} total recordings\n`);

    // Filter for recordings without userId
    const recordingsToMigrate = snapshot.docs.filter(doc => {
      const data = doc.data();
      return !data.userId || data.userId === null;
    });

    console.log(`🔧 ${recordingsToMigrate.length} recordings need userId\n`);

    if (recordingsToMigrate.length === 0) {
      console.log('✅ All recordings already have userId!');
      process.exit(0);
    }

    // Get the authenticated user (assuming ricardo.rodriguez@getlawgic.com)
    const userId = 'YOUR_USER_ID_HERE'; // Replace with actual userId

    // If we don't know the userId, find it from the first recording with userId
    let targetUserId = userId;
    const existingUserRecording = snapshot.docs.find(doc => doc.data().userId);
    
    if (existingUserRecording) {
      targetUserId = existingUserRecording.data().userId;
      console.log(`👤 Using userId from existing recording: ${targetUserId}\n`);
    } else {
      console.error('❌ Could not determine userId. Please provide it manually.');
      console.log('\nTo get your userId:');
      console.log('1. Open Firebase Console');
      console.log('2. Go to Authentication');
      console.log('3. Find ricardo.rodriguez@getlawgic.com');
      console.log('4. Copy the User UID');
      console.log('5. Replace YOUR_USER_ID_HERE in this script\n');
      process.exit(1);
    }

    // Batch update (max 500 per batch)
    const batchSize = 500;
    let totalMigrated = 0;

    for (let i = 0; i < recordingsToMigrate.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = recordingsToMigrate.slice(i, i + batchSize);

      batchDocs.forEach(doc => {
        batch.update(doc.ref, {
          userId: targetUserId,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      totalMigrated += batchDocs.length;

      console.log(`✅ Migrated batch: ${totalMigrated}/${recordingsToMigrate.length}`);
    }

    console.log(`\n🎉 Migration complete! ${totalMigrated} recordings migrated.`);
    console.log(`👤 All recordings now belong to userId: ${targetUserId}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateRecordings();
