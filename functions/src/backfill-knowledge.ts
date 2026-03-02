import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { processKnowledgeGraph } from './knowledge-graph';

// =========================================
// BACKFILL: Process existing recordings
// =========================================

export const backfillKnowledgeGraph = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }

                    const userId = context.auth.uid;
        const db = admin.firestore();
        const batchSize = data?.batchSize || 50;
        const startAfter = data?.startAfter || null;

                    console.log(`[Backfill] Starting KG backfill for user ${userId}`);

                    let query = db
          .collection('users').doc(userId)
          .collection('recordings')
          .where('status', '==', 'processed')
          .orderBy('createdAt', 'asc')
          .limit(batchSize);

                    if (startAfter) {
                            const startDoc = await db
                              .collection('users').doc(userId)
                              .collection('recordings').doc(startAfter)
                              .get();
                            if (startDoc.exists) {
                                      query = query.startAfter(startDoc);
                            }
                    }

                    const snapshot = await query.get();

                    if (snapshot.empty) {
                            return { success: true, processed: 0, total: 0, message: 'No hay grabaciones', hasMore: false };
                    }

                    const results: { id: string; success: boolean; error?: string; entities?: number }[] = [];
        let lastDocId = '';

                    for (const doc of snapshot.docs) {
                            const recData = doc.data();
                            const transcript = recData.transcript?.text || recData.transcript;
                            lastDocId = doc.id;

          if (!transcript || transcript.length < 20) {
                    results.push({ id: doc.id, success: false, error: 'no_transcript' });
                    continue;
          }

          const existing = await db
                              .collection('users').doc(userId)
                              .collection('entity_mentions')
                              .where('recordingId', '==', doc.id)
                              .limit(1)
                              .get();

          if (!existing.empty && !data?.force) {
                    results.push({ id: doc.id, success: true, error: 'already_processed' });
                    continue;
          }

          try {
                    await processKnowledgeGraph(userId, doc.id, transcript);
                    const mentions = await db
                      .collection('users').doc(userId)
                      .collection('entity_mentions')
                      .where('recordingId', '==', doc.id)
                      .get();
                    results.push({ id: doc.id, success: true, entities: mentions.size });
          } catch (error) {
                    results.push({ id: doc.id, success: false, error: String(error) });
          }

          await new Promise(resolve => setTimeout(resolve, 500));
                    }

                    const processed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const skipped = results.filter(r => r.error === 'already_processed').length;

                    const ents = await db.collection('users').doc(userId).collection('entities').get();
        const rels = await db.collection('users').doc(userId).collection('relationships').get();

                    return {
                            success: true, processed, failed, skipped, total: snapshot.size,
                            graphStats: { totalEntities: ents.size, totalRelationships: rels.size },
                            hasMore: snapshot.size === batchSize, lastDocId,
                            message: `Backfill: ${processed} procesadas, ${ents.size} entidades en el grafo`,
                            results,
                    };
  });

// =========================================
// KG STATS
// =========================================

export const getKnowledgeGraphStats = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }

                    const userId = context.auth.uid;
        const db = admin.firestore();

                    const entitiesSnap = await db.collection('users').doc(userId).collection('entities').get();
        const typeCounts: Record<string, number> = {};
        let totalMentions = 0;
        for (const doc of entitiesSnap.docs) {
                const e = doc.data();
                typeCounts[e.type || 'unknown'] = (typeCounts[e.type || 'unknown'] || 0) + 1;
                totalMentions += e.mentionCount || 0;
        }

                    const relsSnap = await db.collection('users').doc(userId).collection('relationships').get();

                    const topSnap = await db
          .collection('users').doc(userId)
          .collection('entities')
          .orderBy('mentionCount', 'desc')
          .limit(10)
          .get();
        const topEntities = topSnap.docs.map(d => ({
                id: d.id, name: d.data().name, type: d.data().type, mentionCount: d.data().mentionCount,
        }));

                    const recsSnap = await db
          .collection('users').doc(userId)
          .collection('recordings')
          .where('status', '==', 'processed')
          .get();

                    const mentionsSnap = await db.collection('users').doc(userId).collection('entity_mentions').get();
        const processedIds = new Set<string>();
        mentionsSnap.docs.forEach(d => { if (d.data().recordingId) processedIds.add(d.data().recordingId); });

                    return {
                            totalEntities: entitiesSnap.size,
                            totalRelationships: relsSnap.size,
                            totalMentions, typeCounts, topEntities,
                            recordingsTotal: recsSnap.size,
                            recordingsProcessedForKG: processedIds.size,
                            recordingsPending: recsSnap.size - processedIds.size,
                    };
  });
