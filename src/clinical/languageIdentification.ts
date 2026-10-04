/**
 * Sovereign Multilingual Clinical Language Identification Engine (Phase 8C).
 *
 * Provides honest, multi-signal language identification across:
 * - English (en)
 * - Hindi (hi) [Devanagari & Romanized]
 * - Marathi (mr) [Devanagari & Romanized]
 * - Tamil (ta) [Tamil script & Romanized]
 * - Gujarati (gu) [Gujarati script & Romanized]
 *
 * Invariant: Explicitly separates:
 * 1. UI Language (display)
 * 2. Clinical Input Language (detected patient speech/text)
 * 3. ASR Language (recognition bias)
 *
 * Does not claim ML-grade LID if heuristic. Exposes method and honest confidence.
 */

export type SupportedClinicalLanguage = 'en' | 'hi' | 'mr' | 'ta' | 'gu';
export type ScriptCategory = 'Devanagari' | 'Tamil' | 'Gujarati' | 'Latin' | 'Mixed';
export type LIDMethod = 'unicode_script' | 'lexical_heuristic' | 'transliteration' | 'ensemble' | 'prior';

export interface LanguageScore {
  language: SupportedClinicalLanguage;
  confidence: number;
}

export interface ClinicalLanguageIdentificationResult {
  language: SupportedClinicalLanguage;
  locale: string;
  confidence: number;
  method: LIDMethod;
  script: ScriptCategory;
  isCodeSwitched: boolean;
  alternatives: LanguageScore[];
  isLowConfidence: boolean;
}

// Distinctive lexical tokens for Romanized Indic inputs
const ROMANIZED_INDIC_MARKERS: Record<SupportedClinicalLanguage, string[]> = {
  hi: [
    'hai', 'hain', 'mein', 'se', 'ka', 'ki', 'ke', 'mujhe', 'mera', 'meri', 'mere',
    'dard', 'bukhar', 'khansi', 'ho', 'raha', 'rahi', 'rahe', 'nahi', 'nahin', 'bahut',
    'aur', 'lekin', 'kyun', 'kya', 'tha', 'thi', 'hua', 'hui', 'seene', 'sar', 'pet'
  ],
  mr: [
    'ahe', 'ahet', 'mala', 'majha', 'majhi', 'majhe', 'tras', 'khup', 'dukhta', 'dukhtay',
    'hota', 'hoti', 'hote', 'zala', 'zali', 'zale', 'nahi', 'nahit', 'pan', 'aani',
    'pasun', 'chhatit', 'potat', 'divas', 'divasapasun', 'lagla', 'lagli', 'kasa'
  ],
  ta: [
    'irukku', 'enakku', 'ennoda', 'vali', 'kaichal', 'sali', 'romba', 'illai', 'aanaal',
    'varuthu', 'mudhal', 'naala', 'natkal', 'irunthathu', 'thinarel', 'marumozhi', 'mathirai',
    'sapten', 'eduthen', 'nenjil', 'vayitril', 'oru'
  ],
  gu: [
    'che', 'mane', 'maro', 'mari', 'maru', 'dukhe', 'dukhavo', 'taav', 'khansi', 'bahut',
    'nathi', 'pan', 'ane', 'thi', 'pachhi', 'divas', 'chhatima', 'petma', 'lage',
    'thayu', 'thayel', 'hato', 'hati'
  ],
  en: [
    'the', 'and', 'is', 'in', 'of', 'for', 'with', 'to', 'at', 'from', 'pain',
    'fever', 'cough', 'severe', 'since', 'days', 'have', 'having', 'chest', 'head', 'stomach',
    'doctor', 'hospital', 'taking', 'problem', 'blood', 'pressure'
  ]
};

// High-precision Devanagari discriminant sets for Hindi vs Marathi
const DEVANAGARI_HINDI_DISCRIMINANTS = new Set([
  'है', 'हैं', 'में', 'से', 'का', 'की', 'के', 'मुझे', 'दर्द', 'बुखार', 'खांसी', 'रहा', 'रही', 'नहीं', 'बहुत', 'था', 'थी', 'और', 'लेकिन'
]);

const DEVANAGARI_MARATHI_DISCRIMINANTS = new Set([
  'आहे', 'आहेत', 'मला', 'माझा', 'माझी', 'त्रास', 'खूप', 'दुखत', 'दुखते', 'झाला', 'झाली', 'झाले', 'नाही', 'नाहीत', 'आणि', 'पण', 'पासून', 'दिवस'
]);

const LANGUAGE_TO_LOCALE: Record<SupportedClinicalLanguage, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
};

/**
 * Normalizes input text and detects Unicode script ranges.
 */
function analyzeScripts(text: string): {
  hasDevanagari: boolean;
  hasTamil: boolean;
  hasGujarati: boolean;
  hasLatin: boolean;
  script: ScriptCategory;
  tokens: string[];
} {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasTamil = /[\u0B80-\u0BFF]/.test(text);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  const scriptCount = (hasDevanagari ? 1 : 0) + (hasTamil ? 1 : 0) + (hasGujarati ? 1 : 0) + (hasLatin ? 1 : 0);
  let script: ScriptCategory = 'Latin';

  if (scriptCount > 1) {
    script = 'Mixed';
  } else if (hasTamil) {
    script = 'Tamil';
  } else if (hasGujarati) {
    script = 'Gujarati';
  } else if (hasDevanagari) {
    script = 'Devanagari';
  }

  // Tokenize cleanly
  const tokens = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'–—]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return {
    hasDevanagari,
    hasTamil,
    hasGujarati,
    hasLatin,
    script,
    tokens,
  };
}

