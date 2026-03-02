import * as dotenv from 'dotenv';
dotenv.config();

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { AssemblyAI } from 'assemblyai';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import {
    exchangeCodeForTokens,
    syncUserCalendar,
    syncAllActiveCalendars,
    correlateEventsWithRecordings
} from './calendar-helpers';
import { generateDailySummary } from './daily-summary';
import { indexAllRecordings, indexRecording } from './indexing';
import { reprocessAllUserRecordings } from './reprocess-all';
import { processKnowledgeGraph } from './knowledge-graph';
import { buildContextPackage, formatContextForPrompt } from './context-builder';
export { backfillKnowledgeGraph, getKnowledgeGraphStats } from './backfill-knowledge';
import {
    generateEmailDraft,
    generateCalendarEventDraft,
    generateGenericActionDraft,
    regenerateDraftWithFeedback,
} from './action-helpers';
import {
  encryptApiKey,
  executeActionWithManus,
  handleManusWebhook,
  getUserManusSettings,
} from './manus-integration';
// Conversation consolidation
import {
      consolidateSessions,
      forceConsolidateSession,
      getConversations,
      consolidateAllPending,
} from './conversation-consolidator';

admin.initializeApp();

// Lazy init to avoid Firebase Admin initialization errors

function getDb() { return admin.firestore(); }
const storage = admin.storage();

// Anthropic - lazy initialization
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}
// AssemblyAI - lazy initialization
let assemblyaiClient: AssemblyAI | null = null;
function getAssemblyAI(): AssemblyAI {
  if (!assemblyaiClient) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY not configured');
    }
    assemblyaiClient = new AssemblyAI({ apiKey });
  }
  return assemblyaiClient;
}
let pineconeClient: Pinecone | null = null;
function getPinecone(): Pinecone {
  if (!pineconeClient) {
    const pk = process.env.PINECONE_API_KEY;
    if (!pk) {
      throw new Error('PINECONE_API_KEY not configured');
    }
    pineconeClient = new Pinecone({ apiKey: pk });
  }
  return pineconeClient;
}

// OpenAI client - lazy initialization
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
    if (!openaiClient) {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
                  throw new Error('OPENAI_API_KEY not configured');
          }
          const cleanedApiKey = apiKey.trim();
          openaiClient = new OpenAI({ apiKey: cleanedApiKey });
    }
    return openaiClient;
}

// ===========================================
// HELPER: Verificar ownership de recording
// ===========================================
async function verifyRecordingOwnership(
    userId: string, 
    recordingId: string
  ): Promise<FirebaseFirestore.DocumentSnapshot> {
    const doc = await getDb()
      .collection('users').doc(userId)
      .collection('recordings').doc(recordingId)
      .get();

  if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Grabación no encontrada o no tienes acceso');
  }

  return doc;
}

// ===========================================
// AUDIO PROCESSING (Storage Trigger)
// ===========================================

/**
 * Procesa audio cuando se sube a Storage
 * Formato esperado: audio/{userId}/{filename}
 */
export const processAudio = functions.storage
  .object()
  .onFinalize(async (object) => {
        if (!object.name?.startsWith('audio/')) return undefined;

                  // Extraer userId del path: audio/{userId}/{filename}
                  const pathParts = object.name.split('/');
        if (pathParts.length < 3) {
                console.error('Invalid audio path format. Expected: audio/{userId}/{filename}');
                return { success: false, reason: 'invalid_path' };
        }
        const userId = pathParts[1];

                  const bucket = storage.bucket(object.bucket);
        const file = bucket.file(object.name);
        const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 3600000
        });

                  // Transcribir con AssemblyAI
                  const transcript = await getAssemblyAI().transcripts.transcribe({
                          audio_url: url,
                          speaker_labels: true,
                          language_code: 'es',
                  });

                  // Guardar en Firestore bajo el usuario (user-scoped)
                  const docRef = await getDb()
          .collection('users').doc(userId)
          .collection('recordings')
          .add({
                    userId,
                    audioPath: object.name,
                    transcript: transcript.text,
                    utterances: transcript.utterances,
                    duration: transcript.audio_duration,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: 'transcribed',
          });

                  // Generar embeddings y guardar en Pinecone
                  const embedding = await getOpenAI().embeddings.create({
                          model: 'text-embedding-3-small',
                          input: transcript.text || '',
                  });

                  const index = getPinecone().index('always-transcripts');
        await index.upsert([{
                id: docRef.id,
                values: embedding.data[0].embedding,
                metadata: { 
                  text: transcript.text?.substring(0, 1000) || '',
                          userId,
                },
        }]);

                  return { success: true, recordingId: docRef.id };
  });

