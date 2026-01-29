import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// Lazy init to avoid Firebase Admin initialization errors
function getDb() { return admin.firestore(); }

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Initialize OpenAI
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: apiKey.trim() });
  }
  return openaiClient;
}

/**
 * Index all existing recordings into Pinecone
 * Run manually: firebase functions:call indexAllRecordings
 */
export const indexAllRecordings = functions
  .runWith({
    secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY'],
    timeoutSeconds: 540, // 9 minutes
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const { force = false } = data; // Force re-index even if already indexed

    console.log(`[indexAllRecordings] Starting for user ${userId}, force=${force}`);

    try {
      const openai = getOpenAI();
      const index = pinecone.index('always-transcripts');

      // Get all recordings for this user
      const recordingsRef = getDb()
        .collection('users')
        .doc(userId)
        .collection('recordings');

      const snapshot = await recordingsRef.get();

      console.log(`[indexAllRecordings] Found ${snapshot.size} recordings to process`);

      if (snapshot.empty) {
        return {
          success: true,
          indexed: 0,
          skipped: 0,
          errors: 0,
          message: 'No recordings found',
        };
      }

      let indexed = 0;
      let skipped = 0;
      let errors = 0;
      const batchSize = 100; // Pinecone upsert batch size
      const vectors: any[] = [];

      for (const doc of snapshot.docs) {
        const recordingId = doc.id;
        const data = doc.data();

        try {
          // Check if already indexed (unless force)
          if (!force && data.indexed === true) {
            console.log(`[indexAllRecordings] Skipping ${recordingId} (already indexed)`);
            skipped++;
            continue;
          }

          // Get transcript text
          const transcript =
            data.transcript?.text ||
            data.transcript ||
            data.transcription?.text ||
            data.transcription ||
            '';

          if (!transcript || transcript === '(sin transcripción)' || transcript.trim().length < 10) {
            console.log(`[indexAllRecordings] Skipping ${recordingId} (no valid transcript)`);
            skipped++;
            continue;
          }

          console.log(
            `[indexAllRecordings] Processing ${recordingId} (${transcript.length} chars)`
          );

          // Generate embedding
          const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: transcript.substring(0, 8000), // Limit to 8k chars for embedding
          });

          const embedding = embeddingResponse.data[0].embedding;

          // Prepare vector for batch upsert
          vectors.push({
            id: recordingId,
            values: embedding,
            metadata: {
              userId: userId,
              text: transcript.substring(0, 1000), // Store first 1000 chars in metadata
              createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
              sessionId: data.sessionId || '',
              chunkIndex: data.chunkIndex || 0,
            },
          });

          // Mark as indexed in Firestore
          await doc.ref.update({
            indexed: true,
            indexedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          indexed++;

          // Batch upsert when we reach batch size
          if (vectors.length >= batchSize) {
            console.log(`[indexAllRecordings] Upserting batch of ${vectors.length} vectors`);
            await index.upsert(vectors);
            vectors.length = 0; // Clear array
          }
        } catch (error: any) {
          console.error(`[indexAllRecordings] Error processing ${recordingId}:`, error);
          errors++;
        }
      }

      // Upsert remaining vectors
      if (vectors.length > 0) {
        console.log(`[indexAllRecordings] Upserting final batch of ${vectors.length} vectors`);
        await index.upsert(vectors);
      }

      const result = {
        success: true,
        indexed,
        skipped,
        errors,
        total: snapshot.size,
        message: `Indexed ${indexed} recordings, skipped ${skipped}, errors ${errors}`,
      };

      console.log('[indexAllRecordings] Completed:', result);

      return result;
    } catch (error: any) {
      console.error('[indexAllRecordings] Fatal error:', error);

      throw new functions.https.HttpsError(
        'internal',
        `Indexing failed: ${error.message || 'Unknown error'}`
      );
    }
  });

/**
 * Index a single recording (called automatically by processRecording trigger)
 */
export const indexRecording = async (
  recordingId: string,
  userId: string,
  transcript: string,
  metadata: any = {}
): Promise<void> => {
  try {
    const openai = getOpenAI();
    const index = pinecone.index('always-transcripts');

    // Generate embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: transcript.substring(0, 8000),
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Upsert to Pinecone
    await index.upsert([
      {
        id: recordingId,
        values: embedding,
        metadata: {
          userId: userId,
          text: transcript.substring(0, 1000),
          ...metadata,
        },
      },
    ]);

    console.log(`[indexRecording] Indexed recording ${recordingId}`);

    // Mark as indexed in Firestore
    await getDb()
      .collection('users')
      .doc(userId)
      .collection('recordings')
      .doc(recordingId)
      .update({
        indexed: true,
        indexedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error: any) {
    console.error(`[indexRecording] Error indexing ${recordingId}:`, error);
    throw error;
  }
};
