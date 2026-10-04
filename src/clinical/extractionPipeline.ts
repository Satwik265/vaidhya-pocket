/**
 * Headless Canonical Clinical Fact Extraction Pipeline.
 *
 * Runs entirely independent of React component state or UI event loops.
 * Ingests unstructured patient utterances, transcripts, or document texts and emits
 * strictly typed, evidence-anchored Canonical ClinicalFact[] instances.
 */

import {
  ClinicalFact,
  FactDomain,
  FactAssertion,
  FactElicitation,
  FactTemporality,
  FactExperiencer,
  FactSourceType,
  generateFactId,
  createClinicalFact,
  MedicationAttributes,
  AYUSHAttributes,
} from './clinicalFactModel';
import { validateClinicalFact } from './evidenceGate';
import { extractMultilingualConcepts, ExtractedClinicalConcept } from '../nlp/codeSwitchingExtractor';
import { analyzeHindiTranscript, ExtractedFact, ClinicalConcept } from './hindiClinicalMatcher';
import { normalizeMedications } from '../nlp/medicationNormalizer';
import hindiSymptoms from '../dictionaries/medical/hindi_symptoms.json';
import hindiNegation from '../dictionaries/medical/hindi_negation.json';
import hindiTemporal from '../dictionaries/medical/hindi_temporal.json';

export interface ExtractionContext {
  encounterId?: string;
  sourceType?: FactSourceType;
  sourceId?: string;
  language?: string;
  experiencer?: FactExperiencer;
  turnIndex?: number;
}

/**
 * Parses dosage, unit, and frequency from clinical medication phrases.
 * e.g., "Tab. Metformin 500mg BD" -> { dose: "500", unit: "mg", frequency: "BD" }
 */
export function parseMedicationComponents(text: string): {
  drugName?: string;
  dose?: string;
  unit?: string;
  frequency?: string;
  route?: string;
} {
  const result: {
    drugName?: string;
    dose?: string;
    unit?: string;
    frequency?: string;
    route?: string;
  } = {};

  // Route / Form
  const routeMatch = text.match(/\b(tab(?:let)?|cap(?:sule)?|syp|syrup|inj(?:ection)?|drops?|cream|gel|oint(?:ment)?)\b/i);
  if (routeMatch) {
    result.route = routeMatch[1].toLowerCase();
  }

  // Dose & Unit (e.g. 500mg, 500 mg, 0.5mg, 5ml, 10 units, 20/120mg)
  const doseMatch = text.match(/(\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)\s*(mg|g|mcg|ml|units?|tablets?|capsules?|drops?|iu)\b/i);
  if (doseMatch) {
    result.dose = doseMatch[1];
    result.unit = doseMatch[2].toLowerCase();
  }

  // Frequency (e.g. OD, BD, BID, TDS, TID, QID, QDS, PRN, once daily, twice daily, raat ko, subah)
  const freqMatch = text.match(/\b(od|bd|bid|tds|tid|qid|qds|prn|stat|sos|hs|once\s+daily|twice\s+daily|thrice\s+daily|din\s+me\s+do\s+baar|subah\s+sham|raat\s+ko)\b/i);
  if (freqMatch) {
    result.frequency = freqMatch[1].toUpperCase();
  }

  return result;
}

/**
 * Adapts legacy ExtractedClinicalConcept to canonical ClinicalFact.
 */
