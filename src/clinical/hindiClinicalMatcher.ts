/**
 * hindiClinicalMatcher.ts
 *
 * Offline-first Hindi clinical concept matcher.
 *
 * Design goals:
 * - Zero network dependency — runs entirely client-side against bundled JSON.
 * - Zero new npm dependency — plain TypeScript string matching + a small
 *   hand-rolled Levenshtein distance for ASR-typo tolerance.
 * - Data-driven: all clinical knowledge lives in the JSON dictionaries
 *   (hindi_symptoms.json, hindi_negation.json, hindi_temporal.json).
 *   This file contains ONLY generic matching logic — it should not need to
 *   change when the dictionary grows from 35 concepts to 350.
 *
 * IMPORTANT SAFETY NOTE:
 * This is a keyword/fuzzy-match layer, not a diagnostic system. It never
 * infers a diagnosis — it only extracts what the patient said, with the
 * original evidence text attached, so a clinician can verify every
 * extracted fact against the raw transcript.
 */

// ---------- Types ----------

export interface ClinicalConcept {
  conceptId: string;
  category: 'symptom' | 'condition';
  canonicalEnglish: string;
  devanagari: string[];
  romanized: string[];
  colloquial: string[];
  asrVariants: string[];
  requiresFollowUp?: boolean;
  relatedConcepts: string[];
}

export type Assertion = 'present' | 'negated' | 'uncertain';

export interface ExtractedFact {
  conceptId: string;
  canonicalEnglish: string;
  category: string;
  assertion: Assertion;
  matchType: 'exact' | 'fuzzy';
  matchedPhrase: string;
  evidence: string; // the original sentence/segment the match came from
  confidence: number; // 0-1, heuristic — NOT a clinical accuracy score
  source: 'offline_local';
}

export interface TemporalExpression {
  value: number | null;
  unit: 'days' | 'weeks' | 'months' | 'years' | null;
  evidence: string;
}

// ---------- Normalization ----------

/**
 * Normalizes text for matching: Unicode NFC normalization, lowercasing
 * (safe no-op on Devanagari), punctuation stripping, whitespace collapse.
 * Deliberately does NOT strip Devanagari matras/diacritics — over-stripping
 * script marks can merge distinct words in Devanagari.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.,!?;:()"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits normalized text into simple word tokens (space-delimited). */
export function tokenize(input: string): string[] {
  return normalizeText(input).split(' ').filter(Boolean);
}

// ---------- Fuzzy matching (Levenshtein) ----------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/** Normalized similarity in [0,1], 1 = identical. */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// ---------- Concept matching ----------

const FUZZY_THRESHOLD = 0.82; // tune against real transcripts before trusting in production

function allSurfaceForms(concept: ClinicalConcept): { phrase: string; isDevanagari: boolean }[] {
  const forms: { phrase: string; isDevanagari: boolean }[] = [];
  for (const p of concept.devanagari) forms.push({ phrase: normalizeText(p), isDevanagari: true });
  for (const p of concept.romanized) forms.push({ phrase: normalizeText(p), isDevanagari: false });
  for (const p of concept.colloquial) forms.push({ phrase: normalizeText(p), isDevanagari: /[\u0900-\u097F]/.test(p) });
  for (const p of concept.asrVariants) forms.push({ phrase: normalizeText(p), isDevanagari: /[\u0900-\u097F]/.test(p) });
  return forms;
}

/**
 * Finds concept matches in a transcript segment.
 * Strategy: exact substring match first (cheap, high confidence);
 * falls back to per-token fuzzy match against short surface forms only
 * (fuzzy matching long phrases is unreliable and slow — skip it).
 */
