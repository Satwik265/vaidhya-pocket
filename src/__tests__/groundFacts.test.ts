// PHASE1-POCKET
import { describe, it, expect } from 'vitest';
import { extractCanonicalFacts } from '../clinical/extractionPipeline';
import { groundFacts, findWordBoundedSpan } from '../pocket/groundFacts';

const run = (t: string) => {
  const facts = extractCanonicalFacts(t, { sourceType: 'PATIENT_TEXT', language: 'hi' });
  return groundFacts(facts, t);
};

describe('verbatim grounding', () => {
  it('every kept fact quotes an exact span of the source', () => {
    const t = 'Mujhe seene mein dard hai aur saans phoolti hai, do din se. Bukhar nahi hai. BP ka problem nahi hai.';
    const { grounded } = run(t);
    expect(grounded.length).toBeGreaterThan(0);
    for (const g of grounded) {
      expect(t.slice(g.span.start, g.span.end)).toBe(g.span.text);
      expect(g.span.text.length).toBeLessThanOrEqual(80);
    }
  });

  it('rejects the partial-word false positive (oolti inside phoolti -> vomiting)', () => {
    const t = 'Mujhe seene mein dard hai aur saans phoolti hai, do din se. Bukhar nahi hai.';
    const { grounded } = run(t);
    expect(grounded.some((g) => g.fact.code === 'SYM_VOMITING')).toBe(false);
    expect(grounded.some((g) => g.fact.code === 'SYM_CHEST_PAIN')).toBe(true);
  });

  it('keeps one fact per concept and does not lose negation of a narrower mention', () => {
    const t = 'Bukhar nahi hai. Sar dard hai.';
    const { grounded } = run(t);
    const fever = grounded.filter((g) => g.fact.code === 'SYM_FEVER');
    expect(fever).toHaveLength(1);
    expect(fever[0].fact.assertion).toBe('NEGATED');
  });

  it('findWordBoundedSpan respects left word boundary only', () => {
    expect(findWordBoundedSpan('phoolti hai', 'oolti')).toBeNull();
    expect(findWordBoundedSpan('saans phoolti hai', 'saans phool')?.text).toBe('saans phool');
  });

  it('anchors generic-name medications by the alias that appears in the text', () => {
    const t = 'Tab. Metformin 500mg BD\nTab. Paracetamol 500mg SOS';
    const { grounded } = run(t);
    const names = grounded.map((g) => g.fact.preferredTerm.toLowerCase());
    expect(names.some((n) => n.includes('paracetamol'))).toBe(true);
    for (const g of grounded) expect(t.slice(g.span.start, g.span.end)).toBe(g.span.text);
  });

  it('returns nothing grounded for empty input', () => {
    expect(run('   ').grounded).toEqual([]);
  });
});
