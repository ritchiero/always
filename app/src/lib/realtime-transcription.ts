const ASSEMBLYAI_REALTIME_URL = 'wss://api.assemblyai.com/v2/realtime/ws';

export class RealtimeTranscription {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  constructor(
    private apiKey: string,
    private onTranscript: (text: string, isFinal: boolean) => void,
    private onError: (error: Error) => void
  ) {}

  async start() {
    try {
      // Obtener acceso al micrófono
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Conectar WebSocket con autenticación
      const url = `${ASSEMBLYAI_REALTIME_URL}?sample_rate=16000`;
      this.socket = new WebSocket(url);

      // Configurar autenticación en el primer mensaje
      this.socket.onopen = () => {
        console.log('WebSocket connected to AssemblyAI');
        if (this.socket) {
          this.socket.send(JSON.stringify({
            "audio_data": btoa(this.apiKey)
          }));
        }
      };

      // Manejar mensajes de transcripción
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received transcript:', data);
          
          if (data.message_type === 'PartialTranscript' && data.text) {
            this.onTranscript(data.text, false);
          } else if (data.message_type === 'FinalTranscript' && data.text) {
            this.onTranscript(data.text, true);
          } else if (data.error) {
            this.onError(new Error(data.error));
          }
        } catch (err) {
          console.error('Error parsing transcript data:', err);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(new Error('WebSocket connection failed'));
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
      };

      // Crear AudioContext para procesar el audio
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convertir Float32Array a Int16Array
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Convertir a base64 y enviar
          const uint8Array = new Uint8Array(int16Data.buffer);
          const base64Audio = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          
          this.socket.send(JSON.stringify({
            "audio_data": base64Audio
          }));
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log('Real-time transcription started');
    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError(error as Error);
    }
  }

  async stop(): Promise<string> {
    console.log('Stopping real-time transcription...');
    
    // Cerrar procesador de audio
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    // Cerrar WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    // Parar stream de micrófono
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    console.log('Real-time transcription stopped');
    return '';
  }
}