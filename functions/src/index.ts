import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { AssemblyAI } from 'assemblyai';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Inicializar clientes
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const assemblyai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    const embedding = await openai.embeddings.create({
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
  
  const embedding = await openai.embeddings.create({
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

// Obtener token temporal para AssemblyAI Real-time
export const getAssemblyAIToken = functions.https.onCall(async (data, context) => {
  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLYAI_API_KEY || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expires_in: 3600 }),
    });
    
    const result = await response.json();
    return { token: result.token };
  } catch (error) {
    console.error('Error getting AssemblyAI token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get AssemblyAI token');
  }
});
