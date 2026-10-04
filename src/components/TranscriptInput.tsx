import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SAMPLE_SCENARIOS } from '../data/sampleScenarios';
import { Mic, MicOff, Upload, Sparkles, Trash2, Play, Pause, AlertCircle, RefreshCw, Cpu, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n';
import { isNonEnglishTranscript } from '../utils/languageDetector';

interface TranscriptInputProps {
  transcript: string;
  onChangeTranscript: (text: string) => void;
  onSelectScenario: (scenarioId: string) => void;
  onGenerateSOAP: (audioData?: { base64: string; mimeType: string }) => void;
  isGenerating: boolean;
  selectedScenarioId?: string;
  isOfflineMode?: boolean;
}

export const TranscriptInput: React.FC<TranscriptInputProps> = ({
  transcript,
  onChangeTranscript,
  onSelectScenario,
  onGenerateSOAP,
  isGenerating,
  selectedScenarioId,
  isOfflineMode,
}) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [audioFile, setAudioFile] = useState<{ file: File; url: string; base64: string } | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API if supported in browser
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    // Sovereign mode: browser dictation uploads audio to the vendor cloud, so it is opt-in only (?webspeech=1).
    if (!SpeechRecognition || !/[?&]webspeech=1/.test(window.location.search)) {
      setSpeechSupported(false);
    } else {
      setSpeechSupported(true);
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !/[?&]webspeech=1/.test(window.location.search)) {
      alert('Browser dictation is disabled in sovereign mode because it sends audio to the browser vendor cloud. Type or paste the transcript, or use the on-device speech model.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            currentTranscript += transcriptChunk + ' ';
          }
        }
        if (currentTranscript) {
          onChangeTranscript(transcript ? `${transcript}\n${currentTranscript}` : currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Audio file size exceeds 25MB. Please choose a smaller audio file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64
      const base64 = result.split(',')[1] || '';
      const url = URL.createObjectURL(file);
      setAudioFile({
        file,
        url,
        base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAudioFile = () => {
    if (audioFile) {
      URL.revokeObjectURL(audioFile.url);
    }
    setAudioFile(null);
    setIsPlayingAudio(false);
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current || !audioFile) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const characterCount = transcript.length;

  return (
    <div id="transcript-input-section" className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
      {/* Section Header */}
      <div id="transcript-header" className="px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <span className="w-2 h-6 bg-blue-600 rounded-full shrink-0"></span>
          <h2 id="transcript-title" className="font-bold text-sm text-slate-800">
            {t.transcriptInput.title}
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            ({wordCount} {t.transcriptInput.wordCount} | {characterCount} {t.transcriptInput.charCount})
          </span>
        </div>

        {/* Live Controls */}
        <div className="flex items-center space-x-2">
          {/* Mic dictation button */}
          <button
            id="btn-toggle-mic"
            type="button"
            onClick={toggleRecording}
            className={
              isRecording
                ? 'btn-danger px-3.5 py-1.5 animate-pulse shadow-md shadow-red-600/30'
                : 'btn-secondary px-3.5 py-1.5 text-xs'
            }
            title={speechSupported ? t.transcriptInput.micStart : t.transcriptInput.micNotSupported}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-blue-600" />}
            <span>{isRecording ? t.transcriptInput.micListening : t.transcriptInput.micStart}</span>
          </button>

          {/* Audio upload button */}
          <label
            id="label-audio-upload"
            className="btn-secondary px-3.5 py-1.5 text-xs cursor-pointer"
            title={t.transcriptInput.uploadAudio}
          >
            <Upload className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">{t.transcriptInput.uploadAudio}</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
          </label>

          {/* Clear button */}
          {transcript && (
            <button
              id="btn-clear-transcript"
              type="button"
              onClick={() => onChangeTranscript('')}
              className="btn-secondary p-1.5 hover:text-red-600"
              title={t.transcriptInput.clearAudio}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Scenario Pills */}
      <div id="quick-scenarios-bar" className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-2 overflow-x-auto text-xs scrollbar-thin">
        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider whitespace-nowrap flex items-center space-x-1 mr-1">
          <Sparkles className="w-3 h-3 text-blue-600" />
          <span>{t.transcriptInput.scenarioSelect}:</span>
        </span>
        {SAMPLE_SCENARIOS.map((sc) => {
          const isSelected = selectedScenarioId === sc.id;
          return (
            <button
              key={sc.id}
              id={`btn-scenario-${sc.id}`}
              type="button"
              onClick={() => onSelectScenario(sc.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {sc.title}
            </button>
          );
        })}
      </div>

      {/* Audio File Player Preview */}
      {audioFile && (
        <div id="audio-file-preview" className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-semibold">
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleAudioPlayback}
              className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold"
            >
              {isPlayingAudio ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
            </button>
            <span className="font-bold truncate max-w-xs">{audioFile.file.name}</span>
            <span className="badge-warning text-[10px] py-0.5 px-2">
              {(audioFile.file.size / (1024 * 1024)).toFixed(2)} MB
            </span>
          </div>
          <audio
            ref={audioRef}
            src={audioFile.url}
            onEnded={() => setIsPlayingAudio(false)}
            className="hidden"
          />
          <button
            onClick={removeAudioFile}
            className="text-amber-700 hover:text-red-600 p-1"
            title={t.transcriptInput.clearAudio}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Textarea */}
      <div className="p-5 relative">
        {/* Offline Mode Non-English Warning Banner */}
        {isOfflineMode && isNonEnglishTranscript(transcript) && (
          <div id="offline-non-english-warning" className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-start space-x-3 text-amber-900 text-xs shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {t.transcriptInput.offlineLanguageWarningTitle}
              </p>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                {t.transcriptInput.offlineLanguageWarning}
              </p>
            </div>
          </div>
        )}

        {isGenerating ? (
          <div id="transcript-skeleton-overlay" className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[220px] flex flex-col justify-between space-y-4 shadow-inner relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-800/40 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />

            <div className="flex items-center space-x-3 text-blue-400 font-bold text-xs">
              <Cpu className="w-4 h-4 animate-spin text-blue-400" />
              <span>{t.transcriptInput.generatingBtn}</span>
            </div>

            <div className="space-y-3 z-10">
              <motion.div
                className="h-3.5 bg-slate-800 rounded-md w-11/12"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <motion.div
                className="h-3.5 bg-slate-800 rounded-md w-4/5"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
              />
              <motion.div
                className="h-3.5 bg-slate-800 rounded-md w-9/12"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
              />
              <motion.div
                className="h-3.5 bg-slate-800 rounded-md w-2/3"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: 0.6 }}
              />
            </div>

            <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500 font-medium z-10 border-t border-slate-800/80">
              <span>{t.banner.title}</span>
              <span>{t.banner.guardrails}</span>
            </div>
          </div>
        ) : (
          <textarea
            id="textarea-transcript"
            rows={10}
            placeholder={t.transcriptInput.placeholder}
            value={transcript}
            onChange={(e) => onChangeTranscript(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono leading-relaxed resize-y min-h-[200px]"
          />
        )}

        {/* Recording active overlay warning */}
        {isRecording && !isGenerating && (
          <div className="absolute bottom-8 right-8 bg-red-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
            <span>{t.transcriptInput.micListening}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div id="transcript-footer" className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{t.transcriptInput.subtitle}</span>
        </div>

        <button
          id="btn-generate-soap"
          type="button"
          disabled={isGenerating || (!transcript.trim() && !audioFile)}
          onClick={() => {
            if (audioFile) {
              onGenerateSOAP({
                base64: audioFile.base64,
                mimeType: audioFile.file.type,
              });
            } else {
              onGenerateSOAP();
            }
          }}
          className={
            isGenerating || (!transcript.trim() && !audioFile)
              ? 'btn-secondary px-6 py-3 text-xs sm:text-sm cursor-not-allowed text-slate-400 bg-slate-200 border-slate-300'
              : 'btn-primary px-6 py-3 text-xs sm:text-sm shadow-xs'
          }
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
              <span>{t.transcriptInput.generatingBtn}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white fill-white" />
              <span>{t.transcriptInput.generateBtn}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

