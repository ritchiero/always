import { RealtimeTranscriber } from 'assemblyai';

export class RealtimeTranscription {
  private transcriber: RealtimeTranscriber | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  
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
        } 
      });

      // Crear transcriber en tiempo real
      this.transcriber = new RealtimeTranscriber({
        apiKey: this.apiKey,
        sampleRate: 16000,
      });

      // Manejar transcripciones parciales
      this.transcriber.on('transcript.partial', (transcript) => {
        if (transcript.text) {
          this.onTranscript(transcript.text, false);
        }
      });

      // Manejar transcripciones finales
      this.transcriber.on('transcript.final', (transcript) => {
        if (transcript.text) {
          this.onTranscript(transcript.text, true);
        }
      });

      this.transcriber.on('error', (error) => {
        this.onError(new Error(error.message));
      });

      // Conectar al servicio
      await this.transcriber.connect();

      // Crear AudioContext para procesar el audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this.stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (this.transcriber) {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convertir Float32Array a Int16Array
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          this.transcriber.sendAudio(int16Data.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log('Real-time transcription started');
    } catch (error) {
      this.onError(error as Error);
    }
  }

  async stop(): Promise<string> {
    if (this.transcriber) {
      await this.transcriber.close();
      this.transcriber = null;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    console.log('Real-time transcription stopped');
    return '';
  }
}