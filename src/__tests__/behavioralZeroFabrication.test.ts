import { describe, it, expect } from 'vitest';
import {
  extractCanonicalFacts,
  createUnelicitedAllergyFact,
} from '../clinical/extractionPipeline';
import { generatePhysicianReadyIntakeSummary } from '../utils/intakeSummaryGenerator';
import { auditProjectionIntegrity } from '../clinical/evidenceGate';

describe('Phase 5 / Gate 5: Behavioral Zero-Fabrication Regression Suite (Cases A-H)', () => {
  // Case A: "No BP problem."
  it('Case A: "No BP problem." -> hypertension NEGATED, no hypertension diagnosis generated', () => {
    const text = 'No BP problem.';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const bpFact = facts.find((f) => f.code === 'COND_HYPERTENSION' || f.canonicalId === 'COND_HYPERTENSION');

    expect(bpFact).toBeDefined();
    expect(bpFact?.assertion).toBe('NEGATED');

    const summary = generatePhysicianReadyIntakeSummary(null, null, 'Allopathic', [], facts);
    expect(summary.soapNote.assessment.primary_diagnosis).not.toContain('Hypertension');
    expect(summary.soapNote.assessment.primary_diagnosis).toBe('Pending attending physician evaluation');
  });

  // Case B: "BP ka problem nahi hai lekin sar dard hai."
  it('Case B: "BP ka problem nahi hai lekin sar dard hai." -> hypertension NEGATED, headache AFFIRMED', () => {
    const text = 'BP ka problem nahi hai lekin sar dard hai.';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });

    const bpFact = facts.find((f) => f.code === 'COND_HYPERTENSION' || f.canonicalId === 'COND_HYPERTENSION');
    const headacheFact = facts.find((f) => f.code === 'SYM_HEADACHE' || f.canonicalId === 'SYM_HEADACHE');

    expect(bpFact).toBeDefined();
    expect(bpFact?.assertion).toBe('NEGATED');

    expect(headacheFact).toBeDefined();
    expect(headacheFact?.assertion).toBe('AFFIRMED');
  });

  // Case C: "Metformin 500 mg BD."
  it('Case C: "Metformin 500 mg BD." -> medication name=Metformin, dose=500 mg, frequency=BD', () => {
    const text = 'Metformin 500 mg BD.';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const med = facts.find((f) => f.domain === 'medication');

    expect(med).toBeDefined();
    expect(med?.term.toLowerCase()).toContain('metformin');
    expect((med?.attributes as any)?.dose).toBe('500');
    expect((med?.attributes as any)?.unit).toBe('mg');
    expect((med?.attributes as any)?.frequency).toBe('BD');
  });

  // Case D: "No allergy information provided."
  it('Case D: "No allergy information provided." -> allergy status UNKNOWN, never convert to NKDA', () => {
    const unelicited = createUnelicitedAllergyFact();

    expect(unelicited.assertion).toBe('UNKNOWN');
    expect(unelicited.elicitation).toBe('NOT_ELICITED');
    expect(unelicited.preferredTerm).not.toContain('No Known Drug Allergies');
    expect(unelicited.preferredTerm).not.toContain('NKDA');

    const summary = generatePhysicianReadyIntakeSummary(null, null, 'Allopathic', [], [unelicited]);
    expect(summary.soapNote.subjective.allergies.some((a) => a.toLowerCase().includes('nkda'))).toBe(false);
  });

  // Case E: "No vitals documented."
  it('Case E: "No vitals documented." -> vitals UNKNOWN, never generate 120/80, 38.9, 115', () => {
    const text = 'Patient discusses general symptoms without recording vitals.';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });

    const vitals = facts.filter((f) => f.domain === 'vital');
    expect(vitals.length).toBe(0);

    const summary = generatePhysicianReadyIntakeSummary(null, null, 'Allopathic', [], facts);
    const vitalsText = summary.soapNote.objective.vital_signs;

    expect(vitalsText).not.toContain('120/80');
    expect(vitalsText).not.toContain('38.9');
    expect(vitalsText).not.toContain('115');
    expect(vitalsText).toContain('Not documented');
  });

  // Case F: No diagnosis evidence.
  it('Case F: No diagnosis evidence -> no diagnosis projection', () => {
    const text = 'Patient reports feeling mild fatigue.';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });

    const summary = generatePhysicianReadyIntakeSummary(null, null, 'Allopathic', [], facts);
    expect(summary.soapNote.assessment.primary_diagnosis).toBe('Pending attending physician evaluation');

    // Audit projection integrity
    const audit = auditProjectionIntegrity(facts, {
      diagnoses: [],
      prescriptions: [],
      vitals: 'Not documented',
    });
    expect(audit.passed).toBe(true);
    expect(audit.violations.length).toBe(0);
  });

  // Case G: Patient-reported AYUSH statement
  it('Case G: "Meri prakriti Vata-Pitta hai." -> AYUSH finding source=patient_reported (never clinician_assessed)', () => {
    const text = 'Meri prakriti Vata-Pitta hai.';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const ayushFact = facts.find((f) => f.domain === 'ayush');

    expect(ayushFact).toBeDefined();
    expect(ayushFact?.reporterType).toBe('PATIENT_REPORTED');
    expect(ayushFact?.reporterType).not.toBe('CLINICIAN_OBSERVED');
    expect(ayushFact?.preferredTerm).toContain('Patient-Reported');
  });

  // Case H: "Mother has diabetes."
  it('Case H: "Mother has diabetes." -> diabetes experiencer = FAMILY_MEMBER (not patient)', () => {
    const text = 'Mother has diabetes.';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const diabetesFact = facts.find((f) => f.code === 'COND_DIABETES' || f.canonicalId === 'COND_DIABETES');

    expect(diabetesFact).toBeDefined();
    expect(diabetesFact?.experiencer).toBe('FAMILY_MEMBER');
    expect(diabetesFact?.experiencer).not.toBe('PATIENT');
  });
});