// ===========================================
// GENERATE SUMMARY (Callable)
// ===========================================

export const generateSummary = functions.https.onCall(async (data, context) => {
    // Auth check
                                                        if (!context.auth) {
                                                              throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                                                        }
    const userId = context.auth.uid;

                                                        const { recordingId } = data;
    if (!recordingId) {
          throw new functions.https.HttpsError('invalid-argument', 'recordingId es requerido');
    }

                                                        // Ownership check
                                                        const doc = await verifyRecordingOwnership(userId, recordingId);
    const recording = doc.data();

                                                        const message = await getAnthropic().messages.create({
                                                              model: 'claude-sonnet-4-20250514',
                                                              max_tokens: 1024,
                                                              messages: [{
                                                                      role: 'user',
                                                                      content: `Analiza esta transcripción de una reunión y genera:
                                                                      1. Resumen ejecutivo (2-3 oraciones)
                                                                      2. Puntos clave discutidos
                                                                      3. Tareas/action items detectados
                                                                      4. Insights (objeciones, señales de compra, etc.)

                                                                      Transcripción:
                                                                      ${recording?.transcript}

                                                                      Responde en JSON con esta estructura:
                                                                      {
                                                                        "summary": "",
                                                                          "keyPoints": [],
                                                                            "actionItems": [],
                                                                              "insights": []
                                                                              }`
                                                              }],
                                                        });

                                                        const analysis = JSON.parse(
                                                              message.content[0].type === 'text' ? message.content[0].text : '{}'
                                                            );

                                                        // Actualizar en ruta user-scoped
                                                        await getDb()
      .collection('users').doc(userId)
      .collection('recordings').doc(recordingId)
      .update({
              summary: analysis.summary,
              keyPoints: analysis.keyPoints,
              actionItems: analysis.actionItems,
              insights: analysis.insights,
              status: 'analyzed',
      });

                                                        return analysis;
});

// ===========================================
// SEARCH TRANSCRIPTS (Callable)
// ===========================================

export const searchTranscripts = functions
  .runWith({ secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY'], timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
        // Auth check
                    if (!context.auth) {
                            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                    }
        const userId = context.auth.uid;
        const { query } = data;

                    if (!query || typeof query !== 'string' || query.trim().length === 0) {
                            throw new functions.https.HttpsError('invalid-argument', 'Query debe ser un string no vacío');
                    }

                    try {
                            const openai = getOpenAI();
                            const embedding = await openai.embeddings.create({
                                      model: 'text-embedding-3-small',
                                      input: query.trim(),
                            });

          const index = getPinecone().index('always-transcripts');
                            const queryResponse = await index.query({
                                      vector: embedding.data[0].embedding,
                                      topK: 10,
                                      includeMetadata: true,
                                      filter: { userId },
                            });

          if (!queryResponse.matches || queryResponse.matches.length === 0) {
                    return [];
          }

          return queryResponse.matches.map((match: any) => ({
                    id: match.id,
                    score: match.score,
                    metadata: match.metadata || {},
          }));
                    } catch (error: any) {
      console.error('[searchTranscripts] Error:', error.message);
                            throw new functions.https.HttpsError('internal', 'Error en búsqueda');
                    }
  });

// ===========================================
// CHAT (Callable)
// ===========================================