/**
 * Identifies the clinical language of a patient or clinician input.
 */
export function identifyClinicalLanguage(
  input: string,
  priorHint?: SupportedClinicalLanguage
): ClinicalLanguageIdentificationResult {
  if (!input || !input.trim()) {
    const fallbackLang = priorHint || 'hi';
    return {
      language: fallbackLang,
      locale: LANGUAGE_TO_LOCALE[fallbackLang],
      confidence: 0.5,
      method: 'prior',
      script: 'Latin',
      isCodeSwitched: false,
      alternatives: [],
      isLowConfidence: true,
    };
  }

  const { hasDevanagari, hasTamil, hasGujarati, hasLatin, script, tokens } = analyzeScripts(input);

  // 1. Native Script: Tamil is unambiguous
  if (hasTamil && !hasDevanagari && !hasGujarati) {
    const isCodeSwitched = hasLatin;
    return {
      language: 'ta',
      locale: LANGUAGE_TO_LOCALE['ta'],
      confidence: 0.98,
      method: 'unicode_script',
      script,
      isCodeSwitched,
      alternatives: [{ language: 'en', confidence: isCodeSwitched ? 0.4 : 0.05 }],
      isLowConfidence: false,
    };
  }

  // 2. Native Script: Gujarati is unambiguous
  if (hasGujarati && !hasDevanagari && !hasTamil) {
    const isCodeSwitched = hasLatin;
    return {
      language: 'gu',
      locale: LANGUAGE_TO_LOCALE['gu'],
      confidence: 0.98,
      method: 'unicode_script',
      script,
      isCodeSwitched,
      alternatives: [{ language: 'en', confidence: isCodeSwitched ? 0.4 : 0.05 }],
      isLowConfidence: false,
    };
  }

  // 3. Native Script: Devanagari (Disambiguate Hindi vs Marathi)
  if (hasDevanagari) {
    let hiHits = 0;
    let mrHits = 0;
    for (const t of tokens) {
      if (DEVANAGARI_HINDI_DISCRIMINANTS.has(t)) hiHits++;
      if (DEVANAGARI_MARATHI_DISCRIMINANTS.has(t)) mrHits++;
    }

    const isCodeSwitched = hasLatin;
    const selectedLang: SupportedClinicalLanguage = mrHits > hiHits ? 'mr' : 'hi';
    const otherLang: SupportedClinicalLanguage = selectedLang === 'mr' ? 'hi' : 'mr';
    const confidence = mrHits === 0 && hiHits === 0 ? 0.85 : 0.95;

    return {
      language: selectedLang,
      locale: LANGUAGE_TO_LOCALE[selectedLang],
      confidence,
      method: mrHits > 0 || hiHits > 0 ? 'ensemble' : 'unicode_script',
      script,
      isCodeSwitched,
      alternatives: [
        { language: otherLang, confidence: 0.2 },
        { language: 'en', confidence: isCodeSwitched ? 0.35 : 0.05 },
      ],
      isLowConfidence: false,
    };
  }

  // 4. Romanized / Latin Script: Multi-signal Lexical Matching
  const scores: Record<SupportedClinicalLanguage, number> = {
    en: 0,
    hi: 0,
    mr: 0,
    ta: 0,
    gu: 0,
  };

  const langs: SupportedClinicalLanguage[] = ['en', 'hi', 'mr', 'ta', 'gu'];
  for (const l of langs) {
    const markers = ROMANIZED_INDIC_MARKERS[l];
    let hits = 0;
    for (const t of tokens) {
      if (markers.includes(t)) {
        hits++;
      }
    }
    scores[l] = tokens.length > 0 ? hits / tokens.length : 0;
  }

  // Apply prior bias if given
  if (priorHint && scores[priorHint] !== undefined) {
    scores[priorHint] += 0.15;
  }

  // Check code-switching (English medical terms inside Indic sentence)
  const englishMedical = ['pain', 'chest', 'fever', 'cough', 'headache', 'bp', 'sugar', 'doctor', 'tablet', 'vomiting'];
  const hasMedical = tokens.some((t) => englishMedical.includes(t));
  const hasIndicTokens = scores.hi > 0 || scores.mr > 0 || scores.ta > 0 || scores.gu > 0;
  const isCodeSwitched = hasMedical && hasIndicTokens;

  // Rank languages
  const ranked = langs
    .map((l) => ({ language: l, score: scores[l] }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];

  let selectedLang: SupportedClinicalLanguage = 'en';
  let confidence = 0.6;
  let method: LIDMethod = 'lexical_heuristic';

  if (top.score > 0.1) {
    selectedLang = top.language;
    confidence = Math.min(0.92, 0.65 + (top.score - second.score) * 0.5);
  } else if (priorHint) {
    selectedLang = priorHint;
    confidence = 0.65;
    method = 'prior';
  }

  const isLowConfidence = confidence < 0.65;

  const alternatives: LanguageScore[] = ranked
    .slice(1)
    .filter((r) => r.score > 0.05)
    .map((r) => ({ language: r.language, confidence: parseFloat(r.score.toFixed(2)) }));

  return {
    language: selectedLang,
    locale: LANGUAGE_TO_LOCALE[selectedLang],
    confidence: parseFloat(confidence.toFixed(2)),
    method,
    script,
    isCodeSwitched,
    alternatives,
    isLowConfidence,
  };
}