export function adaptExtractedConceptToFact(
  concept: ExtractedClinicalConcept,
  context: ExtractionContext = {}
): ClinicalFact {
  const assertion: FactAssertion =
    concept.assertion === 'affirmed'
      ? 'AFFIRMED'
      : concept.assertion === 'negated'
      ? 'NEGATED'
      : 'UNKNOWN';

  const domain: FactDomain =
    concept.category === 'symptom'
      ? 'symptom'
      : concept.category === 'condition'
      ? 'condition'
      : concept.category === 'investigation'
      ? 'investigation'
      : concept.category === 'anatomy'
      ? 'anatomy'
      : 'symptom';

  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  return createClinicalFact({
    factId: generateFactId(concept.conceptId, sourceType),
    encounterId: context.encounterId,
    domain,
    canonicalId: concept.conceptId,
    preferredTerm: concept.surfaceText,
    assertion,
    elicitation: 'ELICITED',
    temporality: 'CURRENT',
    experiencer: context.experiencer || 'PATIENT',
    confidence: concept.confidence || 0.9,
    evidence: [
      {
        text: concept.evidence || concept.surfaceText,
        verbatimText: concept.evidence || concept.surfaceText,
        startOffset: 0,
        endOffset: (concept.evidence || concept.surfaceText).length,
        startChar: 0,
        endChar: (concept.evidence || concept.surfaceText).length,
      },
    ],
    provenance: {
      sourceType,
      sourceId: context.sourceId,
      language: concept.language || context.language || 'en',
      extractionEngine: 'codeSwitchingExtractor',
      confidence: concept.confidence || 0.9,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Adapts Hindi ExtractedFact to canonical ClinicalFact.
 */
export function adaptHindiFactToFact(
  fact: ExtractedFact,
  rawTranscript: string,
  context: ExtractionContext = {},
  temporal?: any
): ClinicalFact {
  let assertion: FactAssertion =
    fact.assertion === 'present'
      ? 'AFFIRMED'
      : fact.assertion === 'negated'
      ? 'NEGATED'
      : 'UNKNOWN';

  const lowerTranscript = rawTranscript.toLowerCase();
  const isSuspected =
    /\b(maybe|perhaps|possible|possibly|might be|suspect|shayad|lagta hai|ho sakta hai)\b/i.test(
      lowerTranscript
    );
  const isConditional =
    /\b(if\b|in case|whenever|agar\b|yadi\b|jab\b)/i.test(lowerTranscript);

  if (assertion === 'AFFIRMED') {
    if (isSuspected) {
      assertion = 'SUSPECTED';
    } else if (isConditional) {
      assertion = 'CONDITIONAL';
    }
  }

  const domain: FactDomain = fact.category === 'condition' ? 'condition' : 'symptom';
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  const evText =
    fact.assertion === 'negated' && fact.evidence
      ? fact.evidence
      : fact.matchedPhrase || fact.evidence || rawTranscript;

  let startOffset = 0;
  let endOffset = rawTranscript.length;
  if (evText && rawTranscript.includes(evText)) {
    startOffset = rawTranscript.indexOf(evText);
    endOffset = startOffset + evText.length;
  } else if (fact.matchedPhrase && rawTranscript.includes(fact.matchedPhrase)) {
    startOffset = rawTranscript.indexOf(fact.matchedPhrase);
    endOffset = startOffset + fact.matchedPhrase.length;
  }

  const durationStr =
    temporal?.value && temporal?.unit ? `${temporal.value} ${temporal.unit}` : undefined;

  return createClinicalFact({
    factId: generateFactId(fact.conceptId, sourceType),
    encounterId: context.encounterId,
    domain,
    canonicalId: fact.conceptId,
    preferredTerm: fact.canonicalEnglish,
    assertion,
    elicitation: 'ELICITED',
    temporality: temporal ? 'PAST_ONGOING' : 'CURRENT',
    experiencer: context.experiencer || 'PATIENT',
    confidence: fact.confidence,
    attributes: durationStr ? { duration: durationStr } : undefined,
    evidence: [
      {
        text: evText,
        verbatimText: evText,
        startOffset,
        endOffset,
        startChar: startOffset,
        endChar: endOffset,
      },
    ],
    provenance: {
      sourceType,
      sourceId: context.sourceId,
      language: context.language || 'hi',
      extractionEngine: 'hindiClinicalMatcher',
      confidence: fact.confidence,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Detects explicit allergy discussions:
 * - "I have no allergies" / "allergy nahi hai" -> NEGATED
 * - "Allergic to penicillin" -> AFFIRMED
 */
export function extractAllergyFacts(
  text: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  // 1. Explicit denial of allergies
  const explicitNegationRegex = /\b(no\s+(known\s+)?(drug\s+)?allerg(?:y|ies)|not\s+allergic|allergy\s+(nahi|nahin)\s+hai|kisi\s+dawa(?:i)?\s+se\s+allergy\s+(nahi|nahin))\b/i;
  const negMatch = text.match(explicitNegationRegex);
  if (negMatch) {
    facts.push(
      createClinicalFact({
        factId: generateFactId('ALLERGY_NKDA', sourceType),
        encounterId: context.encounterId,
        domain: 'allergy',
        canonicalId: 'ALLERGY_DRUG_GENERAL',
        preferredTerm: 'No Known Drug Allergy (Explicit Patient Denial)',
        assertion: 'NEGATED',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        experiencer: context.experiencer || 'PATIENT',
        evidence: [
          {
            text: negMatch[0],
            verbatimText: negMatch[0],
            startOffset: negMatch.index,
            endOffset:
              negMatch.index !== undefined ? negMatch.index + negMatch[0].length : undefined,
            startChar: negMatch.index,
            endChar:
              negMatch.index !== undefined ? negMatch.index + negMatch[0].length : undefined,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'en',
          extractionEngine: 'allergyPatternMatcher',
          confidence: 0.98,
          timestamp: new Date().toISOString(),
        },
      })
    );
    return facts;
  }

  // 2. Explicit patient uncertainty: "I don't know" / "not sure" / "pata nahi" -> UNKNOWN + ELICITED
  const allergyUncertaintyRegex = /\b(don'?t\s+know(\s+if|\s+about)?\s+allerg(?:y|ies)?|not\s+sure\s+about\s+allerg(?:y|ies)?|allergy.*(pata\s+nahi|maloom\s+nahi|yaad\s+nahi)|(pata\s+nahi|maloom\s+nahi).*allergy)\b/i;
  const uncertMatch = text.match(allergyUncertaintyRegex);
  if (uncertMatch) {
    facts.push(
      createClinicalFact({
        factId: generateFactId('ALLERGY_UNCERTAIN', sourceType),
        encounterId: context.encounterId,
        domain: 'allergy',
        canonicalId: 'ALLERGY_UNSPECIFIED',
        preferredTerm: 'Allergy Status: Unknown / Uncertain by Patient',
        assertion: 'UNKNOWN',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        experiencer: context.experiencer || 'PATIENT',
        evidence: [
          {
            text: uncertMatch[0],
            verbatimText: uncertMatch[0],
            startOffset: uncertMatch.index,
            endOffset: uncertMatch.index !== undefined ? uncertMatch.index + uncertMatch[0].length : undefined,
            startChar: uncertMatch.index,
            endChar: uncertMatch.index !== undefined ? uncertMatch.index + uncertMatch[0].length : undefined,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'en',
          extractionEngine: 'allergyPatternMatcher',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        },
      })
    );
    return facts;
  }

  // 3. Specific drug allergy mention (e.g. penicillin allergy, sulfa allergy, पेनिसिलिन से एलर्जी)
  const allergyMentionRegex = /(?:\b(allergic\s+to\s+([a-z0-9\u0900-\u097F]+)|([a-z0-9\u0900-\u097F]+)\s*(?:se\s*)?(?:allergy|allergies|एलर्जी))\b|([a-z0-9\u0900-\u097F]+)\s*से\s*एलर्जी)/i;
  const posMatch = text.match(allergyMentionRegex);
  if (posMatch) {
    let allergen = posMatch[2] || posMatch[3] || posMatch[4];
    const stopWords = ['no', 'nahi', 'nahin', 'not', 'kisi', 'about', 'any', 'my', 'the', 'ko', 'have', 'has'];
    if (allergen && !stopWords.includes(allergen.toLowerCase())) {
      let canonicalId = allergen.toUpperCase();
      if (allergen.includes('पेनिसिलिन')) {
        canonicalId = 'PENICILLIN';
      }
      facts.push(
        createClinicalFact({
          factId: generateFactId(`ALLERGY_${canonicalId}`, sourceType),
          encounterId: context.encounterId,
          domain: 'allergy',
          canonicalId: `ALLERGY_${canonicalId}`,
          preferredTerm: `Allergy to ${allergen}`,
          value: allergen,
          assertion: 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'CHRONIC',
          experiencer: context.experiencer || 'PATIENT',
          evidence: [
            {
              text: posMatch[0],
              verbatimText: posMatch[0],
              startOffset: posMatch.index,
              endOffset:
                posMatch.index !== undefined ? posMatch.index + posMatch[0].length : undefined,
              startChar: posMatch.index,
              endChar:
                posMatch.index !== undefined ? posMatch.index + posMatch[0].length : undefined,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'en',
            extractionEngine: 'allergyPatternMatcher',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  return facts;
}

/**
 * Creates an unelicited allergy fact indicating allergies were never discussed.
 * UNKNOWN + NOT_ELICITED. Never defaults to NKDA!
 */
export function createUnelicitedAllergyFact(context: ExtractionContext = {}): ClinicalFact {
  return createClinicalFact({
    factId: generateFactId('ALLERGY_UNELICITED', context.sourceType || 'SYSTEM_DERIVED'),
    encounterId: context.encounterId,
    domain: 'allergy',
    canonicalId: 'ALLERGY_STATUS',
    preferredTerm: 'Allergy History',
    assertion: 'UNKNOWN',
    elicitation: 'NOT_ELICITED',
    temporality: 'UNSPECIFIED',
    experiencer: context.experiencer || 'PATIENT',
    evidence: [],
    provenance: {
      sourceType: context.sourceType || 'SYSTEM_DERIVED',
      sourceId: context.sourceId,
      language: context.language || 'en',
      extractionEngine: 'systemElicitationTracker',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Extracts patient-reported AYUSH Prakriti and constitutional tendencies.
 * Preserves PATIENT_REPORTED distinction from clinician-assessed Dashavidha Pariksha.
 */
export function extractAYUSHFacts(
  text: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  const isClinicianObserved =
    context.sourceType === 'CLINICIAN_ENTERED' ||
    /\b(pariksha|examin(?:ed|ation)|clinician|doctor|observed|vaidya|dashavidha)\b/i.test(text);
  const reporterType = isClinicianObserved ? 'CLINICIAN_OBSERVED' : 'PATIENT_REPORTED';

  const prakritiRegex = /\b(prakriti|prakruti|dosha|body\s+type)\s*(?:hai|is|:)?\s*([a-z\s-]+)\b/i;
  const match =
    text.match(prakritiRegex) ||
    text.match(/\b(vata-pitta|pitta-kapha|vata-kapha|tridoshaja|vata|pitta|kapha)\b/i);

  if (match) {
    const rawDosha = (match[2] || match[1] || '').trim();
    let normalized = 'Tridoshaja';
    if (/vata-pitta/i.test(rawDosha)) normalized = 'Vata-Pitta';
    else if (/pitta-kapha/i.test(rawDosha)) normalized = 'Pitta-Kapha';
    else if (/vata-kapha/i.test(rawDosha)) normalized = 'Vata-Kapha';
    else if (/vata/i.test(rawDosha)) normalized = 'Vata';
    else if (/pitta/i.test(rawDosha)) normalized = 'Pitta';
    else if (/kapha/i.test(rawDosha)) normalized = 'Kapha';

    const ayushAttrs: AYUSHAttributes = {
      ayushCategory: 'prakriti',
      constitutionalRole: normalized,
      prakriti: normalized,
      reporterType,
    };

    facts.push(
      createClinicalFact({
        factId: generateFactId(
          `AYUSH_PRAKRITI_${normalized.toUpperCase().replace(/[^A-Z]/g, '_')}`,
          sourceType
        ),
        encounterId: context.encounterId,
        domain: 'ayush',
        canonicalId: `AYUSH_PRAKRITI_${normalized.toUpperCase().replace(/[^A-Z]/g, '_')}`,
        preferredTerm: `${reporterType === 'CLINICIAN_OBSERVED' ? 'Clinician-Observed' : 'Patient-Reported'} Prakriti: ${normalized}`,
        value: normalized,
        attributes: ayushAttrs,
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        temporality: 'CHRONIC',
        experiencer: context.experiencer || 'PATIENT',
        reporterType,
        evidence: [
          {
            text: match[0],
            verbatimText: match[0],
            startOffset: match.index,
            endOffset: match.index !== undefined ? match.index + match[0].length : undefined,
            startChar: match.index,
            endChar: match.index !== undefined ? match.index + match[0].length : undefined,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'hi',
          extractionEngine: 'ayushConceptMatcher',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  // Agni
  const agniMatch = text.match(/\b(samagni|tikshnagni|mandagni|vishamagni)\b/i);
  if (agniMatch) {
    const agniType = agniMatch[1];
    const normalizedAgni =
      agniType.toLowerCase() === 'samagni'
        ? 'Samagni'
        : agniType.toLowerCase() === 'tikshnagni'
        ? 'Tikshnagni'
        : agniType.toLowerCase() === 'mandagni'
        ? 'Mandagni'
        : 'Vishamagni';

    const agniAttrs: AYUSHAttributes = {
      ayushCategory: 'agni',
      agniType: normalizedAgni,
      reporterType,
    };

    facts.push(
      createClinicalFact({
        factId: generateFactId(`AYUSH_AGNI_${normalizedAgni.toUpperCase()}`, sourceType),
        encounterId: context.encounterId,
        domain: 'ayush',
        canonicalId: `AYUSH_AGNI_${normalizedAgni.toUpperCase()}`,
        preferredTerm: `Digestive Fire: ${normalizedAgni}`,
        value: normalizedAgni,
        attributes: agniAttrs,
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        experiencer: context.experiencer || 'PATIENT',
        reporterType,
        evidence: [
          {
            text: agniMatch[0],
            verbatimText: agniMatch[0],
            startOffset: agniMatch.index,
            endOffset:
              agniMatch.index !== undefined ? agniMatch.index + agniMatch[0].length : undefined,
            startChar: agniMatch.index,
            endChar:
              agniMatch.index !== undefined ? agniMatch.index + agniMatch[0].length : undefined,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'hi',
          extractionEngine: 'ayushConceptMatcher',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  return facts;
}

/**
 * Extracts medications with dose and frequency.
 * Treats mentions as MEDICATION history (MedicationStatement), NOT prescription orders!
 */
export function extractMedicationFacts(
  text: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  const normalizedMatches = normalizeMedications(text);
  const parsedComp = parseMedicationComponents(text);

  for (const m of normalizedMatches) {
    const rawDose = parsedComp.dose || m.dosage || text.match(/(\d+\s*mg)/i)?.[1];
    const unit = parsedComp.unit || 'mg';
    const dosage = rawDose
      ? rawDose.toLowerCase().includes(unit.toLowerCase())
        ? rawDose
        : `${rawDose}${unit}`
      : undefined;
    const freq =
      parsedComp.frequency ||
      m.frequency ||
      text.match(/\b(bd|bid|tds|tid|od|qd|sos)\b/i)?.[1]?.toUpperCase();

    // Check for discontinuation, cessation, or negation markers
    const isDiscontinued = /\b(band\s+kar\s+d(?:i|iya|e|ege|ungi)|band\s+hai|rok\s+d(?:i|iya|e)|rok\s+diya|nahi\s+le\s+rah[aei]|nahin\s+le\s+rah[aei]|chhod\s+d(?:i|iya|e)|le\s+nahi\s+rah[aei]|le\s+nahin\s+rah[aei]|band\s+ki|stopped|discontinued|not\s+taking|no\s+longer\s+taking|ceased|quit)\b/i.test(text);

    const assertion: FactAssertion = isDiscontinued ? 'NEGATED' : 'AFFIRMED';
    const temporality: FactTemporality = isDiscontinued ? 'HISTORICAL' : 'CURRENT';

    const medAttrs: MedicationAttributes = {
      drugName: m.genericName,
      dose: rawDose,
      dosage,
      unit,
      frequency: freq,
      route: parsedComp.route,
      isPrescriptionOrder: false, // Patient/document mention is NEVER an order!
      status: isDiscontinued ? 'discontinued' : 'active',
      isDiscontinued,
    };

    let evText = m.surfaceText || text.trim();
    let startOffset = 0;
    let endOffset = text.length;

    if (isDiscontinued) {
      evText = text.trim();
      startOffset = 0;
      endOffset = evText.length;
    } else if (m.surfaceText && text.includes(m.surfaceText)) {
      startOffset = text.indexOf(m.surfaceText);
      endOffset = startOffset + m.surfaceText.length;
    }

    facts.push(
      createClinicalFact({
        factId: generateFactId(m.canonicalId, sourceType, isDiscontinued ? 'discontinued' : undefined),
        encounterId: context.encounterId,
        domain: 'medication',
        canonicalId: m.canonicalId,
        preferredTerm: m.genericName,
        value: `${m.genericName}${medAttrs.dose ? ` ${medAttrs.dose}` : ''}${medAttrs.frequency ? ` ${medAttrs.frequency}` : ''}${isDiscontinued ? ' (Discontinued)' : ''}`,
        attributes: medAttrs,
        assertion,
        elicitation: 'ELICITED',
        temporality,
        experiencer: context.experiencer || 'PATIENT',
        confidence: m.confidence,
        evidence: [
          {
            text: evText,
            verbatimText: evText,
            startOffset,
            endOffset,
            startChar: startOffset,
            endChar: endOffset,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'en',
          extractionEngine: 'medicationNormalizer',
          confidence: m.confidence,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  return facts;
}

/**
 * Extracts vital signs from clinical text or transcripts:
 * - Blood pressure (e.g. "Blood pressure 148/92", "BP 148/92 mmHg")
 * - Heart rate / Pulse (e.g. "Pulse 78 bpm", "Heart rate 80")
 */
export function extractVitalFacts(
  text: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';

  // 1. Blood Pressure: e.g. "Blood pressure 148/92", "BP: 120/80 mmHg", "148/92 mmHg"
  const bpRegex = /\b(?:blood\s+pressure|bp|raktchap)?\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:mm\s*hg|bp)?\b/i;
  const bpMatch = text.match(bpRegex);
  if (bpMatch && bpMatch[1] && bpMatch[2]) {
    const systolicVal = parseInt(bpMatch[1], 10);
    const diastolicVal = parseInt(bpMatch[2], 10);

    // Validate physiological range
    if (systolicVal >= 50 && systolicVal <= 300 && diastolicVal >= 30 && diastolicVal <= 200) {
      const matchIndex = bpMatch.index ?? 0;
      const matchEnd = matchIndex + bpMatch[0].length;

      // Systolic Fact
      facts.push(
        createClinicalFact({
          factId: generateFactId('VITAL_BP_SYSTOLIC', sourceType, 'systolic'),
          encounterId: context.encounterId,
          domain: 'vital',
          canonicalId: 'VITAL_BP_SYSTOLIC',
          preferredTerm: 'Systolic Blood Pressure',
          value: systolicVal,
          attributes: {
            unit: 'mmHg',
            systolic: systolicVal,
            reading: `${systolicVal}/${diastolicVal}`,
          },
          assertion: 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'CURRENT',
          experiencer: context.experiencer || 'PATIENT',
          confidence: 0.98,
          evidence: [
            {
              text: bpMatch[0],
              verbatimText: bpMatch[0],
              startOffset: matchIndex,
              endOffset: matchEnd,
              startChar: matchIndex,
              endChar: matchEnd,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'en',
            extractionEngine: 'vitalSignsExtractor',
            confidence: 0.98,
            timestamp: new Date().toISOString(),
          },
        })
      );

      // Diastolic Fact
      facts.push(
        createClinicalFact({
          factId: generateFactId('VITAL_BP_DIASTOLIC', sourceType, 'diastolic'),
          encounterId: context.encounterId,
          domain: 'vital',
          canonicalId: 'VITAL_BP_DIASTOLIC',
          preferredTerm: 'Diastolic Blood Pressure',
          value: diastolicVal,
          attributes: {
            unit: 'mmHg',
            diastolic: diastolicVal,
            reading: `${systolicVal}/${diastolicVal}`,
          },
          assertion: 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'CURRENT',
          experiencer: context.experiencer || 'PATIENT',
          confidence: 0.98,
          evidence: [
            {
              text: bpMatch[0],
              verbatimText: bpMatch[0],
              startOffset: matchIndex,
              endOffset: matchEnd,
              startChar: matchIndex,
              endChar: matchEnd,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'en',
            extractionEngine: 'vitalSignsExtractor',
            confidence: 0.98,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  // 2. Pulse / Heart Rate: e.g. "Pulse 78 bpm", "Heart rate 80"
  const hrRegex = /\b(?:heart\s+rate|pulse|hr)\s*[:=]?\s*(\d{2,3})\s*(?:bpm)?\b/i;
  const hrMatch = text.match(hrRegex);
  if (hrMatch && hrMatch[1]) {
    const hrVal = parseInt(hrMatch[1], 10);
    if (hrVal >= 30 && hrVal <= 250) {
      const matchIndex = hrMatch.index ?? 0;
      const matchEnd = matchIndex + hrMatch[0].length;
      facts.push(
        createClinicalFact({
          factId: generateFactId('VITAL_HEART_RATE', sourceType),
          encounterId: context.encounterId,
          domain: 'vital',
          canonicalId: 'VITAL_HEART_RATE',
          preferredTerm: 'Heart Rate',
          value: hrVal,
          attributes: { unit: 'bpm', heartRate: hrVal },
          assertion: 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'CURRENT',
          experiencer: context.experiencer || 'PATIENT',
          confidence: 0.95,
          evidence: [
            {
              text: hrMatch[0],
              verbatimText: hrMatch[0],
              startOffset: matchIndex,
              endOffset: matchEnd,
              startChar: matchIndex,
              endChar: matchEnd,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'en',
            extractionEngine: 'vitalSignsExtractor',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  return facts;
}

interface KnownConditionDef {
  canonicalId: string;
  preferredTerm: string;
  regex: RegExp;
}

const KNOWN_CONDITIONS: KnownConditionDef[] = [
  {
    canonicalId: 'COND_DIABETES',
    preferredTerm: 'Diabetes Mellitus',
    regex: /(?:\b(diabetes|madhumeh|sugar\s+ki\s+bimari|shugar|sugar)\b|डायबिटीज|मधुमेह|शुगर)/i,
  },
  {
    canonicalId: 'COND_HYPERTENSION',
    preferredTerm: 'Hypertension',
    regex: /(?:\b(hypertension|high\s+bp|bp\s+high|raktchap|raktadaab|bp\s+problem|bp\s+ka\s+problem|bp\s+ki\s+problem|bp\s+ki\s+bimari|blood\s+pressure)\b|हाई\s*बीपी|रक्तचाप)/i,
  },
  {
    canonicalId: 'COND_ASTHMA',
    preferredTerm: 'Asthma',
    regex: /\b(asthma|dama|dame\s+ki\s+bimari)\b/i,
  },
  {
    canonicalId: 'COND_KIDNEY_STONE',
    preferredTerm: 'Kidney Stones (Nephrolithiasis)',
    regex: /\b(pathri|gurde\s+ki\s+pathri|kidney\s+stones?|nephrolithiasis)\b/i,
  },
  {
    canonicalId: 'COND_TUBERCULOSIS',
    preferredTerm: 'Tuberculosis',
    regex: /\b(tuberculosis|tapedik|tb\s+ki\s+bimari|\btb\b)\b/i,
  },
  {
    canonicalId: 'COND_HEART_DISEASE',
    preferredTerm: 'Heart Disease',
    regex: /\b(heart\s+disease|heart\s+attack|dil\s+ki\s+bimari|hriday\s+rog)\b/i,
  },
];

/**
 * Extracts conditions with strict temporal, assertion, and experiencer semantics.
 * Handles:
 * - Contrastive clauses: "Pehle diabetes tha, ab nahi hai" -> emits both HISTORICAL AFFIRMED and CURRENT NEGATED
 * - Historical past: "Pehle diabetes tha" -> HISTORICAL AFFIRMED
 * - Current negation: "Ab diabetes nahi hai" -> CURRENT NEGATED
 * - Family experiencer: "Mother had asthma" -> experiencer: 'FAMILY_MEMBER'
 * - Suspected: "Shayad pathri hai" -> assertion: 'SUSPECTED'
 * - Conditional: "Agar dard badhe to" -> assertion: 'CONDITIONAL'
 */
export function extractTemporalConditionFacts(
  text: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  const facts: ClinicalFact[] = [];
  const sourceType: FactSourceType = context.sourceType || 'PATIENT_VOICE';
  const lowerText = text.toLowerCase();

  // Experiencer check (e.g. "Mother had asthma", "Father had hypertension", "मेरी माताजी को डायबिटीज है")
  const familyMatch = text.match(/(?:\b(mother|mummy|maa|mataji|father|papa|pitaji|brother|bhai|sister|behan|parents|family)\b|माताजी|माँ|माता|पिताजी|पिता|भाई|बहन|परिवार|आई|वडील)/i);
  const experiencer: FactExperiencer = familyMatch ? 'FAMILY_MEMBER' : (context.experiencer || 'PATIENT');

  // Uncertainty check (e.g. "Shayad pathri hai", "Maybe diabetes")
  const isSuspected = /\b(shayad|lagta\s+hai|ho\s+sakta\s+hai|suspect|maybe|perhaps|possible|possibly)\b/i.test(lowerText);

  // Conditional check (e.g. "Agar dard badhe to")
  const isConditional = /\b(agar\b|yadi\b|jab\b|if\b|whenever|in\s+case)\b/i.test(lowerText);

  // Historical markers
  const hasHistoricalMarker = /\b(pehle|past\s+me|purani|earlier|previously|history\s+of|had\b|tha\b|thi\b|the\b)\b/i.test(lowerText);

  // Current negation markers
  const hasCurrentNegation =
    /\b(ab\s+nahi|ab\s+nahin|now\s+no|not\s+anymore|ab\s+theek|ab\s+normal|now\s+resolved)\b/i.test(lowerText) ||
    /\b(ab|now)\b[^,.;]*\b(nahi|nahin|not)\b/i.test(lowerText);

  // General negation (e.g. "nahi hai", "denies", "no")
  const hasGeneralNegation =
    /\b(nahi\s+hai|nahin\s+hai|nhi\s+hai|not\s+present|denies|denied|no\b|ruled\s+out)\b/i.test(lowerText);

  for (const cond of KNOWN_CONDITIONS) {
    const match = text.match(cond.regex);
    if (!match) continue;

    const matchIndex = match.index ?? 0;
    const matchEnd = matchIndex + match[0].length;

    // Case 1: Contrastive utterance: "Pehle diabetes tha, ab nahi hai"
    if (hasHistoricalMarker && hasCurrentNegation) {
      // Split into clauses by punctuation or contrastive conjunctions
      const clauses = text.split(/[,;।|]|\b(?:lekin|par|magar|kintu|but|however)\b/i);
      const histClause = clauses.find((c) => /\b(pehle|past\s+me|purani|earlier|previously|history\s+of|had|tha|thi|the)\b/i.test(c)) || clauses[0] || text;
      const currClause = clauses.find((c) => /\b(ab|now|not\s+anymore|resolved)\b/i.test(c)) || clauses[1] || 'ab nahi hai';

      const histEvidence = histClause.trim();
      const histStart = text.indexOf(histEvidence);
      const histEnd = histStart >= 0 ? histStart + histEvidence.length : histEvidence.length;

      facts.push(
        createClinicalFact({
          factId: generateFactId(cond.canonicalId, sourceType, 'historical'),
          encounterId: context.encounterId,
          domain: 'condition',
          canonicalId: cond.canonicalId,
          preferredTerm: cond.preferredTerm,
          assertion: isSuspected ? 'SUSPECTED' : isConditional ? 'CONDITIONAL' : 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'HISTORICAL',
          experiencer,
          confidence: 0.95,
          evidence: [
            {
              text: histEvidence,
              verbatimText: histEvidence,
              startOffset: Math.max(0, histStart),
              endOffset: histEnd,
              startChar: Math.max(0, histStart),
              endChar: histEnd,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'hi',
            extractionEngine: 'temporalConditionExtractor',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
          },
        })
      );

      // 2. Current Negated Fact
      const currEvidence = currClause.trim();
      const currStart = text.indexOf(currEvidence);
      const currEnd = currStart >= 0 ? currStart + currEvidence.length : currEvidence.length;

      facts.push(
        createClinicalFact({
          factId: generateFactId(cond.canonicalId, sourceType, 'current'),
          encounterId: context.encounterId,
          domain: 'condition',
          canonicalId: cond.canonicalId,
          preferredTerm: cond.preferredTerm,
          assertion: 'NEGATED',
          elicitation: 'ELICITED',
          temporality: 'CURRENT',
          experiencer,
          confidence: 0.95,
          evidence: [
            {
              text: currEvidence,
              verbatimText: currEvidence,
              startOffset: Math.max(0, currStart),
              endOffset: currEnd,
              startChar: Math.max(0, currStart),
              endChar: currEnd,
            },
          ],
          provenance: {
            sourceType,
            sourceId: context.sourceId,
            language: context.language || 'hi',
            extractionEngine: 'temporalConditionExtractor',
            confidence: 0.95,
            timestamp: new Date().toISOString(),
          },
        })
      );

      continue;
    }

    // Case 2: Individual Historical vs Current Negated vs Current Affirmed
    let temporality: FactTemporality = 'CURRENT';
    let assertion: FactAssertion = 'AFFIRMED';

    if (hasHistoricalMarker) {
      temporality = 'HISTORICAL';
      assertion = isSuspected ? 'SUSPECTED' : isConditional ? 'CONDITIONAL' : (hasGeneralNegation ? 'NEGATED' : 'AFFIRMED');
    } else if (hasCurrentNegation || hasGeneralNegation) {
      temporality = 'CURRENT';
      assertion = 'NEGATED';
    } else {
      temporality = 'CURRENT';
      assertion = isSuspected ? 'SUSPECTED' : isConditional ? 'CONDITIONAL' : 'AFFIRMED';
    }

    // Evidence span
    let evText = text.trim();
    let evStart = 0;
    let evEnd = text.length;
    const clauseMatch = text.match(new RegExp(`[^,.;]*?${match[0]}[^,.;]*`, 'i'));
    if (clauseMatch && clauseMatch.index !== undefined) {
      evText = clauseMatch[0].trim();
      evStart = clauseMatch.index;
      evEnd = evStart + clauseMatch[0].length;
    }

    facts.push(
      createClinicalFact({
        factId: generateFactId(cond.canonicalId, sourceType, temporality.toLowerCase()),
        encounterId: context.encounterId,
        domain: 'condition',
        canonicalId: cond.canonicalId,
        preferredTerm: cond.preferredTerm,
        assertion,
        elicitation: 'ELICITED',
        temporality,
        experiencer,
        confidence: 0.95,
        evidence: [
          {
            text: evText,
            verbatimText: evText,
            startOffset: evStart,
            endOffset: evEnd,
            startChar: evStart,
            endChar: evEnd,
          },
        ],
        provenance: {
          sourceType,
          sourceId: context.sourceId,
          language: context.language || 'en',
          extractionEngine: 'temporalConditionExtractor',
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  return facts;
}

/**
 * Master Headless Canonical Fact Extractor.
 * Runs deterministic bilingual NLP + medication + AYUSH + allergy matching.
 * Validates each fact through the Evidence Gate before returning.
 */
export function extractCanonicalFacts(
  input: string,
  context: ExtractionContext = {}
): ClinicalFact[] {
  if (!input || !input.trim()) {
    return [];
  }

  const raw = input.trim();
  const facts: ClinicalFact[] = [];
  const seenFactKeys = new Set<string>();

  const getFactKey = (f: ClinicalFact): string =>
    `${f.canonicalId || f.code}_${f.assertion}_${f.temporality}_${f.experiencer}`;

  // 1. Vital Signs Extraction (e.g. BP 148/92, Pulse 78)
  const vitalFacts = extractVitalFacts(raw, context);
  for (const vf of vitalFacts) {
    const key = getFactKey(vf);
    if (!seenFactKeys.has(key)) {
      facts.push(vf);
      seenFactKeys.add(key);
    }
  }

  // 2. Temporal Condition Facts (contrastive clauses, historical vs current, suspected, experiencer)
  const temporalCondFacts = extractTemporalConditionFacts(raw, context);
  const specializedCondIds = new Set<string>();
  for (const tcf of temporalCondFacts) {
    const key = getFactKey(tcf);
    if (!seenFactKeys.has(key)) {
      facts.push(tcf);
      seenFactKeys.add(key);
      specializedCondIds.add(tcf.canonicalId);
    }
  }

  // 3. Check if Hindi / Romanized Hindi is present
  const isDevanagari = /[\u0900-\u097F]/.test(raw);
  const isHindiKeywords =
    /\b(dard|bukhar|sirdard|chakkar|ulti|dast|khasi|seene|chhati|nahi|nahin|lekin|sar\s+dard)\b/i.test(
      raw
    );

  if (isDevanagari || isHindiKeywords) {
    const hindiResult = analyzeHindiTranscript(
      raw,
      hindiSymptoms as unknown as ClinicalConcept[],
      hindiNegation as any,
      hindiTemporal as any
    );
    for (const hf of hindiResult.facts) {
      if (specializedCondIds.has(hf.conceptId)) {
        continue;
      }
      const canonical = adaptHindiFactToFact(hf, raw, context, hindiResult.temporal);
      const key = getFactKey(canonical);
      if (!seenFactKeys.has(key)) {
        facts.push(canonical);
        seenFactKeys.add(key);
      }
    }
  }

  // 4. Multilingual concept extractor
  const concepts = extractMultilingualConcepts(raw, 'patient_voice', context.language);
  for (const c of concepts) {
    if (specializedCondIds.has(c.conceptId)) {
      continue;
    }
    const canonical = adaptExtractedConceptToFact(c, context);
    const key = getFactKey(canonical);
    if (!seenFactKeys.has(key)) {
      facts.push(canonical);
      seenFactKeys.add(key);
    }
  }

  // 5. Medication Extraction (with dose, unit, frequency)
  const medFacts = extractMedicationFacts(raw, context);
  for (const mf of medFacts) {
    const key = getFactKey(mf);
    if (!seenFactKeys.has(key)) {
      facts.push(mf);
      seenFactKeys.add(key);
    }
  }

  // 6. AYUSH Extraction
  const ayushFacts = extractAYUSHFacts(raw, context);
  for (const af of ayushFacts) {
    const key = getFactKey(af);
    if (!seenFactKeys.has(key)) {
      facts.push(af);
      seenFactKeys.add(key);
    }
  }

  // 7. Allergy Extraction
  const allergyFacts = extractAllergyFacts(raw, context);
  for (const alf of allergyFacts) {
    const key = getFactKey(alf);
    if (!seenFactKeys.has(key)) {
      facts.push(alf);
      seenFactKeys.add(key);
    }
  }

  // 8. Run all facts through the Evidence Gatekeeper
  const validatedFacts = facts.filter((f) => {
    const validation = validateClinicalFact(f);
    if (!validation.valid) {
      console.warn(`[EvidenceGate] Rejected invalid fact:`, validation.violations, f);
      return false;
    }
    return true;
  });

  return validatedFacts;
}

/**
 * Headless extraction runner for multi-turn dialogues or multi-sentence batches.
 * Fully decoupled from React or UI lifecycle.
 */
export function runHeadlessClinicalExtractionPipeline(
  inputs: string[],
  options?: { includeUnelicitedAllergy?: boolean; context?: ExtractionContext }
): { facts: ClinicalFact[] } {
  const allFacts: ClinicalFact[] = [];
  for (const input of inputs) {
    allFacts.push(...extractCanonicalFacts(input, options?.context));
  }
  if (options?.includeUnelicitedAllergy) {
    const hasAllergy = allFacts.some(
      (f) => f.domain === 'allergy' || f.domain === 'ALLERGY'
    );
    if (!hasAllergy) {
      allFacts.push(createUnelicitedAllergyFact(options?.context));
    }
  }
  return { facts: allFacts };
}
