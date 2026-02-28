'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { onRecordingsChange, onDeletedRecordingsChange, saveRecording, deleteRecording, recoverRecording, hardDeleteRecording, updateActionItemStatus } from '@/lib/firebase';
import { RealtimeTranscription } from '@/lib/realtime-transcription';
import { SemanticSearch } from '@/components/SemanticSearch';
import { db, functions, auth } from '@/lib/firebase';
import { onSnapshot, query, orderBy, collection, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ActionConfirmationModal } from '@/components/ActionConfirmationModal';
import { RecordingControl } from '@/components/RecordingControl';
import { CalendarView } from '@/components/CalendarView';
import { AlwaysLogoFull, AlwaysLogo } from '@/components/AlwaysLogo';
import { ActionsWidget } from '@/components/ActionsWidget';

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

const DailySummaryIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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

// Constantes de configuración para sesión continua
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // Autoguardado silencioso cada 5 min (backup, no corta nada)
const CONVERSATION_END_SILENCE_MS = 2 * 60 * 1000; // 2 min de silencio = conversación terminó
const VOICE_THRESHOLD = -50; // dB umbral para detectar voz (ajustable)
const VOICE_CHECK_INTERVAL = 500; // Chequear voz cada 500ms

interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function Home() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);
  const [activeNav, setActiveNav] = useState('home');
  const [activeTab, setActiveTab] = useState('transcription');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  
  // Real-time transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<TranscriptSegment[]>([]);
  
  // Estados para sesión continua y detección de voz
  const [isListening, setIsListening] = useState(false); // Estado "escuchando" (esperando voz tras silencio largo)
  const [lastVoiceActivity, setLastVoiceActivity] = useState<number>(0); // Timestamp última actividad
  const [sessionStartTime, setSessionStartTime] = useState<number>(0); // Inicio de sesión
  const [lastCheckpointTime, setLastCheckpointTime] = useState<number>(0); // Último checkpoint guardado

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
  
  // Refs adicionales para sesión continua
  const checkpointTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer de checkpoint (5 min)
  const voiceDetectionTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer de detección de silencio
  const analyserRef = useRef<AnalyserNode | null>(null); // Para análisis de audio
  const voiceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null); // Intervalo de chequeo
  const audioContextRef = useRef<AudioContext | null>(null); // Contexto de audio
  const lastCheckpointTranscriptLengthRef = useRef<number>(0); // Para saber si hay contenido nuevo desde último checkpoint

  // Refs para rastrear estado actual en el interval (evita stale closures)
  const isRecordingRef = useRef(false);
  const isListeningRef = useRef(false);
  const lastVoiceActivityRef = useRef<number>(0);

  // Refs para funciones (evita recrear el interval cuando cambian)
  const saveConversationRef = useRef<(reason: string) => Promise<void>>();
  const resumeRecordingRef = useRef<() => Promise<void>>();

  // Refs para valores usados en saveCheckpoint/saveConversation
  const sessionStartTimeRef = useRef(0);
  const finalTranscriptsRef = useRef<TranscriptSegment[]>([]);

  useEffect(() => {
    // Wait for user to be authenticated
    if (!user) {
      setRecordings([]);
      return;
    }

    // Real-time listener para grabaciones activas (no eliminadas) desde Firestore
// Use the centralized onRecordingsChange from firebase.ts which queries the user-scoped subcollection
        const unsubscribe = onRecordingsChange((recordingsData) => {
                setRecordings(recordingsData);
                console.log('Loaded recordings:', recordingsData.length);
        });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // Wait for user to be authenticated
    if (!user) {
      setDeletedCount(0);
      return;
    }

    // Contar grabaciones eliminadas para el badge de papelera
// Use the centralized onDeletedRecordingsChange from firebase.ts
        const unsubscribe = onDeletedRecordingsChange((deletedRecordings) => {
                setDeletedCount(deletedRecordings.length);
        });

    return () => unsubscribe();
  }, [user]);

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
    sessionStartTimeRef.current = sessionStartTime;
  }, [sessionStartTime]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isUserMenuOpen && !target.closest('.user-menu-container')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

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

  // ========== FUNCIONES DE SESIÓN CONTINUA Y DETECCIÓN INTELIGENTE ==========

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
   * Guarda un checkpoint silencioso de la transcripción acumulada.
   * NO corta la sesión, NO para Deepgram, NO para el MediaRecorder.
   * Es solo un backup en caso de crash.
   */
  const saveCheckpoint = useCallback(async () => {
    try {
      const transcripts = finalTranscriptsRef.current;
      const fullTranscript = transcripts.map(s => s.text).join(' ');
      
      // Solo guardar si hay contenido nuevo desde el último checkpoint
      if (fullTranscript.length <= lastCheckpointTranscriptLengthRef.current) {
        console.log('[Checkpoint] Sin contenido nuevo, saltando...');
        return;
      }

      const sessionId = sessionStartTimeRef.current;
      if (!sessionId) return;

      console.log(`[Checkpoint] Guardando backup silencioso (${fullTranscript.length} chars)...`);

      // Guardar/actualizar un documento de checkpoint (se sobreescribe cada vez)
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const { doc: firestoreDoc, setDoc } = await import('firebase/firestore');
      const checkpointRef = firestoreDoc(db, 'users', currentUser.uid, 'checkpoints', `session-${sessionId}`);
      await setDoc(checkpointRef, {
        sessionId,
        transcript: fullTranscript,
        segmentCount: transcripts.length,
        sessionStartTime: sessionId,
        lastUpdate: Date.now(),
        status: 'recording',
      }, { merge: true });

      lastCheckpointTranscriptLengthRef.current = fullTranscript.length;
      setLastCheckpointTime(Date.now());
      console.log('[Checkpoint] Backup guardado exitosamente');
    } catch (error) {
      console.error('[Checkpoint] Error guardando backup:', error);
    }
  }, []);

  /**
   * Guarda la conversación COMPLETA como una sola grabación.
   * Se llama cuando la conversación realmente terminó (silencio largo o stop manual).
   */
  const saveConversation = useCallback(async (reason: string) => {
    try {
      const transcripts = finalTranscriptsRef.current;
      const sessionId = sessionStartTimeRef.current;
      const fullTranscript = transcripts.map(s => s.text).join(' ');

      console.log(`[Conversation] Guardando conversación completa (razón: ${reason}, ${fullTranscript.length} chars)...`);

      // Solo guardar si hay contenido
      if (fullTranscript && fullTranscript.length > 10) {
        const totalDuration = Math.floor((Date.now() - sessionId) / 1000);

        // Crear audioBlob del TOTAL acumulado
        const audioBlob = audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : undefined;

        await saveRecording(
          fullTranscript,
          audioBlob,
          totalDuration,
          {
            sessionId: sessionId,
            chunkStartTime: sessionId,
            chunkEndTime: Date.now(),
            isAutoSaved: reason !== 'manual_stop',
          }
        );

        console.log(`[Conversation] Conversación guardada exitosamente (${totalDuration}s)`);
      } else {
        console.log('[Conversation] Sin contenido suficiente, no se guarda');
      }

      // Limpiar checkpoint (ya no se necesita)
      try {
        const currentUser = auth.currentUser;
        if (currentUser && sessionId) {
          const { doc: firestoreDoc, deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore');
          const checkpointRef = firestoreDoc(db, 'users', currentUser.uid, 'checkpoints', `session-${sessionId}`);
          await firestoreDeleteDoc(checkpointRef);
        }
      } catch (e) {
        console.warn('[Conversation] Error limpiando checkpoint:', e);
      }

      // Limpiar datos de la sesión
      audioChunksRef.current = [];
      setFinalTranscripts([]);
      finalTranscriptsRef.current = [];
      setCurrentTranscript('');
      lastCheckpointTranscriptLengthRef.current = 0;
    } catch (error) {
      console.error('[Conversation] Error guardando:', error);
      setError('Error al guardar conversación');
    }
  }, []);

  // Mantener ref actualizado
  useEffect(() => {
    saveConversationRef.current = saveConversation;
  }, [saveConversation]);

  /**
   * Inicia el timer de checkpoints periódicos.
   * Los checkpoints son silenciosos: NO interrumpen la grabación.
   */
  const startCheckpointTimer = useCallback(() => {
    // Limpiar timer anterior
    if (checkpointTimerRef.current) {
      clearInterval(checkpointTimerRef.current);
    }
    
    checkpointTimerRef.current = setInterval(async () => {
      if (isRecordingRef.current) {
        await saveCheckpoint();
      }
    }, CHECKPOINT_INTERVAL_MS);

    console.log(`[Checkpoint] Timer iniciado: cada ${CHECKPOINT_INTERVAL_MS / 60000} min`);
  }, [saveCheckpoint]);

  /**
   * Loop principal de detección de voz
   * Se ejecuta cada VOICE_CHECK_INTERVAL ms para monitorear actividad.
   * 
   * Lógica de fin de conversación:
   * - Si hay 2+ minutos de silencio continuo MIENTRAS grabamos -> la conversación terminó
   * - Guarda la conversación completa y entra en modo "listening"
   * - Si se detecta voz en modo "listening" -> nueva conversación
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

      // Si estamos en modo "listening" y detectamos voz, iniciar nueva conversación
      if (hasVoice && currentIsListening) {
        console.log('Voz detectada en modo listening, iniciando nueva conversación...');
        resumeRecordingRef.current?.();
      }

      // Si estamos grabando pero no hay voz, verificar si la conversación terminó
      if (!hasVoice && currentIsRecording && !currentIsListening) {
        const silenceDuration = Date.now() - currentLastVoiceActivity;

        if (silenceDuration > CONVERSATION_END_SILENCE_MS) {
          console.log(`[Conversation End] Silencio de ${Math.floor(silenceDuration / 1000)}s detectado. Conversación terminada.`);
          // Guardar la conversación completa y pasar a modo listening
          saveConversationRef.current?.('silence_detected');
          
          // Cambiar a modo listening (NO paramos el analyser ni el stream)
          setIsRecording(false);
          setIsListening(true);
          isRecordingRef.current = false;
          isListeningRef.current = true;

          // Parar transcripción pero mantener detección de voz
          if (transcriptionRef.current) {
            transcriptionRef.current.stop();
            transcriptionRef.current = null;
          }
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }

          // Limpiar checkpoint timer
          if (checkpointTimerRef.current) {
            clearInterval(checkpointTimerRef.current);
            checkpointTimerRef.current = null;
          }
        }
      }
    }, VOICE_CHECK_INTERVAL);
  }, [checkVoiceActivity]);

  /**
   * Reanuda la grabación cuando se detecta voz después de un fin de conversación.
   * Inicia una NUEVA sesión/conversación (nuevo sessionId, nuevos transcripts).
   */
  const resumeRecording = useCallback(async () => {
    console.log('Iniciando nueva conversación tras silencio...');

    try {
      // Cambiar estados inmediatamente
      setIsListening(false);
      setIsRecording(true);
      isListeningRef.current = false;
      isRecordingRef.current = true;

      const now = Date.now();
      setSessionStartTime(now);
      sessionStartTimeRef.current = now;
      setLastVoiceActivity(now);
      lastVoiceActivityRef.current = now;
      setFinalTranscripts([]);
      finalTranscriptsRef.current = [];
      setCurrentTranscript('');
      audioChunksRef.current = [];
      lastCheckpointTranscriptLengthRef.current = 0;

      // Iniciar transcripción
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

      // Iniciar checkpoint timer
      startCheckpointTimer();

      console.log('Nueva conversación iniciada');
    } catch (error) {
      console.error('Error iniciando nueva conversación:', error);
      setError('Error al iniciar grabación');
    }
  }, [handleTranscript, handleError, setupVoiceDetection, startCheckpointTimer]);

  // Mantener ref actualizado
  useEffect(() => {
    resumeRecordingRef.current = resumeRecording;
  }, [resumeRecording]);

  // ========== FIN DE FUNCIONES DE SESIÓN CONTINUA ==========

  /**
   * Reprocesa grabaciones existentes que no tienen análisis
   * Llama a la Cloud Function reprocessUnanalyzedRecordings
   */
  const reprocessRecordings = async () => {
    try {
      setIsReprocessing(true);
      setReprocessResult(null);
      setError(null);
      console.log('Iniciando reprocesamiento COMPLETO de grabaciones...');

      const reprocessFn = httpsCallable(functions, 'reprocessAllUserRecordings');
      const result = await reprocessFn({ 
        forceAll: true,  // Reprocesar TODAS, no solo las sin análisis
        limit: 100       // Procesar hasta 100 grabaciones
      });

      const data = result.data as { 
        total: number; 
        processed: number; 
        failed: number;
        skipped: number;
        message: string;
      };
      
      setReprocessResult(data);
      console.log('Reprocesamiento completado:', data);
      
      // Mostrar mensaje de éxito
      if (data.total === 0) {
        setError('No hay grabaciones para procesar');
      } else if (data.processed > 0) {
        setError(`✅ ${data.message}`);
        setTimeout(() => setError(null), 8000); // Limpiar después de 8 segundos
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

  const verifyMigration = async () => {
    try {
      setError(null);
      console.log('🔍 Verificando estado de migración...');

      const verifyFn = httpsCallable(functions, 'verifyMigrationStatus');
      const result = await verifyFn();

      setMigrationStatus(result.data);
      console.log('📊 Migration status:', result.data);
    } catch (err: any) {
      console.error('Error verificando migración:', err);
      setError(err.message || 'Error al verificar migración');
    }
  };

  const runMigration = async () => {
    if (!confirm('¿Estás seguro de ejecutar la migración? Esto asignará userId a todas las grabaciones sin userId.')) {
      return;
    }

    try {
      setIsMigrating(true);
      setError(null);
      console.log('🔄 Ejecutando migración...');

      const migrateFn = httpsCallable(functions, 'migrateRecordingsToUser');
      const result = await migrateFn();

      const data = result.data as any;
      setMigrationStatus(data);
      console.log('✅ Migration complete:', data);

      setError(`✅ Migración exitosa: ${data.migrated} grabaciones migradas`);
      setTimeout(() => setError(null), 8000);

      // Refresh recordings after migration
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      console.error('Error ejecutando migración:', err);
      setError(err.message || 'Error al ejecutar migración');
    } finally {
      setIsMigrating(false);
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

      // Inicializar variables de sesión
      const now = Date.now();
      setSessionStartTime(now);
      setLastVoiceActivity(now);
      setIsListening(false);
      setLastCheckpointTime(0);

      // Inicializar refs
      sessionStartTimeRef.current = now;
      lastVoiceActivityRef.current = now;
      isListeningRef.current = false;
      isRecordingRef.current = true;
      finalTranscriptsRef.current = [];
      lastCheckpointTranscriptLengthRef.current = 0;

      console.log('Iniciando nueva sesión de grabación continua:', { sessionId: now });

      // Obtener stream de audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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

      mediaRecorderRef.current.start(1000);

      // Timer de UI
      timerRef.current = setInterval(() => {
        setRecordingTime(d => d + 1);
      }, 1000);

      // Iniciar checkpoints silenciosos (cada 5 min)
      startCheckpointTimer();

      setIsRecording(true);
      console.log('Grabación continua iniciada exitosamente');
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
    isRecordingRef.current = false;
    isListeningRef.current = false;

    // Limpiar TODOS los timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (checkpointTimerRef.current) {
      clearInterval(checkpointTimerRef.current);
      checkpointTimerRef.current = null;
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

    // Guardar la conversación completa
    try {
      await saveConversation('manual_stop');
    } catch (err) {
      console.error('Error saving conversation on stop:', err);
      setError('Failed to save recording');
    }
    
    setIsProcessing(false);
    setRecordingTime(0);
    
    // Resetear estados de sesión
    setSessionStartTime(0);
    setLastCheckpointTime(0);

    // Resetear refs
    sessionStartTimeRef.current = 0;
    isRecordingRef.current = false;
    isListeningRef.current = false;
    finalTranscriptsRef.current = [];
    lastCheckpointTranscriptLengthRef.current = 0;

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

    // Filter by selected date if present
    const filteredRecordings = selectedDate
      ? recordings.filter(rec => {
          if (!rec.createdAt) return false;
          const recDate = rec.createdAt.toDate();
          return (
            recDate.getFullYear() === selectedDate.getFullYear() &&
            recDate.getMonth() === selectedDate.getMonth() &&
            recDate.getDate() === selectedDate.getDate()
          );
        })
      : recordings;

    filteredRecordings.forEach(recording => {
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
    { id: 'daily', icon: DailySummaryIcon, label: 'Resumen Diario', href: '/daily' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendario' },
    { id: 'tasks', icon: TasksIcon, label: 'Acciones', href: '/actions' },
    { id: 'search', icon: SearchIcon, label: 'Buscar' },
    { id: 'insights', icon: InsightsIcon, label: 'Integraciones', href: '/integrations' },
  ];

  const tabs = [
    { id: 'transcription', label: 'Transcription' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <ProtectedRoute>
    <main className="flex flex-col h-screen bg-black text-white font-['Inter',sans-serif]">
      {/* Top Header with User Menu */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
                        <AlwaysLogoFull />
        </div>
        
        {/* User Menu */}
        <div className="relative user-menu-container">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-gray-300">{user?.email?.split('@')[0] || 'User'}</span>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-black border border-white/10 rounded-lg shadow-xl z-50">
              {/* User Info Header */}
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-lg font-medium">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{user?.email?.split('@')[0] || 'User'}</div>
                    <div className="text-xs text-gray-500">Personal</div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm">Personal info</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">Settings</span>
                </Link>
              </div>

              {/* Logout */}
              <div className="border-t border-white/10 py-2">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    auth.signOut();
                  }}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 transition-colors w-full text-left text-red-400 hover:text-red-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm">Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar - Icon Navigation */}
      <div className="w-16 bg-black border-r border-white/10 flex flex-col items-center py-4">
        {/* Recording Control - Desktop */}
        <RecordingControl
          isRecording={isRecording}
          isListening={isListening}
          isProcessing={isProcessing}
          recordingTime={recordingTime}
          onStart={startRecording}
          onStop={stopRecording}
          isMobile={false}
        />

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-2">
          {navItems.map((item: any) => {
            const Icon = item.icon;
            
            // If item has href, render Link
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-all text-gray-500 hover:text-white hover:bg-white/5"
                  title={item.label}
                >
                  <Icon />
                </Link>
              );
            }
            
            // Otherwise render button
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
          <h2 className="text-sm font-medium text-gray-400">
            {selectedDate ? 'Grabaciones Filtradas' : "Grabaciones de Hoy"}
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            {selectedDate 
              ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            }
          </p>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filter
            </button>
          )}
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
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-xs text-red-400">🔴</span>
                                  <span className="text-xs font-medium text-gray-300 truncate">
                                    {chunk.title || `Chunk ${chunk.chunkNumber}`}
                                  </span>
                                  {chunk.analysis?.isGarbage && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded flex-shrink-0" title={chunk.analysis.garbageReason}>
                                      🗑️
                                    </span>
                                  )}
                                  {chunk.analysis?.needsMerge && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded flex-shrink-0" title="Parece fragmento incompleto">
                                      🔗
                                    </span>
                                  )}
                                  {chunk.analysis?.splitSuggestion && chunk.analysis.splitSuggestion.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded flex-shrink-0" title="Puede dividirse">
                                      ✂️
                                    </span>
                                  )}
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
          
          {/* Link a Settings */}
          <Link 
            href="/settings"
            className="p-3 flex items-center gap-2 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <span>⚙️</span>
            <span className="flex-1 text-sm">Configuración</span>
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
      ) : activeNav === 'calendar' ? (
        <CalendarView
          recordings={recordings}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setActiveNav('home');
          }}
        />
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
                    <span className="text-gray-300">Transcripción</span>
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
                    <span className="text-gray-300 flex-1">Continuous Session Recording</span>
                    <span className="text-xs text-green-400">Completo</span>
                  </div>
                  <div className="flex items-center gap-3 p-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span className="text-gray-300 flex-1">Smart Conversation Detection (2min silence)</span>
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
                <div className="text-xs text-gray-500 mt-1">Total Grabaciones</div>
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
                <button
                  onClick={verifyMigration}
                  className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                >
                  🔍 Verify Migration
                </button>
                <button
                  onClick={runMigration}
                  disabled={isMigrating}
                  className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
                >
                  {isMigrating ? '⏳ Migrando...' : '🔒 Run Migration'}
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
                  reprocessResult.failed === 0 ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  <div className="font-medium mb-1">✅ Reprocesamiento completado</div>
                  <div className="text-xs space-y-1">
                    <div>Total: {reprocessResult.total} grabaciones</div>
                    <div>✓ Procesadas: {reprocessResult.processed}</div>
                    {(reprocessResult as any).skipped > 0 && <div>⏭️ Saltadas: {(reprocessResult as any).skipped} (sin transcripción)</div>}
                    {reprocessResult.failed > 0 && <div>❌ Fallidas: {reprocessResult.failed}</div>}
                  </div>
                </div>
              )}
              {migrationStatus && (
                <div className="mt-3 p-3 rounded-lg text-sm bg-blue-500/10 border border-blue-500/30">
                  <div className="font-medium mb-1 text-blue-300">📊 Estado de Migración</div>
                  <div className="text-xs space-y-1">
                    <div>Total: {migrationStatus.total || migrationStatus.migrated || 0} grabaciones</div>
                    {migrationStatus.yourRecordings !== undefined && <div>✓ Tuyas: {migrationStatus.yourRecordings}</div>}
                    {migrationStatus.needsMigration !== undefined && <div>⚠️ Sin userId: {migrationStatus.needsMigration}</div>}
                    {migrationStatus.migrated !== undefined && <div>✅ Migradas: {migrationStatus.migrated}</div>}
                    {migrationStatus.userEmail && <div>👤 Usuario: {migrationStatus.userEmail}</div>}
                    {migrationStatus.message && <div className="mt-2 text-green-300">{migrationStatus.message}</div>}
                  </div>
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
                  <div className="text-gray-500">Checkpoint Interval</div>
                  <div className="text-white font-mono">5 min</div>
                </div>
                <div className="p-2 bg-white/5 rounded">
                  <div className="text-gray-500">Conversation End</div>
                  <div className="text-white font-mono">2 min silence</div>
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
                    Continuous recording {lastCheckpointTime > 0 ? `• Last backup ${Math.floor((Date.now() - lastCheckpointTime) / 60000)}m ago` : ''}
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
                  <h3 className="text-sm font-medium text-gray-400 mb-3">TRANSCRIPCIÓN</h3>
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
                  <p className="text-gray-500">Selecciona una grabación para ver la transcripción, o comienza a grabar</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'summary' && (
            <div className="max-w-2xl">
              {selectedRecording ? (
                <div className="space-y-6">
                  <h3 className="text-lg font-medium mb-4">Resumen de Grabación</h3>
                  
                  {/* Summary */}
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-300">
                      {selectedRecording.analysis?.summary || selectedRecording.summary || 'Summary will be generated automatically after transcription is complete.'}
                    </p>
                  </div>
                  
                  {/* Análisis Detallado */}
                  {selectedRecording.analysis && (
                    <div className="space-y-4">
                      {/* Garbage Detection Warning */}
                      {selectedRecording.analysis.isGarbage && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🗑️</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-red-300 text-sm mb-1">Sin contenido útil</h4>
                              <p className="text-gray-400 text-sm mb-3">
                                {selectedRecording.analysis.garbageReason || 'Esta grabación no parece tener contenido relevante.'}
                              </p>
                              <button
                                onClick={async () => {
                                  if (confirm('¿Eliminar esta grabación?')) {
                                    await deleteRecording(selectedRecording.id);
                                    setSelectedRecording(null);
                                  }
                                }}
                                className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-sm transition-colors"
                              >
                                Eliminar grabación
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Split Suggestion */}
                      {selectedRecording.analysis.splitSuggestion && 
                       selectedRecording.analysis.splitSuggestion.length > 0 && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">✂️</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-blue-300 text-sm mb-1">Sugerencia: Dividir grabación</h4>
                              <p className="text-gray-400 text-sm mb-3">
                                Esta grabación parece contener múltiples conversaciones separadas:
                              </p>
                              <div className="space-y-2">
                                {selectedRecording.analysis.splitSuggestion.map((suggestion: any, i: number) => (
                                  <div key={i} className="bg-white/5 rounded p-2">
                                    <p className="text-white text-sm font-medium mb-1">
                                      {i + 1}. {suggestion.topic}
                                    </p>
                                    <p className="text-gray-500 text-xs mb-1">
                                      Empieza en: "{suggestion.startMarker}"
                                    </p>
                                    <p className="text-gray-400 text-xs">
                                      {suggestion.reason}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-gray-500 mt-3">
                                💡 Funcionalidad de división automática próximamente
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Merge Suggestion */}
                      {selectedRecording.analysis.needsMerge && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">🔗</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-yellow-300 text-sm mb-1">Sugerencia: Fragmento incompleto</h4>
                              <p className="text-gray-400 text-sm mb-3">
                                Esta grabación parece ser parte de una conversación más larga. 
                                Considera revisar si hay otros chunks de la misma sesión que deberían combinarse.
                              </p>
                              <p className="text-xs text-gray-500">
                                💡 Funcionalidad de merge automático próximamente
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Calendar Event Correlation */}
                      {selectedRecording.correlatedEvent && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">📅</span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium text-blue-300 text-sm">Calendar Event</h4>
                                <span className="text-xs text-blue-400 bg-blue-500/20 px-2 py-0.5 rounded">
                                  {Math.round(selectedRecording.correlatedEvent.matchScore * 100)}% match
                                </span>
                              </div>
                              <p className="text-white font-semibold text-base mb-1">
                                {selectedRecording.correlatedEvent.summary}
                              </p>
                              <p className="text-xs text-gray-400">
                                {selectedRecording.correlatedEvent.startTime?.toDate?.()?.toLocaleString('es-MX', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                }) || 'Unknown time'}
                              </p>
                              
                              {selectedRecording.correlatedEvent.participants && 
                               selectedRecording.correlatedEvent.participants.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-500 mb-1.5">Event Participants:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRecording.correlatedEvent.participants.map((p: any, i: number) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 rounded text-xs"
                                      >
                                        <span className="text-blue-300">{p.name || p.email}</span>
                                        {p.email && p.name && (
                                          <span className="text-blue-400/60">{p.email}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Participants */}
                      {selectedRecording.analysis.participants && selectedRecording.analysis.participants.length > 0 && (
                        <div className="bg-white/5 rounded-lg p-4">
                          <h4 className="font-medium text-gray-400 mb-2 text-sm flex items-center gap-2">
                            <span>👥</span> Participantes
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedRecording.analysis.participants.map((participant: string, idx: number) => (
                              <span key={idx} className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-sm font-medium">
                                {participant}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Topics */}
                      {selectedRecording.analysis.topics && selectedRecording.analysis.topics.length > 0 && (
                        <div className="bg-white/5 rounded-lg p-4">
                          <h4 className="font-medium text-gray-400 mb-2 text-sm">Temas</h4>
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
                                    <span>{typeof item === 'string' ? item : (item.task || JSON.stringify(item))}</span>
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
                          <h4 className="font-medium text-gray-400 mb-2 text-sm">SSentimiento/h4>
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
                      <h4 className="font-medium text-gray-400 mb-3 text-sm"Reproducción de Audiok</h4>
                      <audio controls className="w-full">
                        <source src={selectedRecording.audioUrl} type="audio/webm" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Selecciona una grabación para ver el resumen</p>
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
          <h3 className="text-sm font-medium text-gray-400 mb-3">RESUMEN</h3>
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
            <p className="text-sm text-gray-500">Selecciona una grabación para ver el resumen</p>
          )}
        </div>

        {/* Recording Stats */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3">ESTADÍSTICAS</h3>
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
            
            {/* Información de sesión activa */}
            {(isRecording || isListening) && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Session Started</span>
                  <span className="text-gray-300 text-xs">
                    {formatDateShort(sessionStartTime)}
                  </span>
                </div>
                {isRecording && lastCheckpointTime > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Backup</span>
                    <span className="text-gray-300">
                      {Math.floor((Date.now() - lastCheckpointTime) / 60000)}m ago
                    </span>
                  </div>
                )}
                {isRecording && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Silence Ends At</span>
                    <span className="text-gray-300">
                      {Math.floor(CONVERSATION_END_SILENCE_MS / 60000)}m of silence
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">ACCIONES RÁPIDAS</h3>
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
                  {isRecording ? 'Detener' : isProcessing ? 'Procesando...' : 'Grabar'}
                </span>
              </div>
            </button>
            
            {recordings.length > 0 && (
              <>
                <button onClick={() => setActiveNav('search')} className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-300">
                  <span className="text-sm">Buscar Grabaciones</span>
                </button>

            <Link href="/actions" className="w-full text-left p-3 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors text-orange-300 block">
              <span className="text-sm">{'⚡'} Ver Acciones</span>
            </Link>

            <Link href="/daily" className="w-full text-left p-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors text-blue-300 block">
              <span className="text-sm">{'📊'} Resumen del Día</span>
            </Link>

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
                      {isReprocessing ? '⏳ Processing...' : '🔄 Reprocesar Grabaciones'}
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
                        '✓ Sin grabaciones pendientes'
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
      </div>

      {/* Recording Control - Mobile Floating Button */}
      <RecordingControl
        isRecording={isRecording}
        isListening={isListening}
        isProcessing={isProcessing}
        recordingTime={recordingTime}
        onStart={startRecording}
        onStop={stopRecording}
        isMobile={true}
      />
    </main>
    
          {/* Floating Actions Widget */}
          <ActionsWidget />

          </ProtectedRoute>
  );
}
