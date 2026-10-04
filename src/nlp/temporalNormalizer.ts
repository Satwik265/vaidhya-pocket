/**
 * Temporal Normalization Engine for Indian Clinical Speech.
 * Extracts and normalizes relative, episodic, and numeric duration expressions
 * across English, Hindi, Marathi, Tamil, and Gujarati.
 */

export interface NormalizedTemporal {
  rawText: string;
  value: number;
  unit: 'hours' | 'days' | 'weeks' | 'months' | 'years' | 'childhood' | 'ongoing';
  isEstimated: boolean;
}

// Indian number word mappings in Latin script and native scripts
const NUMBER_WORDS: Record<string, number> = {
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  // Hindi / Devanagari romanized
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5, 'panch': 5, 'chhah': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
  // Marathi
  'don': 2, 'sah': 6, 'दोन': 2,
  // Tamil
  'onnu': 1, 'rendu': 2, 'moonu': 3, 'naalu': 4, 'anju': 5, 'aaru': 6, 'ezhu': 7, 'ettu': 8, 'onbadhu': 9, 'patthu': 10,
  'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
  // Gujarati
  'be': 2, 'tran': 3, 'paanch_gu': 5, 'chha': 6,
  'એક': 1, 'બે': 2, 'ત્રણ': 3, 'ચાર': 4, 'પાંચ': 5, 'છ': 6, 'સાત': 7, 'આઠ': 8, 'નવ': 9, 'દસ': 10
};

const INDIC_DIGIT_MAP: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
  '૦': '0', '૧': '1', '૨': '2', '૩': '3', '૪': '4', '૫': '5', '૬': '6', '૭': '7', '૮': '8', '૯': '9',
};

export function parseNumberWordOrDigits(text: string): number | null {
  let clean = text.trim().toLowerCase();
  clean = clean.replace(/[०-९૦-૯]/g, d => INDIC_DIGIT_MAP[d] || d);
  const digitMatch = clean.match(/\d+/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
  }
  if (NUMBER_WORDS[clean] !== undefined) {
    return NUMBER_WORDS[clean];
  }
  return null;
}

/**
 * Extracts temporal expressions from clinical text.
 */
