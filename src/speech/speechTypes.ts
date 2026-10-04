/**
 * Core speech types and interfaces for MediKiosk's Indian Multilingual Voice Pipeline.
 */

export type SupportedLocale = 'en-IN' | 'hi-IN' | 'mr-IN' | 'ta-IN' | 'gu-IN';
export type ScriptType = 'Devanagari' | 'Tamil' | 'Gujarati' | 'Latin' | 'Mixed';

export type SpeechProviderType =
  | 'gemini-live'
  | 'recorded-audio-gemini'
  | 'browser-asr-fallback'
  | 'manual-input';

export type SpeechState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'language_detected'
  | 'processing'
  | 'ready'
  | 'error';

export interface LanguageScore {
  language: SupportedLocale;
  score: number; // 0..1
}

export interface LanguageDetectionResult {
  language: SupportedLocale;
  confidence: number;
  script: ScriptType;
  codeSwitching: boolean;
  secondaryLanguages: LanguageScore[];
  isLowConfidence: boolean; // triggers language confirmation UI if true (< 0.65)
  signals: {
    scriptScore: Record<SupportedLocale, number>;
    lexicalScore: Record<SupportedLocale, number>;
    transliterationScore: Record<SupportedLocale, number>;
    asrSignal?: SupportedLocale;
  };
}

export interface SpeechSessionRecord {
  rawTranscript: string;
  language: SupportedLocale;
  languageConfidence: number;
  detectedLanguages: SupportedLocale[];
  codeSwitching: boolean;
  startedAt: number;
  completedAt: number;
  interimSegments: string[];
  finalSegments: string[];
  providerUsed: SpeechProviderType;
  error?: string;
}

export interface SpeechManagerCallbacks {
  onStatusChange?: (status: SpeechState, message?: string) => void;
  onInterimTranscript?: (interim: string) => void;
  onFinalTranscript?: (transcript: string, record: SpeechSessionRecord) => void;
  onLanguageDetected?: (result: LanguageDetectionResult) => void;
  onError?: (error: string, canRetry: boolean) => void;
}
