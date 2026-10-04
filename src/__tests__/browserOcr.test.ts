// PHASE1-POCKET
import { describe, it, expect, vi } from 'vitest';
import { BrowserTesseractProvider } from '../ocr/browserOcr';

const b64 = 'data:image/png;base64,' + 'A'.repeat(400);

describe('BrowserTesseractProvider (injected recognizer)', () => {
  it('returns text and classifies a prescription', async () => {
    const p = new BrowserTesseractProvider(async () => ({ recognize: async () => ({ text: 'Rx Tab. Metformin 500mg BD', confidence: 0.9 }) }));
    const r = await p.extractText({ kind: 'document', fileBase64: b64, fileName: 'a.png', mimeType: 'image/png' });
    expect(r.isLocal).toBe(true);
    expect(r.documentType).toBe('prescription');
  });
  it('fails closed with OCR_FAILED on empty text, no synthetic output', async () => {
    const p = new BrowserTesseractProvider(async () => ({ recognize: async () => ({ text: '  ', confidence: 0 }) }));
    await expect(p.extractText({ kind: 'document', fileBase64: b64, fileName: 'a.png', mimeType: 'image/png' })).rejects.toThrow(/OCR_FAILED/);
  });
  it('fails closed when the recognizer throws', async () => {
    const p = new BrowserTesseractProvider(async () => { throw new Error('wasm load error'); });
    await expect(p.extractText({ kind: 'document', fileBase64: b64, fileName: 'a.png', mimeType: 'image/png' })).rejects.toThrow(/OCR_FAILED/);
  });
  it('rejects tiny payloads before touching the recognizer', async () => {
    const factory = vi.fn();
    const p = new BrowserTesseractProvider(factory as any);
    await expect(p.extractText({ kind: 'document', fileBase64: 'abc', fileName: 'a.png', mimeType: 'image/png' })).rejects.toThrow(/OCR_FAILED/);
    expect(factory).not.toHaveBeenCalled();
  });
});
