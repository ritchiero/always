'use client';

import { useState, useEffect } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { onRecordingsChange } from '@/lib/firebase';

export default function Home() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribe = onRecordingsChange((newRecordings) => {
      console.log('Recordings updated:', newRecordings);
      setRecordings(newRecordings);
    });

    return () => unsubscribe();
  }, []);

  const handleRecordingComplete = (audioUrl: string) => {
    console.log('Recording completed, audio URL:', audioUrl);
    // Recording will appear in the list automatically via the listener
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Always - Voice Recording Dashboard</h1>
          <p className="text-gray-600 mt-1">Record, transcribe, and analyze your conversations</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recording Section */}
          <div className="lg:col-span-2">
            <AudioRecorder onRecordingComplete={handleRecordingComplete} />
          </div>

          {/* Recent Recordings */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Recordings</h2>
            
            {recordings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">No recordings yet</h3>
                <p className="text-gray-500">Start your first recording to see it appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map((recording) => (
                  <div 
                    key={recording.id}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedRecording(recording)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-800">
                        {recording.title || 'Recording'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatDate(recording.createdAt)}
                      </span>
                    </div>
                    {recording.transcript && (
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {recording.transcript.text?.substring(0, 100)}...
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {recording.status || 'Processing'}
                      </span>
                      {recording.duration && (
                        <span className="text-xs text-gray-500">
                          {Math.round(recording.duration)}s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Recording Details */}
        {selectedRecording && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Recording Details</h2>
                <button 
                  onClick={() => setSelectedRecording(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700 mb-2">Created</h3>
                  <p className="text-gray-600">{formatDate(selectedRecording.createdAt)}</p>
                </div>
                
                {selectedRecording.transcript && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Transcript</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-800">{selectedRecording.transcript.text}</p>
                    </div>
                  </div>
                )}
                
                {selectedRecording.audioUrl && (
                  <div>
                    <h3 className="font-medium text-gray-700 mb-2">Audio</h3>
                    <audio controls className="w-full">
                      <source src={selectedRecording.audioUrl} type="audio/webm" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
