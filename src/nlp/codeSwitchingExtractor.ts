/**
 * Code-Switching & Concept Extraction Engine.
 * Extracts canonical clinical concepts across English, Hindi, Marathi, Tamil, Gujarati,
 * Romanized speech, and code-switched Indian dialects.
 */

import symptomsData from '../dictionaries/medical/symptoms.json';
import diseasesData from '../dictionaries/medical/diseases.json';
import investigationsData from '../dictionaries/medical/investigations.json';
import bodyPartsData from '../dictionaries/medical/bodyParts.json';
import emergencyTermsData from '../dictionaries/medical/emergencyTerms.json';
import { normalizeIndianClinicalText, fuzzySimilarity } from './normalizer';
import { evaluateNegationScope, ClinicalAssertion } from './negationScope';
import { extractTemporalExpressions, NormalizedTemporal } from './temporalNormalizer';

export interface ExtractedClinicalConcept {
  conceptId: string;
  category: 'symptom' | 'condition' | 'investigation' | 'anatomy' | 'emergency' | 'medication';
  surfaceText: string;
  language: string;
  source: 'patient_voice' | 'patient_tap' | 'uploaded_document' | 'clinician_entered' | 'system_derived';
  evidence: string;
  confidence: number;
  assertion: ClinicalAssertion;
  temporality?: NormalizedTemporal;
  isRedFlag?: boolean;
}

interface ConceptDictionaryEntry {
  canonicalId: string;
  nameEn: string;
  category?: string;
  isRedFlag?: boolean;
  translations: Record<string, {
    standard: string;
    variants?: string[];
    transliteration?: string;
    asrErrors?: string[];
  }>;
}

// Combine all medical concept dictionaries
const ALL_CONCEPTS: { entry: ConceptDictionaryEntry; category: ExtractedClinicalConcept['category'] }[] = [
  ...(symptomsData as ConceptDictionaryEntry[]).map(e => ({ entry: e, category: 'symptom' as const })),
  ...(diseasesData as ConceptDictionaryEntry[]).map(e => ({ entry: e, category: 'condition' as const })),
  ...(investigationsData as ConceptDictionaryEntry[]).map(e => ({ entry: e, category: 'investigation' as const })),
  ...(bodyPartsData as ConceptDictionaryEntry[]).map(e => ({ entry: e, category: 'anatomy' as const })),
  ...(emergencyTermsData as ConceptDictionaryEntry[]).map(e => ({ entry: e, category: 'emergency' as const })),
];

/**
 * Extracts canonical concepts from multilingual Indian clinical transcripts.
 */