export const chat = functions.https.onCall(async (data, context) => {
    // Auth check
                                             if (!context.auth) {
                                                   throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                                             }
    const userId = context.auth.uid;

                                             const { message, recordingId } = data;
    if (!message || typeof message !== 'string') {
          throw new functions.https.HttpsError('invalid-argument', 'message es requerido');
    }

                                             let contextText = '';
    if (recordingId) {
          // Ownership check
      const doc = await verifyRecordingOwnership(userId, recordingId);
          contextText = doc.data()?.transcript || '';
    }

                                             const response = await getAnthropic().messages.create({
                                                   model: 'claude-sonnet-4-20250514',
                                                   max_tokens: 1024,
                                                   system: `Eres un asistente que ayuda a analizar grabaciones y reuniones.
                                                   Tienes acceso al contexto de las transcripciones del usuario.
                                                   Responde de forma concisa y útil en español.`,
                                                   messages: [{
                                                           role: 'user',
                                                           content: contextText
                                                             ? `Contexto de la grabación:\n${contextText}\n\nPregunta: ${message}`
                                                                     : message
                                                   }],
                                             });

                                             return response.content[0].type === 'text' ? response.content[0].text : '';
});

// ===========================================
// GET DEEPGRAM KEY (Callable)
// ===========================================

export const getDeepgramKey = functions
  .runWith({ secrets: ['DEEPGRAM_API_KEY'] })
  .https.onCall(async (data, context) => {
        // Auth check
                    if (!context.auth) {
                            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                    }

                    const apiKey = process.env.DEEPGRAM_API_KEY?.trim();
        if (!apiKey) {
                throw new functions.https.HttpsError('failed-precondition', 'Deepgram API key not configured');
        }
        return { apiKey };
  });

// ===========================================
// PROCESS RECORDING (Firestore Trigger - User Scoped)
// ===========================================

