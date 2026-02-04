import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Lazy init
function getDb() { return admin.firestore(); }

// OpenAI client - lazy initialization
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!openaiClient) {
          const apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
          openaiClient = new OpenAI({ apiKey: apiKey.trim() });
    }
    return openaiClient;
}

// Configuración
const CONSOLIDATION_DELAY_MINUTES = 5; // Esperar 5 min sin nuevos chunks
const MIN_SILENCE_GAP_MS = 3 * 60 * 1000; // 3 min de silencio = nueva conversación

interface ChunkData {
    id: string;
    sessionId: string;
    chunkNumber: number;
    chunkStartTime: number;
    chunkEndTime?: number;
    transcript: { text: string } | string;
    createdAt: admin.firestore.Timestamp;
    userId: string;
    analysis?: {
      participants?: string[];
      topics?: string[];
      actionItems?: any[];
    };
}

interface ConversationAnalysis {
    title: string;
    summary: string;
    participants: string[];
    topics: string[];
    actionItems: any[];
    sentiment: string;
    keyDecisions: string[];
    followUps: string[];
}

/**
 * Agrupa chunks en conversaciones basándose en gaps de tiempo
 */
function groupChunksIntoConversations(chunks: ChunkData[]): ChunkData[][] {
    if (chunks.length === 0) return [];

  const sorted = [...chunks].sort((a, b) => a.chunkStartTime - b.chunkStartTime);

  const conversations: ChunkData[][] = [];
    let currentConversation: ChunkData[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
        const prevChunk = sorted[i - 1];
        const currentChunk = sorted[i];

      const prevEndTime = prevChunk.chunkEndTime || (prevChunk.chunkStartTime + 15 * 60 * 1000);
        const gap = currentChunk.chunkStartTime - prevEndTime;

      if (gap > MIN_SILENCE_GAP_MS) {
              conversations.push(currentConversation);
              currentConversation = [currentChunk];
      } else {
              currentConversation.push(currentChunk);
      }
  }

  if (currentConversation.length > 0) {
        conversations.push(currentConversation);
  }

  return conversations;
}

/**
 * Genera análisis consolidado para una conversación completa
 */
async function generateConsolidatedAnalysis(
    fullTranscript: string,
    existingAnalyses: any[]
  ): Promise<ConversationAnalysis> {
    const openai = getOpenAI();

  const allParticipants = new Set<string>();
    const allTopics = new Set<string>();
    const allActionItems: any[] = [];

  existingAnalyses.forEach(analysis => {
        analysis?.participants?.forEach((p: string) => allParticipants.add(p));
        analysis?.topics?.forEach((t: string) => allTopics.add(t));
        if (analysis?.actionItems) allActionItems.push(...analysis.actionItems);
  });

  const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
                    role: 'system',
                    content: `Eres un asistente que analiza transcripciones de conversaciones/reuniones completas. 
                    Tu trabajo es generar un análisis consolidado que capture TODO el contexto de la conversación.
                    Responde SOLO con JSON válido, sin markdown.`
          },
          {
                    role: 'user',
                    content: `Analiza esta transcripción COMPLETA de una conversación y genera un análisis consolidado.

                    Contexto previo detectado:
                    - Participantes identificados: ${Array.from(allParticipants).join(', ') || 'No identificados'}
                    - Temas previos: ${Array.from(allTopics).join(', ') || 'No identificados'}
                    - Action items previos: ${allActionItems.length}

                    Transcripción completa:
                    "${fullTranscript.substring(0, 12000)}"

                    Genera JSON con:
{
  "title": "Título descriptivo de la conversación (máx 80 chars)",
    "summary": "Resumen ejecutivo completo (3-5 oraciones)",
      "participants": ["lista de participantes"],
        "topics": ["temas principales discutidos"],
          "actionItems": [
              {
                    "task": "descripción de la tarea",
                          "assignee": "responsable o null",
                                "deadline": "fecha si se mencionó o null",
                                      "priority": "high/medium/low",
                                            "context": "contexto breve de por qué surgió"
                                                }
                                                  ],
                                                    "keyDecisions": ["decisiones importantes tomadas"],
                                                      "followUps": ["temas que quedaron pendientes para seguimiento"],
                                                        "sentiment": "positive/neutral/negative"
                                                        }

                                                        JSON:`
          }
              ],
        temperature: 0.3,
        max_tokens: 1500,
  });

  const responseText = completion.choices[0]?.message?.content || '{}';
    const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();

  try {
        return JSON.parse(cleanJson);
  } catch {
        return {
                title: 'Conversación sin procesar',
                summary: 'Error al procesar el análisis',
                participants: Array.from(allParticipants),
                topics: Array.from(allTopics),
                actionItems: allActionItems,
                keyDecisions: [],
                followUps: [],
                sentiment: 'neutral'
        };
  }
}

/**
 * Consolida un grupo de chunks en una sola conversación
 */
