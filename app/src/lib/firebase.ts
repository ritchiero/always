import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Solo conectar Functions al emulador (Firestore y Storage usan producción)
if (typeof window !== 'undefined') {
  try {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    console.log('Connected to Functions emulator');
  } catch (e) {
    console.log('Functions emulator connection skipped');
  }
}

// Audio recording functions
export async function uploadAudio(audioBlob: Blob): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audio-${timestamp}.webm`;
    const storageRef = ref(storage, `audio/${fileName}`);
    
    console.log('Uploading audio blob to Firebase Storage...');
    const snapshot = await uploadBytes(storageRef, audioBlob);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log('Audio uploaded successfully:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading audio:', error);
    throw error;
  }
}

export async function getRecordings() {
  try {
    const recordingsRef = collection(db, 'recordings');
    const q = query(recordingsRef, orderBy('createdAt', 'desc'));
    return q;
  } catch (error) {
    console.error('Error getting recordings:', error);
    throw error;
  }
}

export function onRecordingsChange(callback: (recordings: any[]) => void) {
  const recordingsRef = collection(db, 'recordings');
  const q = query(recordingsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const recordings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(recordings);
  });
}

/**
 * Guarda una grabación con transcripción y audio opcional
 * Soporta metadata adicional para auto-chunking
 */
export async function saveRecording(
  transcript: string,
  audioBlob?: Blob,
  duration?: number,
  metadata?: {
    chunkNumber?: number;
    sessionId?: number;
    chunkStartTime?: number;
    chunkEndTime?: number;
    isAutoSaved?: boolean;
  }
): Promise<string> {
  try {
    let audioUrl = null;

    // Subir audio si existe
    if (audioBlob) {
      const audioRef = ref(storage, `audio/${Date.now()}.webm`);
      console.log('Subiendo audio a Firebase Storage...');
      await uploadBytes(audioRef, audioBlob);
      audioUrl = await getDownloadURL(audioRef);
      console.log('Audio subido exitosamente:', audioUrl);
    }

    // Preparar documento con campos base
    const docData: any = {
      transcript: { text: transcript },
      audioUrl,
      duration: duration || 0,
      createdAt: serverTimestamp(),
      status: 'completed',
    };

    // Agregar metadata de chunking si existe
    if (metadata?.chunkNumber !== undefined) {
      docData.chunkNumber = metadata.chunkNumber;
    }
    if (metadata?.sessionId !== undefined) {
      docData.sessionId = metadata.sessionId;
    }
    if (metadata?.chunkStartTime !== undefined) {
      docData.chunkStartTime = metadata.chunkStartTime;
    }
    if (metadata?.chunkEndTime !== undefined) {
      docData.chunkEndTime = metadata.chunkEndTime;
    }
    if (metadata?.isAutoSaved !== undefined) {
      docData.isAutoSaved = metadata.isAutoSaved;
    }

    // Guardar en Firestore
    const docRef = await addDoc(collection(db, 'recordings'), docData);
    console.log('Grabación guardada con ID:', docRef.id, metadata?.chunkNumber ? `(Chunk ${metadata.chunkNumber})` : '');
    
    return docRef.id;
  } catch (error) {
    console.error('Error guardando grabación:', error);
    throw error;
  }
}
