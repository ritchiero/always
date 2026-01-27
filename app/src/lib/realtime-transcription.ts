import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export class RealtimeTranscription {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;

  constructor(
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onError: (error: Error) => void
  ) {}

  async start() {
    try {
      console.log('Getting Deepgram API key...');
      const getKey = httpsCallable(functions, 'getDeepgramKey');
      const result = await getKey();
      const apiKey = (result.data as { apiKey: string }).apiKey;

      if (!apiKey || apiKey === 'YOUR_DEEPGRAM_API_KEY_HERE') {
        throw new Error('Deepgram API key not configured');
      }
      
      console.log('API key received, requesting microphone...');

      // Obtener acceso al micrófono
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      
      console.log('Microphone access granted, connecting to Deepgram...');

      // Conectar a Deepgram WebSocket
      const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&language=es&punctuate=true&interim_results=true`;
      
      this.socket = new WebSocket(url, ['token', apiKey]);

      this.socket.onopen = () => {
        console.log('Deepgram WebSocket connected');
        this.startAudioCapture();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'Results') {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            const isFinal = data.is_final;
            
            if (transcript) {
              console.log(`Transcript (${isFinal ? 'final' : 'partial'}):`, transcript);
              this.onTranscript(transcript, isFinal);
            }
          } else if (data.type === 'Metadata') {
            console.log('Deepgram session started:', data.request_id);
          } else if (data.type === 'Error') {
            console.error('Deepgram error:', data);
            this.onError(new Error(data.message || 'Deepgram error'));
          }
        } catch (e) {
          console.error('Error parsing Deepgram message:', e);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(new Error('WebSocket connection failed'));
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket closed - Code:', event.code, 'Reason:', event.reason);
      };

    } catch (error) {
      console.error('Start error:', error);
      this.onError(error as Error);
    }
  }

  private startAudioCapture() {
    if (!this.stream) {
      console.error('No audio stream available');
      return;
    }

    try {
      // Usar AudioContext para obtener PCM16
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convertir a PCM16
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          
          // Enviar como binary
          this.socket.send(pcm16.buffer);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('Audio capture started');
    } catch (error) {
      console.error('Error starting audio capture:', error);
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping transcription...');
    
    if (this.socket?.readyState === WebSocket.OPEN) {
      // Enviar mensaje de cierre
      this.socket.send(JSON.stringify({ type: 'CloseStream' }));
      this.socket.close();
    }
    this.socket = null;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    console.log('Transcription stopped');
  }
}