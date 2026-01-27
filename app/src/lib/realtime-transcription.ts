import { getFunctions, httpsCallable } from 'firebase/functions';

const ASSEMBLYAI_REALTIME_URL = 'wss://api.assemblyai.com/v2/realtime/ws';

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
      // Obtener token temporal desde Cloud Function
      const functions = getFunctions();
      const getToken = httpsCallable(functions, 'getAssemblyAIToken');
      const result = await getToken();
      const token = (result.data as { token: string }).token;

      if (!token) {
        throw new Error('Failed to get AssemblyAI token');
      }

      // Obtener acceso al micrófono
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Conectar WebSocket con token temporal
      const url = `${ASSEMBLYAI_REALTIME_URL}?sample_rate=16000`;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log('AssemblyAI WebSocket connected');
        // Enviar token de autenticación
        this.socket?.send(JSON.stringify({ token }));
        this.startAudioProcessing();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            this.onError(new Error(data.error));
            return;
          }

          if (data.message_type === 'PartialTranscript' && data.text) {
            this.onTranscript(data.text, false);
          } else if (data.message_type === 'FinalTranscript' && data.text) {
            this.onTranscript(data.text, true);
          }
        } catch (e) {
          console.error('Error parsing message:', e);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
      };

    } catch (error) {
      this.onError(error as Error);
    }
  }

  private startAudioProcessing() {
    if (!this.stream) return;

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Convertir Float32Array a Int16Array (PCM16)
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        
        // Convertir a base64 y enviar
        const base64 = this.arrayBufferToBase64(pcm16.buffer);
        this.socket.send(JSON.stringify({ audio_data: base64 }));
      }
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async stop(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ terminate_session: true }));
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
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}