async function consolidateConversation(chunks: ChunkData[]): Promise<string | null> {
    if (chunks.length === 0) return null;

  const userId = chunks[0].userId;
    const sessionId = chunks[0].sessionId;

  const sortedChunks = [...chunks].sort((a, b) => a.chunkStartTime - b.chunkStartTime);

  const fullTranscript = sortedChunks
      .map(chunk => {
              const text = typeof chunk.transcript === 'string' 
                   ? chunk.transcript 
                        : chunk.transcript?.text || '';
              return text;
      })
                                            .filter(text => text && text !== '(sin transcripción)')
      .join('\n\n---\n\n');

  if (!fullTranscript || fullTranscript.length < 50) {
        console.log(`[consolidateConversation] Skipping - insufficient transcript`);
        await markChunksAsConsolidated(chunks.map(c => c.id), null);
        return null;
  }

  const existingAnalyses = sortedChunks
      .map(chunk => chunk.analysis)
      .filter(Boolean);

  const consolidatedAnalysis = await generateConsolidatedAnalysis(fullTranscript, existingAnalyses);

  const startTime = sortedChunks[0].createdAt;
    const endTime = sortedChunks[sortedChunks.length - 1].createdAt;
    const totalDuration = sortedChunks.reduce((sum, chunk) => {
          const chunkDuration = (chunk.chunkEndTime || chunk.chunkStartTime + 15*60*1000) - chunk.chunkStartTime;
          return sum + chunkDuration;
    }, 0);

  const conversationData = {
        userId,
        sessionId,
        chunkIds: sortedChunks.map(c => c.id),
        startTime,
        endTime,
        totalDuration: Math.round(totalDuration / 1000),
        fullTranscript,
        analysis: {
                title: consolidatedAnalysis.title || 'Conversación',
                summary: consolidatedAnalysis.summary || '',
                participants: consolidatedAnalysis.participants || [],
                topics: consolidatedAnalysis.topics || [],
                actionItems: consolidatedAnalysis.actionItems || [],
                sentiment: consolidatedAnalysis.sentiment || 'neutral',
                keyDecisions: consolidatedAnalysis.keyDecisions || [],
                followUps: consolidatedAnalysis.followUps || [],
        },
        status: 'consolidated',
        consolidatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const conversationRef = await getDb()
      .collection('users')
      .doc(userId)
      .collection('conversations')
      .add(conversationData);

  console.log(`[consolidateConversation] Created conversation ${conversationRef.id} from ${chunks.length} chunks`);

  await markChunksAsConsolidated(chunks.map(c => c.id), conversationRef.id);

  return conversationRef.id;
}

/**
 * Marca chunks como consolidados
 */
async function markChunksAsConsolidated(chunkIds: string[], conversationId: string | null): Promise<void> {
    const batch = getDb().batch();

  for (const chunkId of chunkIds) {
        const chunkRef = getDb().collection('recordings').doc(chunkId);
        batch.update(chunkRef, {
                consolidated: true,
                consolidatedAt: admin.firestore.FieldValue.serverTimestamp(),
                conversationId: conversationId,
        });
  }

  await batch.commit();
}

/**
 * Scheduled job: Consolida sesiones que no han tenido actividad reciente
 * Corre cada 5 minutos
 */
export const consolidateSessions = functions
  .runWith({
        secrets: ['OPENAI_API_KEY'],
        timeoutSeconds: 540,
        memory: '1GB',
  })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
        const now = Date.now();
        const cutoffTime = now - (CONSOLIDATION_DELAY_MINUTES * 60 * 1000);

             console.log('[consolidateSessions] Starting consolidation check...');

             try {
                     const pendingChunks = await getDb()
                       .collection('recordings')
                       .where('consolidated', '==', false)
                       .where('status', '==', 'processed')
                       .get();

          if (pendingChunks.empty) {
                    console.log('[consolidateSessions] No pending chunks to consolidate');
                    return null;
          }

          const sessionGroups = new Map<string, ChunkData[]>();

          pendingChunks.docs.forEach(doc => {
                    const data = doc.data() as ChunkData;
                    data.id = doc.id;

                                             const sessionId = data.sessionId || doc.id;

                                             if (!sessionGroups.has(sessionId)) {
                                                         sessionGroups.set(sessionId, []);
                                             }
                    sessionGroups.get(sessionId)!.push(data);
          });

          console.log(`[consolidateSessions] Found ${sessionGroups.size} sessions to check`);

          let consolidatedCount = 0;

          for (const [sessionId, chunks] of sessionGroups) {
                    const latestChunk = chunks.reduce((latest, chunk) => {
                                const chunkTime = chunk.createdAt?.toMillis() || 0;
                                const latestTime = latest.createdAt?.toMillis() || 0;
                                return chunkTime > latestTime ? chunk : latest;
                    }, chunks[0]);

                       const latestTime = latestChunk.createdAt?.toMillis() || 0;

                       if (latestTime > cutoffTime) {
                                   console.log(`[consolidateSessions] Session ${sessionId} still active, skipping`);
                                   continue;
                       }

                       const conversations = groupChunksIntoConversations(chunks);

                       console.log(`[consolidateSessions] Session ${sessionId}: ${chunks.length} chunks -> ${conversations.length} conversations`);

                       for (const conversationChunks of conversations) {
                                   await consolidateConversation(conversationChunks);
                                   consolidatedCount++;
                       }
          }

          console.log(`[consolidateSessions] Consolidated ${consolidatedCount} conversations`);
                     return null;

             } catch (error) {
                     console.error('[consolidateSessions] Error:', error);
                     return null;
             }
  });

