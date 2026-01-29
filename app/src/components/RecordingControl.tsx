'use client';

interface RecordingControlProps {
  isRecording: boolean;
  isListening: boolean;
  isProcessing: boolean;
  recordingTime: number;
  onStart: () => void;
  onStop: () => void;
  isMobile?: boolean;
}

export function RecordingControl({
  isRecording,
  isListening,
  isProcessing,
  recordingTime,
  onStart,
  onStop,
  isMobile = false
}: RecordingControlProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    if (isProcessing) return 'Processing...';
    if (isRecording) return 'Recording';
    if (isListening) return 'Listening...';
    return 'Ready to Record';
  };

  const getStatusColor = () => {
    if (isProcessing) return 'text-yellow-400';
    if (isRecording) return 'text-red-400';
    if (isListening) return 'text-yellow-400';
    return 'text-gray-400';
  };

  if (isMobile) {
    // Mobile: Floating button in bottom right
    return (
      <div className="md:hidden">
        {(isRecording || isListening) && (
          // Status banner at top
          <div className="fixed top-16 left-0 right-0 z-40 bg-gradient-to-b from-black/90 to-transparent backdrop-blur-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Animated indicator */}
                <div className="relative">
                  <div className={`w-3 h-3 rounded-full ${
                    isRecording ? 'bg-red-500' : 'bg-yellow-500'
                  }`} />
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-red-500/50 animate-ping" />
                      <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" style={{ animationDelay: '0.5s' }} />
                    </>
                  )}
                  {isListening && (
                    <>
                      <div className="absolute -inset-1 rounded-full border border-yellow-500/50 animate-ping" />
                      <div className="absolute -inset-2 rounded-full border border-yellow-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
                    </>
                  )}
                </div>

                {/* Status text */}
                <div>
                  <div className={`font-semibold text-sm ${getStatusColor()}`}>
                    {getStatusText()}
                  </div>
                  {(isRecording || isListening) && (
                    <div className="text-xs text-gray-500">
                      {isListening ? 'Waiting for voice...' : 'Auto-saving every 15 min'}
                    </div>
                  )}
                </div>
              </div>

              {/* Timer */}
              {(isRecording || isListening) && (
                <div className="font-mono text-xl font-bold text-white tabular-nums">
                  {formatTime(recordingTime)}
                </div>
              )}
            </div>

            {/* Voice activity indicator */}
            {isRecording && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-green-500 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 16 + 8}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: `${0.8 + Math.random() * 0.4}s`
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">Voice detected</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating action button */}
        <button
          onClick={(isRecording || isListening) ? onStop : onStart}
          disabled={isProcessing}
          className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all disabled:opacity-50 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600'
              : isListening
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isProcessing ? (
            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (isRecording || isListening) ? (
            // Stop icon
            <div className="w-6 h-6 bg-white rounded-sm" />
          ) : (
            // Microphone icon
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}

          {/* Pulse animation when recording */}
          {isRecording && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-red-500/50 animate-ping" />
              <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping" style={{ animationDelay: '0.5s' }} />
            </>
          )}

          {/* Wave animation when listening */}
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full border-4 border-yellow-500/50 animate-ping" />
              <div className="absolute inset-0 rounded-full border-4 border-yellow-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
            </>
          )}
        </button>

        {/* Tooltip hint when idle */}
        {!isRecording && !isListening && !isProcessing && (
          <div className="fixed bottom-24 right-6 z-40 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-bounce">
            Tap to start recording
          </div>
        )}
      </div>
    );
  }

  // Desktop: Enhanced sidebar control
  return (
    <div className="hidden md:flex flex-col items-center gap-3 p-4">
      {/* Main recording button */}
      <button
        onClick={(isRecording || isListening) ? onStop : onStart}
        disabled={isProcessing}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${
          isRecording
            ? 'bg-red-500/20 border-2 border-red-500'
            : isListening
            ? 'bg-yellow-500/20 border-2 border-yellow-500'
            : 'bg-white/5 border-2 border-white/10 hover:bg-white/10'
        }`}
      >
        {isProcessing ? (
          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (isRecording || isListening) ? (
          <div className="w-6 h-6 bg-white rounded-sm" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-500" />
        )}

        {/* Animations */}
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        {isListening && (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-yellow-500/50 animate-ping" />
            <div className="absolute inset-0 rounded-full border-2 border-yellow-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
          </>
        )}
      </button>

      {/* Status text */}
      <div className={`text-xs font-medium text-center ${getStatusColor()}`}>
        {getStatusText()}
      </div>

      {/* Timer */}
      {(isRecording || isListening) && (
        <div className="font-mono text-sm font-bold text-white tabular-nums bg-white/5 px-2 py-1 rounded">
          {formatTime(recordingTime)}
        </div>
      )}

      {/* Voice activity bars */}
      {isRecording && (
        <div className="flex gap-0.5 h-8 items-end">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-500 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: `${0.6 + Math.random() * 0.4}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
