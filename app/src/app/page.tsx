'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { onRecordingsChange } from '@/lib/firebase';
import { RealtimeTranscription } from '@/lib/realtime-transcription';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export default function Home() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);
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
  
  const transcriptionRef = useRef<RealtimeTranscription | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = onRecordingsChange((newRecordings) => {
      console.log('Recordings updated:', newRecordings);
      setRecordings(newRecordings);
    });

    return () => unsubscribe();
  }, []);

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
      setRecordingTime(0);
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
        setRecordingTime(d => d + 1);
      }, 1000);

      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

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
          transcript: { text: fullTranscript },
          segments: finalTranscripts,
          audioUrl,
          duration: recordingTime,
          createdAt: serverTimestamp(),
          status: 'completed',
        });
        
        console.log('Recording saved successfully');
      }
    } catch (err) {
      console.error('Error saving recording:', err);
      setError('Failed to save recording');
    }
    
    setIsProcessing(false);
    setRecordingTime(0);
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

  const navItems = [
    { id: 'home', icon: HomeIcon, label: 'Home' },
    { id: 'timeline', icon: TimelineIcon, label: 'Timeline' },
    { id: 'calendar', icon: CalendarIcon, label: 'Calendar' },
    { id: 'tasks', icon: TasksIcon, label: 'Tasks' },
    { id: 'search', icon: SearchIcon, label: 'Search' },
    { id: 'insights', icon: InsightsIcon, label: 'Insights' },
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const tabs = [
    { id: 'transcription', label: 'Transcription' },
    { id: 'summary', label: 'Summary' },
  ];

  return (
    <main className="flex h-screen bg-black text-white font-['Inter',sans-serif]">
      {/* Left Sidebar - Icon Navigation */}
      <div className="w-16 bg-black border-r border-white/10 flex flex-col items-center py-4">
        {/* Recording Indicator */}
        <div className="mb-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className="relative w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <div className={`w-3 h-3 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 
              isProcessing ? 'bg-yellow-500 animate-spin' : 'bg-gray-500'
            }`} />
            {isRecording && (
              <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
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

      {/* Secondary Sidebar - Recordings */}
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
            <div className="space-y-3">
              {recordings.map((recording, idx) => (
                <div 
                  key={recording.id} 
                  className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => setSelectedRecording(recording)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-sm font-medium truncate">
                      {recording.title || `Recording ${idx + 1}`}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatDate(recording.createdAt).split(' ')[1]}
                    </span>
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
            </div>
          )}
        </div>
      </div>

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
            
            {!isRecording && !isProcessing && (
              <button
                onClick={startRecording}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-white" />
                Start Recording
              </button>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-4">
                <button
                  onClick={stopRecording}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-sm bg-white" />
                  Stop Recording
                </button>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-500 font-mono">{formatTime(recordingTime)}</span>
                </div>
              </div>
            )}
            
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
                <div>
                  <h3 className="text-lg font-medium mb-4">Recording Summary</h3>
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-300">
                      {selectedRecording.summary || 'Summary will be generated automatically after transcription is complete.'}
                    </p>
                  </div>
                  
                  {selectedRecording.audioUrl && (
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-400 mb-3">Audio Playback</h4>
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
            <p className="text-sm text-gray-300">
              {selectedRecording.summary || 'Analysis will appear here after transcription completes.'}
            </p>
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
              <span className={`${isRecording ? 'text-red-500' : isProcessing ? 'text-yellow-500' : 'text-green-500'}`}>
                {isRecording ? 'Recording' : isProcessing ? 'Processing' : 'Ready'}
              </span>
            </div>
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
              <button className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-300">
                <span className="text-sm">Search Recordings</span>
              </button>
            )}
          </div>
        </div>
      </div>

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
    </main>
  );
}