export function matchConcepts(
  transcript: string,
  dictionary: ClinicalConcept[]
): ExtractedFact[] {
  const normalizedTranscript = normalizeText(transcript);
  const tokens = tokenize(transcript);
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  for (const concept of dictionary) {
    const forms = allSurfaceForms(concept);
    let bestMatch: { phrase: string; type: 'exact' | 'fuzzy'; confidence: number } | null = null;

    // Exact substring match
    for (const { phrase } of forms) {
      if (phrase.length >= 2 && normalizedTranscript.includes(phrase)) {
        bestMatch = { phrase, type: 'exact', confidence: 0.95 };
        break;
      }
    }

    // Fuzzy fallback — handles 1, 2, and 3-word surface forms, matched
    // against sliding token windows of the transcript (size = wordCount).
    if (!bestMatch) {
      for (const { phrase } of forms) {
        const wordCount = phrase.split(' ').length;
        if (wordCount > 4) continue; // skip long phrases (>4 words) for fuzzy pass
        for (let i = 0; i <= tokens.length - wordCount; i++) {
          const windowText = tokens.slice(i, i + wordCount).join(' ');
          const sim = similarity(phrase, windowText);
          if (sim >= FUZZY_THRESHOLD) {
            const confidence = 0.6 + (sim - FUZZY_THRESHOLD) * 2; // ~0.6-0.9
            if (!bestMatch || confidence > bestMatch.confidence) {
              bestMatch = { phrase: windowText, type: 'fuzzy', confidence: Math.min(confidence, 0.9) };
            }
          }
        }
      }
    }

    if (bestMatch && !seen.has(concept.conceptId)) {
      seen.add(concept.conceptId);
      facts.push({
        conceptId: concept.conceptId,
        canonicalEnglish: concept.canonicalEnglish,
        category: concept.category,
        assertion: 'present', // negation applied in a second pass — see applyNegation()
        matchType: bestMatch.type,
        matchedPhrase: bestMatch.phrase,
        evidence: transcript,
        confidence: bestMatch.confidence,
        source: 'offline_local',
      });
    }
  }

  return facts;
}

// ---------- Negation ----------

interface NegationDict {
  negationTriggers: { devanagari: string[]; romanized: string[]; asrVariants: string[] };
}

/**
 * Applies negation to already-extracted facts using a small token-window
 * heuristic: if a negation trigger appears within `windowSize` tokens AFTER
 * (or immediately before) the matched phrase's position in the transcript, mark the fact negated.
 * Always keep `evidence` so a clinician can verify.
 */
export function applyNegation(
  facts: ExtractedFact[],
  transcript: string,
  negationDict: NegationDict,
  windowSize = 4
): ExtractedFact[] {
  const tokens = tokenize(transcript);
  const triggers = new Set(
    [
      ...negationDict.negationTriggers.devanagari,
      ...negationDict.negationTriggers.romanized,
      ...negationDict.negationTriggers.asrVariants,
    ].map(normalizeText)
  );

  return facts.map((fact) => {
    const matchedTokens = tokenize(fact.matchedPhrase);
    let matchStartIndex = -1;
    let matchEndIndex = -1;

    // 1. Locate the matched token sequence in tokens
    for (let i = 0; i <= tokens.length - matchedTokens.length; i++) {
      let isMatch = true;
      for (let j = 0; j < matchedTokens.length; j++) {
        if (tokens[i + j] !== matchedTokens[j] && similarity(tokens[i + j], matchedTokens[j]) < 0.75) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        matchStartIndex = i;
        matchEndIndex = i + matchedTokens.length;
        break;
      }
    }

    // 2. Fallback: match by significant token (length >= 3)
    if (matchStartIndex === -1) {
      for (const mt of matchedTokens) {
        if (mt.length >= 3) {
          const idx = tokens.findIndex((t) => t === mt || similarity(t, mt) >= 0.82);
          if (idx !== -1) {
            matchStartIndex = idx;
            matchEndIndex = idx + 1;
            break;
          }
        }
      }
    }

    if (matchStartIndex === -1) {
      // If concept phrase itself contains negation trigger (e.g. "BP ka problem nahi hai")
      const selfNegated = matchedTokens.some((t) => triggers.has(t) || ['nahi', 'nahin', 'nhi', 'nai'].includes(t));
      return selfNegated ? { ...fact, assertion: 'negated' as Assertion } : fact;
    }

    // Check tokens within the matched phrase, immediately after, and shortly before
    const windowEnd = Math.min(tokens.length, matchEndIndex + windowSize);
    const windowTokensAfter = tokens.slice(matchEndIndex, windowEnd);
    const windowTokensBefore = tokens.slice(Math.max(0, matchStartIndex - 2), matchStartIndex);

    const checkTokens = [...matchedTokens, ...windowTokensBefore, ...windowTokensAfter];
    const negated = checkTokens.some((t) => triggers.has(t) || ['nahi', 'nahin', 'nhi', 'nai'].includes(t));

    return negated ? { ...fact, assertion: 'negated' as Assertion } : fact;
  });
}

