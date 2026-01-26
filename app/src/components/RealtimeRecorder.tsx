'use client';

import { useState, useRef, useCallback } from 'react';
import { RealtimeTranscription } from '@/lib/realtime-transcription';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function RealtimeRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<TranscriptSegment[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const transcriptionRef = useRef<RealtimeTranscription | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const handleTranscript = useCallback((text: string, isFinal: boolean) => {
    if (isFinal) {
      setFinalTranscripts(prev => [...prev, { 
        text, 
        isFinal: true, 
        timestamp: Date.now() - startTimeRef.current 
      }]);
      setCurrentTranscript('');
    } else {
      setCurrentTranscript(text);
    }
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('Transcription error:', error);
    setError(error.message);
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setFinalTranscripts([]);
      setCurrentTranscript('');
      setDuration(0);
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      // Iniciar transcripción en tiempo real
      transcriptionRef.current = new RealtimeTranscription(
        process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY || '',
        handleTranscript,
        handleError
      );
      await transcriptionRef.current.start();

      // También grabar el audio para guardarlo después
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start(1000); // Chunk cada segundo

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    // Parar timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Parar transcripción
    if (transcriptionRef.current) {
      await transcriptionRef.current.stop();
      transcriptionRef.current = null;
    }

    // Parar grabación de audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Esperar a que termine de procesar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Guardar en Firebase
    try {
      const fullTranscript = finalTranscripts.map(s => s.text).join(' ');
      
      if (audioChunksRef.current.length > 0 && fullTranscript) {
        // Subir audio
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioRef = ref(storage, `audio/${Date.now()}.webm`);
        await uploadBytes(audioRef, audioBlob);
        const audioUrl = await getDownloadURL(audioRef);

        // Guardar en Firestore
        await addDoc(collection(db, 'recordings'), {
          transcript: fullTranscript,
          segments: finalTranscripts,
          audioUrl,
          duration,
          createdAt: serverTimestamp(),
          status: 'completed',
        });
      }
    } catch (err) {
      console.error('Error saving recording:', err);
      setError('Failed to save recording');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Recording Controls */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition"
            >
              <span className="w-3 h-3 bg-white rounded-sm"></span>
              Stop Recording
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition"
            >
              <span className="w-3 h-3 bg-white rounded-full"></span>
              Start Recording
            </button>
          )}
          
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-400 font-mono">{formatTime(duration)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/20 border-b border-red-500/30 text-red-400">
          {error}
        </div>
      )}

      {/* Live Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {finalTranscripts.map((segment, i) => (
          <p key={i} className="text-white/90">
            {segment.text}
          </p>
        ))}
        
        {currentTranscript && (
          <p className="text-white/50 italic">
            {currentTranscript}
          </p>
        )}
        
        {isRecording && !currentTranscript && finalTranscripts.length === 0 && (
          <p className="text-white/30">Listening...</p>
        )}
        
        {!isRecording && finalTranscripts.length === 0 && (
          <p className="text-white/30">Start recording to see live transcription</p>
        )}
      </div>
    </div>
  );
}