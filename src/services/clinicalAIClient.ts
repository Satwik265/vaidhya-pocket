/**
 * Clinical AI Core API Client.
 *
 * Centralized boundary between the React frontend and the sovereign Python/FastAPI backend.
 * Provides typed access to canonical ClinicalFact extraction and service health.
 */

export interface FactProvenance {
  source_id: string;
  start_char: number;
  end_char: number;
  matched_text?: string | null;
  engine: string;
}

export type FactAssertion = 'present' | 'negated' | 'uncertain' | 'not_elicited';
export type FactCategory = 'symptom' | 'condition' | 'medication' | 'allergy' | 'investigation' | 'anatomy' | 'ayush';
export type FactTemporality = 'current' | 'historical' | 'acute' | 'chronic' | 'unknown';
export type FactExperiencer = 'patient' | 'family_member' | 'clinician' | 'other';
export type FactSource =
  | 'patient_transcript'
  | 'patient_voice'
  | 'patient_tap'
  | 'uploaded_document'
  | 'clinician_entered'
  | 'system_derived';

export interface ClinicalFact {
  concept_id: string;
  canonical_text: string;
  category: FactCategory;
  assertion: FactAssertion;
  temporality: FactTemporality;
  experiencer: FactExperiencer;
  evidence: string;
  source: FactSource;
  confidence: number;
  language: string;
  provenance: FactProvenance;
}

export interface ClinicalExtractionResponse {
  facts: ClinicalFact[];
  language_detected?: string;
}

export interface OCRBlock {
  block_id: number;
  text: string;
  confidence: number;
  bbox: number[];
}

export interface OCRResult {
  text: string;
  language_detected: string;
  confidence: number;
  facts: ClinicalFact[];
  document_type: string;
  blocks: OCRBlock[];
  preprocessed_stages: string[];
}

export interface ASRResult {
  text: string;
  language_detected: string;
  confidence: number;
  facts: ClinicalFact[];
  audio_duration_ms?: number | null;
  word_count: number;
  latency_ms?: number | null;
}

export interface ASRStatus {
  available: boolean;
  engine: string;
  model_name: string;
  supported_languages: string[];
  execution_provider: string;
  device: string;
}

export interface AudioTranscribeInput {
  audio_base64: string;
  mime_type?: string;
  duration_ms?: number;
  sample_rate?: number;
  channels?: number;
  preferred_language?: string;
}

export interface DocumentOCRInput {
  file_base64: string;
  file_name: string;
  mime_type?: string;
  file_size_bytes?: number;
  document_hint?: string;
}

export class ClinicalAIClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Checks whether the sovereign Python AI core backend is running and healthy.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: 'GET' });
      if (!res.ok) return false;
      const data = await res.json();
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the Python AI core service version.
   */
  async getVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/version`, { method: 'GET' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts canonical ClinicalFact models with evidence grounding from patient/clinician text.
   */
  async extractClinicalFacts(
    text: string,
    language: string = 'hi',
    sourceId: string = 'encounter-live'
  ): Promise<ClinicalFact[]> {
    if (!text || !text.trim()) {
      return [];
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/clinical/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          source_id: sourceId,
        }),
      });

      if (!res.ok) {
        throw new Error(`Clinical extraction HTTP error: ${res.status}`);
      }

      const data: ClinicalExtractionResponse = await res.json();
      return data.facts || [];
    } catch (err) {
      console.warn('FastAPI clinical extraction unavailable:', err);
      return [];
    }
  }

  /**
   * Transcribes patient clinical audio using sovereign local ASR.
   */
  async transcribeAudio(input: AudioTranscribeInput): Promise<ASRResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/asr/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'audio',
        mime_type: input.mime_type || 'audio/webm',
        ...input,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.detail?.message || `ASR HTTP error: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Performs physical OCR extraction on an uploaded medical document.
   */
  async extractDocumentOCR(input: DocumentOCRInput): Promise<OCRResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/ocr/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'document',
        mime_type: input.mime_type || 'image/jpeg',
        ...input,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.detail?.message || `OCR HTTP error: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Probes local ASR inference engine status and execution provider.
   */
  async getASRStatus(): Promise<ASRStatus | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/asr/status`, { method: 'GET' });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }
}

export const clinicalAIClient = new ClinicalAIClient();
