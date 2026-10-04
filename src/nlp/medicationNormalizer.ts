/**
 * Multilingual Medication Normalization Layer for Indian Healthcare.
 * Maps generic names, brand names, native script terms, transliterated names,
 * and common ASR acoustic misrecognitions to canonical RX concept IDs.
 */

import medicationsData from '../dictionaries/medical/medications.json';
import { normalizeIndianClinicalText, fuzzySimilarity } from './normalizer';

export interface NormalizedMedicationMatch {
  canonicalId: string;
  genericName: string;
  matchedTerm: string;
  surfaceText: string;
  confidence: number;
  requiresConfirmation: boolean;
  evidence: string;
  dosage?: string;
  frequency?: string;
}

interface MedicationEntry {
  canonicalId: string;
  genericName: string;
  commonBrands: string[];
  translations: Record<string, {
    standard: string;
    variants?: string[];
    transliteration?: string;
    asrErrors?: string[];
  }>;
}

const MED_ENTRIES = medicationsData as MedicationEntry[];

/**
 * Extracts and normalizes medications mentioned in a clinical transcript.
 */
export function normalizeMedications(transcript: string): NormalizedMedicationMatch[] {
  if (!transcript) return [];

  const { cleaned } = normalizeIndianClinicalText(transcript);
  const matches: NormalizedMedicationMatch[] = [];
  const seenCanonicalIds = new Set<string>();

  for (const entry of MED_ENTRIES) {
    let bestMatch: {
      term: string;
      confidence: number;
      evidence: string;
      requiresConfirmation: boolean;
    } | null = null;

    // 1. Check generic name
    const genericLower = entry.genericName.toLowerCase();
    if (cleaned.includes(genericLower.split('/')[0].trim().toLowerCase())) {
      bestMatch = {
        term: entry.genericName,
        confidence: 0.96,
        evidence: `Direct match for generic name: ${entry.genericName}`,
        requiresConfirmation: false,
      };
    }

    // 2. Check common Indian brand names (e.g. Crocin, Dolo, Glycomet, Amlong, Augmentin)
    if (!bestMatch) {
      for (const brand of entry.commonBrands) {
        const brandLower = brand.toLowerCase();
        // Look for whole word or exact token match
        const regex = new RegExp(`\\b${brandLower}\\b`, 'i');
        if (regex.test(cleaned) || cleaned.includes(brandLower)) {
          bestMatch = {
            term: brand,
            confidence: 0.94,
            evidence: `Direct match for brand name: ${brand}`,
            requiresConfirmation: false,
          };
          break;
        }
      }
    }

    // 3. Check language translations, transliterations, and variants
    if (!bestMatch) {
      for (const langData of Object.values(entry.translations)) {
        // Standard & transliteration
        const termsToCheck = [
          langData.standard,
          langData.transliteration,
          ...(langData.variants || [])
        ].filter(Boolean) as string[];

        for (const term of termsToCheck) {
          const termClean = term.toLowerCase();
          if (termClean.length > 2 && cleaned.includes(termClean)) {
            bestMatch = {
              term,
              confidence: 0.90,
              evidence: `Matched translation/variant: "${term}"`,
              requiresConfirmation: false,
            };
            break;
          }
        }
        if (bestMatch) break;

        // Common ASR acoustic errors (e.g. "met for men", "meat formin", "amlo dip in")
        if (langData.asrErrors) {
          for (const asrErr of langData.asrErrors) {
            const asrClean = asrErr.toLowerCase();
            if (cleaned.includes(asrClean)) {
              bestMatch = {
                term: asrErr,
                confidence: 0.74, // Lower confidence for ASR typo
                evidence: `Matched known ASR acoustic error: "${asrErr}" -> mapped to ${entry.genericName}`,
                requiresConfirmation: true, // Requires user confirmation!
              };
              break;
            }
          }
        }
        if (bestMatch) break;
      }
    }

    // 4. Fuzzy fallback matching for medication words
    if (!bestMatch) {
      const tokens = cleaned.split(' ');
      for (const token of tokens) {
        if (token.length < 5) continue;
        const brandOrGeneric = [entry.genericName.split('/')[0].trim().toLowerCase(), ...entry.commonBrands.map(b => b.toLowerCase())];
        for (const target of brandOrGeneric) {
          const sim = fuzzySimilarity(token, target);
          if (sim >= 0.82) {
            bestMatch = {
              term: token,
              confidence: Math.min(0.72, sim),
              evidence: `Fuzzy phonetic match (${Math.round(sim * 100)}%): "${token}" for "${target}"`,
              requiresConfirmation: true,
            };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    if (bestMatch && !seenCanonicalIds.has(entry.canonicalId)) {
      seenCanonicalIds.add(entry.canonicalId);
      matches.push({
        canonicalId: entry.canonicalId,
        genericName: entry.genericName,
        matchedTerm: bestMatch.term,
        surfaceText: bestMatch.term,
        confidence: bestMatch.confidence,
        requiresConfirmation: bestMatch.requiresConfirmation,
        evidence: bestMatch.evidence,
      });
    }
  }

  return matches;
}
