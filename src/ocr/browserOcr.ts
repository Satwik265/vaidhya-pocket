// PHASE1-POCKET
/**
 * On-device OCR for the phone: Tesseract.js (WASM) running in a Web Worker, with the worker script, WASM core
 * and eng+hin language data served from /ocr (bundled in public/, precached by the service worker).
 * Replaces the removed cloud vision route. Fails closed: any problem -> OCR_FAILED, never synthetic text.
 */
import type { OCRProvider, OCRProviderStatus, OCRResult, OCRModelMetadata } from './ocrProvider';
import { classifyDocumentType, validateDocumentPayload } from './ocrProvider';
import type { DocumentInput } from '../clinical/ingestionContract';

export interface Recognizer {
  recognize(image: Blob | string): Promise<{ text: string; confidence: number }>;
  terminate?(): Promise<void>;
}

export const OCR_BASE = '/ocr';

async function createTesseractRecognizer(langs = 'eng+hin'): Promise<Recognizer> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(langs, 1, {
    workerPath: `${OCR_BASE}/worker.min.js`,
    corePath: OCR_BASE,
    langPath: `${OCR_BASE}/lang`,
    gzip: false,
    workerBlobURL: false,
  } as any);
  return {
    async recognize(image) {
      const { data } = await worker.recognize(image as any);
      return { text: data.text || '', confidence: (data.confidence || 0) / 100 };
    },
    async terminate() {
      await worker.terminate();
    },
  };
}

/** Downscale to max 1600px and boost contrast; large phone photos otherwise take 20s+ on WASM. */
export async function preprocessImage(blob: Blob, maxDim = 1600): Promise<Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return blob;
  try {
    return await preprocessInner(blob, maxDim);
  } catch {
    // Unsupported format or decode error: OCR the original image instead of failing.
    return blob;
  }
}

async function preprocessInner(blob: Blob, maxDim: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.filter = 'grayscale(1) contrast(1.35)';
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/png'));
}

export function base64ToBlob(b64: string, mime = 'image/jpeg'): Blob {
  const clean = b64.replace(/^data:[^;]+;base64,/, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export class BrowserTesseractProvider implements OCRProvider {
  readonly name = 'BrowserTesseractProvider';
  readonly isLocal = true;
  readonly modelMetadata: OCRModelMetadata = {
    provider: 'tesseract.js',
    model: 'tessdata_fast eng+hin (WASM, in-browser)',
    version: '5.1.1',
    isLocal: true,
    supportedDocumentTypes: ['prescription', 'lab_report', 'discharge_summary', 'medical_report'],
    task: 'document-ocr',
  };

  private rec: Recognizer | null = null;
  lastStageMs = { preprocess: 0, ocr: 0 };

  constructor(private factory: () => Promise<Recognizer> = () => createTesseractRecognizer()) {}

  async checkAvailability(): Promise<OCRProviderStatus> {
    const ok = typeof Worker !== 'undefined' || typeof process !== 'undefined';
    return {
      isAvailable: ok,
      status: ok ? 'READY' : 'UNAVAILABLE',
      reason: ok ? undefined : 'Web Workers are not available in this runtime.',
      supportedDocumentTypes: this.modelMetadata.supportedDocumentTypes,
    };
  }

  async extractText(document: DocumentInput): Promise<OCRResult> {
    const val = validateDocumentPayload(document);
    if (!val.passed) throw new Error(`OCR_FAILED: ${val.error}`);
    const t0 = performance.now();
    try {
      if (!this.rec) this.rec = await this.factory();
      const blob = base64ToBlob(document.fileBase64, document.mimeType || 'image/jpeg');
      const pre = await preprocessImage(blob);
      const t1 = performance.now();
      const { text, confidence } = await this.rec.recognize(pre);
      const t2 = performance.now();
      this.lastStageMs = { preprocess: t1 - t0, ocr: t2 - t1 };
      const clean = text.replace(/[ \t]+\n/g, '\n').trim();
      if (!clean) throw new Error('No readable text detected.');
      return {
        text: clean,
        documentType: classifyDocumentType(clean, document.documentHint),
        confidence,
        layoutBlocks: clean
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((p) => ({ text: p, blockType: 'paragraph' as const, confidence })),
        provider: this.name,
        model: this.modelMetadata.model,
        isLocal: true,
        latencyMs: t2 - t0,
      };
    } catch (e: any) {
      throw new Error(`OCR_FAILED: ${e?.message || 'unknown error'}`);
    }
  }

  async dispose(): Promise<void> {
    await this.rec?.terminate?.();
    this.rec = null;
  }
}

export const browserOcr = new BrowserTesseractProvider();
