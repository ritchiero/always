import * as dotenv from 'dotenv';
dotenv.config();

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { AssemblyAI } from 'assemblyai';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Inicializar clientes - lazy initialization para secrets
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

// OpenAI client - lazy initialization porque usa Firebase Secret
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  // #region agent log
  console.log('[DEBUG-HYPC] getOpenAI called:', JSON.stringify({hasClient:!!openaiClient,envKeys:Object.keys(process.env).length,envVarsList:Object.keys(process.env).slice(0,20)}));
  // #endregion
  
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    // #region agent log
    console.log('[DEBUG-HYPABE] API key details:', JSON.stringify({hasKey:!!apiKey,keyType:typeof apiKey,keyLength:apiKey?.length || 0,keyFirstChars:apiKey?.substring(0,15) || 'EMPTY',keyLastChars:apiKey?.substring(apiKey.length-8) || 'EMPTY',containsNewline:apiKey?.includes('\n'),containsSpace:apiKey?.includes(' '),trimmedLength:apiKey?.trim().length || 0}));
    // #endregion
    
    if (!apiKey) {
      // #region agent log
      console.log('[DEBUG-HYPBE] API key is EMPTY, all env vars:', JSON.stringify(Object.keys(process.env)));
      // #endregion
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    // Trim whitespace/newlines from API key
    const cleanedApiKey = apiKey.trim();
    
    // #region agent log
    console.log('[DEBUG-HYPABE] After trim:', JSON.stringify({originalLength:apiKey.length,cleanedLength:cleanedApiKey.length,different:apiKey !== cleanedApiKey}));
    // #endregion
    
    openaiClient = new OpenAI({ apiKey: cleanedApiKey });
    console.log('OpenAI client initialized with key:', cleanedApiKey.substring(0, 10) + '...');
    
    // #region agent log
    console.log('[DEBUG-HYPC] OpenAI client created successfully');
    // #endregion
  }
  return openaiClient;
}

// Procesar audio cuando se sube a Storage
export const processAudio = functions.storage
  .object()
  .onFinalize(async (object) => {
    if (!object.name?.startsWith('audio/')) return;
    
    const bucket = storage.bucket(object.bucket);
    const file = bucket.file(object.name);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600000 });
    
    // Transcribir con AssemblyAI (incluye diarization)
    const transcript = await assemblyai.transcripts.transcribe({
      audio_url: url,
      speaker_labels: true,
      language_code: 'es',
    });
    
    // Guardar en Firestore
    const docRef = await db.collection('recordings').add({
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
    
    const index = pinecone.index('always-transcripts');
    await index.upsert([{
      id: docRef.id,
      values: embedding.data[0].embedding,
      metadata: { text: transcript.text?.substring(0, 1000) || '' },
    }]);
    
    return { success: true, recordingId: docRef.id };
  });

