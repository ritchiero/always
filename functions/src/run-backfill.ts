/**
 * Standalone backfill script for Knowledge Graph
 * Run: cd functions && npx ts-node src/run-backfill.ts <userId>
 */
import * as admin from 'firebase-admin';

// Initialize admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}

import { processKnowledgeGraph } from './knowledge-graph';

async function runBackfill() {
    const userId = process.argv[2];
    if (!userId) {
          // Try to find the first user
      const usersSnap = await admin.firestore().collection('users').limit(5).get();
          if (usersSnap.empty) {
                  console.error('No users found. Pass userId as argument.');
                  process.exit(1);
          }
          console.log('Available users:');
          usersSnap.docs.forEach(d => console.log(`  ${d.id}`));
          console.log('\nRun: npx ts-node src/run-backfill.ts <userId>');
          process.exit(0);
    }

  const db = admin.firestore();
    console.log(`[Backfill] Starting for user: ${userId}`);

  const recsSnap = await db
      .collection('users').doc(userId)
      .collection('recordings')
      .where('status', '==', 'processed')
      .orderBy('createdAt', 'asc')
      .get();

  console.log(`[Backfill] Found ${recsSnap.size} processed recordings`);

  let processed = 0;
    let skipped = 0;
    let failed = 0;

  for (const doc of recsSnap.docs) {
        const data = doc.data();
        const transcript = data.transcript?.text || data.transcript;

      if (!transcript || transcript.length < 20) {
              console.log(`  [SKIP] ${doc.id} - no transcript`);
              skipped++;
              continue;
      }

      // Check if already processed
      const existing = await db
          .collection('users').doc(userId)
          .collection('entity_mentions')
          .where('recordingId', '==', doc.id)
          .limit(1)
          .get();

      if (!existing.empty) {
              console.log(`  [SKIP] ${doc.id} - already processed`);
              skipped++;
              continue;
      }

      try {
              console.log(`  [PROCESSING] ${doc.id}...`);
              await processKnowledgeGraph(userId, doc.id, transcript);

          const mentions = await db
                .collection('users').doc(userId)
                .collection('entity_mentions')
                .where('recordingId', '==', doc.id)
                .get();

          console.log(`  [OK] ${doc.id} - ${mentions.size} entities extracted`);
              processed++;
      } catch (err) {
              console.error(`  [ERROR] ${doc.id}: ${err}`);
              failed++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500));
  }

  // Final stats
  const ents = await db.collection('users').doc(userId).collection('entities').get();
    const rels = await db.collection('users').doc(userId).collection('relationships').get();

  console.log('\n=== BACKFILL COMPLETE ===');
    console.log(`Processed: ${processed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total entities: ${ents.size}`);
    console.log(`Total relationships: ${rels.size}`);

  process.exit(0);
}

runBackfill().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
