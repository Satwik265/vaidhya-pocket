/**
 * Clinical Evidence & Fabrication Gatekeeper.
 *
 * Enforces zero clinical fabrication invariants across both fact ingestion and downstream projection.
 */

import { ClinicalFact } from './clinicalFactModel';

export interface FactValidationResult {
  valid: boolean;
  violations: string[];
  errors: string[]; // Alias for violations
}

export interface ProjectionAuditResult {
  safe: boolean;
  passed: boolean; // Alias for safe
  ungroundedElements: string[];
  violations: Array<{ type: string; message: string }>;
}

/**
 * Validates that an ingested ClinicalFact obeys strict clinical evidence rules.
 */
export function validateClinicalFact(fact: ClinicalFact): FactValidationResult {
  const violations: string[] = [];

  if (!fact) {
    return { valid: false, violations: ['Fact cannot be null or undefined'], errors: ['Fact cannot be null or undefined'] };
  }

  // 1. Mandatory Canonical & Domain identifiers
  if (!fact.canonicalId || !fact.canonicalId.trim()) {
    violations.push('Missing canonicalId');
  }
  if (!fact.domain) {
    violations.push('Missing domain');
  }

  // 2. Evidence Grounding Invariant: Patient/Document facts MUST have evidence
  const isPatientOrDoc =
    fact.provenance?.sourceType === 'PATIENT_VOICE' ||
    fact.provenance?.sourceType === 'PATIENT_TEXT' ||
    fact.provenance?.sourceType === 'PATIENT_TAP' ||
    fact.provenance?.sourceType === 'PATIENT_TOUCH' ||
    fact.provenance?.sourceType === 'UPLOADED_DOCUMENT';

  const hasEvidence =
    Array.isArray(fact.evidence) &&
    fact.evidence.length > 0 &&
    fact.evidence.some(
      (e) => (e.text && e.text.trim()) || (e.verbatimText && e.verbatimText.trim())
    );

  if (isPatientOrDoc && fact.assertion !== 'UNKNOWN') {
    if (!hasEvidence) {
      violations.push(
        `Patient/Document-derived fact (${fact.canonicalId}) requires at least one evidence span with verbatim text`
      );
    }
  }

  // 3. Elicitation / Assertion Orthogonality Invariant:
  // An unelicited topic CANNOT have a NEGATED finding without explicit evidence.
  if (fact.elicitation === 'NOT_ELICITED' && fact.assertion === 'NEGATED') {
    violations.push(
      `Illegal state: Fact (${fact.canonicalId}) cannot be NEGATED when NOT_ELICITED`
    );
  }

  // 4. AYUSH Clinician/Patient Boundary Invariant
  if (
    (fact.domain === 'ayush' || fact.domain === 'AYUSH') &&
    fact.attributes &&
    'reporterType' in fact.attributes
  ) {
    const reporter = (fact.attributes as any).reporterType;
    if (reporter === 'PATIENT_REPORTED' && fact.provenance?.sourceType === 'CLINICIAN_ENTERED') {
      violations.push(
        `Boundary violation: Patient-reported AYUSH fact cannot have clinician provenance`
      );
    }
  }

  // 5. Confidence Range Invariant
  const conf = fact.confidence ?? fact.provenance?.confidence;
  if (conf !== undefined && (conf < 0.0 || conf > 1.0)) {
    violations.push(`Confidence score (${conf}) out of valid [0.0, 1.0] range`);
  }

  return {
    valid: violations.length === 0,
    violations,
    errors: violations,
  };
}

/**
 * Known synthetic/fabricated diagnostic strings that must NEVER appear
 * without an anchored ClinicalFact.
 */
const FORBIDDEN_SYNTHETIC_DIAGNOSES = [
  'gastroesophageal reflux disease',
  'gerd',
  'amlapitta',
  'functional dyspepsia',
  'peptic ulcer disease',
  'plasmodium falciparum malaria',
  'acute suppurative otitis media',
];

/**
 * Audits a generated summary, SOAP note, or FHIR bundle before output.
 * Flags any unanchored diagnoses, unanchored vitals, or unanchored prescriptions.
 */
