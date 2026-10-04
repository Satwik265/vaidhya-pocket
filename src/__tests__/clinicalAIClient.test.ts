import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClinicalAIClient } from '../services/clinicalAIClient';
import { LocalPythonProvider, NoNetworkFallbackProvider, HybridClinicalProvider } from '../services/aiProvider';

describe('ClinicalAIClient & Provider Abstraction', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('healthCheck returns true when FastAPI reports status ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'medscribe-ai-core' }),
    });

    const client = new ClinicalAIClient('http://127.0.0.1:8000');
    const isHealthy = await client.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('healthCheck returns false when FastAPI is unreachable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const client = new ClinicalAIClient('http://127.0.0.1:8000');
    const isHealthy = await client.healthCheck();
    expect(isHealthy).toBe(false);
  });

  it('extractClinicalFacts handles successful extraction', async () => {
    const mockFact = {
      concept_id: 'SYM_HEADACHE',
      canonical_text: 'headache',
      category: 'symptom',
      assertion: 'present',
      temporality: 'current',
      experiencer: 'patient',
      evidence: 'sar mein dard hai',
      source: 'patient_transcript',
      confidence: 0.95,
      language: 'hi',
      provenance: {
        source_id: 'enc-01',
        start_char: 0,
        end_char: 17,
        engine: 'medscribe-deterministic-nlp',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ facts: [mockFact], language_detected: 'hi' }),
    });

    const client = new ClinicalAIClient('http://127.0.0.1:8000');
    const facts = await client.extractClinicalFacts('sar mein dard hai', 'hi');
    expect(facts).toHaveLength(1);
    expect(facts[0].concept_id).toBe('SYM_HEADACHE');
    expect(facts[0].assertion).toBe('present');
  });

  it('LocalPythonProvider delegates to client', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'medscribe-ai-core' }),
    });

    const provider = new LocalPythonProvider();
    const available = await provider.isAvailable();
    expect(available).toBe(true);
    expect(provider.name).toBe('LocalPythonProvider');
  });

  it('HybridClinicalProvider routes to local provider when available', async () => {
    const mockLocal = {
      name: 'MockLocal',
      isAvailable: vi.fn().mockResolvedValue(true),
      extractFacts: vi.fn().mockResolvedValue([{ concept_id: 'SYM_FEVER' }]),
    };
    const mockCloud = {
      name: 'MockCloud',
      isAvailable: vi.fn().mockResolvedValue(true),
      extractFacts: vi.fn().mockResolvedValue([]),
    };

    const hybrid = new HybridClinicalProvider(mockLocal as any, mockCloud as any);
    const facts = await hybrid.extractFacts('bukhar hai');

    expect(mockLocal.isAvailable).toHaveBeenCalled();
    expect(mockLocal.extractFacts).toHaveBeenCalledWith('bukhar hai', undefined);
    expect(mockCloud.extractFacts).not.toHaveBeenCalled();
    expect(facts).toHaveLength(1);
  });
});
