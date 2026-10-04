/**
 * LEGACY server transcription client. Disabled in sovereign mode: /api/speech/transcribe returns 410. On-device ASR replaces it.
 * Communicates with the secure server-side endpoint /api/speech/transcribe.
 * Preserves the patient's original verbatim spoken language (native script / romanized),
 * allowing code-switching and medical terms without premature translation.
 */

import { SupportedLocale, SpeechSessionRecord, LanguageDetectionResult } from './speechTypes';
import { detectLanguage } from './languageDetection';

export interface TranscribeRequestPayload {
  audioBase64: string;
  mimeType: string;
  preferredLocale: SupportedLocale;
  allowCodeSwitching?: boolean;
}

export interface TranscribeResponsePayload {
  transcript: string;
  languageDetected: SupportedLocale;
  confidence: number;
  codeSwitching: boolean;
  segments?: string[];
  error?: string;
}

export class LiveTranscriptionClient {
  /**
   * Sends captured audio buffer to the server transcription endpoint (disabled, returns 410).
   */
  async transcribeAudio(
    payload: TranscribeRequestPayload,
    startedAt: number
  ): Promise<SpeechSessionRecord> {
    const completedAt = Date.now();

    try {
      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioBase64: payload.audioBase64,
          audioMimeType: payload.mimeType,
          preferredLocale: payload.preferredLocale,
          allowCodeSwitching: payload.allowCodeSwitching ?? true,
        }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server transcription error (${response.status})`);
      }

      const data: TranscribeResponsePayload = await response.json();

      const rawTranscript = data.transcript || '';

      // Run multi-signal language detection on transcript as cross-verification
      const detected = detectLanguage(rawTranscript, data.languageDetected || payload.preferredLocale);

      return {
        rawTranscript,
        language: data.languageDetected || detected.language,
        languageConfidence: Math.max(data.confidence || 0.85, detected.confidence),
        detectedLanguages: [data.languageDetected || detected.language, ...detected.secondaryLanguages.map(s => s.language)],
        codeSwitching: data.codeSwitching ?? detected.codeSwitching,
        startedAt,
        completedAt,
        interimSegments: [],
        finalSegments: data.segments && data.segments.length > 0 ? data.segments : [rawTranscript],
        providerUsed: 'gemini-live',
      };
    } catch (err: any) {
      throw new Error(`Server transcription unavailable (sovereign mode): ${err.message || err}`);
    }
  }
}