export const processRecording = functions
  .runWith({ secrets: ['OPENAI_API_KEY', 'PINECONE_API_KEY'], timeoutSeconds: 60 })
  .firestore
  .document('users/{userId}/recordings/{recordingId}')
  .onCreate(async (snapshot, context) => {
        const recordingId = context.params.recordingId;
        const userId = context.params.userId;
        const data = snapshot.data();

                console.log(`Processing recording ${recordingId} for user ${userId}...`);

                const transcript = data.transcript?.text || data.transcript;
        if (!transcript || transcript === '(sin transcripción)') {
                console.log('No transcript to process, skipping');
                return { success: false, reason: 'no_transcript' };
        }

                try {
                        // Fetch Knowledge Graph context to enrich action extraction
                        let kgContextStr = '';
                        try {
                            const kgCtx = await buildContextPackage(userId, transcript);
                            kgContextStr = formatContextForPrompt(kgCtx);
                        } catch (kgErr) {
                            console.warn('[processRecording] KG context fetch failed:', kgErr);
                        }

                        const completion = await getOpenAI().chat.completions.create({
                                  model: 'gpt-4o-mini',
                                  messages: [
                                    {
                                                  role: 'system',
                                                  content: `Eres un asistente que analiza transcripciones de conversaciones/reuniones.
Extrae informacion estructurada. Tienes acceso al Knowledge Graph del usuario con informacion sobre personas, proyectos y temas de conversaciones previas.
Usa este contexto para generar action items MAS PRECISOS y CONTEXTUALES.
${kgContextStr ? 'CONTEXTO DEL KNOWLEDGE GRAPH:\n' + kgContextStr : ''}
Responde SOLO con JSON válido.`
                                    },
                                    {
                                                  role: 'user',
                                                  content: `Analiza esta transcripción y extrae:
                                                  1. title: Título descriptivo corto (máx 60 caracteres)
                                                  2. summary: Resumen breve (1-2 oraciones)
                                                  3. participants: Lista de nombres de personas mencionadas
                                                  4. topics: Temas principales (máximo 5)
                                                  5. actionItems: Tareas/acciones detectadas con formato enriquecido [{"task":"descripción de la tarea","assignee":"responsable","deadline":"fecha si se menciona","status":"pending","suggestedAction":"qué hacer concretamente (ej: enviar email, agendar reunión, crear documento)","targetService":"servicio sugerido (email, calendar, document, task, browser, other)","category":"tipo (followup, task, decision, reminder, research)","priority":"high/medium/low basado en urgencia detectada","context":"contexto breve de por qué surge esta acción"}]
                                                  6. sentiment: Tono general (positive, neutral, negative)
                                                  7. isGarbage: true si no tiene contenido útil
                                                  8. garbageReason: Si isGarbage es true, explicar por qué

                                                  Transcripción: "${transcript}"

                                                  JSON:`
                                    }
                                            ],
                                  temperature: 0.3,
                                  max_tokens: 1000,
                        });

          const responseText = completion.choices[0]?.message?.content || '{}';
                        const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();

          let analysis;
                        try {
                                  analysis = JSON.parse(cleanJson);
                        } catch {
                                  analysis = {
                                              summary: 'Error al procesar',
                                              participants: [],
                                              topics: [],
                                              actionItems: [],
                                              sentiment: 'neutral'
                                  };
                        }

          await snapshot.ref.update({
                    title: analysis.title || 'Untitled Recording',
                    analysis: {
                                summary: analysis.summary || '',
                                participants: analysis.participants || [],
                                topics: analysis.topics || [],
                                actionItems: analysis.actionItems || [],
                                sentiment: analysis.sentiment || 'neutral',
                                isGarbage: analysis.isGarbage || false,
                                garbageReason: analysis.garbageReason || '',
                                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                                model: 'gpt-4o-mini',
                    },
                    status: 'processed',
                      consolidated: false,  // Mark as pending consolidation
          });

          // === FASE 1a: Create independent action documents ===
          const actionItems = analysis.actionItems || [];
          if (actionItems.length > 0) {
              const actionsCollection = getDb()
                  .collection('users').doc(userId)
                  .collection('actions');
              
              const batch = getDb().batch();
              
              for (const item of actionItems) {
                  const actionRef = actionsCollection.doc();
                  batch.set(actionRef, {
                      task: item.task || '',
                      assignee: item.assignee || '',
                      deadline: item.deadline || '',
                      status: item.status || 'pending',
                      suggestedAction: item.suggestedAction || '',
                      targetService: item.targetService || 'other',
                      category: item.category || 'task',
                      priority: item.priority || 'medium',
                      context: item.context || '',
                      sourceRecordingId: recordingId,
                      sourceSessionId: data.sessionId || '',
                      userId: userId,
                      createdAt: admin.firestore.FieldValue.serverTimestamp(),
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      completedAt: null,
                      manusTaskId: null,
                      manusStatus: null,
                  });
              }
              
              try {
                  await batch.commit();
                  console.log(`Created ${actionItems.length} action documents for user ${userId}`);
              } catch (actionError) {
                  console.error('Error creating action documents:', actionError);
              }
          }

          // Index in Pinecone
          try {
                    const metadata = {
                                createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
                                sessionId: data.sessionId || '',
                                chunkIndex: data.chunkIndex || 0,
                                title: analysis.title || 'Untitled Recording',
                    };
                    await indexRecording(recordingId, userId, transcript, metadata);
          } catch (indexError) {
                    console.error(`Failed to index ${recordingId}:`, indexError);
          }

              // === Knowledge Graph: Extract entities and update graph ===
        try {
            await processKnowledgeGraph(userId, recordingId, transcript);
            console.log(`[KnowledgeGraph] Successfully processed for ${recordingId}`);
        } catch (kgError) {
            console.error(`[KnowledgeGraph] Failed for ${recordingId}:`, kgError);
        }

        return { success: true, recordingId, analysis };
                } catch (error) {
                        console.error(`Error processing ${recordingId}:`, error);
                        await snapshot.ref.update({
                                  status: 'process_error',
                                  processError: error instanceof Error ? error.message : 'Unknown error',
                        });
                        return { success: false, error: String(error) };
                }
  });

// ===========================================
// REPROCESS UNANALYZED (Callable)
// ===========================================