// Generar resumen con Claude
export const generateSummary = functions.https.onCall(async (data, context) => {
  const { recordingId } = data;
  const doc = await db.collection('recordings').doc(recordingId).get();
  const recording = doc.data();
  
  const message = await anthropic.messages.create({
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
{ "summary": "", "keyPoints": [], "actionItems": [], "insights": [] }`
    }],
  });
  
  const analysis = JSON.parse(message.content[0].type === 'text' ? message.content[0].text : '{}');
  
  await db.collection('recordings').doc(recordingId).update({
    summary: analysis.summary,
    keyPoints: analysis.keyPoints,
    actionItems: analysis.actionItems,
    insights: analysis.insights,
    status: 'analyzed',
  });
  
  return analysis;
});

// Buscar en transcripciones con Pinecone
export const searchTranscripts = functions.https.onCall(async (data, context) => {
  const { query } = data;
  
  const embedding = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  
  const index = pinecone.index('always-transcripts');
  const results = await index.query({
    vector: embedding.data[0].embedding,
    topK: 5,
    includeMetadata: true,
  });
  
  return results.matches;
});

// Chat con contexto
export const chat = functions.https.onCall(async (data, context) => {
  const { message, recordingId } = data;
  
  let contextText = '';
  if (recordingId) {
    const doc = await db.collection('recordings').doc(recordingId).get();
    contextText = doc.data()?.transcript || '';
  }
  
  const response = await anthropic.messages.create({
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

// Obtener API key de Deepgram para el cliente
export const getDeepgramKey = functions.https.onCall(async (data, context) => {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  console.log('=== getDeepgramKey called ===');

  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Deepgram API key not configured');
  }

  return { apiKey };
});

// ========== PROCESAMIENTO AUTOMÁTICO DE CHUNKS ==========

/**
 * Procesa un recording cuando se crea en Firestore
 * Usa GPT-4o-mini para extraer: resumen, participantes, action items, temas
 */
export const processRecording = functions
  .runWith({
    secrets: ['OPENAI_API_KEY'],
    timeoutSeconds: 60,
  })
  .firestore
  .document('recordings/{recordingId}')
  .onCreate(async (snapshot, context) => {
    const recordingId = context.params.recordingId;
    const data = snapshot.data();

    console.log(`Processing recording ${recordingId}...`);

    // Solo procesar si tiene transcripción
    const transcript = data.transcript?.text || data.transcript;
    if (!transcript || transcript === '(sin transcripción)') {
      console.log('No transcript to process, skipping');
      return { success: false, reason: 'no_transcript' };
    }

    try {
      // Usar GPT-4o-mini para análisis (barato y rápido)
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que analiza transcripciones de conversaciones/reuniones.
Extrae información estructurada de la transcripción proporcionada.
Responde SOLO con JSON válido, sin markdown ni explicaciones.`
          },
          {
            role: 'user',
            content: `Analiza esta transcripción y extrae:
1. summary: Resumen breve (1-2 oraciones)
2. participants: Lista de participantes inferidos (nombres o roles como "Speaker 1", "Entrevistador", etc.)
3. topics: Temas principales discutidos (máximo 5)
4. actionItems: Tareas o compromisos mencionados (puede estar vacío)
5. sentiment: Tono general (positive, neutral, negative)

Transcripción:
"${transcript}"

Responde en JSON:
{"summary":"","participants":[],"topics":[],"actionItems":[],"sentiment":""}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';
      console.log('GPT-4o-mini response:', responseText);

      // Parsear respuesta
      let analysis;
      try {
        // Limpiar posibles marcadores de código
        const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
        analysis = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('Error parsing GPT response:', parseError);
        analysis = {
          summary: 'Error al procesar',
          participants: [],
          topics: [],
          actionItems: [],
          sentiment: 'neutral'
        };
      }

      // Actualizar documento con análisis
      await snapshot.ref.update({
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

      console.log(`Recording ${recordingId} processed successfully`);
      return { success: true, recordingId, analysis };

    } catch (error) {
      console.error(`Error processing recording ${recordingId}:`, error);

      // Marcar como error pero no fallar
      await snapshot.ref.update({
        status: 'process_error',
        processError: error instanceof Error ? error.message : 'Unknown error',
      });

      return { success: false, error: String(error) };
    }
  });

/**
 * Función callable para reprocesar recordings existentes que no tienen análisis
 */
export const reprocessUnanalyzedRecordings = functions
  .runWith({
    secrets: ['OPENAI_API_KEY'],
    timeoutSeconds: 540, // 9 minutos
  })
  .https.onCall(async (data, context) => {
  // #region agent log
  console.log('[DEBUG-HYPD] reprocessUnanalyzedRecordings called:', JSON.stringify({hasContext:!!context,envKeysCount:Object.keys(process.env).length,hasOpenAIKey:!!process.env.OPENAI_API_KEY,openAIKeyLength:process.env.OPENAI_API_KEY?.length || 0}));
  // #endregion
  
  console.log('Starting reprocess of unanalyzed recordings...');

  // Obtener recordings sin análisis
  const snapshot = await db.collection('recordings')
    .where('status', '!=', 'processed')
    .limit(50) // Limitar para evitar timeouts
    .get();

  console.log(`Found ${snapshot.size} unprocessed recordings`);

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const transcript = data.transcript?.text || data.transcript;

    if (!transcript || transcript === '(sin transcripción)') {
      results.push({ id: doc.id, success: false, error: 'no_transcript' });
      continue;
    }

    try {
      // #region agent log
      console.log('[DEBUG-HYPCD] Before getOpenAI call for doc:', doc.id, 'transcriptLength:', transcript.length);
      // #endregion
      
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente que analiza transcripciones de conversaciones/reuniones.
Extrae información estructurada de la transcripción proporcionada.
Responde SOLO con JSON válido, sin markdown ni explicaciones.`
          },
          {
            role: 'user',
            content: `Analiza esta transcripción y extrae:
1. summary: Resumen breve (1-2 oraciones)
2. participants: Lista de participantes inferidos
3. topics: Temas principales (máximo 5)
4. actionItems: Tareas mencionadas
5. sentiment: Tono general (positive, neutral, negative)

Transcripción:
"${transcript}"

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
      console.log(`Processed ${doc.id}`);

    } catch (error) {
      // #region agent log
      console.log('[DEBUG-HYPABCDE] Error processing doc:', doc.id, 'Error:', JSON.stringify({errorName:error instanceof Error ? error.name : typeof error,errorMessage:error instanceof Error ? error.message : String(error),errorCause:(error as any)?.cause?.toString().substring(0,300),errorStack:(error as any)?.stack?.substring(0,500)}));
      // #endregion
      
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

// ========== FASE 7: SISTEMA DE CONFIRMACIÓN ==========
// Cloud Functions para generar drafts y ejecutar acciones

import {
  generateEmailDraft,
  generateCalendarEventDraft,
  generateGenericActionDraft,
  regenerateDraftWithFeedback,
} from './action-helpers';

/**
 * Genera un borrador de contenido para una acción (email, evento, etc.)
 * basándose en el contexto de la conversación
 */
export const generateActionDraft = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { recordingId, action, previousDraft, feedback } = data;

    if (!recordingId || !action) {
      throw new functions.https.HttpsError('invalid-argument', 'recordingId y action son requeridos');
    }

    try {
      // Obtener la grabación para el contexto
      const recordingDoc = await db.collection('recordings').doc(recordingId).get();
      
      if (!recordingDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Grabación no encontrada');
      }

      const recordingData = recordingDoc.data();
      const transcriptText = recordingData?.transcript?.text || '';

      // Si hay feedback, regenerar el draft anterior
      if (previousDraft && feedback) {
        const openai = getOpenAI();
        const updatedDraft = await regenerateDraftWithFeedback(openai, previousDraft, feedback);
        
        return { draft: updatedDraft };
      }

      // Generar nuevo draft según el tipo de acción
      const openai = getOpenAI();
      let draft = '';

      switch (action.type) {
        case 'email':
          draft = await generateEmailDraft(openai, action, transcriptText);
          break;
        
        case 'meeting':
          draft = await generateCalendarEventDraft(openai, action, transcriptText);
          break;
        
        case 'call':
        case 'document':
        case 'followup':
        case 'other':
          draft = await generateGenericActionDraft(openai, action.type, action, transcriptText);
          break;
        
        default:
          throw new functions.https.HttpsError('invalid-argument', `Tipo de acción no soportado: ${action.type}`);
      }

      return { draft };

    } catch (error) {
      console.error('Error generando draft:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', `Error al generar borrador: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

/**
 * Ejecuta una acción después de la aprobación del usuario
 * (Por ahora solo registra la acción, las integraciones reales vienen en Fase 9-10)
 */
export const executeAction = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB' })
  .https.onCall(async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { recordingId, action, draft } = data;

    if (!recordingId || !action || !draft) {
      throw new functions.https.HttpsError('invalid-argument', 'recordingId, action y draft son requeridos');
    }

    try {
      // Por ahora, solo registramos la acción ejecutada
      // En Fases 9-10 se integrarán Gmail API, Google Calendar, etc.
      
      const executionRecord = {
        recordingId,
        action,
        draft,
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
        executedBy: context.auth.uid,
        status: 'executed',
        // Placeholder para futuras integraciones
        integrationStatus: {
          email: null, // Se llenará cuando se integre Gmail API
          calendar: null, // Se llenará cuando se integre Google Calendar
        }
      };

      // Guardar en colección de acciones ejecutadas
      await db.collection('executedActions').add(executionRecord);

      // Actualizar el status del action item en la grabación
      const recordingRef = db.collection('recordings').doc(recordingId);
      const recordingDoc = await recordingRef.get();
      
      if (recordingDoc.exists) {
        const data = recordingDoc.data();
        const actionItems = data?.analysis?.actionItems || [];
        
        // Encontrar y actualizar el action item correspondiente
        const updatedActionItems = actionItems.map((item: any) => {
          if (item.description === action.description) {
            return {
              ...item,
              status: 'executed',
              executedAt: admin.firestore.FieldValue.serverTimestamp(),
              draft: draft,
            };
          }
          return item;
        });

        await recordingRef.update({
          'analysis.actionItems': updatedActionItems
        });
      }

      console.log(`Acción ejecutada: ${action.type} para recording ${recordingId}`);

      return { 
        success: true,
        message: 'Acción registrada exitosamente. Las integraciones con servicios externos se implementarán en fases posteriores.',
        executionId: executionRecord
      };

    } catch (error) {
      console.error('Error ejecutando acción:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError('internal', `Error al ejecutar acción: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

