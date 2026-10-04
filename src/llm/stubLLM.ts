// PHASE1-POCKET
import type { LocalLLM, LLMStats, LLMProposedFact } from './types';
import { extractCanonicalFacts } from '../clinical/extractionPipeline';
import { findWordBoundedSpan } from '../pocket/groundFacts';

/**
 * Deterministic stand-in for a small LLM. It is NOT a quality benchmark of any real model.
 * It proposes the grounded facts the rule engine finds plus a configurable number of FABRICATED facts
 * (evidence that does not occur in the transcript) so the evidence gate can be exercised and demonstrated.
 */
const FABRICATIONS: LLMProposedFact[] = [
  { category: 'condition', concept: 'Type 2 Diabetes Mellitus', assertion: 'AFFIRMED', evidence: 'patient has diabetes for five years' },
  { category: 'symptom', concept: 'Vomiting', assertion: 'AFFIRMED', evidence: 'she has been vomiting since morning' },
  { category: 'allergy', concept: 'No known drug allergies', assertion: 'NEGATED', evidence: 'no drug allergies' },
  { category: 'vital', concept: 'Temperature 101F', assertion: 'AFFIRMED', evidence: 'temperature 101 degrees' },
];

export class StubLLM implements LocalLLM {
  readonly name: string;
  readonly backend = 'stub' as const;
  private lastStats: LLMStats = {};

  constructor(private fabricatedCount = 2, label = 'stub-llm') {
    this.name = label;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  stats(): LLMStats {
    return this.lastStats;
  }

  async generate(prompt: string): Promise<string> {
    const t0 = performance.now();
    const m = prompt.match(/<transcript>([\s\S]*?)<\/transcript>/);
    const transcript = (m ? m[1] : prompt).trim();
    const facts = extractCanonicalFacts(transcript, { sourceType: 'PATIENT_TEXT', language: 'hi' });
    const proposed: LLMProposedFact[] = [];
    for (const f of facts) {
      const cands = (f.evidence || []).map((e) => (e.text || '').trim()).filter(Boolean);
      for (const c of cands) {
        const quoted = [...c.matchAll(/"([^"]{2,})"/g)].map((x) => x[1])[0] || c;
        const span = findWordBoundedSpan(transcript, quoted);
        if (span && span.text.length <= 80) {
          proposed.push({
            category: String(f.domain).toLowerCase(),
            concept: f.preferredTerm,
            assertion: f.assertion,
            evidence: span.text,
          });
          break;
        }
      }
    }
    const seen = new Set<string>();
    const uniq = proposed.filter((p) => {
      const k = `${p.concept}|${p.assertion}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const fabs = FABRICATIONS.filter((fab) => !transcript.toLowerCase().includes(fab.evidence.toLowerCase())).slice(0, this.fabricatedCount);
    const out = [...uniq, ...fabs];
    const text = JSON.stringify({ facts: out });
    const ms = performance.now() - t0;
    this.lastStats = { totalMs: ms, outputTokens: Math.ceil(text.length / 4), tokensPerSec: undefined, ttftMs: undefined };
    return text;
  }
}
