import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, query, orderBy, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions,connectFunctionsEmulator } from 'firebase/functions';

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

// Conectar a emuladores en desarrollo
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099');
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
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
