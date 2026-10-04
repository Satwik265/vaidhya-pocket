/**
 * Multilingual Indian Clinical Speech Manager.
 * Orchestrates microphone capture, transcription, multi-signal language detection,
 * browser fallback, retry logic, and ephemeral state management.
 */

import { AudioBufferManager } from './audioBuffer';
import { LiveTranscriptionClient } from './liveTranscription';
import { BrowserSpeechFallback } from './speechFallback';
import { detectLanguage } from './languageDetection';
import {
  SupportedLocale,
  SpeechState,
  SpeechSessionRecord,
  LanguageDetectionResult,
  SpeechManagerCallbacks,
  SpeechProviderType
} from './speechTypes';

export class SpeechManager {
  private audioBuffer: AudioBufferManager;
  private liveClient: LiveTranscriptionClient;
  private fallbackClient: BrowserSpeechFallback;
  private callbacks: SpeechManagerCallbacks = {};

  private currentState: SpeechState = 'idle';
  private currentLocale: SupportedLocale = 'en-IN';
  private sessionStartedAt = 0;
  private lastCapturedBase64 = '';
  private lastCapturedMime = '';
  private lastSessionRecord: SpeechSessionRecord | null = null;
  private activeProvider: SpeechProviderType = 'gemini-live';

  constructor(callbacks: SpeechManagerCallbacks = {}) {
    this.callbacks = callbacks;
    this.audioBuffer = new AudioBufferManager();
    this.liveClient = new LiveTranscriptionClient();
    this.fallbackClient = new BrowserSpeechFallback();
  }

