/**
 * High-performance multilingual text normalizer for Indian clinical speech.
 * Handles Unicode normalization, ASR typo squashing, phonetic alignment,
 * and Romanized Indian transliteration variants.
 */

// Common phonetic replacements for Romanized Indian speech
const PHONETIC_REPLACEMENTS: [RegExp, string][] = [
  // Repeated letters (3 or more reduced to 1 or 2)
  [/(.)\1{2,}/g, '$1$1'],
  // Long vs short vowels in romanization
  [/\b(chha|chaa)\b/gi, 'chha'],
  [/\b(seena|seene)\b/gi, 'seene'],
  [/\b(dardd|dard)\b/gi, 'dard'],
  [/\b(bukhaar|bukhr)\b/gi, 'bukhar'],
  [/\b(khaansi|khasi)\b/gi, 'khansi'],
  [/\b(saans|sans)\b/gi, 'saans'],
  [/\b(phoolna|fulna|foolna)\b/gi, 'phoolna'],
  [/\b(dukhtay|dukhto|dukhata)\b/gi, 'dukhta'],
  [/\b(thalaivali|talaivali)\b/gi, 'thalaivali'],
  [/\b(nenju|ninju)\b/gi, 'nenju'],
  [/\b(chhatima|chatima)\b/gi, 'chhatima'],
  [/\b(dukhavo|dukhavo)\b/gi, 'dukhavo'],
  [/\b(shwas|swas)\b/gi, 'shwas'],
  // Common ASR mistakes
  [/\bchase pain\b/gi, 'chest pain'],
  [/\bchess pain\b/gi, 'chest pain'],
  [/\bcinema dard\b/gi, 'seene mein dard'],
  [/\bmet for men\b/gi, 'metformin'],
  [/\bmeat formin\b/gi, 'metformin'],
  [/\bdolow\b/gi, 'dolo'],
  [/\bfeever\b/gi, 'fever']
];

export interface NormalizedText {
  raw: string;
  cleaned: string;
  tokens: string[];
  hasDevanagari: boolean;
  hasTamil: boolean;
  hasGujarati: boolean;
  hasLatin: boolean;
}

/**
 * Normalizes input speech/text:
 * - NFC Unicode normalization
 * - Lowercase for Latin
 * - Removes non-essential punctuation while preserving clause breaks
 * - Squashes excessive repeating characters
 * - Applies Indian phonetic transliteration rules
 */
export function normalizeIndianClinicalText(input: string): NormalizedText {
  if (!input) {
    return {
      raw: '',
      cleaned: '',
      tokens: [],
      hasDevanagari: false,
      hasTamil: false,
      hasGujarati: false,
      hasLatin: false,
    };
  }

  // 1. Unicode Normalization
  let normalized = input.normalize('NFKC');

  // Detect scripts
  const hasDevanagari = /[\u0900-\u097F]/.test(normalized);
  const hasTamil = /[\u0B80-\u0BFF]/.test(normalized);
  const hasGujarati = /[\u0A80-\u0AFF]/.test(normalized);
  const hasLatin = /[a-zA-Z]/.test(normalized);

  // 2. Lowercase (for Latin characters)
  normalized = normalized.toLowerCase();

  // 3. Remove punctuation except clause markers
  normalized = normalized.replace(/[,;।!?–—\-\/]/g, ' ');
  normalized = normalized.replace(/["'()[\]{}]/g, '');

  // 4. Phonetic & ASR replacements
  for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  // 5. Whitespace normalization
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // 6. Tokenize
  const tokens = normalized.length > 0 ? normalized.split(' ') : [];

  return {
    raw: input,
    cleaned: normalized,
    tokens,
    hasDevanagari,
    hasTamil,
    hasGujarati,
    hasLatin,
  };
}

/**
 * Levenshtein Distance for fuzzy matching noisy ASR variants.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Fuzzy similarity score between 0.0 and 1.0.
 */
export function fuzzySimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}
