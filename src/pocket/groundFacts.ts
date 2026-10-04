// PHASE1-POCKET
/**
 * Verbatim grounding layer.
 *
 * The legacy extractor emits facts whose `evidence` is sometimes a whole sentence or a descriptive string
 * ("Matched variant ... for ...") rather than the patient's own words, and a partial-word match can create
 * a false fact (for example "oolti" inside "phoolti" -> vomiting). This layer re-anchors every fact to an
 * exact, word-bounded span of the SOURCE text and rejects anything it cannot anchor.
 */
import type { ClinicalFact } from '../clinical/clinicalFactModel';

export interface Span {
  start: number;
  end: number;
  text: string;
}

export interface GroundedFact {
  fact: ClinicalFact;
  span: Span;
  /** True when the same concept was both affirmed and negated and could not be resolved. */
  conflict: boolean;
}

export interface RejectedFact {
  fact: ClinicalFact;
  reason: 'no_verbatim_anchor' | 'partial_word_match' | 'span_too_broad' | 'conflicts_with_narrower_mention' | 'duplicate';
}

export interface GroundingResult {
  grounded: GroundedFact[];
  rejected: RejectedFact[];
}

const MAX_SPAN_CHARS = 80;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function candidates(fact: ClinicalFact): string[] {
  const out: string[] = [];
  for (const e of fact.evidence || []) {
    const t = (e.text || e.verbatimText || '').trim();
    if (!t) continue;
    const quoted = [...t.matchAll(/"([^"]{2,})"/g)].map((m) => m[1]);
    if (quoted.length) out.push(...quoted);
    else out.push(t);
  }
  // Generic-name aliases ("Paracetamol / Acetaminophen") are anchored by whichever alias actually appears
  // in the source. The span is still an exact quote, so nothing can be invented this way.
  const dom = String(fact.domain).toLowerCase();
  if (dom === 'medication' || dom === 'allergy') {
    for (const part of String(fact.preferredTerm || '').split('/').map((x) => x.trim())) if (part.length >= 4) out.push(part);
  }
  return out;
}

/** Left boundary strict (kills "oolti" inside "phoolti"); right boundary relaxed so stems still match. */
export function findWordBoundedSpan(source: string, phrase: string): Span | null {
  const p = phrase.trim();
  if (p.length < 2) return null;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(p)}`, 'iu');
  const m = re.exec(source);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, text: source.slice(m.index, m.index + m[0].length) };
}

function anyIndexOf(source: string, phrase: string): boolean {
  return source.toLowerCase().includes(phrase.trim().toLowerCase());
}

export function groundFacts(facts: ClinicalFact[], source: string): GroundingResult {
  const rejected: RejectedFact[] = [];
  const anchored: GroundedFact[] = [];

  for (const fact of facts) {
    const cands = candidates(fact);
    let best: Span | null = null;
    let sawPartial = false;
    let sawBroad = false;
    for (const c of cands) {
      const span = findWordBoundedSpan(source, c);
      if (!span) {
        if (anyIndexOf(source, c)) sawPartial = true;
        continue;
      }
      if (span.text.length > MAX_SPAN_CHARS) {
        sawBroad = true;
        continue;
      }
      if (!best || span.text.length < best.text.length) best = span;
    }
    if (best) anchored.push({ fact, span: best, conflict: false });
    else
      rejected.push({
        fact,
        reason: sawBroad ? 'span_too_broad' : sawPartial ? 'partial_word_match' : 'no_verbatim_anchor',
      });
  }

  // Resolve per-concept: duplicates and assertion conflicts.
  const byCode = new Map<string, GroundedFact[]>();
  for (const g of anchored) {
    const k = `${g.fact.domain.toString().toLowerCase()}|${g.fact.code}`;
    byCode.set(k, [...(byCode.get(k) || []), g]);
  }

  const grounded: GroundedFact[] = [];
  for (const group of byCode.values()) {
    const affirmed = group.filter((g) => g.fact.assertion === 'AFFIRMED');
    const negated = group.filter((g) => g.fact.assertion === 'NEGATED');
    const others = group.filter((g) => g.fact.assertion !== 'AFFIRMED' && g.fact.assertion !== 'NEGATED');
    const pickNarrowest = (arr: GroundedFact[]) => arr.slice().sort((a, b) => a.span.text.length - b.span.text.length)[0];

    const keep: GroundedFact[] = [];
    if (affirmed.length && negated.length) {
      const a = pickNarrowest(affirmed);
      const n = pickNarrowest(negated);
      if (n.span.text.length < a.span.text.length * 0.6) {
        keep.push(n);
        rejected.push({ fact: a.fact, reason: 'conflicts_with_narrower_mention' });
      } else if (a.span.text.length < n.span.text.length * 0.6) {
        keep.push(a);
        rejected.push({ fact: n.fact, reason: 'conflicts_with_narrower_mention' });
      } else {
        // Unresolvable: keep the affirmed one (safer for triage) and flag it for the clinician.
        keep.push({ ...a, conflict: true });
        rejected.push({ fact: n.fact, reason: 'conflicts_with_narrower_mention' });
      }
    } else if (affirmed.length) keep.push(pickNarrowest(affirmed));
    else if (negated.length) keep.push(pickNarrowest(negated));
    if (others.length) keep.push(pickNarrowest(others));

    const keptSet = new Set(keep.map((k) => k.fact));
    for (const g of group) {
      if (!keptSet.has(g.fact) && !rejected.some((r) => r.fact === g.fact)) rejected.push({ fact: g.fact, reason: 'duplicate' });
    }
    grounded.push(...keep);
  }

  grounded.sort((a, b) => a.span.start - b.span.start);
  return { grounded, rejected };
}
