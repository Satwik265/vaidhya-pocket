// PHASE1-POCKET
import { describe, it, expect } from 'vitest';
import { StubLLM } from '../llm/stubLLM';
import { runGatedPipeline, gateFacts, parseFacts } from '../llm/gatedPipeline';
import type { LocalLLM } from '../llm/types';

const T = 'Patient reports chest pain with shortness of breath for 2 days. No fever.';

describe('evidence-gated LLM pipeline', () => {
  it('drops fabricated facts: raw rate > 0, gated rate = 0, grounded facts kept', async () => {
    const r = await runGatedPipeline(new StubLLM(2), T);
    expect(r.usedFallback).toBe(false);
    expect(r.dropped.length).toBe(2);
    expect(r.rawFabricationRate).toBeGreaterThan(0);
    expect(r.gatedFabricationRate).toBe(0);
    expect(r.kept.length).toBeGreaterThan(0);
    for (const k of r.kept) expect(T.slice(k.start, k.end)).toBe(k.evidence.length ? T.slice(k.start, k.end) : '');
  });

  it('with zero fabrications nothing is dropped and kept facts are untouched', async () => {
    const r = await runGatedPipeline(new StubLLM(0), T);
    expect(r.dropped).toHaveLength(0);
    expect(r.rawFabricationRate).toBe(0);
  });

  it('paraphrased evidence is dropped (not an exact quote)', () => {
    const g = gateFacts([{ category: 'symptom', concept: 'Chest pain', assertion: 'AFFIRMED', evidence: 'pain in the chest' }], T);
    expect(g.kept).toHaveLength(0);
    expect(g.dropped[0].reason).toBe('evidence_not_in_transcript');
  });

  it('empty and malformed evidence are dropped', () => {
    const g = gateFacts([{ category: 'symptom', concept: 'X', assertion: 'AFFIRMED', evidence: '  ' }, { foo: 1 } as any], T);
    expect(g.kept).toHaveLength(0);
    expect(g.dropped.map((d) => d.reason)).toEqual(['empty_evidence', 'invalid_shape']);
  });

  it('parses fenced JSON and rejects garbage', () => {
    expect(parseFacts('```json\n{"facts":[]}\n```')).toEqual([]);
    expect(parseFacts('not json')).toBeNull();
  });

  it('invalid LLM output twice -> fallback flag, no throw', async () => {
    const bad: LocalLLM = { name: 'bad', backend: 'stub', isAvailable: async () => true, generate: async () => 'nope', stats: () => ({}) };
    const r = await runGatedPipeline(bad, T);
    expect(r.usedFallback).toBe(true);
    expect(r.kept).toHaveLength(0);
  });

  it('unavailable backend -> fallback, never calls generate', async () => {
    let called = false;
    const off: LocalLLM = { name: 'off', backend: 'webllm', isAvailable: async () => false, generate: async () => { called = true; return ''; }, stats: () => ({}) };
    const r = await runGatedPipeline(off, T);
    expect(r.usedFallback).toBe(true);
    expect(called).toBe(false);
  });
});
