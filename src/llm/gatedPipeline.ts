// PHASE1-POCKET
import type { LocalLLM, GatedResult, LLMProposedFact } from './types';
import { findWordBoundedSpan } from '../pocket/groundFacts';

export const FACT_PROMPT = (transcript: string) => `You are a clinical documentation assistant. Extract clinical facts from the transcript.
Rules: use ONLY what is written. For each fact return the exact words from the transcript as "evidence" (copy-paste, no paraphrase).
Return JSON only: {"facts":[{"category":"symptom|condition|medication|allergy|vital|investigation","concept":"...","assertion":"AFFIRMED|NEGATED|SUSPECTED","evidence":"exact words"}]}
<transcript>${transcript}</transcript>`;

export function parseFacts(raw: string): LLMProposedFact[] | null {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try {
    const obj = JSON.parse(s.slice(a, b + 1));
    if (!obj || !Array.isArray(obj.facts)) return null;
    return obj.facts;
  } catch {
    return null;
  }
}

/** Pure gate: keeps a proposed fact only if its evidence is a verbatim, word-bounded span of the transcript. */
export function gateFacts(proposed: LLMProposedFact[], transcript: string): Pick<GatedResult, 'kept' | 'dropped' | 'rawFabricationRate' | 'gatedFabricationRate' | 'proposedCount'> {
  const kept: GatedResult['kept'] = [];
  const dropped: GatedResult['dropped'] = [];
  for (const f of proposed) {
    if (!f || typeof f.concept !== 'string' || typeof f.evidence !== 'string') {
      dropped.push({ fact: f as LLMProposedFact, reason: 'invalid_shape' });
      continue;
    }
    if (!f.evidence.trim()) {
      dropped.push({ fact: f, reason: 'empty_evidence' });
      continue;
    }
    const span = findWordBoundedSpan(transcript, f.evidence);
    if (!span) dropped.push({ fact: f, reason: 'evidence_not_in_transcript' });
    else kept.push({ ...f, start: span.start, end: span.end });
  }
  const n = proposed.length;
  const stillBad = kept.filter((k) => !findWordBoundedSpan(transcript, k.evidence)).length;
  return {
    kept,
    dropped,
    proposedCount: n,
    rawFabricationRate: n === 0 ? 0 : dropped.length / n,
    gatedFabricationRate: kept.length === 0 ? 0 : stillBad / kept.length,
  };
}

export async function runGatedPipeline(llm: LocalLLM, transcript: string): Promise<GatedResult> {
  const empty = (usedFallback: boolean): GatedResult => ({
    kept: [], dropped: [], rawFabricationRate: 0, gatedFabricationRate: 0, proposedCount: 0,
    usedFallback, llmName: llm.name, llmStats: llm.stats(),
  });
  if (!(await llm.isAvailable())) return empty(true);

  let proposed: LLMProposedFact[] | null = null;
  for (let attempt = 0; attempt < 2 && !proposed; attempt++) {
    const raw = await llm.generate(FACT_PROMPT(transcript), { maxTokens: 512, temperature: 0.1 });
    proposed = parseFacts(raw);
  }
  if (!proposed) return empty(true); // caller falls back to the deterministic extractor

  const g = gateFacts(proposed, transcript);
  return { ...g, usedFallback: false, llmName: llm.name, llmStats: llm.stats() };
}
