/**
 * Audio Buffer and Microphone Capture Manager.
 * Safely captures audio via MediaStream and MediaRecorder with ephemeral buffering.
 * Never writes raw audio to permanent storage (localStorage/IndexedDB) to protect patient privacy.
 */

export interface AudioBufferOptions {
  timesliceMs?: number;
  mimeType?: string;
  onAudioChunk?: (chunk: Blob) => void;
  onVolumeChange?: (volume: number) => void;
}

export class AudioBufferManager {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isRecording = false;

  /**
   * Request microphone permission and initialize audio stream.
   */
  async start(options: AudioBufferOptions = {}): Promise<void> {
    if (this.isRecording) {
      this.stop();
    }

    this.audioChunks = [];

    // Ensure navigator.mediaDevices is supported
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone audio capture is not supported in this browser environment.');
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      // Volume / VAD feedback analyzer
      if (options.onVolumeChange && typeof AudioContext !== 'undefined') {
        try {
          this.audioContext = new AudioContext();
          const source = this.audioContext.createMediaStreamSource(this.mediaStream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);

          const pcmData = new Uint8Array(this.analyser.frequencyBinCount);
          const trackVolume = () => {
            if (!this.isRecording || !this.analyser) return;
            this.analyser.getByteFrequencyData(pcmData);
            let sum = 0;
            for (let i = 0; i < pcmData.length; i++) {
              sum += pcmData[i];
            }
            const avg = sum / pcmData.length;
            const normalized = Math.min(1.0, avg / 128);
            options.onVolumeChange?.(normalized);
            this.animFrameId = requestAnimationFrame(trackVolume);
          };
          trackVolume();
        } catch {
          // AudioContext failure is non-blocking
        }
      }

      // Determine best supported MIME type
      let chosenMime = 'audio/webm;codecs=opus';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          chosenMime = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          chosenMime = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          chosenMime = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          chosenMime = 'audio/ogg;codecs=opus';
        } else {
          chosenMime = '';
        }
      }

      this.mediaRecorder = new MediaRecorder(this.mediaStream, chosenMime ? { mimeType: chosenMime } : undefined);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
          options.onAudioChunk?.(e.data);
        }
      };

      this.mediaRecorder.start(options.timesliceMs || 500);
      this.isRecording = true;
    } catch (err: any) {
      this.cleanup();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access on this kiosk.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device found on this system.');
      } else {
        throw new Error(`Microphone initialization error: ${err.message || err}`);
      }
    }
  }

  /**
   * Stop recording and compile all audio buffers into a single Blob.
   */
  async stop(): Promise<{ blob: Blob; base64: string; mimeType: string }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        const emptyBlob = new Blob([], { type: 'audio/webm' });
        this.cleanup();
        return resolve({ blob: emptyBlob, base64: '', mimeType: 'audio/webm' });
      }

      this.mediaRecorder.onstop = async () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const compiledBlob = new Blob(this.audioChunks, { type: mimeType });
        const base64 = await this.blobToBase64(compiledBlob);
        this.cleanup();
        resolve({ blob: compiledBlob, base64, mimeType });
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        resolve({ blob: new Blob([]), base64: '', mimeType: 'audio/webm' });
      }
    });
  }

  /**
   * Cancels current recording immediately without emitting data.
   */
  cancel(): void {
    this.cleanup();
  }

  /**
   * Check if currently recording.
   */
  isActive(): boolean {
    return this.isRecording;
  }

  private cleanup(): void {
    this.isRecording = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    this.audioChunks = [];
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Strip data URL prefix: "data:audio/webm;base64,"
          const base64 = reader.result.split(',')[1] || '';
          resolve(base64);
        } else {
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
