import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

// Lazy init to avoid Firebase Admin initialization errors
function getDb() { return admin.firestore(); }

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
 * Reprocess ALL recordings for a user (not just unprocessed)
 * Applies the improved participant detection prompt
 */
export const reprocessAllUserRecordings = functions
  .runWith({
    secrets: ['OPENAI_API_KEY'],
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
    const { forceAll = false, limit = 100 } = data;

    console.log(
      `[reprocessAllUserRecordings] Starting for user ${userId}, forceAll=${forceAll}, limit=${limit}`
    );

    try {
      // Get all recordings for this user
      let query = getDb()
        .collection('users')
        .doc(userId)
        .collection('recordings')
        .orderBy('createdAt', 'desc');

      if (!forceAll) {
        // Only reprocess those without analysis or with old model
        query = query.where('status', '!=', 'processed') as any;
      }

      const snapshot = await query.limit(limit).get();

      console.log(`[reprocessAllUserRecordings] Found ${snapshot.size} recordings to process`);

      if (snapshot.empty) {
        return {
          success: true,
          total: 0,
          processed: 0,
          failed: 0,
          skipped: 0,
          message: 'No recordings found',
        };
      }

      const results: {
        id: string;
        success: boolean;
        error?: string;
        skipped?: boolean;
      }[] = [];

      for (const doc of snapshot.docs) {
        const recordingId = doc.id;
        const data = doc.data();

        try {
          // Get transcript text
          const transcript = data.transcript?.text || data.transcript;

          if (!transcript || transcript === '(sin transcripción)') {
            console.log(`[reprocessAllUserRecordings] Skipping ${recordingId} (no transcript)`);
            results.push({ id: recordingId, success: false, error: 'no_transcript', skipped: true });
            continue;
          }

          console.log(
            `[reprocessAllUserRecordings] Processing ${recordingId} (${transcript.length} chars)`
          );

          // Use the IMPROVED prompt with better participant detection
          const completion = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Eres un asistente que analiza transcripciones de conversaciones/reuniones.
Extrae información estructurada de la transcripción proporcionada.
Responde SOLO con JSON válido, sin markdown ni explicaciones.`,
              },
              {
                role: 'user',
                content: `Analiza esta transcripción y extrae:

1. title: Título descriptivo corto (máx 60 caracteres) que capture el tema principal
   - Ejemplos: "Reunión con Carlos - Presupuesto Q1", "Lluvia de ideas - Nueva feature", "Finanzas personales - Enero"
   - Si identificas nombres de personas, INCLÚYELOS en el título
   - Si no tiene contenido útil: "Recording sin contenido"

2. summary: Resumen breve (1-2 oraciones)

3. participants: IMPORTANTE - Lista de NOMBRES de personas mencionadas en la conversación
   - Busca nombres propios mencionados directamente (ej: "Rodrigo", "Juan Pérez", "María")
   - Incluye vocativos (cuando alguien llama a otra persona: "Estimado, Rodrigo...", "Gracias, Carlos")
   - Incluye despedidas con nombres ("Adiós Rodrigo", "Fuerte abrazo, María")
   - Incluye referencias directas ("Juan Pérez dijo...", "como mencionó Rodrigo...")
   - SIEMPRE extrae nombres si hay alguno mencionado, no importa cuántas veces
   - Si NO hay nombres mencionados, deja la lista vacía []
   - NO inventes nombres ni uses roles genéricos

4. topics: Temas principales discutidos (máximo 5)

5. actionItems: Tareas o compromisos mencionados con formato:
   [{"task":"descripción","assignee":"persona (si se menciona)","deadline":"fecha (si se menciona)","status":"pending"}]

6. sentiment: Tono general (positive, neutral, negative)

7. isGarbage: true si la grabación NO tiene contenido útil:
   - Solo ruido de fondo
   - Conversación trivial sin información relevante
   - Fragmentos muy cortos sin contexto
   - Pruebas técnicas
   - Silencio prolongado

8. garbageReason: Si isGarbage es true, explicar brevemente por qué

Transcripción:
"${transcript}"

Responde en JSON válido:
{
  "title": "",
  "summary": "",
  "participants": [],
  "topics": [],
  "actionItems": [],
  "sentiment": "",
  "isGarbage": false,
  "garbageReason": ""
}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          });

          const responseText = completion.choices[0]?.message?.content || '{}';
          console.log(`[reprocessAllUserRecordings] GPT response for ${recordingId}:`, responseText);

          // Parse response
          let analysis;
          try {
            const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanJson);
          } catch (parseError) {
            console.error('[reprocessAllUserRecordings] Error parsing GPT response:', parseError);
            analysis = {
              title: 'Error al procesar',
              summary: 'Error al procesar',
              participants: [],
              topics: [],
              actionItems: [],
              sentiment: 'neutral',
            };
          }

          // Update document with analysis
          await doc.ref.update({
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
              reprocessedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            status: 'processed',
          });

          results.push({ id: recordingId, success: true });
          console.log(`[reprocessAllUserRecordings] ✅ Processed ${recordingId}`);
        } catch (error: any) {
          console.error(`[reprocessAllUserRecordings] ❌ Error processing ${recordingId}:`, error);
          results.push({
            id: recordingId,
            success: false,
            error: error.message || String(error),
          });

          // Mark as error in Firestore
          await doc.ref.update({
            status: 'process_error',
            processError: error.message || String(error),
          });
        }
      }

      const result = {
        success: true,
        total: snapshot.size,
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success && !r.skipped).length,
        skipped: results.filter((r) => r.skipped).length,
        results,
        message: `Processed ${results.filter((r) => r.success).length}/${snapshot.size} recordings`,
      };

      console.log('[reprocessAllUserRecordings] Completed:', result);

      return result;
    } catch (error: any) {
      console.error('[reprocessAllUserRecordings] Fatal error:', error);

      throw new functions.https.HttpsError(
        'internal',
        `Reprocessing failed: ${error.message || 'Unknown error'}`
      );
    }
  });
