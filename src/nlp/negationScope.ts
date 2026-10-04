/**
 * Multilingual Negation Scope Analyzer for Indian Clinical Conversations.
 * Implements clause-bounded scope analysis for English, Hindi, Marathi, Tamil, and Gujarati.
 * Prevents false positives like: "BP nahi hai" -> hypertension = true.
 */

export type ClinicalAssertion = 'affirmed' | 'negated' | 'uncertain';

// Adversative and coordinating conjunctions that create clause boundaries
const CLAUSE_BOUNDARY_WORDS = new Set([
  // English
  'but', 'however', 'although', 'except', 'yet', 'while', 'whereas', 'though', 'and',
  // Hindi
  'lekin', 'par', 'magar', 'kintu', 'parantu', 'aur', 'tatha', 'kyunki', 'isliye', 'phir', 'ya',
  'लेकिन', 'पर', 'मगर', 'किन्तु', 'परन्तु', 'और', 'क्योंकि', 'इसलिए',
  // Marathi
  'pan', 'panthu', 'parantu', 'aani', 'tar', 'tari', 'mhanun', 'karan',
  'पण', 'परंतु', 'आणि', 'तर', 'म्हणून', 'कारण',
  // Tamil
  'aanaal', 'aanaalum', 'matrum', 'enral', 'aagave', 'enave',
  'ஆனால்', 'ஆனாலும்', 'மற்றும்', 'எனவே',
  // Gujarati
  'pan', 'parantu', 'ane', 'kintu', 'etle', 'karan ke',
  'પણ', 'પરંતુ', 'અને', 'એટલે', 'કારણ'
]);

// Multilingual negation triggers categorized by language
export const MULTILINGUAL_NEGATION_TRIGGERS: Record<string, string[]> = {
  en: [
    'no', 'not', 'never', "don't have", 'does not have', 'denies', 'denied', 'without', 'absent',
    'none', 'free of', 'negative for', 'ruled out'
  ],
  hi: [
    'nahi', 'nahin', 'nai', 'na', 'koi nahi', 'bilkul nahi', 'nahi hai', 'nahi hua', 'nahi hui',
    'kabhi nahi', 'abhi tak nahi', 'nahi tha', 'nahi thi', 'नहीं', 'ना', 'कोई नहीं', 'बिल्कुल नहीं',
    'नहीं है', 'नहीं हुआ', 'कभी नहीं'
  ],
  mr: [
    'nahi', 'nahit', 'nahiye', 'nahi ahe', 'kahi nahi', 'kadhi nahi', 'ajun nahi', 'nako', 'naslyamule',
    'नाही', 'नाहीत', 'नाहीये', 'काही नाही', 'कधी नाही', 'अजून नाही'
  ],
  ta: [
    'illai', 'kidayathu', 'illa', 'illave illai', 'eppothum illai', 'illamal', 'illaiye',
    'இல்லை', 'கிடையாது', 'இல்லவே இல்லை', 'இல்லாமல்'
  ],
  gu: [
    'nathi', 'nahi', 'na', 'bilkul nathi', 'kayrey nathi', 'nathi thayu', 'nathi aavyu', 'nathi rahyu',
    'નથી', 'નહિ', 'બિલકુલ નથી', 'ક્યારેય નથી'
  ]
};

// Flattened set of all negation tokens for quick lookup
const ALL_NEGATION_TRIGGERS = new Set<string>();
for (const list of Object.values(MULTILINGUAL_NEGATION_TRIGGERS)) {
  for (const trigger of list) {
    ALL_NEGATION_TRIGGERS.add(trigger.toLowerCase());
  }
}

function phraseMatchesTrigger(phrase: string, tokens: string[], trigger: string): boolean {
  if (trigger.length <= 3) {
    return tokens.includes(trigger) || new RegExp(`(^|\\s)${trigger}(\\s|$)`, 'i').test(phrase);
  }
  return phrase.includes(trigger) || tokens.includes(trigger);
}

export interface NegationCheckResult {
  assertion: ClinicalAssertion;
  negationTrigger?: string;
  scopeDistance?: number;
}

