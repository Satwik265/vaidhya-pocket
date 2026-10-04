import { describe, it, expect } from 'vitest';
import {
  createTextInputEvent,
  createAudioInputEvent,
  createDocumentInputEvent,
  validateIngestionEvent,
  IngestionEvent,
} from '../clinical/ingestionContract';

describe('Canonical Ingestion Contract (Phase 8B)', () => {
  it('creates a valid TextInput IngestionEvent with provenance and encounterId', () => {
    const event = createTextInputEvent('enc-12345', 'Mujhe seene mein dard hai', {
      sourceType: 'patient_voice',
      sourceId: 'turn-01',
      language: 'hi',
      inputMethod: 'asr_transcript',
    });

    expect(event.id).toMatch(/^ingest-patient-voice-/);
    expect(event.encounterId).toBe('enc-12345');
    expect(event.sourceType).toBe('patient_voice');
    expect(event.sourceId).toBe('turn-01');
    expect(event.language).toBe('hi');
    expect(event.payload.kind).toBe('text');
    if (event.payload.kind === 'text') {
      expect(event.payload.text).toBe('Mujhe seene mein dard hai');
      expect(event.payload.inputMethod).toBe('asr_transcript');
    }
    expect(event.provenance.stationId).toBe('MediKiosk-Terminal-01');
  });

  it('creates a valid AudioInput IngestionEvent with format metadata', () => {
    const event = createAudioInputEvent('enc-12345', 'dGVzdGF1ZGlv', 'audio/webm', {
      durationMs: 4200,
      sampleRate: 16000,
      channels: 1,
      preferredLanguage: 'hi-IN',
    });

    expect(event.id).toMatch(/^ingest-patient-voice-/);
    expect(event.payload.kind).toBe('audio');
    if (event.payload.kind === 'audio') {
      expect(event.payload.audioBase64).toBe('dGVzdGF1ZGlv');
      expect(event.payload.mimeType).toBe('audio/webm');
      expect(event.payload.durationMs).toBe(4200);
      expect(event.payload.sampleRate).toBe(16000);
    }
  });

  it('creates a valid DocumentInput IngestionEvent with classification hint', () => {
    const event = createDocumentInputEvent('enc-12345', 'ZmlsZWRhdGE=', 'prescription.jpg', 'image/jpeg', {
      fileSizeBytes: 204800,
      documentHint: 'prescription',
    });

    expect(event.id).toMatch(/^ingest-uploaded-document-/);
    expect(event.payload.kind).toBe('document');
    if (event.payload.kind === 'document') {
      expect(event.payload.fileName).toBe('prescription.jpg');
      expect(event.payload.documentHint).toBe('prescription');
      expect(event.payload.fileSizeBytes).toBe(204800);
    }
  });

  it('strictly rejects untracked ingestion without encounterId', () => {
    expect(() => {
      createTextInputEvent('', 'Some clinical text');
    }).toThrow(/untracked clinical inputs are strictly forbidden/i);
  });

  it('fails validation when audioBase64 or mimeType is empty', () => {
    const invalidAudioEvent: IngestionEvent = {
      id: 'ingest-01',
      encounterId: 'enc-1',
      sourceType: 'patient_voice',
      sourceId: 'src-1',
      timestamp: new Date().toISOString(),
      payload: {
        kind: 'audio',
        audioBase64: '',
        mimeType: '',
      },
      provenance: {
        clientTimestamp: new Date().toISOString(),
      },
    };

    const res = validateIngestionEvent(invalidAudioEvent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('audioBase64'))).toBe(true);
  });

  it('fails validation when document fileBase64 is empty', () => {
    const invalidDocEvent: IngestionEvent = {
      id: 'ingest-02',
      encounterId: 'enc-1',
      sourceType: 'uploaded_document',
      sourceId: 'src-2',
      timestamp: new Date().toISOString(),
      payload: {
        kind: 'document',
        fileBase64: '',
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
      },
      provenance: {
        clientTimestamp: new Date().toISOString(),
      },
    };

    const res = validateIngestionEvent(invalidDocEvent);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('fileBase64'))).toBe(true);
  });
});