export function extractMultilingualConcepts(
  rawTranscript: string,
  source: ExtractedClinicalConcept['source'] = 'patient_voice',
  primaryLangHint?: string
): ExtractedClinicalConcept[] {
  if (!rawTranscript || !rawTranscript.trim()) {
    return [];
  }

  const { cleaned } = normalizeIndianClinicalText(rawTranscript);
  const temporalList = extractTemporalExpressions(rawTranscript);
  const extracted: ExtractedClinicalConcept[] = [];
  const seenIds = new Set<string>();

  for (const { entry, category } of ALL_CONCEPTS) {
    let bestMatch: {
      surfaceText: string;
      language: string;
      confidence: number;
      evidence: string;
      matchIndex: number;
    } | null = null;

    // Check each language's translations, transliterations, and variants
    for (const [langCode, transData] of Object.entries(entry.translations)) {
      const candidates: { text: string; confidence: number; type: string }[] = [];

      // Standard term
      if (transData.standard) {
        candidates.push({ text: transData.standard, confidence: 0.96, type: 'standard' });
      }

      // Transliterated Romanized term (crucial for code-switching & Romanized speech!)
      if (transData.transliteration) {
        candidates.push({ text: transData.transliteration, confidence: 0.94, type: 'transliteration' });
      }

      // Colloquial & spelling variants
      if (transData.variants) {
        for (const variant of transData.variants) {
          candidates.push({ text: variant, confidence: 0.92, type: 'variant' });
        }
      }

      // Known ASR errors
      if (transData.asrErrors) {
        for (const asrErr of transData.asrErrors) {
          candidates.push({ text: asrErr, confidence: 0.78, type: 'asr_error' });
        }
      }

      for (const candidate of candidates) {
        const normCand = normalizeIndianClinicalText(candidate.text).cleaned;
        if (!normCand || normCand.length < 2) continue;

        let idx = -1;
        let matchedLen = normCand.length;

        // For short acronyms/terms (e.g. "bp", "tb", "dam", "tav"), require whole word match
        if (normCand.length <= 3) {
          const wordRegex = new RegExp(`(^|\\s)(${normCand})(\\s|$)`, 'i');
          const m = cleaned.match(wordRegex);
          if (m && m.index !== undefined) {
            const prefixLen = m[1] ? m[1].length : 0;
            idx = m.index + prefixLen;
            matchedLen = m[2].length;
          }
        } else {
          idx = cleaned.indexOf(normCand);
        }

        if (idx !== -1) {
          if (!bestMatch || candidate.confidence > bestMatch.confidence) {
            const rawMatchedSpan = cleaned.substring(idx, idx + matchedLen);
            bestMatch = {
              surfaceText: rawMatchedSpan || candidate.text,
              language: langCode,
              confidence: candidate.confidence,
              evidence: `Matched ${candidate.type} "${candidate.text}" for ${entry.nameEn}`,
              matchIndex: idx,
            };
          }
        }
      }
    }

    // Direct English name check
    if (!bestMatch && entry.nameEn) {
      const enNorm = normalizeIndianClinicalText(entry.nameEn).cleaned;
      const idx = cleaned.indexOf(enNorm);
      if (idx !== -1) {
        bestMatch = {
          surfaceText: cleaned.substring(idx, idx + enNorm.length) || entry.nameEn,
          language: 'en',
          confidence: 0.95,
          evidence: `Direct English concept name match: "${entry.nameEn}"`,
          matchIndex: idx,
        };
      }
    }

    // Fuzzy matching for slightly noisy Romanized speech (e.g. "chhatit dukhtay" -> "chhatit dukhne")
    if (!bestMatch) {
      for (const [langCode, transData] of Object.entries(entry.translations)) {
        const translit = transData.transliteration;
        if (translit && translit.length > 5) {
          const normTranslit = normalizeIndianClinicalText(translit).cleaned;
          // Compare against n-grams of equal length in cleaned text
          const tWords = normTranslit.split(' ');
          const cWords = cleaned.split(' ');
          if (cWords.length >= tWords.length) {
            for (let i = 0; i <= cWords.length - tWords.length; i++) {
              const windowStr = cWords.slice(i, i + tWords.length).join(' ');
              const sim = fuzzySimilarity(windowStr, normTranslit);
              if (sim >= 0.82) {
                bestMatch = {
                  surfaceText: windowStr,
                  language: langCode,
                  confidence: Math.min(0.85, sim),
                  evidence: `Fuzzy phonetic match (${Math.round(sim * 100)}%): "${windowStr}" ~ "${translit}"`,
                  matchIndex: cleaned.indexOf(windowStr),
                };
                break;
              }
            }
          }
        }
        if (bestMatch) break;
      }
    }

    if (bestMatch && !seenIds.has(entry.canonicalId)) {
      seenIds.add(entry.canonicalId);

      // Evaluate Negation Scope
      const negationResult = evaluateNegationScope(
        rawTranscript,
        bestMatch.surfaceText,
        bestMatch.matchIndex
      );

      extracted.push({
        conceptId: entry.canonicalId,
        category,
        surfaceText: bestMatch.surfaceText,
        language: bestMatch.language,
        source,
        evidence: negationResult.assertion === 'negated'
          ? `${bestMatch.evidence} [NEGATED by "${negationResult.negationTrigger}"]`
          : bestMatch.evidence,
        confidence: bestMatch.confidence,
        assertion: negationResult.assertion,
        temporality: temporalList.length > 0 ? temporalList[0] : undefined,
        isRedFlag: !!entry.isRedFlag,
      });
    }
  }

  return extracted;
}
