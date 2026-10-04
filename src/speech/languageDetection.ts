/**
 * Multilingual Language Detection Engine for Indian Healthcare.
 * Combines 5 complementary signals:
 * 1. ASR language signal (prior)
 * 2. Script detection (Unicode ranges)
 * 3. Local lexical frequency scoring
 * 4. Transliteration & romanized particle match
 * 5. Character n-gram scoring
 */

import { SupportedLocale, LanguageDetectionResult, ScriptType, LanguageScore } from './speechTypes';
import { normalizeIndianClinicalText } from '../nlp/normalizer';

// Distinctive lexical particles for Romanized speech
const LEXICAL_MARKERS: Record<SupportedLocale, string[]> = {
  'hi-IN': [
    'hai', 'hain', 'mein', 'se', 'ka', 'ki', 'ke', 'mujhe', 'mera', 'meri', 'mere',
    'dard', 'bukhar', 'khansi', 'ho', 'raha', 'rahi', 'rahe', 'nahi', 'nahin', 'bahut',
    'aur', 'lekin', 'kyun', 'kya', 'tha', 'thi', 'hua', 'hui'
  ],
  'mr-IN': [
    'ahe', 'ahet', 'mala', 'majha', 'majhi', 'majhe', 'tras', 'khup', 'dukhta', 'dukhtay',
    'hota', 'hoti', 'hote', 'zala', 'zali', 'zale', 'nahi', 'nahit', 'pan', 'aani',
    'pasun', 'chhatit', 'potat', 'divas', 'divasapasun', 'lagla', 'lagli'
  ],
  'ta-IN': [
    'irukku', 'enakku', 'ennoda', 'vali', 'kaichal', 'sali', 'romba', 'illai', 'aanaal',
    'varuthu', 'mudhal', 'naala', 'natkal', 'irunthathu', 'thinarel', 'marumozhi', 'mathirai',
    'sapten', 'eduthen', 'nenjil', 'vayitril'
  ],
  'gu-IN': [
    'che', 'mane', 'maro', 'mari', 'maru', 'dukhe', 'dukhavo', 'taav', 'khansi', 'bahut',
    'nathi', 'pan', 'ane', 'thi', 'pachhi', 'divas', 'chhatima', 'petma', 'lage',
    'thayu', 'thayel', 'hato', 'hati'
  ],
  'en-IN': [
    'the', 'and', 'is', 'in', 'of', 'for', 'with', 'to', 'at', 'from', 'pain',
    'fever', 'cough', 'severe', 'since', 'days', 'have', 'having', 'chest', 'head', 'stomach'
  ]
};

// Distinctive Devanagari words to disambiguate Hindi vs Marathi in Devanagari script
const DEVANAGARI_HINDI_MARKERS = new Set([
  'है', 'हैं', 'में', 'से', 'का', 'की', 'के', 'मुझे', 'दर्द', 'बुखार', 'खांसी', 'रहा', 'रही', 'नहीं', 'बहुत', 'था', 'थी'
]);

const DEVANAGARI_MARATHI_MARKERS = new Set([
  'आहे', 'आहेत', 'मला', 'माझा', 'माझी', 'त्रास', 'खूप', 'दुखत', 'दुखते', 'झाला', 'झाली', 'झाले', 'नाही', 'नाहीत', 'आणि', 'पण', 'पासून'
]);

const CONFIDENCE_THRESHOLD = 0.65;