export const reprocessUnanalyzedRecordings = functions
  .runWith({ secrets: ['OPENAI_API_KEY'], timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
        // Auth check
                    if (!context.auth) {
                            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                    }
        const userId = context.auth.uid;

                    console.log(`[reprocessUnanalyzedRecordings] Starting for user ${userId}`);

                    // User-scoped query
                    const snapshot = await getDb()
          .collection('users').doc(userId)
          .collection('recordings')
          .where('status', '!=', 'processed')
          .limit(50)
          .get();

                    console.log(`Found ${snapshot.size} unprocessed recordings`);
        const results: { id: string; success: boolean; error?: string }[] = [];

                    for (const doc of snapshot.docs) {
                            const docData = doc.data();
                            const transcript = docData.transcript?.text || docData.transcript;

          if (!transcript || transcript === '(sin transcripción)') {
                    results.push({ id: doc.id, success: false, error: 'no_transcript' });
                    continue;
          }

          try {
                    const completion = await getOpenAI().chat.completions.create({
                                model: 'gpt-4o-mini',
                                messages: [
                                  {
                                                  role: 'system',
                                                  content: `Eres un asistente que analiza transcripciones. Responde SOLO con JSON válido.`
                                  },
                                  {
                                                  role: 'user',
                                                  content: `Analiza: summary, participants, topics, actionItems, sentiment.
                                                  Transcripción: "${transcript}"
                                                  JSON:`
                                  }
                                            ],
                                temperature: 0.3,
                                max_tokens: 500,
                    });

                              const responseText = completion.choices[0]?.message?.content || '{}';
                    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
                    const analysis = JSON.parse(cleanJson);

                              await doc.ref.update({
                                          analysis: {
                                                        summary: analysis.summary || '',
                                                        participants: analysis.participants || [],
                                                        topics: analysis.topics || [],
                                                        actionItems: analysis.actionItems || [],
                                                        sentiment: analysis.sentiment || 'neutral',
                                                        processedAt: admin.firestore.FieldValue.serverTimestamp(),
                                                        model: 'gpt-4o-mini',
                                          },
                                          status: 'processed',
                              });

                              results.push({ id: doc.id, success: true });
          } catch (error) {
                    console.error(`Error processing ${doc.id}:`, error);
                    results.push({ id: doc.id, success: false, error: String(error) });
          }
                    }

                    return {
                            total: snapshot.size,
                            processed: results.filter(r => r.success).length,
                            failed: results.filter(r => !r.success).length,
                            results,
                    };
  });

// ===========================================
// GENERATE ACTION DRAFT (Callable)
// ===========================================

