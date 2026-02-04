import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData, addDoc, serverTimestamp, doc, updateDoc, getDoc, deleteDoc, where } from 'firebase/firestore';
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
export const functions = getFunctions(app, 'us-central1');
export const googleProvider = new GoogleAuthProvider();

console.log('[Firebase] Initialized - Production mode');

// ===========================================
// HELPER: Get user-scoped recordings collection
// ===========================================
function getUserRecordingsRef(userId: string) {
    return collection(db, 'users', userId, 'recordings');
}

function getUserRecordingDocRef(userId: string, recordingId: string) {
    return doc(db, 'users', userId, 'recordings', recordingId);
}

// ===========================================
// AUDIO UPLOAD
// ===========================================
export async function uploadAudio(audioBlob: Blob, userId: string): Promise<string> {
    try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `audio-${timestamp}.webm`;
          // Store audio under user's folder
      const audioRef = ref(storage, `audio/${userId}/${fileName}`);

      console.log('Uploading audio blob to Firebase Storage...');
          const snapshot = await uploadBytes(audioRef, audioBlob);
          const downloadURL = await getDownloadURL(snapshot.ref);
          console.log('Audio uploaded successfully:', downloadURL);

      return downloadURL;
    } catch (error) {
          console.error('Error uploading audio:', error);
          throw error;
    }
}

// ===========================================
// GET RECORDINGS (Query)
// ===========================================
export async function getRecordings(userId: string) {
    try {
          if (!userId) {
                  throw new Error('userId is required');
          }
          const recordingsRef = getUserRecordingsRef(userId);
          const q = query(recordingsRef, orderBy('createdAt', 'desc'));
          return q;
    } catch (error) {
          console.error('Error getting recordings:', error);
          throw error;
    }
}

// ===========================================
// REALTIME LISTENER
// ===========================================
export function onRecordingsChange(callback: (recordings: any[]) => void) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
          console.warn('No authenticated user for onRecordingsChange');
          callback([]);
          return () => {};
    }

  const recordingsRef = getUserRecordingsRef(currentUser.uid);
    const q = query(
          recordingsRef,
          where('deletedAt', '==', null),
          orderBy('createdAt', 'desc')
        );

  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const recordings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
        }));
        callback(recordings);
  });
}

// ===========================================
// SAVE RECORDING
// ===========================================
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
          const currentUser = auth.currentUser;
          if (!currentUser) {
                  throw new Error('User must be authenticated to save recordings');
          }

      let audioUrl = null;

      if (audioBlob) {
              // Upload to user-scoped path
            audioUrl = await uploadAudio(audioBlob, currentUser.uid);
      }

      const docData: any = {
              userId: currentUser.uid,
              transcript: { text: transcript },
              audioUrl,
              duration: duration || 0,
              createdAt: serverTimestamp(),
              status: 'completed',
              deletedAt: null,
      };

      // Add chunking metadata if present
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

      // Save to user-scoped collection
      const recordingsRef = getUserRecordingsRef(currentUser.uid);
          const docRef = await addDoc(recordingsRef, docData);

      console.log('Recording saved with ID:', docRef.id, metadata?.chunkNumber ? `(Chunk ${metadata.chunkNumber})` : '');
          return docRef.id;
    } catch (error) {
          console.error('Error saving recording:', error);
          throw error;
    }
}

// ===========================================
// SOFT DELETE (move to trash)
// ===========================================
export async function deleteRecording(
    recordingId: string,
    deleteActionItems: boolean = false
  ): Promise<void> {
    try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
                  throw new Error('User must be authenticated');
          }

      const docRef = getUserRecordingDocRef(currentUser.uid, recordingId);

      if (deleteActionItems) {
              const docSnap = await getDoc(docRef);
              const data = docSnap.data();

            if (data?.analysis?.actionItems) {
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
                      await updateDoc(docRef, { deletedAt: serverTimestamp() });
            }
      } else {
              await updateDoc(docRef, { deletedAt: serverTimestamp() });
      }

      console.log(`Recording ${recordingId} moved to trash`);
    } catch (error) {
          console.error('Error deleting recording:', error);
          throw error;
    }
}

// ===========================================
// RECOVER FROM TRASH
// ===========================================
export async function recoverRecording(recordingId: string): Promise<void> {
    try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
                  throw new Error('User must be authenticated');
          }

      const docRef = getUserRecordingDocRef(currentUser.uid, recordingId);
          await updateDoc(docRef, { deletedAt: null });
          console.log(`Recording ${recordingId} recovered from trash`);
    } catch (error) {
          console.error('Error recovering recording:', error);
          throw error;
    }
}

// ===========================================
// HARD DELETE (permanent)
// ===========================================
export async function hardDeleteRecording(recordingId: string): Promise<void> {
    try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
                  throw new Error('User must be authenticated');
          }

      const docRef = getUserRecordingDocRef(currentUser.uid, recordingId);
          const docSnap = await getDoc(docRef);
          const data = docSnap.data();

      // Delete audio from Storage if exists
      if (data?.audioUrl) {
              try {
                        const audioRef = storageRef(storage, data.audioUrl);
                        await deleteObject(audioRef);
                        console.log('Audio deleted from Storage');
              } catch (storageError) {
                        console.error('Error deleting audio:', storageError);
              }
      }

      // Delete document
      await deleteDoc(docRef);
          console.log(`Recording ${recordingId} permanently deleted`);
    } catch (error) {
          console.error('Error hard deleting recording:', error);
          throw error;
    }
}

// ===========================================
// UPDATE ACTION ITEM STATUS
// ===========================================
export async function updateActionItemStatus(
    recordingId: string,
    actionIndex: number,
    status: 'pending' | 'completed' | 'discarded',
    reason?: string
  ): Promise<void> {
    try {
          const currentUser = auth.currentUser;
          if (!currentUser) {
                  throw new Error('User must be authenticated');
          }

      const docRef = getUserRecordingDocRef(currentUser.uid, recordingId);
          const docSnap = await getDoc(docRef);
          const data = docSnap.data();

      if (!data?.analysis?.actionItems) {
              throw new Error('No action items found');
      }

      const actionItems = [...data.analysis.actionItems];
          const timestamp = new Date().toISOString();

      actionItems[actionIndex] = {
              ...actionItems[actionIndex],
              status,
              ...(status === 'completed' && { completedAt: timestamp, executedBy: 'user' }),
              ...(status === 'discarded' && { discardedReason: reason || 'Sin razón especificada', completedAt: timestamp }),
              ...(status === 'pending' && { completedAt: null, discardedReason: null })
      };

      await updateDoc(docRef, { 'analysis.actionItems': actionItems });
          console.log(`Action item ${actionIndex} updated to ${status}`);
    } catch (error) {
          console.error('Error updating action item:', error);
          throw error;
    }
}

// ===========================================
// GET DELETED RECORDINGS (for trash page)
// ===========================================
export function onDeletedRecordingsChange(callback: (recordings: any[]) => void) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
          console.warn('No authenticated user');
          callback([]);
          return () => {};
    }

  const recordingsRef = getUserRecordingsRef(currentUser.uid);
    const q = query(
          recordingsRef,
          where('deletedAt', '!=', null),
          orderBy('deletedAt', 'desc')
        );

  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        const recordings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
        }));
        callback(recordings);
  });
}
