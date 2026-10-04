/**
 * Canonical Ingestion Contract for MedScribeAI.
 *
 * Ensures all clinical inputs (voice, text, documents, clinician entries)
 * are captured as strongly-typed, auditable IngestionEvents carrying
 * encounterId, source, timestamp, language, payload, and provenance metadata.
 *
 * Downstream clinical processing must consume tracked IngestionEvents
 * rather than raw untracked strings or buffers.
 */

export type IngestionSourceType =
  | 'patient_voice'
  | 'patient_text'
  | 'clinician_text'
  | 'uploaded_document'
  | 'system';

export type IngestionInputKind = 'text' | 'audio' | 'document';

export interface TextInput {
  kind: 'text';
  text: string;
  languageHint?: string;
  inputMethod?: 'keyboard' | 'touch_option' | 'asr_transcript';
}

export interface AudioInput {
  kind: 'audio';
  audioBase64: string;
  mimeType: string;
  durationMs?: number;
  sampleRate?: number;
  channels?: number;
  preferredLanguage?: string;
}

export interface DocumentInput {
  kind: 'document';
  fileBase64: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  documentHint?: 'prescription' | 'lab_report' | 'discharge_summary' | 'medical_report' | 'unspecified' | 'unknown';
}

export interface IngestionProvenance {
  clientTimestamp: string;
  deviceType?: string;
  stationId?: string;
  operatorId?: string;
  clientIp?: string;
}

export interface IngestionEvent {
  id: string;
  encounterId: string;
  sourceType: IngestionSourceType;
  sourceId: string;
  timestamp: string;
  language?: string;
  payload: TextInput | AudioInput | DocumentInput;
  provenance: IngestionProvenance;
}

export interface IngestionValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates an IngestionEvent against structural and safety invariants.
 */
export function validateIngestionEvent(event: IngestionEvent): IngestionValidationResult {
  const errors: string[] = [];

  if (!event) {
    return { valid: false, errors: ['IngestionEvent cannot be null or undefined'] };
  }
  if (!event.id || !event.id.trim()) {
    errors.push('Missing IngestionEvent id');
  }
  if (!event.encounterId || !event.encounterId.trim()) {
    errors.push('Missing encounterId: untracked clinical inputs are strictly forbidden');
  }
  if (!event.sourceType) {
    errors.push('Missing sourceType');
  }
  if (!event.timestamp) {
    errors.push('Missing timestamp');
  }
  if (!event.payload) {
    errors.push('Missing payload');
    return { valid: false, errors };
  }

  // Kind-specific validations
  if (event.payload.kind === 'text') {
    if (typeof event.payload.text !== 'string') {
      errors.push('TextInput payload must contain a text string');
    }
  } else if (event.payload.kind === 'audio') {
    if (!event.payload.audioBase64 || !event.payload.audioBase64.trim()) {
      errors.push('AudioInput payload must contain non-empty audioBase64');
    }
    if (!event.payload.mimeType) {
      errors.push('AudioInput payload must specify mimeType');
    }
  } else if (event.payload.kind === 'document') {
    if (!event.payload.fileBase64 || !event.payload.fileBase64.trim()) {
      errors.push('DocumentInput payload must contain non-empty fileBase64');
    }
    if (!event.payload.fileName) {
      errors.push('DocumentInput payload must specify fileName');
    }
  } else {
    errors.push(`Unknown payload kind: ${(event.payload as any)?.kind}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates a deterministic or pseudorandom event ID with prefix.
 */
export function generateIngestionId(sourceType: IngestionSourceType, index?: number | string): string {
  const suffix = index !== undefined ? `-${index}` : `-${Date.now()}`;
  return `ingest-${sourceType.replace(/_/g, '-')}${suffix}`;
}

/**
 * Factory for TextInput ingestion events.
 */
export function createTextInputEvent(
  encounterId: string,
  text: string,
  options: {
    sourceType?: IngestionSourceType;
    sourceId?: string;
    language?: string;
    inputMethod?: 'keyboard' | 'touch_option' | 'asr_transcript';
    stationId?: string;
  } = {}
): IngestionEvent {
  const timestamp = new Date().toISOString();
  const sourceType = options.sourceType || 'patient_text';
  const id = generateIngestionId(sourceType);

  const event: IngestionEvent = {
    id,
    encounterId,
    sourceType,
    sourceId: options.sourceId || id,
    timestamp,
    language: options.language,
    payload: {
      kind: 'text',
      text,
      languageHint: options.language,
      inputMethod: options.inputMethod || 'keyboard',
    },
    provenance: {
      clientTimestamp: timestamp,
      stationId: options.stationId || 'MediKiosk-Terminal-01',
    },
  };

  const validation = validateIngestionEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid TextInput IngestionEvent: ${validation.errors.join(', ')}`);
  }

  return event;
}

/**
 * Factory for AudioInput ingestion events.
 */
export function createAudioInputEvent(
  encounterId: string,
  audioBase64: string,
  mimeType: string,
  options: {
    sourceType?: IngestionSourceType;
    sourceId?: string;
    durationMs?: number;
    sampleRate?: number;
    channels?: number;
    preferredLanguage?: string;
    stationId?: string;
  } = {}
): IngestionEvent {
  const timestamp = new Date().toISOString();
  const sourceType = options.sourceType || 'patient_voice';
  const id = generateIngestionId(sourceType);

  const event: IngestionEvent = {
    id,
    encounterId,
    sourceType,
    sourceId: options.sourceId || id,
    timestamp,
    language: options.preferredLanguage,
    payload: {
      kind: 'audio',
      audioBase64,
      mimeType,
      durationMs: options.durationMs,
      sampleRate: options.sampleRate,
      channels: options.channels,
      preferredLanguage: options.preferredLanguage,
    },
    provenance: {
      clientTimestamp: timestamp,
      stationId: options.stationId || 'MediKiosk-Terminal-01',
    },
  };

  const validation = validateIngestionEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid AudioInput IngestionEvent: ${validation.errors.join(', ')}`);
  }

  return event;
}

/**
 * Factory for DocumentInput ingestion events.
 */
export function createDocumentInputEvent(
  encounterId: string,
  fileBase64: string,
  fileName: string,
  mimeType: string,
  options: {
    sourceType?: IngestionSourceType;
    sourceId?: string;
    fileSizeBytes?: number;
    documentHint?: 'prescription' | 'lab_report' | 'discharge_summary' | 'medical_report' | 'unspecified' | 'unknown';
    stationId?: string;
  } = {}
): IngestionEvent {
  const timestamp = new Date().toISOString();
  const sourceType = options.sourceType || 'uploaded_document';
  const id = generateIngestionId(sourceType);

  const event: IngestionEvent = {
    id,
    encounterId,
    sourceType,
    sourceId: options.sourceId || id,
    timestamp,
    payload: {
      kind: 'document',
      fileBase64,
      fileName,
      mimeType,
      fileSizeBytes: options.fileSizeBytes,
      documentHint: options.documentHint || 'unspecified',
    },
    provenance: {
      clientTimestamp: timestamp,
      stationId: options.stationId || 'MediKiosk-Terminal-01',
    },
  };

  const validation = validateIngestionEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid DocumentInput IngestionEvent: ${validation.errors.join(', ')}`);
  }

  return event;
}