export const generateActionDraft = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onCall(async (data, context) => {
        // Auth check
                    if (!context.auth) {
                            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                    }
        const userId = context.auth.uid;

                    const { recordingId, action, previousDraft, feedback } = data;
        if (!recordingId || !action) {
                throw new functions.https.HttpsError('invalid-argument', 'recordingId y action son requeridos');
        }

                    try {
                            // Ownership check
          const recordingDoc = await verifyRecordingOwnership(userId, recordingId);
                            const recordingData = recordingDoc.data();
                            const transcriptText = recordingData?.transcript?.text || recordingData?.transcript || '';

          if (previousDraft && feedback) {
                    const openai = getOpenAI();
                    const updatedDraft = await regenerateDraftWithFeedback(openai, previousDraft, feedback);
                    return { draft: updatedDraft };
          }

          const openai = getOpenAI();
                            let draft = '';

          switch (action.type) {
            case 'email':
                        draft = await generateEmailDraft(openai, action, transcriptText);
                        break;
            case 'meeting':
                        draft = await generateCalendarEventDraft(openai, action, transcriptText);
                        break;
            default:
                        draft = await generateGenericActionDraft(openai, action.type, action, transcriptText);
          }

          return { draft };
                    } catch (error) {
                            console.error('Error generando draft:', error);
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

// ===========================================
// EXECUTE ACTION (Callable)
// ===========================================

export const executeAction = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
        // Auth check
                    if (!context.auth) {
                            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
                    }
        const userId = context.auth.uid;

                    const { recordingId, action, draft } = data;
        if (!recordingId || !action || !draft) {
                throw new functions.https.HttpsError('invalid-argument', 'recordingId, action y draft son requeridos');
        }

                    try {
                            // Ownership check
          await verifyRecordingOwnership(userId, recordingId);

          const executionRecord = {
                    recordingId,
                    action,
                    draft,
                    executedAt: admin.firestore.FieldValue.serverTimestamp(),
                    executedBy: userId,
                    status: 'executed',
                    integrationStatus: { email: null, calendar: null }
          };

          await getDb().collection('executedActions').add(executionRecord);

          // Update action item status
          const recordingRef = getDb()
                              .collection('users').doc(userId)
                              .collection('recordings').doc(recordingId);

          const recordingDoc = await recordingRef.get();
                            if (recordingDoc.exists) {
                                      const recData = recordingDoc.data();
                                      const actionItems = recData?.analysis?.actionItems || [];

                              const updatedActionItems = actionItems.map((item: any) => {
                                          if (item.description === action.description) {
                                                        return {
                                                                        ...item,
                                                                        status: 'executed',
                                                                        executedAt: admin.firestore.FieldValue.serverTimestamp(),
                                                                        draft,
                                                        };
                                          }
                                          return item;
                              });

                              await recordingRef.update({ 'analysis.actionItems': updatedActionItems });
                            }

          return { success: true, message: 'Acción registrada exitosamente' };
                    } catch (error) {
                            console.error('Error ejecutando acción:', error);
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

// ===========================================
// GOOGLE CALENDAR INTEGRATION
// ===========================================

export const connectGoogleCalendar = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;
        const { code } = data;

                    if (!code) {
                            throw new functions.https.HttpsError('invalid-argument', 'Código de OAuth requerido');
                    }

                    try {
                            const result = await exchangeCodeForTokens(userId, code);
                            if (!result.success) {
                                      throw new functions.https.HttpsError('internal', result.error || 'Error al conectar calendario');
                            }
                            return { success: true, message: 'Calendario conectado exitosamente' };
                    } catch (error) {
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

export const syncCalendar = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;

                    try {
                            await syncUserCalendar(userId);
                            return { success: true, message: 'Calendario sincronizado exitosamente' };
                    } catch (error) {
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

export const scheduledCalendarSync = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('every 1 hours')
  .onRun(async () => {
        try {
                await syncAllActiveCalendars();
                return null;
        } catch (error) {
                console.error('[Calendar] Scheduled sync error:', error);
                return null;
        }
  });

export const disconnectGoogleCalendar = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;

                    try {
                            await getDb().collection('users').doc(userId)
                              .collection('calendarAuth').doc('google').update({
                                          isActive: false,
                                          disconnectedAt: admin.firestore.FieldValue.serverTimestamp()
                              });
                            return { success: true, message: 'Calendario desconectado exitosamente' };
                    } catch (error) {
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

export const correlateRecordingsWithEvents = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;

                    try {
                            await correlateEventsWithRecordings(userId);
                            return { success: true, message: 'Correlación completada exitosamente' };
                    } catch (error) {
                            if (error instanceof functions.https.HttpsError) throw error;
                            throw new functions.https.HttpsError('internal', `Error: ${error instanceof Error ? error.message : String(error)}`);
                    }
  });

// ===========================================
// MANUS INTEGRATION
// ===========================================

/**
 * Save/update user's Manus API key (encrypted)
 */
export const saveManusApiKey = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 10, memory: '256MB' })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;
        const { apiKey, remove } = data;

        const db = getDb();
        const integrationRef = db
            .collection('users').doc(userId)
            .collection('integrations').doc('manus');

        if (remove) {
            await integrationRef.set({
                isActive: false,
                disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return { success: true, message: 'Manus desconectado' };
        }

        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
            throw new functions.https.HttpsError('invalid-argument', 'API key invalida');
        }

        const encrypted = encryptApiKey(apiKey.trim());

        await integrationRef.set({
            apiKeyEncrypted: encrypted,
            isActive: true,
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return { success: true, message: 'Manus conectado exitosamente' };
    });

/**
 * Check if user has Manus configured
 */
export const getManusStatus = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 10, memory: '256MB' })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;
        const settings = await getUserManusSettings(userId);

        return {
            isConnected: !!settings?.isActive,
            lastUsedAt: settings?.lastUsedAt || null,
        };
    });

/**
 * Execute an action with Manus
 */
