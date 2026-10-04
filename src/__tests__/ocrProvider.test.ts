import { describe, it, expect } from 'vitest';
import {
  validateDocumentPayload,
  classifyDocumentType,
  LocalTesseractOCRProvider,
  MockOCRProvider,
  OCRDocumentPipeline,
} from '../ocr/ocrProvider';
import { DocumentInput } from '../clinical/ingestionContract';

describe('Sovereign OCR Provider Architecture & Document Pipeline (Phase 8F & 8G)', () => {
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(5);

  describe('Document Validation', () => {
    it('rejects empty document payload without attempting OCR', () => {
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: '',
        fileName: 'rx.jpg',
        mimeType: 'image/jpeg',
      };
      const val = validateDocumentPayload(doc);
      expect(val.passed).toBe(false);
      expect(val.error).toContain('zero bytes');
    });

    it('rejects document payloads smaller than minimum valid container size', () => {
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: 'short',
        fileName: 'rx.jpg',
        mimeType: 'image/jpeg',
      };
      const val = validateDocumentPayload(doc);
      expect(val.passed).toBe(false);
      expect(val.error).toContain('too small');
    });

    it('rejects unsupported MIME types', () => {
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: dummyBase64,
        fileName: 'audio.mp3',
        mimeType: 'audio/mpeg',
      };
      const val = validateDocumentPayload(doc);
      expect(val.passed).toBe(false);
      expect(val.error).toContain('Unsupported document MIME');
    });

    it('passes valid image payload', () => {
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: dummyBase64,
        fileName: 'prescription.png',
        mimeType: 'image/png',
      };
      const val = validateDocumentPayload(doc);
      expect(val.passed).toBe(true);
    });
  });

  describe('Document Classification', () => {
    it('classifies prescription documents based on clinical tokens', () => {
      expect(classifyDocumentType('Rx Tab. Metformin 500mg BD')).toBe('prescription');
    });

    it('classifies laboratory reports based on diagnostic tokens', () => {
      expect(classifyDocumentType('Pathology Lab Report: HbA1c 8.2% (Reference: < 5.7%)')).toBe('lab_report');
    });

    it('classifies hospital discharge summaries', () => {
      expect(classifyDocumentType('Hospital Discharge Summary IPD No: 44102')).toBe('discharge_summary');
    });
  });

  describe('LocalTesseractOCRProvider', () => {
    it('honestly reports UNAVAILABLE when Tesseract is not detected on host system PATH', async () => {
      const provider = new LocalTesseractOCRProvider({ isBinaryInstalled: false });
      const status = await provider.checkAvailability();

      expect(status.isAvailable).toBe(false);
      expect(status.status).toBe('UNAVAILABLE');
      expect(status.reason).toContain('Local Tesseract OCR binary or language data');
    });

    it('throws explicit error when attempting extraction on unavailable provider', async () => {
      const provider = new LocalTesseractOCRProvider({ isBinaryInstalled: false });
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: dummyBase64,
        fileName: 'rx.jpg',
        mimeType: 'image/jpeg',
      };

      await expect(provider.extractText(doc)).rejects.toThrow(/OCR_UNAVAILABLE/i);
    });
  });

  describe('OCRDocumentPipeline & ClinicalFact Generation', () => {
    it('converts layout text into canonical ClinicalFact[] with document provenance', async () => {
      const mockProvider = new MockOCRProvider();
      mockProvider.setFixture(dummyBase64, 'Rx: Tab. Metformin 500mg BD.', 'prescription');

      const pipeline = new OCRDocumentPipeline(mockProvider);
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: dummyBase64,
        fileName: 'metformin_rx.jpg',
        mimeType: 'image/jpeg',
      };

      const { ocrResult, ingestionEvent, clinicalFacts } = await pipeline.processDocument('enc-999', doc);

      expect(ocrResult.documentType).toBe('prescription');
      expect(ingestionEvent.sourceType).toBe('uploaded_document');
      expect(clinicalFacts.length).toBeGreaterThan(0);

      const medFact = clinicalFacts.find((f) => f.canonicalId === 'RX_METFORMIN' || f.canonicalId === 'MED_METFORMIN');
      expect(medFact).toBeDefined();
      expect(medFact?.assertion).toBe('AFFIRMED');
      expect(medFact?.provenance.sourceType).toBe('UPLOADED_DOCUMENT');
      expect((medFact?.attributes as any)?.dosage).toContain('500');
    });

    it('strictly throws OCR_FAILED when OCR yields no text and generates zero facts', async () => {
      const mockProvider = new MockOCRProvider();
      mockProvider.setFixture(dummyBase64, '   ', 'unknown');

      const pipeline = new OCRDocumentPipeline(mockProvider);
      const doc: DocumentInput = {
        kind: 'document',
        fileBase64: dummyBase64,
        fileName: 'blank.jpg',
        mimeType: 'image/jpeg',
      };

      await expect(pipeline.processDocument('enc-999', doc)).rejects.toThrow(/OCR_FAILED/i);
    });
  });
});