/**
 * Splits text into grammatical clauses based on punctuation and adversative conjunctions.
 */
export function splitIntoClauses(text: string): string[] {
  // Normalize punctuation boundaries
  const punctNormalized = text.replace(/[,;।!?–—\.\n]+/g, ' __CLAUSE_SPLIT__ ');
  const rawTokens = punctNormalized.split(/\s+/).filter(Boolean);

  const clauses: string[] = [];
  let currentClauseTokens: string[] = [];

  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (token === '__CLAUSE_SPLIT__' || CLAUSE_BOUNDARY_WORDS.has(lower)) {
      if (currentClauseTokens.length > 0) {
        clauses.push(currentClauseTokens.join(' '));
        currentClauseTokens = [];
      }
      if (token !== '__CLAUSE_SPLIT__') {
        // The conjunction itself can start a new clause context
        currentClauseTokens.push(token);
      }
    } else {
      currentClauseTokens.push(token);
    }
  }

  if (currentClauseTokens.length > 0) {
    clauses.push(currentClauseTokens.join(' '));
  }

  return clauses.length > 0 ? clauses : [text];
}

/**
 * Evaluates whether a clinical concept mention is negated within its clause.
 * Uses a token-window heuristic (up to 4 tokens before or 3 tokens after the concept)
 * strictly constrained to the same clause.
 */
export function evaluateNegationScope(
  fullTranscript: string,
  conceptSurfaceText: string,
  charStartIndex: number
): NegationCheckResult {
  const clauses = splitIntoClauses(fullTranscript);

  // Find which clause contains this mention
  const conceptLower = conceptSurfaceText.toLowerCase();
  let targetClause = '';

  for (const clause of clauses) {
    if (clause.toLowerCase().includes(conceptLower)) {
      targetClause = clause;
      break;
    }
  }

  if (!targetClause) {
    targetClause = fullTranscript;
  }

  const clauseTokens = targetClause.toLowerCase().split(/\s+/).filter(Boolean);
  const conceptTokens = conceptLower.split(/\s+/).filter(Boolean);

  // Find start token index of concept inside the clause
  let matchIndex = -1;
  for (let i = 0; i <= clauseTokens.length - conceptTokens.length; i++) {
    let matched = true;
    for (let j = 0; j < conceptTokens.length; j++) {
      if (clauseTokens[i + j] !== conceptTokens[j]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    // Check if any negation trigger appears in the clause with word boundaries
    for (const trigger of ALL_NEGATION_TRIGGERS) {
      if (phraseMatchesTrigger(targetClause.toLowerCase(), clauseTokens, trigger)) {
        return {
          assertion: 'negated',
          negationTrigger: trigger,
        };
      }
    }
    return { assertion: 'affirmed' };
  }

  const conceptEndIndex = matchIndex + conceptTokens.length - 1;

  // Window before: up to 4 tokens
  const windowStart = Math.max(0, matchIndex - 4);
  const beforeTokens = clauseTokens.slice(windowStart, matchIndex);

  // Window after: up to 3 tokens (e.g. "bukhar nahi hai", "BP nahi")
  const windowEnd = Math.min(clauseTokens.length, conceptEndIndex + 4);
  const afterTokens = clauseTokens.slice(conceptEndIndex + 1, windowEnd);

  // Check before window
  const beforePhrase = beforeTokens.join(' ');
  for (const trigger of ALL_NEGATION_TRIGGERS) {
    if (phraseMatchesTrigger(beforePhrase, beforeTokens, trigger)) {
      return {
        assertion: 'negated',
        negationTrigger: trigger,
        scopeDistance: matchIndex - windowStart,
      };
    }
  }

  // Check after window (most common in Indian SOV grammar: "symptom nahi hai")
  const afterPhrase = afterTokens.join(' ');
  for (const trigger of ALL_NEGATION_TRIGGERS) {
    if (phraseMatchesTrigger(afterPhrase, afterTokens, trigger)) {
      return {
        assertion: 'negated',
        negationTrigger: trigger,
        scopeDistance: 1,
      };
    }
  }

  return { assertion: 'affirmed' };
}