export const executeWithManus = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 120, memory: '512MB' })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }
        const userId = context.auth.uid;
        const { actionId } = data;

        if (!actionId) {
            throw new functions.https.HttpsError('invalid-argument', 'actionId es requerido');
        }

        try {
            // Get the action document
            const actionDoc = await getDb()
                .collection('users').doc(userId)
                .collection('actions').doc(actionId)
                .get();

            if (!actionDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Accion no encontrada');
            }

            const actionData = actionDoc.data()!;

            const result = await executeActionWithManus(userId, actionId, {
                task: actionData.task,
                suggestedAction: actionData.suggestedAction || '',
                targetService: actionData.targetService || 'other',
                context: actionData.context || '',
                assignee: actionData.assignee,
                deadline: actionData.deadline,
            });

            return {
                success: true,
                taskId: result.taskId,
                taskUrl: result.taskUrl,
                message: 'Tarea enviada a Manus exitosamente',
            };
        } catch (error) {
            console.error('Error executing with Manus:', error);
            if (error instanceof functions.https.HttpsError) throw error;
            throw new functions.https.HttpsError(
                'internal',
                error instanceof Error ? error.message : 'Error al ejecutar con Manus'
            );
        }
    });

/**
 * Webhook receiver for Manus task status updates
 */
export const manusWebhookReceiver = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onRequest(async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).send('Method not allowed');
            return;
        }

        try {
            const payload = req.body;

            if (!payload.task_id || !payload.status) {
      // Accept test/ping requests from Manus webhook verification
      res.status(200).json({ received: true, message: 'Webhook endpoint active' });
      return;
    }

            await handleManusWebhook({
                task_id: payload.task_id,
                status: payload.status,
                output: payload.output,
            });

            res.status(200).json({ received: true });
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

// ===========================================
// EXPORTS
// ===========================================

export { generateDailySummary };
export { indexAllRecordings };
export { reprocessAllUserRecordings };
export { migrateRecordingsToUser, verifyMigrationStatus } from './migrate-recordings';

// ===========================================
// LARAHQ SYNC (con filtro de seguridad)
// ===========================================
// Conversation consolidation exports
export { consolidateSessions, forceConsolidateSession, getConversations, consolidateAllPending };

let laraHqApp: admin.app.App | null = null;
let laraHqDb: admin.firestore.Firestore | null = null;

function getLaraHqDb(): admin.firestore.Firestore {
    if (!laraHqDb) {
          try {
                  const serviceAccount = require('../larahq-service-account.json');
                  laraHqApp = admin.initializeApp({
                            credential: admin.credential.cert(serviceAccount),
                            projectId: 'larahq-8ea30',
                  }, 'larahq');
                  laraHqDb = laraHqApp.firestore();
          } catch (error) {
                  throw new Error('LaraHQ service account not configured');
          }
    }
    return laraHqDb;
}

export const syncTranscriptionToLaraHQ = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .firestore
  .document('transcriptions/{transcriptionId}')
  .onCreate(async (snapshot, context) => {
        const transcriptionId = context.params.transcriptionId;
        const data = snapshot.data();

                // Security filter: Only sync for authorized user
                const AUTHORIZED_USER_ID = 'oP9ZzurAiEgnE';
        const userId = data.userId || data.uid || '';

                if (!userId || !userId.startsWith(AUTHORIZED_USER_ID.substring(0, 10))) {
                        return { success: false, reason: 'unauthorized_user' };
                }

                try {
                        const laraDb = getLaraHqDb();
                        const inboxDocument = {
                                  type: 'transcription',
                                  source: 'always',
                                  sourceId: transcriptionId,
                                  text: data.text || data.transcript?.text || data.transcript || '',
                                  duration: data.duration || null,
                                  createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                                  processedByLara: false,
                                  syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                                  originalData: {
                                              userId: data.userId || null,
                                              sessionId: data.sessionId || null,
                                  }
                        };

          const docRef = await laraDb.collection('inbox').add(inboxDocument);

          await snapshot.ref.update({
                    laraHqSync: {
                                synced: true,
                                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                                laraHqDocId: docRef.id,
                    }
          });

          return { success: true, laraHqDocId: docRef.id };
                } catch (error) {
                        await snapshot.ref.update({
                                  laraHqSync: {
                                              synced: false,
                                              error: error instanceof Error ? error.message : String(error),
                                              lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
                                  }
                        });
                        return { success: false, error: String(error) };
                }
  });
