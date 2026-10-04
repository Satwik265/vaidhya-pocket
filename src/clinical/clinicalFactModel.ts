/**
 * Canonical ClinicalFact Domain Model.
 *
 * Single source of truth for clinical information across MedScribeAI.
 * Strictly separates clinical truth (assertion) from inquiry status (elicitation),
 * anchors all patient/document facts to verbatim evidence, and preserves provenance.
 */

export type FactDomain =
  | 'symptom'
  | 'condition'
  | 'medication'
  | 'allergy'
  | 'investigation'
  | 'vital'
  | 'anatomy'
  | 'ayush'
  | 'SYMPTOM'
  | 'CONDITION'
  | 'MEDICATION'
  | 'ALLERGY'
  | 'INVESTIGATION'
  | 'VITAL'
  | 'ANATOMY'
  | 'AYUSH';

export type FactAssertion =
  | 'AFFIRMED'
  | 'NEGATED'
  | 'SUSPECTED'
  | 'CONDITIONAL'
  | 'UNKNOWN';

export type FactElicitation =
  | 'ELICITED'
  | 'NOT_ELICITED';

export type FactTemporality =
  | 'CURRENT'
  | 'PAST'
  | 'PAST_ONGOING'
  | 'CHRONIC'
  | 'HISTORICAL'
  | 'RESOLVED'
  | 'UNSPECIFIED';

export type FactExperiencer =
  | 'PATIENT'
  | 'FAMILY_MEMBER'
  | 'OTHER';

export type FactSourceType =
  | 'PATIENT_VOICE'
  | 'PATIENT_TEXT'
  | 'PATIENT_TAP'
  | 'PATIENT_TOUCH'
  | 'UPLOADED_DOCUMENT'
  | 'CLINICIAN_ENTERED'
  | 'SYSTEM_DERIVED'
  | 'SYSTEM_INFERRED';

export interface FactEvidence {
  text?: string;
  verbatimText?: string;
  startOffset?: number;
  endOffset?: number;
  startChar?: number;
  endChar?: number;
  textSegmentId?: string;
}

export interface FactProvenance {
  sourceType: FactSourceType;
  sourceId?: string;
  language?: string;
  extractionEngine: string;
  confidence: number;
  timestamp: string;
}

export interface MedicationAttributes {
  drugName?: string;
  dose?: string;
  dosage?: string;
  unit?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  isPrescriptionOrder?: boolean;
  status?: 'active' | 'discontinued' | 'held' | 'completed' | string;
  isDiscontinued?: boolean;
}

export interface AYUSHAttributes {
  ayushCategory?: 'prakriti' | 'vikriti' | 'dosha' | 'agni' | 'kostha' | 'ahara' | 'vihara';
  constitutionalRole?: string;
  reporterType?: 'PATIENT_REPORTED' | 'CLINICIAN_ASSESSED' | 'CLINICIAN_OBSERVED' | 'SYSTEM_DERIVED';
  prakriti?: string;
  agniType?: string;
  vikriti?: string;
  duration?: string;
  dosage?: string;
  frequency?: string;
}

export interface ClinicalFact {
  factId: string;
  encounterId?: string;
  domain: FactDomain;
  canonicalId: string;
  preferredTerm: string;
  code: string; // Alias for canonicalId
  term: string; // Alias for preferredTerm
  codingSystem?: string;
  confidence?: number;
  reporterType?: 'PATIENT_REPORTED' | 'CLINICIAN_ASSESSED' | 'CLINICIAN_OBSERVED' | 'SYSTEM_DERIVED';
  value?: string | number | boolean | Record<string, unknown>;
  attributes?: MedicationAttributes | AYUSHAttributes | Record<string, unknown>;
  assertion: FactAssertion;
  elicitation: FactElicitation;
  temporality: FactTemporality;
  experiencer: FactExperiencer;
  evidence: FactEvidence[];
  provenance: FactProvenance;
}

/**
 * Creates a deterministic, repeatable fact ID based on domain, canonicalId, source, and optional offset.
 */
export function generateFactId(
  canonicalId: string,
  sourceType: FactSourceType,
  indexOrSpan?: string | number
): string {
  const cleanId = canonicalId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = indexOrSpan !== undefined ? `-${indexOrSpan}` : '';
  return `fact-${sourceType.toLowerCase()}-${cleanId}${suffix}`;
}

/**
 * Creates a fully-populated, validated ClinicalFact with default values.
 */
export function createClinicalFact(
  partial: Partial<Omit<ClinicalFact, 'provenance'>> & {
    domain: FactDomain;
    canonicalId?: string;
    code?: string;
    preferredTerm?: string;
    term?: string;
    assertion: FactAssertion;
    elicitation: FactElicitation;
    temporality?: FactTemporality;
    provenance?: Partial<FactProvenance>;
  }
): ClinicalFact {
  const canonicalId = partial.canonicalId || partial.code || 'UNKNOWN';
  const preferredTerm = partial.preferredTerm || partial.term || canonicalId;
  const sourceType = partial.provenance?.sourceType || 'PATIENT_VOICE';
  const factId = partial.factId || generateFactId(canonicalId, sourceType);

  let evidenceArr: FactEvidence[] = [];
  if (Array.isArray(partial.evidence)) {
    evidenceArr = partial.evidence.map((e) => ({
      ...e,
      text: e.text || e.verbatimText || '',
      verbatimText: e.verbatimText || e.text || '',
      startOffset: e.startOffset ?? e.startChar ?? 0,
      endOffset: e.endOffset ?? e.endChar ?? 0,
      startChar: e.startChar ?? e.startOffset ?? 0,
      endChar: e.endChar ?? e.endOffset ?? 0,
    }));
  } else if (partial.evidence) {
    const e = partial.evidence as any;
    evidenceArr = [
      {
        ...e,
        text: e.text || e.verbatimText || '',
        verbatimText: e.verbatimText || e.text || '',
        startOffset: e.startOffset ?? e.startChar ?? 0,
        endOffset: e.endOffset ?? e.endChar ?? 0,
        startChar: e.startChar ?? e.startOffset ?? 0,
        endChar: e.endChar ?? e.endOffset ?? 0,
      },
    ];
  }

  const confidence = partial.confidence ?? partial.provenance?.confidence ?? 1.0;

  return {
    factId,
    encounterId: partial.encounterId,
    domain: partial.domain,
    canonicalId,
    code: canonicalId,
    preferredTerm,
    term: preferredTerm,
    codingSystem: partial.codingSystem,
    confidence,
    reporterType: partial.reporterType,
    value: partial.value,
    attributes: partial.attributes,
    assertion: partial.assertion,
    elicitation: partial.elicitation,
    temporality: partial.temporality || 'CURRENT',
    experiencer: partial.experiencer || 'PATIENT',
    evidence: evidenceArr,
    provenance: {
      sourceType,
      extractionEngine: partial.provenance?.extractionEngine || 'canonical_pipeline',
      confidence,
      timestamp: partial.provenance?.timestamp || new Date().toISOString(),
      ...partial.provenance,
    },
  };
}
