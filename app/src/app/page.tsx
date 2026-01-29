'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { onRecordingsChange, saveRecording, deleteRecording, recoverRecording, hardDeleteRecording, updateActionItemStatus } from '@/lib/firebase';
import { RealtimeTranscription } from '@/lib/realtime-transcription';
import { SemanticSearch } from '@/components/SemanticSearch';
import { db, functions } from '@/lib/firebase';
import { onSnapshot, query, orderBy, collection, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ActionConfirmationModal } from '@/components/ActionConfirmationModal';

// Icon components
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const TimelineIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TasksIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const InsightsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const DevIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

// Constantes de configuración para auto-chunking
const CHUNK_DURATION_MS = 15 * 60 * 1000; // 15 minutos
const SILENCE_THRESHOLD_MS = 30 * 1000; // 30 segundos de silencio para pausar (cambiar a 2*60*1000 para producción)
const VOICE_THRESHOLD = -50; // dB umbral para detectar voz (ajustable)
const VOICE_CHECK_INTERVAL = 500; // Chequear voz cada 500ms

interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function Home() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [activeNav, setActiveNav] = useState('home');
  const [activeTab, setActiveTab] = useState('transcription');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  
  // Real-time transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<TranscriptSegment[]>([]);
  
  // Nuevos estados para auto-chunking y detección de voz
  const [isListening, setIsListening] = useState(false); // Estado "escuchando" (esperando voz)
  const [lastVoiceActivity, setLastVoiceActivity] = useState<number>(0); // Timestamp última actividad
  const [currentChunkNumber, setCurrentChunkNumber] = useState(1); // Número de chunk actual
  const [sessionStartTime, setSessionStartTime] = useState<number>(0); // Inicio de sesión
  const [chunkStartTime, setChunkStartTime] = useState<number>(0); // Inicio de chunk actual

  // Estado para reprocesamiento
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<{total: number, processed: number, failed: number} | null>(null);
  
  // Estados para modal de confirmación de acciones
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [actionFeedback, setActionFeedback] = useState('');
  const [isDraftReady, setIsDraftReady] = useState(false);
  // Estado para modal de confirmación de drafts (Fase 7)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<any>(null);
  
  // Estados para eliminación de grabaciones
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<any>(null);
  const [deleteActions, setDeleteActions] = useState(false);
  
  // Estados para gestión de action items
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [actionToDiscard, setActionToDiscard] = useState<{recording: any, index: number} | null>(null);
  const [discardReason, setDiscardReason] = useState('already_done');
  const [discardNote, setDiscardNote] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'pending' | 'completed' | 'discarded'>('pending');
  
  const transcriptionRef = useRef<RealtimeTranscription | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null); // Mantener stream activo para detección de voz
  
  // Refs adicionales para auto-chunking
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer de 15 min
  const voiceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer de detección de silencio
  const analyserRef = useRef<AnalyserNode | null>(null); // Para análisis de audio
  const voiceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null); // Intervalo de chequeo
  const audioContextRef = useRef<AudioContext | null>(null); // Contexto de audio

  // Refs para rastrear estado actual en el interval (evita stale closures)
  const isRecordingRef = useRef(false);
  const isListeningRef = useRef(false);
  const lastVoiceActivityRef = useRef<number>(0);

  // Refs para funciones (evita recrear el interval cuando cambian)
  const pauseRecordingRef = useRef<() => Promise<void>>();
  const resumeRecordingRef = useRef<() => Promise<void>>();

  // Refs para valores usados en saveCurrentChunk
  const currentChunkNumberRef = useRef(1);
  const sessionStartTimeRef = useRef(0);
  const chunkStartTimeRef = useRef(0);
  const finalTranscriptsRef = useRef<TranscriptSegment[]>([]);

  useEffect(() => {
    // Real-time listener para grabaciones activas (no eliminadas) desde Firestore
    const q = query(
      collection(db, 'recordings'), 
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecordings(recordingsData);
      console.log('Loaded recordings:', recordingsData.length);
    }, (error) => {
      console.error('Error loading recordings:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Contar grabaciones eliminadas para el badge de papelera
    const q = query(
      collection(db, 'recordings'),
      where('deletedAt', '!=', null)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeletedCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  // Mantener refs sincronizados con estados (para evitar stale closures en intervals)
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    lastVoiceActivityRef.current = lastVoiceActivity;
  }, [lastVoiceActivity]);

  useEffect(() => {
    currentChunkNumberRef.current = currentChunkNumber;
  }, [currentChunkNumber]);

  useEffect(() => {
    sessionStartTimeRef.current = sessionStartTime;
  }, [sessionStartTime]);

  useEffect(() => {
    chunkStartTimeRef.current = chunkStartTime;
  }, [chunkStartTime]);

  useEffect(() => {
    finalTranscriptsRef.current = finalTranscripts;
  }, [finalTranscripts]);

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

  // ========== FUNCIONES DE AUTO-CHUNKING Y DETECCIÓN DE VOZ ==========

  /**
   * Configura el sistema de detección de voz usando Web Audio API
   * Crea un AnalyserNode para monitorear el nivel de audio
   */
  const setupVoiceDetection = useCallback((stream: MediaStream) => {
    try {
      console.log('Configurando detección de voz...');
      
      // Crear AudioContext si no existe
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      // Crear analyser node para analizar el audio
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      // Conectar el stream al analyser
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyser);
      
      analyserRef.current = analyser;
      console.log('Detección de voz configurada exitosamente');
    } catch (error) {
      console.error('Error configurando detección de voz:', error);
    }
  }, []);

  // Counter para logs de debug (evitar spam)
  const debugCounterRef = useRef(0);

  /**
   * Verifica si hay actividad de voz detectando el nivel de audio
   * Retorna true si el volumen supera el umbral definido
   */
  const checkVoiceActivity = useCallback((): boolean => {
    if (!analyserRef.current) return false;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calcular volumen promedio
    const sum = dataArray.reduce((acc, val) => acc + val, 0);
    const average = sum / bufferLength;

    // Convertir a dB (aproximado)
    const db = average > 0 ? 20 * Math.log10(average / 255) : -100;

    // Detectar si hay voz
    const hasVoice = db > VOICE_THRESHOLD;

    // Log de debug cada 10 segundos (20 checks * 500ms)
    debugCounterRef.current++;
    if (debugCounterRef.current >= 20) {
      const silenceDuration = Date.now() - lastVoiceActivityRef.current;
      console.log(`[Voice Detection] dB: ${db.toFixed(1)}, hasVoice: ${hasVoice}, silenceSec: ${Math.floor(silenceDuration / 1000)}, isRecording: ${isRecordingRef.current}, isListening: ${isListeningRef.current}`);
      debugCounterRef.current = 0;
    }

    if (hasVoice) {
      const now = Date.now();
      setLastVoiceActivity(now);
      lastVoiceActivityRef.current = now; // Actualizar ref inmediatamente
    }

    return hasVoice;
  }, []);

  /**
   * Loop principal de detección de voz
   * Se ejecuta cada VOICE_CHECK_INTERVAL ms para monitorear actividad
   * Usa refs para acceder a valores actuales (evita stale closures)
   */
  const startVoiceDetectionLoop = useCallback(() => {
    console.log('Iniciando loop de detección de voz...');

    // Limpiar intervalo anterior si existe
    if (voiceDetectionIntervalRef.current) {
      clearInterval(voiceDetectionIntervalRef.current);
    }

    voiceDetectionIntervalRef.current = setInterval(() => {
      const hasVoice = checkVoiceActivity();

      // Usar refs para obtener valores actuales
      const currentIsRecording = isRecordingRef.current;
      const currentIsListening = isListeningRef.current;
      const currentLastVoiceActivity = lastVoiceActivityRef.current;

      // Si estamos en modo "listening" y detectamos voz, reanudar grabación
      if (hasVoice && currentIsListening) {
        console.log('Voz detectada en modo listening, reanudando grabación...');
        resumeRecordingRef.current?.();
      }

      // Si estamos grabando pero no hay voz, verificar tiempo de silencio
      if (!hasVoice && currentIsRecording && !currentIsListening) {
        const silenceDuration = Date.now() - currentLastVoiceActivity;

        if (silenceDuration > SILENCE_THRESHOLD_MS) {
          console.log(`Silencio detectado por ${Math.floor(silenceDuration / 1000)}s, pausando grabación...`);
          pauseRecordingRef.current?.();
        }
      }
    }, VOICE_CHECK_INTERVAL);
  }, [checkVoiceActivity]);

  /**
   * Pausa la grabación cuando se detecta silencio prolongado
   * Guarda el chunk actual y entra en modo "listening"
   */
  const pauseRecording = useCallback(async () => {
    console.log('Pausando grabación...');

    // Cambiar estados inmediatamente para evitar múltiples llamadas
    setIsRecording(false);
    setIsListening(true);
    isRecordingRef.current = false;
    isListeningRef.current = true;

    // Parar transcripción pero mantener analyser activo
    if (transcriptionRef.current) {
      await transcriptionRef.current.stop();
      transcriptionRef.current = null;
    }

    // Parar MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Guardar chunk actual (después de parar para capturar todo el audio)
    await saveCurrentChunk();

    console.log('Grabación pausada, entrando en modo listening...');
  }, []);

  // Mantener ref actualizado
  useEffect(() => {
    pauseRecordingRef.current = pauseRecording;
  }, [pauseRecording]);

  /**
   * Reanuda la grabación cuando se detecta voz después de una pausa
   * Incrementa el número de chunk y reinicia timers
   */
  const resumeRecording = useCallback(async () => {
    console.log('Reanudando grabación...');

    try {
      // Cambiar estados inmediatamente
      setIsListening(false);
      setIsRecording(true);
      isListeningRef.current = false;
      isRecordingRef.current = true;

      const now = Date.now();
      setCurrentChunkNumber(prev => prev + 1);
      setChunkStartTime(now);
      setLastVoiceActivity(now);
      lastVoiceActivityRef.current = now;

      // Reiniciar transcripción
      transcriptionRef.current = new RealtimeTranscription(handleTranscript, handleError);
      await transcriptionRef.current.start();

      // Usar stream existente si está activo, sino crear uno nuevo
      let stream = streamRef.current;
      if (!stream || stream.getTracks().every(track => track.readyState === 'ended')) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        // Reconectar detección de voz al nuevo stream
        setupVoiceDetection(stream);
      }

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start(1000);

      // Reiniciar timer de chunk (15 min)
      if (chunkTimerRef.current) {
        clearTimeout(chunkTimerRef.current);
      }
      chunkTimerRef.current = setTimeout(onChunkTimerExpired, CHUNK_DURATION_MS);

      console.log('Grabación reanudada');
    } catch (error) {
      console.error('Error reanudando grabación:', error);
      setError('Error al reanudar grabación');
    }
  }, [handleTranscript, handleError, setupVoiceDetection]);

  // Mantener ref actualizado
  useEffect(() => {
    resumeRecordingRef.current = resumeRecording;
  }, [resumeRecording]);

  /**
   * Guarda el chunk actual en Firebase
   * Se llama automáticamente cada 15 min o al detectar silencio
   * Usa refs para obtener valores actuales
   */
  const saveCurrentChunk = useCallback(async () => {
    try {
      // Usar refs para obtener valores actuales
      const chunkNum = currentChunkNumberRef.current;
      const sessionId = sessionStartTimeRef.current;
      const chunkStart = chunkStartTimeRef.current;
      const transcripts = finalTranscriptsRef.current;

      console.log(`Guardando chunk ${chunkNum}...`);

      // Crear audioBlob del chunk actual
      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : undefined;

      // Obtener transcripción acumulada
      const fullTranscript = transcripts.map(s => s.text).join(' ');

      // Solo guardar si hay contenido
      if (fullTranscript || audioBlob) {
        const chunkDuration = Math.floor((Date.now() - chunkStart) / 1000);

        await saveRecording(
          fullTranscript || '(sin transcripción)',
          audioBlob,
          chunkDuration,
          {
            chunkNumber: chunkNum,
            sessionId: sessionId,
            chunkStartTime: chunkStart,
            chunkEndTime: Date.now(),
            isAutoSaved: true,
          }
        );

        console.log(`Chunk ${chunkNum} guardado exitosamente`);

        // Limpiar datos del chunk
        audioChunksRef.current = [];
        setFinalTranscripts([]);
        finalTranscriptsRef.current = [];
        setCurrentTranscript('');
      } else {
        console.log('Chunk vacío, no se guarda');
      }
    } catch (error) {
      console.error('Error guardando chunk:', error);
      setError('Error al guardar chunk');
    }
  }, []);

  /**
   * Se ejecuta cuando expira el timer de 15 minutos
   * Guarda el chunk actual y continúa grabando en un nuevo chunk
   * Usa refs para obtener valores actuales
   */
  const onChunkTimerExpired = useCallback(async () => {
    console.log('Timer de chunk expirado (15 min), guardando chunk...');

    await saveCurrentChunk();

    // Si aún estamos grabando, continuar en nuevo chunk (usar refs)
    if (isRecordingRef.current && !isListeningRef.current) {
      const newChunkNumber = currentChunkNumberRef.current + 1;
      const now = Date.now();

      setCurrentChunkNumber(newChunkNumber);
      setChunkStartTime(now);
      currentChunkNumberRef.current = newChunkNumber;
      chunkStartTimeRef.current = now;

      // Reiniciar timer para próximo chunk
      if (chunkTimerRef.current) {
        clearTimeout(chunkTimerRef.current);
      }
      chunkTimerRef.current = setTimeout(onChunkTimerExpired, CHUNK_DURATION_MS);

      console.log('Continuando grabación en nuevo chunk', newChunkNumber);
    }
  }, [saveCurrentChunk]);

  // ========== FIN DE FUNCIONES DE AUTO-CHUNKING ==========

  /**
   * Reprocesa grabaciones existentes que no tienen análisis
   * Llama a la Cloud Function reprocessUnanalyzedRecordings
   */
  const reprocessRecordings = async () => {
    try {
      setIsReprocessing(true);
      setReprocessResult(null);
      setError(null); // Limpiar error previo
      console.log('Iniciando reprocesamiento de grabaciones...');

      const reprocessFn = httpsCallable(functions, 'reprocessUnanalyzedRecordings');
      const result = await reprocessFn();

      const data = result.data as { total: number; processed: number; failed: number };
      setReprocessResult(data);
      console.log('Reprocesamiento completado:', data);
      
      // Mostrar mensaje de éxito
      if (data.total === 0) {
        setError('No hay grabaciones pendientes de procesar');
      } else if (data.processed > 0) {
        // No es realmente un error, pero usamos el campo para mostrar info
        setTimeout(() => setError(null), 5000); // Limpiar después de 5 segundos
      }
    } catch (err: any) {
      console.error('Error reprocesando grabaciones:', err);
      
      // Mejorar mensaje de error
      let errorMessage = 'Error al reprocesar grabaciones';
      if (err.code === 'functions/unauthenticated') {
        errorMessage = 'Error de autenticación. Verifica tu configuración de Firebase.';
      } else if (err.code === 'functions/not-found') {
        errorMessage = 'Función no encontrada. Verifica que las Cloud Functions estén desplegadas.';
      } else if (err.code === 'functions/internal') {
        errorMessage = 'Error interno en la función. Revisa los logs de Firebase.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsReprocessing(false);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      setFinalTranscripts([]);
      setCurrentTranscript('');
      setRecordingTime(0);
      audioChunksRef.current = [];
      startTimeRef.current = Date.now();

      // Inicializar variables de sesión y chunking
      const now = Date.now();
      setSessionStartTime(now);
      setChunkStartTime(now);
      setCurrentChunkNumber(1);
      setLastVoiceActivity(now);
      setIsListening(false);

      // Inicializar refs también
      sessionStartTimeRef.current = now;
      chunkStartTimeRef.current = now;
      currentChunkNumberRef.current = 1;
      lastVoiceActivityRef.current = now;
      isListeningRef.current = false;
      isRecordingRef.current = true;
      finalTranscriptsRef.current = [];

      console.log('Iniciando nueva sesión de grabación:', { sessionId: now });

      // Obtener stream de audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // Guardar referencia al stream

      // Configurar detección de voz
      setupVoiceDetection(stream);

      // Iniciar loop de detección de voz
      startVoiceDetectionLoop();

      // Iniciar transcripción en tiempo real
      transcriptionRef.current = new RealtimeTranscription(
        handleTranscript,
        handleError
      );
      await transcriptionRef.current.start();

      // Grabar audio
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.start(1000); // Chunk cada segundo

      // Timer de UI
      timerRef.current = setInterval(() => {
        setRecordingTime(d => d + 1);
      }, 1000);

      // Timer de auto-chunk (15 minutos)
      chunkTimerRef.current = setTimeout(onChunkTimerExpired, CHUNK_DURATION_MS);

      setIsRecording(true);
      console.log('Grabación iniciada exitosamente con auto-chunking habilitado');
    } catch (err) {
      console.error('Error iniciando grabación:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    console.log('Deteniendo grabación...');
    setIsRecording(false);
    setIsListening(false);
    setIsProcessing(true);

    // Limpiar TODOS los timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    
    if (voiceDetectionTimerRef.current) {
      clearTimeout(voiceDetectionTimerRef.current);
      voiceDetectionTimerRef.current = null;
    }
    
    if (voiceDetectionIntervalRef.current) {
      clearInterval(voiceDetectionIntervalRef.current);
      voiceDetectionIntervalRef.current = null;
    }

    // Cerrar analyser y AudioContext
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Parar transcripción
    if (transcriptionRef.current) {
      await transcriptionRef.current.stop();
      transcriptionRef.current = null;
    }

    // Parar grabación de audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Cerrar stream de audio
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Esperar a que termine de procesar
    await new Promise(resolve => setTimeout(resolve, 500));

    // Guardar último chunk si hay contenido
    try {
      const fullTranscript = finalTranscripts.map(s => s.text).join(' ');
      
      if (fullTranscript || audioChunksRef.current.length > 0) {
        const audioBlob = audioChunksRef.current.length > 0 
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : undefined;
        
        const chunkDuration = Math.floor((Date.now() - chunkStartTime) / 1000);
        
        await saveRecording(
          fullTranscript || '(sin transcripción)',
          audioBlob,
          chunkDuration,
          {
            chunkNumber: currentChunkNumber,
            sessionId: sessionStartTime,
            chunkStartTime: chunkStartTime,
            chunkEndTime: Date.now(),
            isAutoSaved: false, // Este es guardado manualmente al detener
          }
        );
        
        console.log('Último chunk guardado exitosamente');
      }
    } catch (err) {
      console.error('Error saving final chunk:', err);
      setError('Failed to save recording');
    }
    
    setIsProcessing(false);
    setRecordingTime(0);
    
    // Resetear estados de sesión
    setCurrentChunkNumber(1);
    setSessionStartTime(0);
    setChunkStartTime(0);

    // Resetear refs también
    currentChunkNumberRef.current = 1;
    sessionStartTimeRef.current = 0;
    chunkStartTimeRef.current = 0;
    isRecordingRef.current = false;
    isListeningRef.current = false;
    finalTranscriptsRef.current = [];

    console.log('Grabación detenida completamente');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const formatDateShort = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  /**
   * Agrupa grabaciones por sessionId para mostrar chunks relacionados juntos
   */
  const groupRecordingsBySession = () => {
    const sessionsMap = new Map<number, any[]>();
    const standaloneRecordings: any[] = [];

    recordings.forEach(recording => {
      if (recording.sessionId) {
        // Grabación con sessionId (parte de auto-chunking)
        if (!sessionsMap.has(recording.sessionId)) {
          sessionsMap.set(recording.sessionId, []);
        }
        sessionsMap.get(recording.sessionId)!.push(recording);
      } else {
        // Grabación standalone (sin chunking)
        standaloneRecordings.push(recording);
      }
    });

    // Ordenar chunks dentro de cada sesión
    sessionsMap.forEach(chunks => {
      chunks.sort((a, b) => (a.chunkNumber || 0) - (b.chunkNumber || 0));
    });

    // Convertir a array de sesiones
    const sessions = Array.from(sessionsMap.entries()).map(([sessionId, chunks]) => ({
      sessionId,
      chunks,
      startTime: chunks[0]?.chunkStartTime || sessionId,
      totalChunks: chunks.length,
    }));

    // Ordenar sesiones por fecha (más reciente primero)
    sessions.sort((a, b) => b.sessionId - a.sessionId);

    return { sessions, standaloneRecordings };
  };

  const navItems = [
    { id: 'home', icon: HomeIcon, label: 'Home' },
    { id: 'timeline', icon: TimelineIcon, label: 'Timeline' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'tasks', icon: TasksIcon, label: 'Tasks' },
    { id: 'search', icon: SearchIcon, label: 'Search' },
    { id: 'insights', icon: InsightsIcon, label: 'Insights' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
    { id: 'dev', icon: DevIcon, label: 'Product Dev' },
  ];

  const tabs = [
    { id: 'transcription', label: 'Transcription' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <ProtectedRoute>
    <main className="flex h-screen bg-black text-white font-['Inter',sans-serif]">
      {/* Left Sidebar - Icon Navigation */}
      <div className="w-16 bg-black border-r border-white/10 flex flex-col items-center py-4">
        {/* Recording Indicator */}
        <div className="mb-6">
          <button
            onClick={(isRecording || isListening) ? stopRecording : startRecording}
            disabled={isProcessing}
            className="relative w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
            title={isRecording ? 'Recording' : isListening ? 'Listening...' : 'Ready'}
          >
            {/* Indicador de estado */}
            <div className={`w-3 h-3 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 
              isListening ? 'bg-yellow-500' :
              isProcessing ? 'bg-yellow-500 animate-spin' : 
              'bg-gray-500'
            }`} />
            
            {/* Animación de pulso para Recording */}
            {isRecording && (
              <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
            )}
            
            {/* Ondas de sonido animadas para Listening */}
            {isListening && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-4 h-4 rounded-full border border-yellow-500/50 animate-ping" />
                <div className="absolute w-5 h-5 rounded-full border border-yellow-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  activeNav === item.id
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Secondary Sidebar - Recordings (hidden in dev view) */}
      {activeNav !== 'dev' && (
      <div className="w-64 bg-black border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-medium text-gray-400">Today&apos;s Recordings</h2>
          <p className="text-xs text-gray-600 mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {recordings.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No recordings yet</p>
              <p className="text-xs text-gray-600 mt-1">Start recording to see your conversations here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const { sessions, standaloneRecordings } = groupRecordingsBySession();
                
                return (
                  <>
                    {/* Sesiones con chunks múltiples */}
                    {sessions.map(session => (
                      <div key={session.sessionId} className="border border-white/10 rounded-lg overflow-hidden">
                        <div className="bg-white/5 px-3 py-2 border-b border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">📅</span>
                              <span className="text-xs font-medium text-gray-300">
                                {formatDateShort(session.sessionId)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {session.totalChunks} chunk{session.totalChunks > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-1 p-2">
                          {session.chunks.map((chunk: any) => (
                            <div
                              key={chunk.id}
                              className="relative group p-2 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                              onClick={() => setSelectedRecording(chunk)}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-red-400">🔴</span>
                                  <span className="text-xs font-medium text-gray-300">
                                    Chunk {chunk.chunkNumber}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-600">
                                    {chunk.duration ? `${Math.floor(chunk.duration / 60)}m` : ''}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRecordingToDelete(chunk);
                                      setShowDeleteModal(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500/20 rounded"
                                    title="Eliminar"
                                  >
                                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              {chunk.chunkStartTime && (
                                <p className="text-xs text-gray-500 mb-1">
                                  {formatDateShort(chunk.chunkStartTime)} - {formatDateShort(chunk.chunkEndTime)}
                                </p>
                              )}
                              
                              {chunk.transcript?.text && (
                                <p className="text-xs text-gray-400 line-clamp-1">
                                  {chunk.transcript.text.substring(0, 60)}...
                                </p>
                              )}
                              
                              {chunk.isAutoSaved && (
                                <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                  Auto-saved
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {/* Grabaciones standalone (sin chunking) */}
                    {standaloneRecordings.map((recording, idx) => (
                      <div 
                        key={recording.id} 
                        className="relative group p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => setSelectedRecording(recording)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="text-sm font-medium truncate">
                            {recording.title || `Recording ${idx + 1}`}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {formatDate(recording.createdAt).split(' ')[1]}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRecordingToDelete(recording);
                                setShowDeleteModal(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500/20 rounded"
                              title="Eliminar grabación"
                            >
                              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        {recording.transcript?.text && (
                          <p className="text-xs text-gray-400 line-clamp-2">
                            {recording.transcript.text.substring(0, 80)}...
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            recording.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {recording.status || 'Processing'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Link a Papelera */}
          <Link 
            href="/papelera"
            className="p-3 mt-2 flex items-center gap-2 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <span>📦</span>
            <span className="flex-1 text-sm">Papelera</span>
            {deletedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {deletedCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      )}

      {/* Semantic Search View */}
      {activeNav === 'search' ? (
        <SemanticSearch onSelectRecording={(id) => {
          const recording = recordings.find(r => r.id === id);
          if (recording) {
            setSelectedRecording(recording);
            setActiveNav('home');
          }
        }} />
      ) : activeNav === 'dev' ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="border-b border-white/10 pb-4">
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-purple-500">⚡</span> Always - Product Development
              </h1>
              <p className="text-gray-500 mt-1">Estado del proyecto y arquitectura</p>
            </div>

            {/* Architecture Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tech Stack */}
              <div className="border border-white/10 rounded-lg p-4">
                <h2 className="text-sm font-medium text-purple-400 mb-4 flex items-center gap-2">
                  <span>🏗️</span> ARQUITECTURA
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Frontend</span>
                    <span className="text-xs text-blue-400">Next.js 14 + React</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Backend</span>
                    <span className="text-xs text-orange-400">Firebase Functions (Node.js)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Database</span>
                    <span className="text-xs text-yellow-400">Firestore</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Storage</span>
                    <span className="text-xs text-green-400">Firebase Storage</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Transcription</span>
                    <span className="text-xs text-cyan-400">Deepgram (Real-time)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">AI Analysis</span>
                    <span className="text-xs text-pink-400">GPT-4o-mini</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <span className="text-gray-300">Vector DB</span>
                    <span className="text-xs text-indigo-400">Pinecone</span>
                  </div>
                </div>
              </div>

              {/* Features Status */}
              <div className="border border-white/10 rounded-lg p-4">
                <h2 className="text-sm font-medium text-green-400 mb-4 flex items-center gap-2">
                  <span>✅</span> ESTADO DE FEATURES
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1">Transcripción en tiempo real</span>
                    <span className="text-xs text-green-400">Completo</span>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1">Auto-chunking (15 min)</span>
                    <span className="text-xs text-green-400">Completo</span>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1">Voice Activity Detection</span>
                    <span className="text-xs text-green-400">Completo</span>
                  </div>
                  <Link href="/analisis" className="flex items-center gap-3 p-2 hover:bg-white/5 rounded transition-colors cursor-pointer">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1 hover:text-white">Análisis con GPT-4o-mini</span>
                    <span className="text-xs text-green-400">Operativo →</span>
                  </Link>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1">Reprocessing masivo</span>
                    <span className="text-xs text-green-400">Operativo</span>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                    <span className="text-gray-300 flex-1">Búsqueda semántica (Pinecone)</span>
                    <span className="text-xs text-gray-500">Pendiente</span>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                    <span className="text-gray-300 flex-1">Chat con contexto (Claude)</span>
                    <span className="text-xs text-gray-500">Pendiente</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Functions */}
            <div className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-medium text-orange-400 mb-4 flex items-center gap-2">
                <span>☁️</span> CLOUD FUNCTIONS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">processRecording</span>
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Activa</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: Firestore onCreate</p>
                  <p className="text-xs text-gray-500">Memoria: 1GB | Timeout: 300s</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">reprocessUnanalyzed</span>
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Activa</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: HTTPS Callable</p>
                  <p className="text-xs text-gray-500">Memoria: 1GB | Timeout: 540s</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">getDeepgramKey</span>
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Activa</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: HTTPS Callable</p>
                  <p className="text-xs text-gray-500">Memoria: 256MB</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">generateSummary</span>
                    <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">Inactiva</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: HTTPS Callable</p>
                  <p className="text-xs text-gray-500">Usa Claude Sonnet</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">searchTranscripts</span>
                    <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">Inactiva</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: HTTPS Callable</p>
                  <p className="text-xs text-gray-500">Usa Pinecone</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">chat</span>
                    <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">Inactiva</span>
                  </div>
                  <p className="text-xs text-gray-500">Trigger: HTTPS Callable</p>
                  <p className="text-xs text-gray-500">Usa Claude Sonnet</p>
                </div>
              </div>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-white">{recordings.length}</div>
                <div className="text-xs text-gray-500 mt-1">Total Recordings</div>
              </div>
              <div className="border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">
                  {recordings.filter(r => r.status === 'processed').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Processed</div>
              </div>
              <div className="border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">
                  {recordings.filter(r => r.status && r.status !== 'processed').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Pending</div>
              </div>
              <div className="border border-white/10 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-400">
                  {recordings.filter(r => r.status === 'process_error').length}
                </div>
                <div className="text-xs text-gray-500 mt-1">Errors</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-medium text-blue-400 mb-4 flex items-center gap-2">
                <span>🚀</span> ACCIONES RÁPIDAS
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={reprocessRecordings}
                  disabled={isReprocessing}
                  className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm"
                >
                  {isReprocessing ? '⏳ Procesando...' : '🔄 Reprocess All'}
                </button>
                <Link
                  href="/analisis"
                  className="px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg hover:bg-pink-500/30 transition-colors text-sm"
                >
                  🧠 Análisis GPT-4o
                </Link>
                <a
                  href="https://console.firebase.google.com/project/always-f6dda/functions/logs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                >
                  📊 Firebase Logs
                </a>
                <a
                  href="https://console.firebase.google.com/project/always-f6dda/firestore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors text-sm"
                >
                  🗄️ Firestore
                </a>
                <a
                  href="https://console.cloud.google.com/security/secret-manager?project=always-f6dda"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                >
                  🔐 Secrets
                </a>
              </div>
              {reprocessResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  reprocessResult.failed === 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  Último reprocess: {reprocessResult.processed}/{reprocessResult.total} procesados
                  {reprocessResult.failed > 0 && ` (${reprocessResult.failed} fallidos)`}
                </div>
              )}
            </div>

            {/* Data Flow Diagram */}
            <div className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-medium text-cyan-400 mb-4 flex items-center gap-2">
                <span>🔄</span> FLUJO DE DATOS
              </h2>
              <div className="text-xs font-mono text-gray-400 bg-black/50 p-4 rounded-lg overflow-x-auto">
                <pre>{`
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│   Deepgram   │────▶│  Firestore  │
│  (WebRTC)   │     │  (Real-time) │     │ (recordings)│
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                 │
                                                 ▼ onCreate
                                         ┌──────────────┐
                                         │processRecording│
                                         │  (GPT-4o-mini) │
                                         └──────┬───────┘
                                                │
                    ┌───────────────────────────┴───────────────────────────┐
                    ▼                                                       ▼
            ┌──────────────┐                                       ┌──────────────┐
            │   Firestore  │                                       │   Pinecone   │
            │  (analysis)  │                                       │ (embeddings) │
            └──────────────┘                                       └──────────────┘
`}</pre>
              </div>
            </div>

            {/* Environment Info */}
            <div className="border border-white/10 rounded-lg p-4">
              <h2 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <span>⚙️</span> CONFIGURACIÓN
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-2 bg-white/5 rounded">
                  <div className="text-gray-500">Chunk Duration</div>
                  <div className="text-white font-mono">15 min</div>
                </div>
                <div className="p-2 bg-white/5 rounded">
                  <div className="text-gray-500">Silence Threshold</div>
                  <div className="text-white font-mono">30 sec</div>
                </div>
                <div className="p-2 bg-white/5 rounded">
                  <div className="text-gray-500">Voice Threshold</div>
                  <div className="text-white font-mono">-50 dB</div>
                </div>
                <div className="p-2 bg-white/5 rounded">
                  <div className="text-gray-500">Voice Check</div>
                  <div className="text-white font-mono">500 ms</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Recording Controls */}
        <div className="h-14 border-b border-white/10 flex items-center px-4 gap-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex-1" />
          
          {/* Recording Controls */}
          <div className="flex items-center gap-4">
            {error && (
              <div className="text-xs text-red-400">{error}</div>
            )}
            
            {/* Estado: Stopped/Ready */}
            {!isRecording && !isListening && !isProcessing && (
              <button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-white" />
                Start Recording
              </button>
            )}
            
            {/* Estado: Recording */}
            {isRecording && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-500 font-mono font-medium">{formatTime(recordingTime)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Chunk {currentChunkNumber} • Next save in {Math.floor((CHUNK_DURATION_MS - (Date.now() - chunkStartTime)) / 60000)}min
                  </div>
                </div>
                
                <button
                  onClick={() => saveCurrentChunk()}
                  className="text-xs text-blue-500 hover:text-blue-400 hover:underline px-2 py-1 rounded transition-colors"
                  title="Guardar chunk actual manualmente"
                >
                  💾 Force Save
                </button>
                
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-sm bg-white" />
                  Stop
                </button>
              </div>
            )}
            
            {/* Estado: Listening */}
            {isListening && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="text-yellow-500 font-medium">Listening...</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Waiting for voice activity
                  </div>
                </div>
                
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-sm bg-white" />
                  Stop
                </button>
              </div>
            )}
            
            {/* Estado: Processing */}
            {isProcessing && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-yellow-500">Processing...</span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'transcription' && (
            <div className="max-w-3xl space-y-4">
              {/* Live Transcription */}
              {isRecording && (
                <div className="border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">LIVE TRANSCRIPTION</h3>
                  <div className="space-y-2">
                    {finalTranscripts.map((segment, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="text-xs text-gray-600 mt-1 w-12">
                          {Math.floor(segment.timestamp / 60000).toString().padStart(2, '0')}:
                          {Math.floor((segment.timestamp % 60000) / 1000).toString().padStart(2, '0')}
                        </span>
                        <p className="text-white/90">{segment.text}</p>
                      </div>
                    ))}
                    
                    {currentTranscript && (
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-gray-600 mt-1 w-12">--:--</span>
                        <p className="text-white/50 italic">{currentTranscript}</p>
                      </div>
                    )}
                    
                    {!currentTranscript && finalTranscripts.length === 0 && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm">Listening...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Selected Recording Transcript */}
              {selectedRecording?.transcript && (
                <div className="border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">RECORDING TRANSCRIPT</h3>
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-600 mt-1 w-12">
                      {formatDate(selectedRecording.createdAt).split(' ')[1]}
                    </span>
                    <div className="flex-1">
                      <p className="text-gray-300">{selectedRecording.transcript.text}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Empty State */}
              {!isRecording && !selectedRecording && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Select a recording to view transcript, or start recording to begin</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'summary' && (
            <div className="max-w-2xl">
              {selectedRecording ? (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium mb-4">Recording Summary</h3>
                  
                  {/* Summary */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-300">
                      {selectedRecording.analysis?.summary || selectedRecording.summary || 'Summary will be generated automatically after transcription is complete.'}
                    </p>
                  </div>
                  
                  {/* Análisis Detallado */}
                  {selectedRecording.analysis && (
                    <div className="space-y-4">
                      {/* Participants */}
                      {selectedRecording.analysis.participants && selectedRecording.analysis.participants.length > 0 && (
                        <div className="bg-white/5 rounded-lg p-4">
                          <h4 className="font-medium text-gray-400 mb-2 text-sm">Participants</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedRecording.analysis.participants.map((participant: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
                                {participant}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Topics */}
                      {selectedRecording.analysis.topics && selectedRecording.analysis.topics.length > 0 && (
                        <div className="bg-white/5 rounded-lg p-4">
                          <h4 className="font-medium text-gray-400 mb-2 text-sm">Topics</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedRecording.analysis.topics.map((topic: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 rounded bg-blue-500/20 text-blue-400 text-sm">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Action Items */}
                      {selectedRecording.analysis.actionItems && selectedRecording.analysis.actionItems.length > 0 && (
                        <div className="bg-white/5 rounded-lg p-4">
                          {/* Filtros */}
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-400 text-sm">Action Items</h4>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setActionFilter('pending')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  actionFilter === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                Pendientes
                              </button>
                              <button
                                onClick={() => setActionFilter('completed')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  actionFilter === 'completed' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                Completadas
                              </button>
                              <button
                                onClick={() => setActionFilter('all')}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  actionFilter === 'all' ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                Todas
                              </button>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {selectedRecording.analysis.actionItems
                              .map((item: any, idx: number) => ({ item, idx }))
                              .filter(({ item }: any) => {
                                if (actionFilter === 'all') return true;
                                if (actionFilter === 'pending') return !item.status || item.status === 'pending';
                                if (actionFilter === 'completed') return item.status === 'completed';
                                if (actionFilter === 'discarded') return item.status === 'discarded';
                                return true;
                              })
                              .map(({ item, idx }: any) => {
                              // Soporte para formato legacy (string) y nuevo (objeto)
                              const isStructured = typeof item === 'object' && item.type;
                              
                              if (!isStructured) {
                                // Formato legacy
                                return (
                                  <div key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                    <span className="text-green-400">✓</span>
                                    <span>{item}</span>
                                  </div>
                                );
                              }
                              
                              // Formato estructurado
                              const typeIcons: Record<string, string> = {
                                email: '✉️',
                                meeting: '📅',
                                call: '📞',
                                document: '📄',
                                followup: '🔄',
                                other: '📌'
                              };
                              
                              const priorityColors: Record<string, string> = {
                                high: 'bg-red-500/20 text-red-400 border-red-500/30',
                                medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              };
                              
                              return (
                                <div key={idx} className="bg-black/30 border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <span className="text-2xl">{typeIcons[item.type] || '📌'}</span>
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-white font-medium text-sm">{item.description}</p>
                                        {item.priority && (
                                          <span className={`text-xs px-2 py-0.5 rounded border ${priorityColors[item.priority]}`}>
                                            {item.priority === 'high' ? 'Urgente' : item.priority === 'medium' ? 'Normal' : 'Baja'}
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-2 text-xs text-gray-400 mt-2">
                                        {item.assignee && (
                                          <span className="flex items-center gap-1">
                                            <span className="text-purple-400">→</span>
                                            {item.assignee}
                                          </span>
                                        )}
                                        {item.deadline && (
                                          <span className="flex items-center gap-1">
                                            <span>📅</span>
                                            {item.deadline}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {item.context && (
                                        <p className="text-gray-500 text-xs mt-2">{item.context}</p>
                                      )}
                                      
                                      {/* Quick Action Buttons */}
                                      <div className="flex gap-2 mt-3">
                                        {item.type === 'email' && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedAction(item);
                                              setShowConfirmationModal(true);
                                            }}
                                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors font-medium flex items-center gap-1 border border-green-500/30"
                                          >
                                            🤖 Redactar Email
                                          </button>
                                        )}
                                        
                                        {item.type === 'meeting' && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedAction(item);
                                              setShowConfirmationModal(true);
                                            }}
                                            className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded text-xs hover:bg-purple-500/30 transition-colors font-medium flex items-center gap-1"
                                          >
                                            📅 Redactar Evento
                                          </button>
                                        )}
                                        
                                        {item.type === 'call' && item.assignee && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              alert(`Recordatorio: Llamar a ${item.assignee}\n\nTema: ${item.description}\n${item.context ? 'Contexto: ' + item.context : ''}`);
                                            }}
                                            className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors font-medium flex items-center gap-1"
                                          >
                                            📞 Recordar Llamada
                                          </button>
                                        )}
                                        
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(`${item.description}\n${item.assignee ? 'Para: ' + item.assignee : ''}\n${item.deadline ? 'Fecha: ' + item.deadline : ''}\n${item.context || ''}`);
                                            alert('✓ Acción copiada al portapapeles');
                                          }}
                                          className="px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30 transition-colors font-medium flex items-center gap-1"
                                        >
                                          📋 Copiar
                                        </button>
                                      </div>
                                      
                                      {/* Estado y Botones de Gestión */}
                                      <div className="mt-3 pt-3 border-t border-white/10">
                                        {(!item.status || item.status === 'pending') && (
                                          <div className="flex gap-2">
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await updateActionItemStatus(selectedRecording.id, idx, 'completed');
                                                } catch (error) {
                                                  console.error('Error marking as completed:', error);
                                                  alert('Error al marcar como completada');
                                                }
                                              }}
                                              className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors font-medium"
                                            >
                                              ✓ Marcar Completada
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActionToDiscard({recording: selectedRecording, index: idx});
                                                setShowDiscardModal(true);
                                              }}
                                              className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors font-medium"
                                            >
                                              ✕ Descartar
                                            </button>
                                          </div>
                                        )}
                                        
                                        {item.status === 'completed' && (
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs text-green-400">
                                              <span>✅</span>
                                              <span>Completada {item.completedAt ? 'el ' + new Date(item.completedAt.seconds * 1000).toLocaleDateString('es-ES') : ''}</span>
                                            </div>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await updateActionItemStatus(selectedRecording.id, idx, 'pending');
                                                } catch (error) {
                                                  console.error('Error reopening:', error);
                                                }
                                              }}
                                              className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30 transition-colors"
                                            >
                                              ♻️ Reabrir
                                            </button>
                                          </div>
                                        )}
                                        
                                        {item.status === 'discarded' && (
                                          <div className="flex items-center justify-between">
                                            <div className="text-xs text-gray-500">
                                              <span className="text-red-400">❌ Descartada:</span>
                                              <span className="ml-1">{item.discardedReason || 'Sin razón'}</span>
                                            </div>
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                  await updateActionItemStatus(selectedRecording.id, idx, 'pending');
                                                } catch (error) {
                                                  console.error('Error reactivating:', error);
                                                }
                                              }}
                                              className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs hover:bg-gray-500/30 transition-colors"
                                            >
                                              ♻️ Reactivar
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Sentiment */}
                      {selectedRecording.analysis.sentiment && (
                        <div className="bg-white/5 rounded-lg p-4">
                          <h4 className="font-medium text-gray-400 mb-2 text-sm">Sentiment</h4>
                          <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                            selectedRecording.analysis.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                            selectedRecording.analysis.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {selectedRecording.analysis.sentiment.charAt(0).toUpperCase() + selectedRecording.analysis.sentiment.slice(1)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Audio Playback */}
                  {selectedRecording.audioUrl && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <h4 className="font-medium text-gray-400 mb-3 text-sm">Audio Playback</h4>
                      <audio controls className="w-full">
                        <source src={selectedRecording.audioUrl} type="audio/webm" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Select a recording to view summary</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-80 bg-black border-l border-white/10 flex flex-col">
        {/* Summary Section */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">SUMMARY</h3>
          {selectedRecording ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                {selectedRecording.analysis?.summary || selectedRecording.summary || 'Analysis will appear here after transcription completes.'}
              </p>
              
              {/* Mostrar detalles adicionales si existen */}
              {selectedRecording.analysis && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {selectedRecording.analysis.topics && selectedRecording.analysis.topics.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Topics:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedRecording.analysis.topics.slice(0, 3).map((topic: string, idx: number) => (
                          <span key={idx} className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedRecording.analysis.sentiment && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Sentiment:</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        selectedRecording.analysis.sentiment === 'positive' ? 'bg-green-500/10 text-green-400' :
                        selectedRecording.analysis.sentiment === 'negative' ? 'bg-red-500/10 text-red-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {selectedRecording.analysis.sentiment}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a recording to view summary</p>
          )}
        </div>

        {/* Recording Stats */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">STATS</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Recordings</span>
              <span className="text-gray-300">{recordings.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span className={`${
                isRecording ? 'text-red-500' : 
                isListening ? 'text-yellow-500' :
                isProcessing ? 'text-yellow-500' : 
                'text-green-500'
              }`}>
                {isRecording ? 'Recording' : isListening ? 'Listening' : isProcessing ? 'Processing' : 'Ready'}
              </span>
            </div>
            
            {/* Información de chunking activo */}
            {(isRecording || isListening) && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current Chunk</span>
                  <span className="text-gray-300">#{currentChunkNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Session Started</span>
                  <span className="text-gray-300 text-xs">
                    {formatDateShort(sessionStartTime)}
                  </span>
                </div>
                {isRecording && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Next Auto-Save</span>
                    <span className="text-gray-300">
                      {Math.max(0, Math.floor((CHUNK_DURATION_MS - (Date.now() - chunkStartTime)) / 60000))}m
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">QUICK ACTIONS</h3>
          <div className="space-y-2">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                isRecording ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-white/5 hover:bg-white/10 text-gray-300'
              } disabled:opacity-50`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  isRecording ? 'bg-red-500' : isProcessing ? 'bg-yellow-500' : 'bg-gray-500'
                }`} />
                <span className="text-sm">
                  {isRecording ? 'Stop Recording' : isProcessing ? 'Processing...' : 'Start Recording'}
                </span>
              </div>
            </button>
            
            {recordings.length > 0 && (
              <>
                <button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-300">
                  <span className="text-sm">Search Recordings</span>
                </button>

                <button
                  onClick={reprocessRecordings}
                  disabled={isReprocessing}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isReprocessing
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {isReprocessing ? '⏳ Processing...' : '🔄 Reprocess Recordings'}
                    </span>
                  </div>
                  {reprocessResult && (
                    <div className={`text-xs mt-1 ${
                      reprocessResult.failed === 0 && reprocessResult.processed > 0
                        ? 'text-green-400'
                        : reprocessResult.failed > 0
                        ? 'text-red-400'
                        : 'text-gray-500'
                    }`}>
                      {reprocessResult.total === 0 ? (
                        '✓ No pending recordings'
                      ) : (
                        <>
                          {reprocessResult.failed === 0 && reprocessResult.processed > 0 ? '✓ ' : ''}
                          Last: {reprocessResult.processed}/{reprocessResult.total} processed
                          {reprocessResult.failed > 0 && ` (${reprocessResult.failed} failed)`}
                        </>
                      )}
                    </div>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Discard Action Modal */}
      {showDiscardModal && actionToDiscard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowDiscardModal(false)}>
          <div className="bg-gray-900 border border-white/20 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">¿Por qué descartas esta acción?</h3>
            
            <div className="bg-white/5 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300 font-medium mb-1">
                {actionToDiscard.recording.analysis.actionItems[actionToDiscard.index].description}
              </p>
              <p className="text-xs text-gray-500">
                {actionToDiscard.recording.analysis.actionItems[actionToDiscard.index].assignee && `Para: ${actionToDiscard.recording.analysis.actionItems[actionToDiscard.index].assignee}`}
              </p>
            </div>
            
            <div className="space-y-2 mb-4">
              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  name="discard-reason"
                  value="already_done"
                  checked={discardReason === 'already_done'}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-300">Ya la hice manualmente</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  name="discard-reason"
                  value="not_applicable"
                  checked={discardReason === 'not_applicable'}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-300">No aplica</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  name="discard-reason"
                  value="detection_error"
                  checked={discardReason === 'detection_error'}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-300">Error de detección</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded hover:bg-white/5 cursor-pointer">
                <input
                  type="radio"
                  name="discard-reason"
                  value="other"
                  checked={discardReason === 'other'}
                  onChange={(e) => setDiscardReason(e.target.value)}
                  className="accent-blue-500"
                />
                <span className="text-sm text-gray-300">Otra razón</span>
              </label>
            </div>
            
            <textarea
              value={discardNote}
              onChange={(e) => setDiscardNote(e.target.value)}
              placeholder="Nota opcional (ej: la hice por teléfono)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 mb-4"
              rows={3}
            />
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const reasonText = discardReason === 'already_done' ? 'Ya la hice manualmente' :
                                      discardReason === 'not_applicable' ? 'No aplica' :
                                      discardReason === 'detection_error' ? 'Error de detección' :
                                      'Otra razón';
                    const fullReason = discardNote ? `${reasonText}: ${discardNote}` : reasonText;
                    
                    await updateActionItemStatus(
                      actionToDiscard.recording.id,
                      actionToDiscard.index,
                      'discarded',
                      fullReason
                    );
                    
                    setShowDiscardModal(false);
                    setActionToDiscard(null);
                    setDiscardNote('');
                    setDiscardReason('already_done');
                  } catch (error) {
                    console.error('Error al descartar:', error);
                    alert('Error al descartar la acción');
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
              >
                Confirmar
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false);
                  setActionToDiscard(null);
                  setDiscardNote('');
                }}
                className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && recordingToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-gray-900 border border-white/20 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">¿Eliminar esta grabación?</h3>
            
            <div className="bg-white/5 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300 mb-1">
                {recordingToDelete.transcript?.text?.substring(0, 100) || recordingToDelete.id}...
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(recordingToDelete.createdAt)}
              </p>
            </div>
            
            {recordingToDelete.analysis?.actionItems && recordingToDelete.analysis.actionItems.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                <p className="text-yellow-300 font-medium text-sm mb-2">
                  ⚠️ Esta grabación tiene {recordingToDelete.analysis.actionItems.length} acción(es) pendiente(s)
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={deleteActions}
                    onChange={(e) => setDeleteActions(e.target.checked)}
                    className="accent-red-500"
                  />
                  <span>Borrar también las acciones pendientes</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {deleteActions ? 'Las acciones se eliminarán junto con la grabación' : 'Las acciones se mantendrán activas'}
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    await deleteRecording(recordingToDelete.id, deleteActions);
                    console.log('Grabación eliminada exitosamente');
                  } catch (error) {
                    console.error('Error al eliminar:', error);
                    alert('Error al eliminar la grabación');
                  }
                  setShowDeleteModal(false);
                  setRecordingToDelete(null);
                  setDeleteActions(false);
                }}
                className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
              >
                🗑️ Eliminar
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setRecordingToDelete(null);
                  setDeleteActions(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 rounded-lg hover:bg-gray-500/30 transition-colors font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all z-50 ${
          isChatOpen ? 'bg-white/10' : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        {isChatOpen ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Chat Panel */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-black border border-white/10 rounded-2xl shadow-2xl flex flex-col z-40">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-medium">AI Assistant</h3>
            <p className="text-xs text-gray-500">Ask questions about your recordings</p>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-blue-500">AI</span>
                </div>
                <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                  <p className="text-sm text-gray-300">Hello! I can help you understand your recordings, find specific information, or summarize conversations. What would you like to know?</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500/50"
              />
              <button className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center hover:bg-blue-600 transition-colors">
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Acciones (Fase 7) */}
      {showConfirmationModal && selectedAction && selectedRecording && (
        <ActionConfirmationModal
          action={selectedAction}
          recordingId={selectedRecording.id}
          onClose={() => {
            setShowConfirmationModal(false);
            setSelectedAction(null);
          }}
          onSuccess={() => {
            // Refrescar la grabación para ver el action actualizado
            console.log('Acción ejecutada exitosamente');
          }}
        />
      )}
    </main>
    </ProtectedRoute>
  );
}