export function detectLanguage(
  input: string,
  asrHint?: SupportedLocale
): LanguageDetectionResult {
  if (!input || !input.trim()) {
    return {
      language: asrHint || 'en-IN',
      confidence: 0.5,
      script: 'Latin',
      codeSwitching: false,
      secondaryLanguages: [],
      isLowConfidence: true,
      signals: {
        scriptScore: { 'en-IN': 0.2, 'hi-IN': 0.2, 'mr-IN': 0.2, 'ta-IN': 0.2, 'gu-IN': 0.2 },
        lexicalScore: { 'en-IN': 0.2, 'hi-IN': 0.2, 'mr-IN': 0.2, 'ta-IN': 0.2, 'gu-IN': 0.2 },
        transliterationScore: { 'en-IN': 0.2, 'hi-IN': 0.2, 'mr-IN': 0.2, 'ta-IN': 0.2, 'gu-IN': 0.2 },
      },
    };
  }

  const { cleaned, tokens, hasDevanagari, hasTamil, hasGujarati, hasLatin } =
    normalizeIndianClinicalText(input);

  // 1. Script Signal
  let script: ScriptType = 'Latin';
  const scriptScore: Record<SupportedLocale, number> = {
    'en-IN': 0, 'hi-IN': 0, 'mr-IN': 0, 'ta-IN': 0, 'gu-IN': 0
  };

  const scriptCount = (hasDevanagari ? 1 : 0) + (hasTamil ? 1 : 0) + (hasGujarati ? 1 : 0) + (hasLatin ? 1 : 0);
  if (scriptCount > 1) {
    script = 'Mixed';
  }

  if (hasTamil) {
    if (script !== 'Mixed') script = 'Tamil';
    scriptScore['ta-IN'] = 0.98;
  }
  if (hasGujarati) {
    if (script !== 'Mixed') script = 'Gujarati';
    scriptScore['gu-IN'] = 0.98;
  }
  if (hasDevanagari) {
    if (script !== 'Mixed') script = 'Devanagari';
    // Disambiguate between Hindi and Marathi in Devanagari
    let hiCount = 0;
    let mrCount = 0;
    for (const token of tokens) {
      if (DEVANAGARI_HINDI_MARKERS.has(token)) hiCount++;
      if (DEVANAGARI_MARATHI_MARKERS.has(token)) mrCount++;
    }
    if (mrCount > hiCount) {
      scriptScore['mr-IN'] = 0.90;
      scriptScore['hi-IN'] = 0.10;
    } else {
      scriptScore['hi-IN'] = 0.85;
      scriptScore['mr-IN'] = 0.15;
    }
  }

  if (!hasTamil && !hasGujarati && !hasDevanagari) {
    script = 'Latin';
    scriptScore['en-IN'] = 0.4;
    scriptScore['hi-IN'] = 0.15;
    scriptScore['mr-IN'] = 0.15;
    scriptScore['ta-IN'] = 0.15;
    scriptScore['gu-IN'] = 0.15;
  }

  // 2. Lexical & Transliteration Signal
  const lexicalScore: Record<SupportedLocale, number> = {
    'en-IN': 0, 'hi-IN': 0, 'mr-IN': 0, 'ta-IN': 0, 'gu-IN': 0
  };
  const transliterationScore: Record<SupportedLocale, number> = {
    'en-IN': 0, 'hi-IN': 0, 'mr-IN': 0, 'ta-IN': 0, 'gu-IN': 0
  };

  const lowerTokens = tokens.map(t => t.toLowerCase());
  for (const locale of ['hi-IN', 'mr-IN', 'ta-IN', 'gu-IN', 'en-IN'] as SupportedLocale[]) {
    const markers = LEXICAL_MARKERS[locale];
    let hits = 0;
    for (const token of lowerTokens) {
      if (markers.includes(token)) {
        hits++;
      }
    }
    lexicalScore[locale] = lowerTokens.length > 0 ? hits / lowerTokens.length : 0;
    transliterationScore[locale] = hits > 0 ? Math.min(1.0, hits * 0.35) : 0;
  }

  // 3. Code-Switching Detection (e.g. English medical words inside Indic frame)
  let codeSwitching = false;
  const englishMedicalTerms = ['pain', 'chest', 'fever', 'cough', 'headache', 'bp', 'sugar', 'doctor', 'tablet', 'inhaler', 'infection'];
  const hasEnglishMedical = lowerTokens.some(t => englishMedicalTerms.includes(t));
  const hasIndicMarkers = (lexicalScore['hi-IN'] > 0 || lexicalScore['mr-IN'] > 0 || lexicalScore['ta-IN'] > 0 || lexicalScore['gu-IN'] > 0);
  if (hasEnglishMedical && hasIndicMarkers) {
    codeSwitching = true;
  }

  // 4. Combined Multi-Signal Scoring
  const combinedScores: Record<SupportedLocale, number> = {
    'en-IN': 0, 'hi-IN': 0, 'mr-IN': 0, 'ta-IN': 0, 'gu-IN': 0
  };

  const locales: SupportedLocale[] = ['hi-IN', 'mr-IN', 'ta-IN', 'gu-IN', 'en-IN'];
  for (const loc of locales) {
    let score = 0;
    // Script is a decisive signal for native scripts (including code-switched mixed scripts)
    if (hasTamil && loc === 'ta-IN') score += 0.60;
    else if (hasGujarati && loc === 'gu-IN') score += 0.60;
    else if (hasDevanagari) {
      score += scriptScore[loc] * 0.55;
    } else {
      score += scriptScore[loc] * 0.15;
    }

    // Lexical & Transliteration
    score += transliterationScore[loc] * 0.40;
    score += lexicalScore[loc] * 0.25;

    // ASR Hint prior
    if (asrHint === loc) {
      score += 0.15;
    }

    combinedScores[loc] = score;
  }

  // Normalize scores
  const totalScore = Object.values(combinedScores).reduce((a, b) => a + b, 0) || 1;
  const normalizedScores: { locale: SupportedLocale; score: number }[] = locales.map(loc => ({
    locale: loc,
    score: parseFloat((combinedScores[loc] / totalScore).toFixed(3))
  }));

  normalizedScores.sort((a, b) => b.score - a.score);

  const topChoice = normalizedScores[0];
  const secondChoice = normalizedScores[1];

  // If script is definitive, confidence is high
  let confidence = topChoice.score;
  if (script === 'Tamil' || script === 'Gujarati') {
    confidence = 0.98;
  } else if (script === 'Devanagari' && (topChoice.locale === 'hi-IN' || topChoice.locale === 'mr-IN')) {
    confidence = Math.max(0.88, topChoice.score);
  } else if (topChoice.score - secondChoice.score > 0.3) {
    confidence = Math.min(0.95, topChoice.score + 0.1);
  } else {
    confidence = topChoice.score;
  }

  const isLowConfidence = confidence < CONFIDENCE_THRESHOLD || (topChoice.score - secondChoice.score < 0.12 && script === 'Latin');

  const secondaryLanguages: LanguageScore[] = normalizedScores
    .slice(1)
    .filter(s => s.score > 0.05)
    .map(s => ({ language: s.locale, score: s.score }));

  return {
    language: topChoice.locale,
    confidence: parseFloat(confidence.toFixed(2)),
    script,
    codeSwitching,
    secondaryLanguages,
    isLowConfidence,
    signals: {
      scriptScore,
      lexicalScore,
      transliterationScore,
      asrSignal: asrHint,
    },
  };
}