export function extractTemporalExpressions(text: string): NormalizedTemporal[] {
  if (!text) return [];

  const results: NormalizedTemporal[] = [];
  const lower = text.toLowerCase();

  // 1. Fixed idiomatic expressions
  // Since yesterday / Kal se / Kalpasun / Netru mudhal / Kaal thi
  if (/(since\s+yesterday|kal\s*se|कल\s*से|kalpasun|कालपासून|netru\s*mudhal|நேற்று\s*முதல்|kaal\s*thi|કાલથી)/i.test(lower)) {
    results.push({
      rawText: 'yesterday',
      value: 1,
      unit: 'days',
      isEstimated: false,
    });
  }

  // Since today / Aaj se / Aajpasun / Indru mudhal / Aaj thi
  if (/(since\s+today|aaj\s*se|आज\s*से|aajpasun|आजपासून|indru\s*mudhal|இன்று\s*முதல்|aajthi|આજથી)/i.test(lower)) {
    results.push({
      rawText: 'today',
      value: 0,
      unit: 'days',
      isEstimated: false,
    });
  }

  // Last night / Kal raat se
  if (/(last\s+night|kal\s*raat\s*se|काल\s*रात्रीपासून|netru\s*iravu|நேற்று\s*இரவு|kaal\s*raat)/i.test(lower)) {
    results.push({
      rawText: 'last night',
      value: 12,
      unit: 'hours',
      isEstimated: true,
    });
  }

  // Last week / Pichhle hafte se / Magchya aathvadyapasun / Senra vaaram
  if (/(last\s+week|pichhle\s*hafte|मागच्या\s*आठवड्यापासून|senra\s*vaaram|சென்ற\s*வாரம்|pachhla\s*athvadiya)/i.test(lower)) {
    results.push({
      rawText: 'last week',
      value: 1,
      unit: 'weeks',
      isEstimated: false,
    });
  }

  // Since childhood / Bachpan se / Lahanpana pasun / Siru vayadhu mudhal / Balpan thi
  if (/(since\s+childhood|bachpan\s*se|बचपन\s*से|lahanpana\s*pasun|लहानपणापासून|siru\s*vayadhu|சிறு\s*வயது|balpan\s*thi|બાળપણથી)/i.test(lower)) {
    results.push({
      rawText: 'since childhood',
      value: 1,
      unit: 'childhood',
      isEstimated: true,
    });
  }

  // Since specific year (e.g. "since 2020", "2020 se", "2021 pasun")
  const yearMatch = lower.match(/(?:since|se|pasun|mudhal|thi)\s*(20\d\d|19\d\d)|(20\d\d|19\d\d)\s*(?:se|pasun|mudhal|thi)/);
  if (yearMatch) {
    const matchedYear = parseInt(yearMatch[1] || yearMatch[2], 10);
    const currentYear = new Date().getFullYear();
    const diffYears = Math.max(1, currentYear - matchedYear);
    results.push({
      rawText: `since ${matchedYear}`,
      value: diffYears,
      unit: 'years',
      isEstimated: false,
    });
  }

  // 2. Numeric patterns (e.g. "3 days", "teen din se", "तीन दिवसांपासून", "two days-ஆ", "2 mahine", "બે દિવસથી")
  const regexPatterns: { regex: RegExp; unit: NormalizedTemporal['unit'] }[] = [
    // Days patterns
    {
      regex: /((?:\d+|[०-९]+|[૦-૯]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|chhah|saat|aath|nau|das|don|onnu|rendu|moonu|naalu|anju|be|tran|तीन|दोन|બે|ત્રણ|ચાર|પાંચ))\s*(?:-|–|\s)*(?:day|days|din|dino|dinon|divas\s*thi|divas|divasan|divasapasun|divasampasun|दिवस|दिवसांपासून|naal|naala|natkal|naatkalaga|naatkal|divasthi|divaso|દિવસ|દિવસથી)/gi,
      unit: 'days',
    },
    // Weeks patterns
    {
      regex: /((?:\d+|[०-९]+|[૦-૯]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|don|rendu|moonu|be|tran|બે|ત્રણ))\s*(?:-|–|\s)*(?:week|weeks|hafte|hafton|हफ्ते|athavade|athavadya|आठवडे|vaaram|vaarama|vaarangal|வாரம்|athvadiyu|athvadiya|અઠવાડિયા)/gi,
      unit: 'weeks',
    },
    // Months patterns
    {
      regex: /((?:\d+|[०-९]+|[૦-૯]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|don|rendu|moonu|be|tran|બે|ત્રણ))\s*(?:-|–|\s)*(?:month|months|mahine|mahino|mahinon|महिने|mahinyanpasun|maasam|maathama|maathangal|மாதம்|mahina|mahinathi|મહિના)/gi,
      unit: 'months',
    },
    // Years patterns
    {
      regex: /((?:\d+|[०-९]+|[૦-૯]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch|don|rendu|moonu|be|tran|બે|ત્રણ))\s*(?:-|–|\s)*(?:year|years|saal|varsh|साल|वर्ष|varshe|varudam|varushama|வருடம்|varsho|વર્ષ)/gi,
      unit: 'years',
    },
    // Hours patterns
    {
      regex: /((?:\d+|[०-९]+|[૦-૯]+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|be|tran))\s*(?:-|–|\s)*(?:hour|hours|ghante|ghanton|घंटे|taas|तास|mani|neram|மணி|kalak|કલાક)/gi,
      unit: 'hours',
    }
  ];

  for (const { regex, unit } of regexPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const numVal = parseNumberWordOrDigits(match[1]);
      if (numVal !== null) {
        results.push({
          rawText: match[0],
          value: numVal,
          unit,
          isEstimated: false,
        });
      }
    }
  }

  return results;
}
