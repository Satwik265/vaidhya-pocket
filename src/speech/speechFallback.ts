/**
 * Speech Recognition Fallback Adapter.
 * Provides browser Web Speech API as a secondary fallback only when cloud live transcription is unavailable.
 * Never fabricates clinical data.
 */

import { SupportedLocale } from './speechTypes';

// Extend window for WebkitSpeechRecognition
interface IWindow extends Window {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
}

export class BrowserSpeechFallback {
  private recognition: any = null;
  private isListening = false;

  static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    // Sovereign mode: Chrome/Android Web Speech sends audio to the vendor's cloud, which the network guard
    // cannot see. It is therefore OFF unless the operator opts in with ?webspeech=1.
    if (!/[?&]webspeech=1/.test(window.location.search)) return false;
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  start(
    locale: SupportedLocale,
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): boolean {
    if (!BrowserSpeechFallback.isAvailable()) {
      onError('Browser Speech Recognition is not available in this browser.');
      return false;
    }

    const win = window as unknown as IWindow;
    const SpeechConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    try {
      this.recognition = new SpeechConstructor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = locale; // e.g. 'hi-IN', 'mr-IN', 'ta-IN', 'gu-IN', 'en-IN'

      let accumulatedFinal = '';

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedFinal += (accumulatedFinal ? ' ' : '') + transcript;
            onFinal(accumulatedFinal);
          } else {
            interimText += transcript;
          }
        }
        if (interimText) {
          onInterim(interimText);
        }
      };

      this.recognition.onerror = (event: any) => {
        onError(event.error || 'Browser speech recognition error');
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (e: any) {
      onError(`Failed to start browser speech fallback: ${e.message}`);
      return false;
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    this.recognition = null;
  }
}
