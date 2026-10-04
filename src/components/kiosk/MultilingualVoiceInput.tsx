import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Send,
  Sparkles,
  Volume2,
  CheckCircle2,
  ShieldAlert,
  Globe,
  Languages,
  Keyboard,
  Radio,
} from 'lucide-react';
import { SpeechManager } from '../../speech/speechManager';
import {
  SupportedLocale,
  SpeechState,
  SpeechSessionRecord,
  LanguageDetectionResult,
} from '../../speech/speechTypes';
import { extractMultilingualConcepts, ExtractedClinicalConcept } from '../../nlp/codeSwitchingExtractor';
import { evaluateRedFlags, RedFlagAlert } from '../../clinical/redFlagRules';
import { computeConfidenceMetrics } from '../../clinical/confidenceScorer';
import { EmergencyTriageAlert } from '../../types';

export interface MultilingualVoiceInputProps {
  onTranscriptSubmitted: (
    transcript: string,
    locale: SupportedLocale,
    extractedConcepts?: ExtractedClinicalConcept[]
  ) => void;
  currentLocale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
  onEmergencyDetected?: (alert: EmergencyTriageAlert) => void;
  disabled?: boolean;
}

const SUPPORTED_LANGUAGES: { locale: SupportedLocale; label: string; native: string }[] = [
  { locale: 'en-IN', label: 'English (India)', native: 'English' },
  { locale: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { locale: 'mr-IN', label: 'Marathi', native: 'मराठी' },
  { locale: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { locale: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
];

export const MultilingualVoiceInput: React.FC<MultilingualVoiceInputProps> = ({
  onTranscriptSubmitted,
  currentLocale,
  onLocaleChange,
  onEmergencyDetected,
  disabled = false,
}) => {
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [activeSession, setActiveSession] = useState<SpeechSessionRecord | null>(null);
  const [extractedConcepts, setExtractedConcepts] = useState<ExtractedClinicalConcept[]>([]);
  const [triggeredRedFlags, setTriggeredRedFlags] = useState<RedFlagAlert[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isManualEditMode, setIsManualEditMode] = useState<boolean>(false);

  const speechManagerRef = useRef<SpeechManager | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Initialize SpeechManager instance
  useEffect(() => {
    const manager = new SpeechManager({
      onStatusChange: (state, message) => {
        setSpeechState(state);
        if (message) setStatusMessage(message);
        if (state === 'listening') {
          setErrorMessage(null);
        }
      },
      onInterimTranscript: (text) => {
        setInterimText(text);
        if (text.trim().length > 3) {
          analyzeText(text);
        }
      },
      onFinalTranscript: (text, session) => {
        setFinalTranscript(text);
        setInterimText('');
        setActiveSession(session);
        analyzeText(text, session.language || currentLocale);
      },
      onError: (err, fatal) => {
        console.error('SpeechManager error:', err);
        setErrorMessage(err);
        clearInterval(timerIntervalRef.current);
      },
    });

    speechManagerRef.current = manager;

    return () => {
      clearInterval(timerIntervalRef.current);
      manager.stopListening().catch(() => {});
    };
  }, [currentLocale]);

  // Real-time clinical concept extraction & red flag analysis
  const analyzeText = (text: string, localeHint: SupportedLocale = currentLocale) => {
    if (!text || text.trim().length < 2) {
      setExtractedConcepts([]);
      setTriggeredRedFlags([]);
      return;
    }

    try {
      const concepts = extractMultilingualConcepts(text, 'patient_voice', localeHint);
      setExtractedConcepts(concepts);

      const flags = evaluateRedFlags(concepts);
      setTriggeredRedFlags(flags);
    } catch (e) {
      console.warn('Clinical extraction error in voice input:', e);
    }
  };

  // Timer while recording
  useEffect(() => {
    if (speechState === 'listening') {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [speechState]);

  const handleStartListening = async () => {
    if (disabled || !speechManagerRef.current) return;
    setErrorMessage(null);
    setFinalTranscript('');
    setInterimText('');
    setExtractedConcepts([]);
    setTriggeredRedFlags([]);
    setActiveSession(null);

    await speechManagerRef.current.startListening(currentLocale);
  };

  const handleStopListening = async () => {
    if (!speechManagerRef.current) return;
    await speechManagerRef.current.stopListening();
  };

  const handleToggleListening = () => {
    if (speechState === 'listening') {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  const handleSubmit = () => {
    const textToSubmit = finalTranscript.trim() || interimText.trim();
    if (!textToSubmit) return;

    onTranscriptSubmitted(
      textToSubmit,
      activeSession?.language || activeSession?.detectedLanguages?.[0] || currentLocale,
      extractedConcepts
    );

    // Reset after submit
    setFinalTranscript('');
    setInterimText('');
    setExtractedConcepts([]);
    setTriggeredRedFlags([]);
    setActiveSession(null);
    setIsManualEditMode(false);
  };

  const handleReset = () => {
    if (speechState === 'listening') {
      speechManagerRef.current?.stopListening();
    }
    setFinalTranscript('');
    setInterimText('');
    setExtractedConcepts([]);
    setTriggeredRedFlags([]);
    setActiveSession(null);
    setErrorMessage(null);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentDisplay = finalTranscript || interimText;

  return (
    <div
      id="multilingual-voice-kiosk-panel"
      className="w-full p-4 sm:p-6 rounded-3xl bg-slate-900/90 border-2 border-slate-700/80 shadow-2xl flex flex-col gap-4"
    >
      {/* 1. Header & Language Selection Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <span>Voice Clinical Assistant</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Multilingual AI
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Speak naturally in any Indian language or mix with English
            </p>
          </div>
        </div>

        {/* Language Selection Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLocale === lang.locale;
            return (
              <button
                key={lang.locale}
                id={`voice-lang-${lang.locale}`}
                type="button"
                onClick={() => {
                  onLocaleChange(lang.locale);
                  if (speechState === 'listening') {
                    handleStopListening();
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 shadow-md scale-102 font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{lang.native}</span>
                <span className="text-[10px] opacity-75 font-normal">({lang.locale.split('-')[0]})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Primary Large Voice Interaction Button */}
      <div className="flex flex-col items-center justify-center py-4 sm:py-6 gap-3">
        <div className="relative flex items-center justify-center">
          {/* Animated Pulsing Rings when Listening */}
          {speechState === 'listening' && (
            <>
              <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-red-500/20 animate-ping" />
              <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-red-500/30 animate-pulse" />
            </>
          )}

          {/* Processing Spin Ring */}
          {speechState === 'transcribing' && (
            <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-indigo-500/40 border-t-indigo-400 animate-spin" />
          )}

          <button
            id="kiosk-main-voice-record-btn"
            type="button"
            onClick={handleToggleListening}
            disabled={disabled || speechState === 'transcribing'}
            className={`relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 flex flex-col items-center justify-center gap-1 transition-all duration-300 cursor-pointer shadow-2xl active:scale-95 ${
              speechState === 'listening'
                ? 'bg-red-600 border-red-300 text-white shadow-red-500/50 scale-105'
                : speechState === 'transcribing'
                ? 'bg-indigo-700 border-indigo-300 text-white'
                : 'bg-gradient-to-b from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 border-teal-200 text-slate-950 shadow-teal-500/30 hover:scale-105'
            }`}
          >
            {speechState === 'listening' ? (
              <>
                <MicOff className="w-8 h-8 animate-bounce" />
                <span className="text-[11px] font-black uppercase tracking-wider">Stop</span>
              </>
            ) : speechState === 'transcribing' ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-[10px] font-bold">Processing</span>
              </>
            ) : (
              <>
                <Mic className="w-9 h-9" />
                <span className="text-[11px] font-black uppercase tracking-wider">Speak</span>
              </>
            )}
          </button>
        </div>

        {/* State Label & Timer */}
        <div className="flex flex-col items-center text-center gap-1">
          {speechState === 'listening' ? (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-bold text-red-400">
                Listening... Speak now ({formatTimer(recordingSeconds)})
              </span>
            </div>
          ) : speechState === 'transcribing' ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-sm font-semibold text-indigo-300">
                Transcribing & analyzing clinical speech...
              </span>
            </div>
          ) : (
            <span className="text-xs sm:text-sm font-medium text-slate-300">
              Tap the microphone to speak your symptoms or answer questions
            </span>
          )}

          {statusMessage && speechState !== 'listening' && (
            <span className="text-xs text-slate-400 italic">{statusMessage}</span>
          )}
        </div>
      </div>

      {/* 3. Live Transcript & Analysis Display */}
      {(currentDisplay || errorMessage) && (
        <div
          id="kiosk-transcript-card"
          className="w-full p-4 rounded-2xl bg-slate-950/90 border border-slate-700/80 flex flex-col gap-3"
        >
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio
                className={`w-4 h-4 ${
                  speechState === 'listening' ? 'text-red-400 animate-pulse' : 'text-teal-400'
                }`}
              />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {speechState === 'listening' ? 'Live Interim Transcript' : 'Captured Patient Speech'}
              </span>
            </div>

            {/* Detected Language & Confidence Badges */}
            {activeSession && (
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-teal-300 border border-teal-500/30">
                  {activeSession.language.toUpperCase()} (
                  {Math.round(activeSession.languageConfidence * 100)}%)
                </span>
                {activeSession.codeSwitching && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Code-Switched
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Transcript Content (Editable when finalized) */}
          {isManualEditMode ? (
            <textarea
              id="kiosk-transcript-edit-input"
              value={finalTranscript}
              onChange={(e) => {
                setFinalTranscript(e.target.value);
                analyzeText(e.target.value);
              }}
              rows={3}
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-teal-400"
            />
          ) : (
            <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed min-h-[44px]">
              {currentDisplay}
              {speechState === 'listening' && (
                <span className="inline-block w-2 h-4 ml-1 bg-teal-400 animate-pulse" />
              )}
            </p>
          )}

          {/* Error display if any */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extracted Clinical Concepts Badges */}
          {extractedConcepts.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Recognized Clinical Concepts:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {extractedConcepts.map((concept, idx) => {
                  const isNegated = concept.assertion === 'negated';
                  return (
                    <span
                      key={idx}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                        isNegated
                          ? 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                          : 'bg-teal-950/60 text-teal-300 border-teal-800/60'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{concept.surfaceText || concept.conceptId}</span>
                      {isNegated && (
                        <span className="text-[10px] uppercase font-black text-rose-400">
                          (Negated)
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Critical Red Flag Alert Warning */}
          {triggeredRedFlags.length > 0 && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500 text-red-200 text-xs flex items-center gap-2.5 animate-pulse">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <div className="flex-1">
                <span className="font-black uppercase tracking-wide">
                  Clinical Safety Red Flag Identified:{' '}
                </span>
                <span>{triggeredRedFlags.map((r) => r.title).join('; ')}</span>
              </div>
            </div>
          )}

          {/* Action buttons (Confirm / Edit / Retry) */}
          {speechState !== 'listening' && currentDisplay && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualEditMode(!isManualEditMode)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  {isManualEditMode ? 'Done Editing' : 'Edit Text'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              <button
                id="kiosk-submit-voice-transcript-btn"
                type="button"
                onClick={handleSubmit}
                className="h-11 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer active:scale-98"
              >
                <span>Confirm & Submit</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Safety & Privacy Notice */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
        <span>Audio is processed for transcription only; no voice data is stored.</span>
        <span>Kiosk clinical intake assistant (non-diagnostic)</span>
      </div>
    </div>
  );
};