/**
 * Callable: Forzar consolidación de una sesión específica
 */
export const forceConsolidateSession = functions
  .runWith({
        secrets: ['OPENAI_API_KEY'],
        timeoutSeconds: 120,
        memory: '512MB',
  })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }

                    const userId = context.auth.uid;
        const { sessionId } = data;

                    if (!sessionId) {
                            throw new functions.https.HttpsError('invalid-argument', 'sessionId es requerido');
                    }

                    try {
                            const chunksSnapshot = await getDb()
                              .collection('recordings')
                              .where('sessionId', '==', sessionId)
                              .where('userId', '==', userId)
                              .get();

          if (chunksSnapshot.empty) {
                    return { success: false, message: 'No se encontraron chunks para esta sesión' };
                                                     }

          const chunks: ChunkData[] = chunksSnapshot.docs.map(doc => ({
                    ...doc.data() as ChunkData,
                    id: doc.id,
          }));

          const conversations = groupChunksIntoConversations(chunks);

          let consolidatedCount = 0;
                            for (const conversationChunks of conversations) {
                                      await consolidateConversation(conversationChunks);
                                             consolidatedCount++;
                            }

          return {
                    success: true,
                    message: `Consolidadas ${consolidatedCount} conversaciones de ${chunks.length} chunks`,
                    conversationsCreated: consolidatedCount,
          };

              } catch (error) {
                            console.error('[forceConsolidateSession] Error:', error);
                            throw new functions.https.HttpsError(
                                      'internal',
                                      `Error: ${error instanceof Error ? error.message : String(error)}`
                                    );
                    }
  });

/**
 * Callable: Obtener conversaciones consolidadas del usuario
 */
export const getConversations = functions
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }

                    const userId = context.auth.uid;
        const { limit: queryLimit = 20, startAfter } = data;

                    try {
                            let query = getDb()
                              .collection('users')
                              .doc(userId)
                              .collection('conversations')
                              .orderBy('startTime', 'desc')
                              .limit(queryLimit);

          if (startAfter) {
                    const startDoc = await getDb()
                      .collection('users')
                      .doc(userId)
                      .collection('conversations')
                      .doc(startAfter)
                      .get();

                              if (startDoc.exists) {
                                          query = query.startAfter(startDoc);
                              }
          }

          const snapshot = await query.get();

          return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
          }));

                    } catch (error) {
                            console.error('[getConversations] Error:', error);
                            throw new functions.https.HttpsError(
                                      'internal',
                                      `Error: ${error instanceof Error ? error.message : String(error)}`
                                    );
                    }
  });

/**
 * Callable: Consolidar todos los chunks pendientes del usuario (manual)
 */
export const consolidateAllPending = functions
  .runWith({
        secrets: ['OPENAI_API_KEY'],
        timeoutSeconds: 540,
        memory: '1GB',
  })
  .https.onCall(async (data, context) => {
        if (!context.auth) {
                throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
        }

                    const userId = context.auth.uid;

                    try {
                            const pendingChunks = await getDb()
                              .collection('recordings')
                              .where('userId', '==', userId)
                              .where('consolidated', '==', false)
                              .where('status', '==', 'processed')
                              .get();

          if (pendingChunks.empty) {
                    return { success: true, message: 'No hay chunks pendientes', conversationsCreated: 0 };
          }

          const sessionGroups = new Map<string, ChunkData[]>();

          pendingChunks.docs.forEach(doc => {
                    const docData = doc.data() as ChunkData;
                    docData.id = doc.id;

                                             const sessionId = docData.sessionId || doc.id;

                                             if (!sessionGroups.has(sessionId)) {
                                                         sessionGroups.set(sessionId, []);
                                             }
                    sessionGroups.get(sessionId)!.push(docData);
          });

          let consolidatedCount = 0;

          for (const [, chunks] of sessionGroups) {
                    const conversations = groupChunksIntoConversations(chunks);

                              for (const conversationChunks of conversations) {
                                          await consolidateConversation(conversationChunks);
                                          consolidatedCount++;
                              }
          }

          return {
                    success: true,
                    message: `Consolidadas ${consolidatedCount} conversaciones`,
                    conversationsCreated: consolidatedCount,
                    chunksProcessed: pendingChunks.size,
          };

                    } catch (error) {
                            console.error('[consolidateAllPending] Error:', error);
                            throw new functions.https.HttpsError(
                                      'internal',
                                      `Error: ${error instanceof Error ? error.message : String(error)}`
                                    );
                    }
  });