// ---------- Temporal extraction ----------

interface TemporalDict {
  relativeTerms: { romanized: string; devanagari: string; meaning: string; days: number | null }[];
  unitWords: Record<string, { devanagari: string[]; romanized: string[]; unit: string }>;
}

const HINDI_NUMBER_WORDS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, char: 4, panch: 5, che: 6, saat: 7, aath: 8, nau: 9, das: 10,
};

/**
 * Extracts a temporal expression (duration since symptom onset) from a
 * transcript segment. Returns the first match found; does not attempt to
 * resolve multiple durations in one segment.
 */
export function extractTemporal(transcript: string, temporalDict: TemporalDict): TemporalExpression | null {
  const normalized = normalizeText(transcript);

  // Fixed relative terms first (kal se, bachpan se, etc.)
  for (const term of temporalDict.relativeTerms) {
    if (normalized.includes(normalizeText(term.romanized)) || normalized.includes(normalizeText(term.devanagari))) {
      return {
        value: term.days,
        unit: term.days !== null ? 'days' : null,
        evidence: transcript,
      };
    }
  }

  // "<number> <unit> se" pattern, numeric digits
  const numericPattern = /(\d+)\s*(din|dino|hafta|hafte|hafton|hafto|mahina|mahine|mahino|saal|saalon)\s*se/;
  const numMatch = normalized.match(numericPattern);
  if (numMatch) {
    const value = parseInt(numMatch[1], 10);
    const unit = resolveUnit(numMatch[2], temporalDict);
    return { value, unit, evidence: transcript };
  }

  // "<word-number> <unit> se" pattern, e.g. "teen din se"
  const words = normalized.split(' ');
  for (let i = 0; i < words.length - 2; i++) {
    const numWord = words[i];
    const unitWord = words[i + 1];
    const seWord = words[i + 2];
    if (HINDI_NUMBER_WORDS[numWord] !== undefined && seWord === 'se') {
      const unit = resolveUnit(unitWord, temporalDict);
      if (unit) {
        return { value: HINDI_NUMBER_WORDS[numWord], unit, evidence: transcript };
      }
    }
  }

  return null;
}

function resolveUnit(word: string, temporalDict: TemporalDict): TemporalExpression['unit'] {
  for (const key of Object.keys(temporalDict.unitWords)) {
    const entry = temporalDict.unitWords[key];
    if (entry.romanized.includes(word) || entry.devanagari.includes(word)) {
      return entry.unit as TemporalExpression['unit'];
    }
  }
  return null;
}

// ---------- Top-level entry point ----------

export interface HindiAnalysisResult {
  facts: ExtractedFact[];
  temporal: TemporalExpression | null;
  rawTranscript: string;
}

export function analyzeHindiTranscript(
  transcript: string,
  dictionary: ClinicalConcept[],
  negationDict: NegationDict,
  temporalDict: TemporalDict
): HindiAnalysisResult {
  const rawFacts = matchConcepts(transcript, dictionary);
  const facts = applyNegation(rawFacts, transcript, negationDict);
  const temporal = extractTemporal(transcript, temporalDict);

  return { facts, temporal, rawTranscript: transcript };
}