  setCallbacks(callbacks: SpeechManagerCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getState(): SpeechState {
    return this.currentState;
  }

  getLastSessionRecord(): SpeechSessionRecord | null {
    return this.lastSessionRecord;
  }

  /**
   * Starts listening with microphone capture and language bias.
   */
  async startListening(preferredLocale: SupportedLocale = 'en-IN'): Promise<void> {
    this.currentLocale = preferredLocale;
    this.sessionStartedAt = Date.now();
    this.updateState('listening', 'Microphone active. Listening for speech...');

    try {
      await this.audioBuffer.start({
        timesliceMs: 1000,
        onAudioChunk: () => {
          // Future real-time streaming chunks
        },
      });
      this.activeProvider = 'gemini-live';
    } catch (err: any) {
      // If mic initialization fails, try browser fallback or report error
      if (BrowserSpeechFallback.isAvailable()) {
        console.warn('Microphone stream error, attempting browser speech fallback:', err.message);
        this.startBrowserFallback(preferredLocale);
      } else {
        this.updateState('error', err.message);
        this.callbacks.onError?.(err.message, true);
      }
    }
  }

  /**
   * Stops listening, compiles audio buffer, and executes transcription.
   */
  async stopListening(): Promise<void> {
    if (this.activeProvider === 'browser-asr-fallback') {
      this.fallbackClient.stop();
      this.updateState('ready', 'Completed browser speech recognition.');
      return;
    }

    if (!this.audioBuffer.isActive()) {
      this.updateState('idle');
      return;
    }

    this.updateState('transcribing', 'Processing audio...');

    try {
      const { base64, mimeType } = await this.audioBuffer.stop();
      this.lastCapturedBase64 = base64;
      this.lastCapturedMime = mimeType;

      if (!base64) {
        this.updateState('ready', 'No audio detected.');
        return;
      }

      // Execute live/recorded transcription
      const record = await this.liveClient.transcribeAudio(
        {
          audioBase64: base64,
          mimeType,
          preferredLocale: this.currentLocale,
          allowCodeSwitching: true,
        },
        this.sessionStartedAt
      );

      this.lastSessionRecord = record;

      // Run multi-signal language detection
      this.updateState('language_detected', `Detected: ${record.language}`);
      const langResult = detectLanguage(record.rawTranscript, record.language);
      this.callbacks.onLanguageDetected?.(langResult);

      this.updateState('processing', 'Structuring clinical concepts...');
      this.callbacks.onFinalTranscript?.(record.rawTranscript, record);
      this.updateState('ready');
    } catch (err: any) {
      console.error('Server transcription unavailable, trying fallback:', err);
      // Fallback path
      if (BrowserSpeechFallback.isAvailable()) {
        this.updateState('listening', 'Retrying via browser speech fallback...');
        this.startBrowserFallback(this.currentLocale);
      } else {
        this.updateState('error', `Transcription failed: ${err.message}`);
        this.callbacks.onError?.(err.message, true);
      }
    }
  }

  /**
   * Cancels active session and purges audio buffers.
   */
  cancel(): void {
    this.audioBuffer.cancel();
    this.fallbackClient.stop();
    this.lastCapturedBase64 = '';
    this.updateState('idle');
  }

  /**
   * Retries transcription of last recorded audio buffer.
   */
  async retry(): Promise<void> {
    if (this.lastCapturedBase64) {
      this.updateState('transcribing', 'Retrying transcription...');
      try {
        const record = await this.liveClient.transcribeAudio(
          {
            audioBase64: this.lastCapturedBase64,
            mimeType: this.lastCapturedMime,
            preferredLocale: this.currentLocale,
            allowCodeSwitching: true,
          },
          Date.now()
        );
        this.lastSessionRecord = record;
        const langResult = detectLanguage(record.rawTranscript, record.language);
        this.callbacks.onLanguageDetected?.(langResult);
        this.callbacks.onFinalTranscript?.(record.rawTranscript, record);
        this.updateState('ready');
      } catch (err: any) {
        this.updateState('error', `Retry failed: ${err.message}`);
        this.callbacks.onError?.(err.message, true);
      }
    } else {
      this.startListening(this.currentLocale);
    }
  }

  /**
   * Explicitly sets manual text input (fallback 4).
   */
  submitManualTranscript(text: string, locale: SupportedLocale = this.currentLocale): void {
    const langResult = detectLanguage(text, locale);
    const record: SpeechSessionRecord = {
      rawTranscript: text,
      language: langResult.language,
      languageConfidence: langResult.confidence,
      detectedLanguages: [langResult.language, ...langResult.secondaryLanguages.map(s => s.language)],
      codeSwitching: langResult.codeSwitching,
      startedAt: Date.now(),
      completedAt: Date.now(),
      interimSegments: [],
      finalSegments: [text],
      providerUsed: 'manual-input',
    };

    this.lastSessionRecord = record;
    this.callbacks.onLanguageDetected?.(langResult);
    this.callbacks.onFinalTranscript?.(text, record);
    this.updateState('ready');
  }

  private startBrowserFallback(locale: SupportedLocale): void {
    this.activeProvider = 'browser-asr-fallback';
    this.fallbackClient.start(
      locale,
      (interim) => {
        this.callbacks.onInterimTranscript?.(interim);
      },
      (finalText) => {
        const langResult = detectLanguage(finalText, locale);
        const record: SpeechSessionRecord = {
          rawTranscript: finalText,
          language: langResult.language,
          languageConfidence: langResult.confidence,
          detectedLanguages: [langResult.language],
          codeSwitching: langResult.codeSwitching,
          startedAt: this.sessionStartedAt,
          completedAt: Date.now(),
          interimSegments: [],
          finalSegments: [finalText],
          providerUsed: 'browser-asr-fallback',
        };
        this.lastSessionRecord = record;
        this.callbacks.onLanguageDetected?.(langResult);
        this.callbacks.onFinalTranscript?.(finalText, record);
      },
      (err) => {
        this.updateState('error', err);
        this.callbacks.onError?.(err, true);
      }
    );
  }

  private updateState(state: SpeechState, message?: string): void {
    this.currentState = state;
    this.callbacks.onStatusChange?.(state, message);
  }
}
