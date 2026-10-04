import { describe, it, expect } from 'vitest';
import {
  evaluateAudioQuality,
  LocalWhisperCppASRProvider,
  MockASRProvider,
  ASRModelRegistry,
} from '../speech/asrProvider';
import { AudioInput } from '../clinical/ingestionContract';

describe('Sovereign ASR Provider Architecture & Audio Quality Gate (Phase 8D & 8E)', () => {
  const validBase64 = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAAAMTE4AAAAAAAY5q7PgnZs';

  describe('Audio Quality Gate', () => {
    it('rejects empty audio payload without attempting ASR', () => {
      const emptyAudio: AudioInput = {
        kind: 'audio',
        audioBase64: '',
        mimeType: 'audio/webm',
      };
      const res = evaluateAudioQuality(emptyAudio);
      expect(res.passed).toBe(false);
      expect(res.errorCode).toBe('EMPTY_AUDIO');
    });

    it('rejects audio shorter than 200ms as silence/noise', () => {
      const shortAudio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'audio/webm',
        durationMs: 120,
      };
      const res = evaluateAudioQuality(shortAudio);
      expect(res.passed).toBe(false);
      expect(res.errorCode).toBe('SILENCE_DETECTED');
    });

    it('rejects unsupported audio container formats', () => {
      const badMimeAudio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'application/pdf',
      };
      const res = evaluateAudioQuality(badMimeAudio);
      expect(res.passed).toBe(false);
      expect(res.errorCode).toBe('UNSUPPORTED_MIME');
    });

    it('passes valid WebM audio payload exceeding minimum thresholds', () => {
      const goodAudio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'audio/webm',
        durationMs: 2500,
      };
      const res = evaluateAudioQuality(goodAudio);
      expect(res.passed).toBe(true);
    });
  });

  describe('LocalWhisperCppASRProvider', () => {
    it('honestly reports UNAVAILABLE when local binary/weights are absent on host system', async () => {
      const provider = new LocalWhisperCppASRProvider({ isBinaryInstalled: false });
      const status = await provider.checkAvailability();

      expect(status.isAvailable).toBe(false);
      expect(status.status).toBe('UNAVAILABLE');
      expect(status.reason).toContain('Local Whisper.cpp binary or GGML Indic model weights not installed');
      expect(status.hardwareRequirements?.minRamGb).toBe(4);
    });

    it('throws explicit unavailable error rather than fabricating transcript or calling cloud', async () => {
      const provider = new LocalWhisperCppASRProvider({ isBinaryInstalled: false });
      const audio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'audio/webm',
        durationMs: 2000,
      };

      await expect(provider.transcribe(audio)).rejects.toThrow(/Local ASR Unavailable/i);
    });
  });

  describe('ASRModelRegistry & Tracked Ingestion', () => {
    it('routes through active provider and produces tracked IngestionEvent', async () => {
      const registry = new ASRModelRegistry();
      const mockProvider = new MockASRProvider();
      mockProvider.setFixture(validBase64.repeat(3), 'सीने में तेज दर्द हो रहा है');
      registry.registerProvider(mockProvider);
      registry.setActiveProvider(mockProvider.name);

      const audio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'audio/webm',
        durationMs: 2200,
      };

      const { result, ingestionEvent } = await registry.transcribeAudio('enc-777', audio, { languageHint: 'hi' });

      expect(result.text).toBe('सीने में तेज दर्द हो रहा है');
      expect(result.isLocal).toBe(true);
      expect(ingestionEvent.encounterId).toBe('enc-777');
      expect(ingestionEvent.sourceType).toBe('patient_voice');
      if (ingestionEvent.payload.kind === 'text') {
        expect(ingestionEvent.payload.text).toBe('सीने में तेज दर्द हो रहा है');
        expect(ingestionEvent.payload.inputMethod).toBe('asr_transcript');
      }
    });

    it('fails with explicit error when selected provider is unavailable', async () => {
      const registry = new ASRModelRegistry();
      const unavailableProvider = new LocalWhisperCppASRProvider({ isBinaryInstalled: false });
      registry.registerProvider(unavailableProvider);
      registry.setActiveProvider(unavailableProvider.name);

      const audio: AudioInput = {
        kind: 'audio',
        audioBase64: validBase64.repeat(3),
        mimeType: 'audio/webm',
        durationMs: 1500,
      };

      await expect(registry.transcribeAudio('enc-888', audio)).rejects.toThrow(/ASR_UNAVAILABLE/i);
    });
  });
});
