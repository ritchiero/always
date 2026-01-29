import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData, addDoc, serverTimestamp, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, ref as storageRef } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Verificar que las variables de entorno existan
console.log('[Firebase] Config check:', {
  apiKey: firebaseConfig.apiKey ? '✓' : '✗ MISSING',
  authDomain: firebaseConfig.authDomain ? '✓' : '✗ MISSING',
  projectId: firebaseConfig.projectId ? '✓' : '✗ MISSING',
  storageBucket: firebaseConfig.storageBucket ? '✓' : '✗ MISSING',
});

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1'); // Especificar región de las Cloud Functions
export const googleProvider = new GoogleAuthProvider();

// Production mode - no emulators
console.log('[Firebase] Initialized - Production mode');

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
  // SECURITY: Filter by current user
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn('No authenticated user for onRecordingsChange');
    callback([]);
    return () => {}; // Return empty unsubscribe function
  }

  const recordingsRef = collection(db, 'recordings');
  const q = query(
    recordingsRef,
    orderBy('createdAt', 'desc')
    // Note: Can't add where clause with orderBy on different field
    // Will filter client-side for now
  );
  
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const recordings = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      // SECURITY: Client-side filter by userId
      .filter((rec: any) => rec.userId === currentUser.uid);
    
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
    // SECURITY: Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User must be authenticated to save recordings');
    }

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
      userId: currentUser.uid, // SECURITY: Always include userId
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

/**
 * Soft delete: Marca una grabación como eliminada
 * @param recordingId ID de la grabación
 * @param deleteActionItems Si true, marca los action items como eliminados también
 */
export async function deleteRecording(
  recordingId: string,
  deleteActionItems: boolean = false
): Promise<void> {
  try {
    const docRef = doc(db, 'recordings', recordingId);
    
    if (deleteActionItems) {
      // Leer el documento para obtener action items
      const docSnap = await getDoc(docRef);
      const data = docSnap.data();
      
      if (data?.analysis?.actionItems) {
        // Marcar cada action item como deleted
        // Nota: serverTimestamp() no funciona dentro de arrays, usar Date.toISOString()
        const updatedActionItems = data.analysis.actionItems.map((item: any) => ({
          ...item,
          status: 'discarded',
          discardedReason: 'Grabación eliminada',
          completedAt: new Date().toISOString()
        }));
        
        await updateDoc(docRef, {
          deletedAt: serverTimestamp(),
          'analysis.actionItems': updatedActionItems
        });
      } else {
        // No hay action items, solo marcar grabación
        await updateDoc(docRef, {
          deletedAt: serverTimestamp()
        });
      }
    } else {
      // Solo marcar grabación como eliminada
      await updateDoc(docRef, {
        deletedAt: serverTimestamp()
      });
    }
    
    console.log(`Recording ${recordingId} moved to trash`);
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw error;
  }
}

/**
 * Recupera una grabación desde la papelera
 */
export async function recoverRecording(recordingId: string): Promise<void> {
  try {
    const docRef = doc(db, 'recordings', recordingId);
    await updateDoc(docRef, {
      deletedAt: null
    });
    console.log(`Recording ${recordingId} recovered from trash`);
  } catch (error) {
    console.error('Error recovering recording:', error);
    throw error;
  }
}

/**
 * Hard delete: Elimina permanentemente una grabación y su audio
 */
export async function hardDeleteRecording(recordingId: string): Promise<void> {
  try {
    const docRef = doc(db, 'recordings', recordingId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    
    // 1. Eliminar audio de Storage si existe
    if (data?.audioUrl) {
      try {
        const audioRef = storageRef(storage, data.audioUrl);
        await deleteObject(audioRef);
        console.log('Audio deleted from Storage');
      } catch (storageError) {
        console.error('Error deleting audio:', storageError);
        // Continuar aunque falle (el audio podría no existir)
      }
    }
    
    // 2. Eliminar documento de Firestore
    await deleteDoc(docRef);
    console.log(`Recording ${recordingId} permanently deleted`);
  } catch (error) {
    console.error('Error hard deleting recording:', error);
    throw error;
  }
}

/**
 * Actualiza el estado de un action item
 */
export async function updateActionItemStatus(
  recordingId: string,
  actionIndex: number,
  status: 'pending' | 'completed' | 'discarded',
  reason?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'recordings', recordingId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    
    if (!data?.analysis?.actionItems) {
      throw new Error('No action items found');
    }
    
    const actionItems = [...data.analysis.actionItems];
    // Nota: serverTimestamp() no funciona dentro de arrays, usar Date.toISOString()
    const timestamp = new Date().toISOString();
    actionItems[actionIndex] = {
      ...actionItems[actionIndex],
      status,
      ...(status === 'completed' && { completedAt: timestamp, executedBy: 'user' }),
      ...(status === 'discarded' && { discardedReason: reason || 'Sin razón especificada', completedAt: timestamp }),
      ...(status === 'pending' && { completedAt: null, discardedReason: null })
    };
    
    await updateDoc(docRef, {
      'analysis.actionItems': actionItems
    });
    
    console.log(`Action item ${actionIndex} updated to ${status}`);
  } catch (error) {
    console.error('Error updating action item:', error);
    throw error;
  }
}
