import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Lazy init to avoid Firebase Admin initialization errors
function getDb() { return admin.firestore(); }

/**
 * Migrate legacy recordings from /recordings to /users/{userId}/recordings
 *
 * SECURITY: Only the authenticated user can migrate recordings
 * This moves all recordings from root to user-scoped collection
 */
export const migrateRecordingsToUser = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    // Authentication required
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to migrate recordings'
      );
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;

    console.log(`[migrateRecordingsToUser] Starting migration for user ${userId} (${userEmail})`);

    try {
      // Find all recordings in root collection
      const rootRecordingsRef = getDb().collection('recordings');
      const snapshot = await rootRecordingsRef.get();

      console.log(`[migrateRecordingsToUser] Found ${snapshot.size} total recordings in root`);

      // Filter for recordings that belong to this user or have no userId
      const recordingsToMigrate = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.userId || data.userId === null || data.userId === userId;
      });

      console.log(`[migrateRecordingsToUser] ${recordingsToMigrate.length} recordings to migrate`);

      if (recordingsToMigrate.length === 0) {
        return {
          success: true,
          migrated: 0,
          message: 'No recordings to migrate',
        };
      }

      // User-scoped collection reference
      const userRecordingsRef = getDb()
        .collection('users').doc(userId)
        .collection('recordings');

      // Migrate in batches (max 500 per batch for Firestore)
      const batchSize = 250; // Use 250 to allow 2 operations per doc (create + delete)
      let totalMigrated = 0;
      let totalSkipped = 0;

      for (let i = 0; i < recordingsToMigrate.length; i += batchSize) {
        const batch = getDb().batch();
        const batchDocs = recordingsToMigrate.slice(i, i + batchSize);

        for (const doc of batchDocs) {
          const docData = doc.data();

          // Check if already exists in user-scoped collection
          const existingDoc = await userRecordingsRef.doc(doc.id).get();
          if (existingDoc.exists) {
            console.log(`[migrateRecordingsToUser] Skipping ${doc.id} - already migrated`);
            totalSkipped++;
            continue;
          }

          // Create in user-scoped collection
          const newDocRef = userRecordingsRef.doc(doc.id);
          batch.set(newDocRef, {
            ...docData,
            userId: userId,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: 'root_recordings',
          });

          // Mark original as migrated (soft delete)
          batch.update(doc.ref, {
            migratedToUserScoped: true,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedToUserId: userId,
          });
        }

        await batch.commit();
        totalMigrated += batchDocs.length - totalSkipped;

        console.log(`[migrateRecordingsToUser] Migrated batch: ${totalMigrated}/${recordingsToMigrate.length}`);
      }

      console.log(`[migrateRecordingsToUser] Migration complete: ${totalMigrated} recordings migrated, ${totalSkipped} skipped`);

      return {
        success: true,
        migrated: totalMigrated,
        skipped: totalSkipped,
        userId: userId,
        userEmail: userEmail,
        message: `Successfully migrated ${totalMigrated} recordings to /users/${userId}/recordings`,
      };
    } catch (error: any) {
      console.error('[migrateRecordingsToUser] Error:', error);

      throw new functions.https.HttpsError(
        'internal',
        `Migration failed: ${error.message || 'Unknown error'}`
      );
    }
  });

/**
 * Verify migration status
 * Returns count of recordings with/without userId
 */
export const verifyMigrationStatus = functions
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;

    try {
      const recordingsRef = getDb().collection('recordings');
      const allSnapshot = await recordingsRef.get();

      const withUserId = allSnapshot.docs.filter(doc => doc.data().userId === userId);
      const withoutUserId = allSnapshot.docs.filter(doc => !doc.data().userId);
      const otherUsers = allSnapshot.docs.filter(doc => 
        doc.data().userId && doc.data().userId !== userId
      );

      return {
        total: allSnapshot.size,
        yourRecordings: withUserId.length,
        needsMigration: withoutUserId.length,
        otherUsers: otherUsers.length,
      };
    } catch (error: any) {
      console.error('[verifyMigrationStatus] Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
