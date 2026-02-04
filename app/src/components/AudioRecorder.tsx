'use client';

import { useState, useRef } from 'react';
import { uploadAudio } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface AudioRecorderProps {
  onRecordingComplete?: (audioUrl: string) => void;
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      setError(null);
      console.log('Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('Recording stopped, processing...');
        setIsProcessing(true);
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        console.log('Audio blob created, size:', audioBlob.size);
        
        try {
          if (!user) {
            throw new Error('User not authenticated');
          }
          const audioUrl = await uploadAudio(audioBlob, user.uid);
          console.log('Audio uploaded successfully:', audioUrl);
          onRecordingComplete?.(audioUrl);
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          setError('Failed to upload recording');
        }
        
        setIsProcessing(false);
        setRecordingTime(0);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      console.log('Recording started');

      // Update recording time every second
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone. Please grant permission.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Audio Recording</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex flex-col items-center space-y-4">
        {!isRecording && !isProcessing && (
          <button
            onClick={startRecording}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-full flex items-center space-x-2 transition-colors"
          >
            <span className="text-2xl">🎙️</span>
            <span>Start Recording</span>
          </button>
        )}
        
        {isRecording && (
          <div className="text-center">
            <button
              onClick={stopRecording}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-8 rounded-full flex items-center space-x-2 transition-colors"
            >
              <span className="text-2xl">⏹️</span>
              <span>Stop Recording</span>
            </button>
            <div className="mt-4">
              <div className="text-red-500 font-mono text-xl">{formatTime(recordingTime)}</div>
              <div className="text-sm text-gray-500">Recording in progress...</div>
            </div>
          </div>
        )}
        
        {isProcessing && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <div className="mt-2 text-blue-600">Processing and uploading...</div>
          </div>
        )}
      </div>
    </div>
  );
}