export function auditProjectionIntegrity(
  arg1:
    | {
        diagnoses?: string[];
        vitals?: string;
        prescriptions?: any[];
        allergies?: string[];
        facts: ClinicalFact[];
      }
    | ClinicalFact[],
  arg2?: any,
  arg3?: { isPreConsultationIntake?: boolean }
): ProjectionAuditResult {
  let facts: ClinicalFact[] = [];
  let diagnoses: string[] = [];
  let vitals: string | undefined;
  let prescriptions: any[] = [];
  let allergies: string[] = [];
  let isPreConsult = arg3?.isPreConsultationIntake ?? false;

  if (Array.isArray(arg1)) {
    facts = arg1;
    const proj = arg2 || {};
    if (proj.assessment?.primary_diagnosis) {
      diagnoses.push(proj.assessment.primary_diagnosis);
    }
    if (proj.assessment?.differential_diagnoses) {
      diagnoses.push(...proj.assessment.differential_diagnoses);
    }
    if (proj.diagnoses) {
      diagnoses.push(...proj.diagnoses);
    }
    vitals = proj.objective?.vital_signs || proj.vitals;
    prescriptions = proj.plan?.prescriptions || proj.prescriptions || [];
    allergies = proj.subjective?.allergies || proj.allergies || [];
  } else {
    facts = arg1.facts || [];
    diagnoses = arg1.diagnoses || [];
    vitals = arg1.vitals;
    prescriptions = arg1.prescriptions || [];
    allergies = arg1.allergies || [];
  }

  const violations: Array<{ type: string; message: string }> = [];
  const ungrounded: string[] = [];

  // Build searchable index of evidence tokens from all grounded facts
  const factTerms = facts.map((f) => (f.preferredTerm || f.term || '').toLowerCase().trim()).filter(Boolean);
  const factCodes = facts.map((f) => (f.canonicalId || f.code || '').toLowerCase().trim()).filter(Boolean);
  const factEvidenceTexts = facts.flatMap((f) =>
    (f.evidence || []).map((e) => (e.verbatimText || e.text || '').toLowerCase().trim()).filter(Boolean)
  );

  const affirmedCodes = new Set(
    facts
      .filter((f) => f.assertion === 'AFFIRMED' || f.assertion === 'SUSPECTED' || f.assertion === 'CONDITIONAL')
      .map((f) => (f.canonicalId || f.code || '').toLowerCase())
  );

  // Helper to check if a text token is grounded in any fact's term, code, or verbatim evidence
  const isGroundedInFacts = (query: string): boolean => {
    const q = query.toLowerCase();
    const words = q.split(/[\s,()/-]+/).filter((w) => w.length > 3);
    if (words.length === 0) return false;

    // Check if code matches
    if (factCodes.some((code) => q.includes(code) || code.includes(q))) return true;

    // Check if term matches
    if (factTerms.some((term) => q.includes(term) || term.includes(q))) return true;

    // Check if evidence text matches
    if (factEvidenceTexts.some((ev) => words.some((w) => ev.includes(w)))) return true;

    // Check if any word is anchored in fact terms or evidence
    const matchedWords = words.filter((w) =>
      factTerms.some((t) => t.includes(w)) ||
      factEvidenceTexts.some((ev) => ev.includes(w)) ||
      factCodes.some((c) => c.includes(w))
    );

    return matchedWords.length > 0;
  };

  // 1. Diagnosis Grounding Check (Provenance-based, with blacklist defense-in-depth)
  const isPlaceholderDiagnosis = (d: string): boolean => {
    const l = d.toLowerCase();
    return (
      !l ||
      l.includes('not documented') ||
      l.includes('pending physician') ||
      l.includes('pending clinician') ||
      l.includes('pending attending') ||
      l.includes('pending consultation') ||
      l.includes('unconfirmed') ||
      l.includes('symptom evaluation') ||
      l.includes('none listed') ||
      l.includes('none documented') ||
      l.includes('primary care consultation') ||
      l.includes('acute medical evaluation')
    );
  };

  if (diagnoses && diagnoses.length > 0) {
    for (const diag of diagnoses) {
      if (!diag || isPlaceholderDiagnosis(diag)) {
        continue;
      }

      const lowerDiag = diag.toLowerCase();

      // Defense-in-depth: Check known synthetic blacklist
      const isKnownSynthetic = FORBIDDEN_SYNTHETIC_DIAGNOSES.some((syn) =>
        lowerDiag.includes(syn)
      );

      // Semantic provenance verification: Is this diagnosis anchored in any ClinicalFact?
      const isAnchored = isGroundedInFacts(diag);

      if (isKnownSynthetic && !isAnchored) {
        const msg = `Fabricated diagnosis detected without anchored fact: "${diag}"`;
        violations.push({ type: 'UNANCHORED_GERD_AMLAPITTA', message: msg });
        ungrounded.push(msg);
      } else if (!isAnchored) {
        // Universal Zero-Fabrication Gate: Any unanchored diagnosis is rejected!
        const msg = `Unanchored diagnosis detected without grounded ClinicalFact or clinician input: "${diag}"`;
        violations.push({ type: 'UNGROUNDED_DIAGNOSIS', message: msg });
        ungrounded.push(msg);
      }
    }
  }

  // 2. Prescription Grounding & Authorization Check
  if (prescriptions && prescriptions.length > 0) {
    for (const rx of prescriptions) {
      const medName = (rx.medication || rx.name || '').toLowerCase();
      const hasClinicianAuthor = rx.isClinicianApproved === true || rx.authoredByClinician === true;
      if (isPreConsult || !hasClinicianAuthor) {
        const msg = `Unanchored/Unauthorized prescription generated without clinician order: "${medName || 'unnamed'}"`;
        violations.push({ type: 'FABRICATED_PRESCRIPTION', message: msg });
        ungrounded.push(msg);
      }
    }
  }

  // 3. Vital Signs & Lab Grounding Check (Provenance-based numerical verification)
  if (vitals) {
    const v = vitals.toLowerCase();
    const isVitalsPlaceholder =
      v.includes('not documented') ||
      v.includes('not measured') ||
      v.includes('pending nursing') ||
      v.includes('pending triage') ||
      v.includes('pending physician');

    if (!isVitalsPlaceholder) {
      // Check for concrete numerical claims: BP (e.g. 120/80, 140/90), Temp (e.g. 37.0°C, 38.5C), HR
      const hasNumericalBP = /\b\d{2,3}\/\d{2,3}\b/.test(v);
      const hasNumericalTemp = /\b\d{2,3}(?:\.\d+)?\s*°?[cf]\b/i.test(v);
      const hasNumericalHR = /\b\d{2,3}\s*(?:bpm|beats)\b/i.test(v);

      if (hasNumericalBP || hasNumericalTemp || hasNumericalHR) {
        // Must be grounded in an affirmed vital fact or explicit transcript evidence
        const hasVitalFact = facts.some(
          (f) =>
            (f.domain.toLowerCase() === 'vital' || f.domain.toLowerCase() === 'investigation') &&
            f.assertion === 'AFFIRMED'
        );

        const hasNumericalEvidence = factEvidenceTexts.some(
          (ev) =>
            (hasNumericalBP && /\b\d{2,3}\/\d{2,3}\b/.test(ev)) ||
            (hasNumericalTemp && /\b\d{2,3}(?:\.\d+)?\s*°?[cf]\b/i.test(ev)) ||
            (hasNumericalHR && /\b\d{2,3}\s*(?:bpm|beats)\b/i.test(ev))
        );

        if (!hasVitalFact && !hasNumericalEvidence) {
          const msg = `Fabricated vital signs string detected without grounded fact or measurement evidence: "${vitals}"`;
          violations.push({ type: 'FABRICATED_VITAL_SIGNS', message: msg });
          ungrounded.push(msg);
        }
      }
    }
  }

  // 4. Allergy Grounding Check
  if (allergies && allergies.length > 0) {
    for (const alg of allergies) {
      const a = alg.toLowerCase().trim();
      if (!a || a.includes('not documented') || a.includes('not elicited') || a.includes('nkda') || a.includes('no known') || a.includes('none reported')) {
        continue;
      }
      if (!isGroundedInFacts(alg)) {
        const msg = `Unanchored allergy detected without grounded ClinicalFact or transcript evidence: "${alg}"`;
        violations.push({ type: 'UNANCHORED_ALLERGY', message: msg });
        ungrounded.push(msg);
      }
    }
  }

  const passed = violations.length === 0;
  return {
    safe: passed,
    passed,
    ungroundedElements: ungrounded,
    violations,
  };
}

/**
 * Asserts that zero fabrication has occurred; throws an error if violations are detected.
 */
export function assertZeroFabrication(
  facts: ClinicalFact[],
  projection: any,
  options?: { isPreConsultationIntake?: boolean }
): void {
  const audit = auditProjectionIntegrity(facts, projection, options);
  if (!audit.passed) {
    throw new Error(
      `Zero-fabrication gate violation: ${audit.violations.map((v) => v.message).join('; ')}`
    );
  }
}
