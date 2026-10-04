import { describe, it, expect } from 'vitest';
import {
  ClinicalFact,
  createClinicalFact,
} from '../clinical/clinicalFactModel';
import { ClinicalFactStore } from '../clinical/clinicalFactStore';
import {
  extractCanonicalFacts,
  runHeadlessClinicalExtractionPipeline,
} from '../clinical/extractionPipeline';
import {
  validateClinicalFact,
  auditProjectionIntegrity,
  assertZeroFabrication,
} from '../clinical/evidenceGate';
import { evaluateRedFlagsFromFacts } from '../clinical/redFlagRules';
import { detectEmergencyFromFacts } from '../utils/emergencyTriageDetector';
import { generateStructuredSummary } from '../utils/intakeSummaryGenerator';
import { generateOfflineSOAPNote } from '../utils/offlineLocalEngine';
import { exportToFHIRBundle } from '../utils/fhirConverter';
import { PatientInfo, StructuredPatientIntake } from '../types';

describe('Phase 7B — Canonical ClinicalFact & Zero-Fabrication Enforcement', () => {
  const mockPatient: PatientInfo = {
    name: 'Maitray Agrawal',
    age: 28,
    gender: 'Male',
    encounterType: 'Outpatient Consultation',
    clinicLocation: 'OPD Station 01',
  };

  // 1. Hindi symptom extraction with verbatim evidence span
  it('1. extracts Hindi symptom "सीने में दर्द हो रहा है" with exact verbatim span', () => {
    const text = 'सीने में दर्द हो रहा है';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const chestPain = facts.find((f) => f.code === 'SYM_CHEST_PAIN');

    expect(chestPain).toBeDefined();
    expect(chestPain?.domain.toLowerCase()).toBe('symptom');
    expect(chestPain?.evidence.length).toBeGreaterThan(0);
    expect(chestPain?.evidence[0].verbatimText).toContain('दर्द');
    expect(chestPain?.evidence[0].startChar).toBeGreaterThanOrEqual(0);
    expect(chestPain?.evidence[0].endChar).toBeGreaterThan(chestPain!.evidence[0].startChar);
  });

  // 2. Strict assertion semantics: AFFIRMED
  it('2. sets assertion to AFFIRMED and elicitation to ELICITED for stated symptoms', () => {
    const text = 'मुझे दो दिन से सीने में दर्द है';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const chestPain = facts.find((f) => f.code === 'SYM_CHEST_PAIN');

    expect(chestPain).toBeDefined();
    expect(chestPain?.assertion).toBe('AFFIRMED');
    expect(chestPain?.elicitation).toBe('ELICITED');
    expect(chestPain?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  // 3. Contrastive negation
  it('3. handles contrastive negation: affirms chest pain while negating breathlessness', () => {
    const text = 'सीने में दर्द है लेकिन सांस लेने में कोई तकलीफ नहीं है';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });

    const chestPain = facts.find((f) => f.code === 'SYM_CHEST_PAIN');
    const dyspnea = facts.find((f) => f.code === 'SYM_BREATHLESSNESS' || f.code === 'SYM_DYSPNEA');

    expect(chestPain).toBeDefined();
    expect(chestPain?.assertion).toBe('AFFIRMED');

    expect(dyspnea).toBeDefined();
    expect(dyspnea?.assertion).toBe('NEGATED');
    expect(dyspnea?.evidence[0].verbatimText).toContain('सांस');
  });

  // 4. Temporal extraction
  it('4. extracts temporal duration from Hindi "2 hafto se"', () => {
    const text = 'मुझे 2 hafto se bukhar hai';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const fever = facts.find((f) => f.code === 'SYM_FEVER');

    expect(fever).toBeDefined();
    expect(fever?.temporality).toBe('PAST_ONGOING');
    expect((fever?.attributes as any)?.duration).toMatch(/2 weeks|2 हफ्ते|2 hafto|2 din/i);
  });

  // 5. Medication extraction with dosage and frequency
  it('5. extracts medication "Tab. Metformin 500mg BD" with attributes', () => {
    const text = 'I am taking Tab. Metformin 500mg BD for diabetes';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const metformin = facts.find((f) => f.term.toLowerCase().includes('metformin'));

    expect(metformin).toBeDefined();
    expect(metformin?.domain).toBe('medication');
    expect(metformin?.assertion).toBe('AFFIRMED');
    expect((metformin?.attributes as any)?.dosage).toContain('500mg');
    expect((metformin?.attributes as any)?.frequency).toContain('BD');
  });

  // 6. AYUSH Prakriti extraction
  it('6. extracts patient-reported AYUSH Prakriti "Vata-Pitta" with correct metadata', () => {
    const text = 'My constitution is Vata-Pitta Prakriti';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const prakriti = facts.find((f) => f.domain === 'ayush' && f.code.includes('PRAKRITI'));

    expect(prakriti).toBeDefined();
    expect(prakriti?.term).toContain('Vata-Pitta');
    expect(prakriti?.reporterType).toBe('PATIENT_REPORTED');
    expect(prakriti?.provenance.sourceType).toBe('PATIENT_VOICE');
  });

  // 7. AYUSH Agni extraction
  it('7. extracts AYUSH Agni assessment "Tikshnagni"', () => {
    const text = 'Patient experiences Tikshnagni intense digestive fire';
    const facts = extractCanonicalFacts(text, { language: 'en', sourceType: 'PATIENT_VOICE' });
    const agni = facts.find((f) => f.domain === 'ayush' && f.code.includes('AGNI'));

    expect(agni).toBeDefined();
    expect(agni?.term).toContain('Tikshnagni');
    expect((agni?.attributes as any)?.agniType).toBe('Tikshnagni');
  });

  // 8. Allergy non-elicitation
  it('8. records UNKNOWN and NOT_ELICITED when allergies are not discussed', () => {
    const result = runHeadlessClinicalExtractionPipeline([], { includeUnelicitedAllergy: true });
    const allergyFact = result.facts.find((f) => f.domain.toLowerCase() === 'allergy');

    expect(allergyFact).toBeDefined();
    expect(allergyFact?.assertion).toBe('UNKNOWN');
    expect(allergyFact?.elicitation).toBe('NOT_ELICITED');
    expect(allergyFact?.evidence.length).toBe(0);
  });

  // 9. Explicit allergy negation
  it('9. records NEGATED ALLERGY_DRUG_GENERAL when explicitly denied', () => {
    const text = 'Mujhe kisi dawa se allergy nahi hai';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const allergyFact = facts.find((f) => f.domain.toLowerCase() === 'allergy');

    expect(allergyFact).toBeDefined();
    expect(allergyFact?.assertion).toBe('NEGATED');
    expect(allergyFact?.elicitation).toBe('ELICITED');
  });

  // 10. Preserves conflicting evidence without destructive overwrite
  it('10. preserves conflicting evidence for the same concept in ClinicalFactStore', () => {
    const store = new ClinicalFactStore();
    const factAffirmed = createClinicalFact({
      domain: 'SYMPTOM',
      code: 'SYM_FEVER',
      term: 'Fever',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      temporality: 'CURRENT',
      confidence: 0.9,
      evidence: [{ textSegmentId: 'seg-1', verbatimText: 'I had fever yesterday', startChar: 0, endChar: 20 }],
      provenance: { sourceId: 'enc-1', sourceType: 'PATIENT_VOICE' },
    });
    const factNegated = createClinicalFact({
      domain: 'SYMPTOM',
      code: 'SYM_FEVER',
      term: 'Fever',
      assertion: 'NEGATED',
      elicitation: 'ELICITED',
      temporality: 'CURRENT',
      confidence: 0.85,
      evidence: [{ textSegmentId: 'seg-2', verbatimText: 'No fever today', startChar: 0, endChar: 14 }],
      provenance: { sourceId: 'enc-1', sourceType: 'PATIENT_VOICE' },
    });

    store.addFact(factAffirmed);
    store.addFact(factNegated);

    expect(store.getFacts().length).toBe(2);
    const conflicts = store.getConflictingFacts('SYM_FEVER');
    expect(conflicts.length).toBe(2);
    expect(conflicts.some((f) => f.assertion === 'AFFIRMED')).toBe(true);
    expect(conflicts.some((f) => f.assertion === 'NEGATED')).toBe(true);
  });

  // 11. Evidence gate rejects unanchored patient facts without evidence
  it('11. evidence gate rejects unanchored patient-voice facts lacking evidence spans', () => {
    const invalidFact = createClinicalFact({
      domain: 'SYMPTOM',
      code: 'SYM_COUGH',
      term: 'Cough',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      temporality: 'CURRENT',
      confidence: 0.9,
      evidence: [], // Missing evidence!
      provenance: { sourceId: 'enc-1', sourceType: 'PATIENT_VOICE' },
    });

    const validation = validateClinicalFact(invalidFact);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('requires at least one evidence span'))).toBe(true);
  });

  // 12. Evidence gate rejects confidence outside [0, 1]
  it('12. evidence gate rejects confidence scores outside [0, 1]', () => {
    const invalidFact = createClinicalFact({
      domain: 'SYMPTOM',
      code: 'SYM_COUGH',
      term: 'Cough',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      temporality: 'CURRENT',
      confidence: 1.5, // Out of range!
      evidence: [{ textSegmentId: 'seg-1', verbatimText: 'cough', startChar: 0, endChar: 5 }],
      provenance: { sourceId: 'enc-1', sourceType: 'PATIENT_VOICE' },
    });

    const validation = validateClinicalFact(invalidFact);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Confidence score'))).toBe(true);
  });

  // 13. Fabrication gate detects and blocks hardcoded GERD/Amlapitta
  it('13. auditProjectionIntegrity detects and blocks hardcoded GERD / Amlapitta', () => {
    const facts = extractCanonicalFacts('I have a mild headache', { language: 'en', sourceType: 'PATIENT_VOICE' });
    const fabricatedProjection = {
      assessment: {
        primary_diagnosis: 'Gastroesophageal Reflux Disease (GERD) / Amlapitta',
      },
    };

    const audit = auditProjectionIntegrity(facts, fabricatedProjection);
    expect(audit.passed).toBe(false);
    expect(audit.violations.some((v) => v.type === 'UNANCHORED_GERD_AMLAPITTA')).toBe(true);
  });

  // 14. Fabrication gate detects and blocks unauthorized prescriptions
  it('14. auditProjectionIntegrity blocks unauthorized prescriptions in pre-consult intake', () => {
    const facts = extractCanonicalFacts('I have a cough', { language: 'en', sourceType: 'PATIENT_VOICE' });
    const fabricatedProjection = {
      plan: {
        prescriptions: [{ medication: 'Amoxicillin 500mg' }],
      },
    };

    const audit = auditProjectionIntegrity(facts, fabricatedProjection, { isPreConsultationIntake: true });
    expect(audit.passed).toBe(false);
    expect(audit.violations.some((v) => v.type === 'FABRICATED_PRESCRIPTION')).toBe(true);
  });

  // 15. Fabrication gate detects and blocks fabricated vitals (120/80)
  it('15. auditProjectionIntegrity detects fabricated vital signs', () => {
    const facts = extractCanonicalFacts('I have a fever', { language: 'en', sourceType: 'PATIENT_VOICE' });
    const fabricatedProjection = {
      objective: {
        vital_signs: 'BP 120/80 mmHg, HR 72 bpm',
      },
    };

    const audit = auditProjectionIntegrity(facts, fabricatedProjection);
    expect(audit.passed).toBe(false);
    expect(audit.violations.some((v) => v.type === 'FABRICATED_VITAL_SIGNS')).toBe(true);
  });

  // 15b. Fabrication gate detects and blocks unanchored allergies
  it('15b. auditProjectionIntegrity detects unanchored allergies', () => {
    const facts = extractCanonicalFacts('I have a headache', { language: 'en', sourceType: 'PATIENT_VOICE' });
    const fabricatedProjection = {
      subjective: {
        allergies: ['Penicillin Anaphylaxis'],
      },
    };

    const audit = auditProjectionIntegrity(facts, fabricatedProjection);
    expect(audit.passed).toBe(false);
    expect(audit.violations.some((v) => v.type === 'UNANCHORED_ALLERGY')).toBe(true);
  });

  // 16. Pure summary projection from ClinicalFact[]
  it('16. generateStructuredSummary produces zero unanchored GERD/Amlapitta and zero fake vitals', () => {
    const intake: StructuredPatientIntake = {
      intakeId: 'INT-TEST',
      startedAt: '10:00 AM',
      completedAt: '10:05 AM',
      clinicalDepartment: 'Allopathic',
      patientDemographics: { fullName: 'Test Patient', age: 30, gender: 'Female' },
      chiefComplaint: 'Chest pain',
      socratesHpi: { site: 'Chest', onset: 'Acute', severity: '7/10' },
      pastMedicalHistory: [],
      pastSurgicalHistory: [],
      familyHistory: [],
      personalHistory: { dietType: 'Not documented' },
      reviewOfSystems: { cardiovascular: { chestPain: true } },
      currentMedications: [],
      knownAllergies: [],
      conversationTurns: [],
      triageClassification: 'Red (Immediate Emergency)',
      redFlagsDetected: ['Chest pain'],
      isComplete: true,
      clinicalFacts: [
        createClinicalFact({
          domain: 'SYMPTOM',
          code: 'SYM_CHEST_PAIN',
          term: 'Chest Pain',
          assertion: 'AFFIRMED',
          elicitation: 'ELICITED',
          temporality: 'CURRENT',
          confidence: 0.95,
          evidence: [{ textSegmentId: 'turn-1', verbatimText: 'chest pain', startChar: 0, endChar: 10 }],
          provenance: { sourceId: 'turn-1', sourceType: 'PATIENT_VOICE' },
        }),
      ],
    };

    const summary = generateStructuredSummary(intake, null, 'Allopathic', []);

    // Verify zero-fabrication assertions
    expect(summary.soapNote.assessment.primary_diagnosis).not.toContain('GERD');
    expect(summary.soapNote.assessment.primary_diagnosis).not.toContain('Amlapitta');
    expect(summary.soapNote.objective.vital_signs).toContain('Not documented');
    expect(summary.soapNote.objective.physical_exam).toContain('pending attending physician consultation');
    expect(summary.soapNote.plan.prescriptions).toEqual([]);
    expect(summary.soapNote.billing_suggestions.cpt_codes).toEqual([]);
  });

  // 17. SOAP projection in production mode has zero prescriptions
  it('17. generateOfflineSOAPNote production mode has empty prescriptions', () => {
    const note = generateOfflineSOAPNote(mockPatient, 'Patient reports headache for 2 days');
    expect(note.plan.prescriptions).toEqual([]);
    expect(note.objective.physical_exam).toContain('Not documented');
  });

  // 18. FHIR Condition verificationStatus is unconfirmed for intake facts
  it('18. exportToFHIRBundle marks intake conditions as verificationStatus: unconfirmed', () => {
    const facts = [
      createClinicalFact({
        domain: 'SYMPTOM',
        code: 'SYM_CHEST_PAIN',
        term: 'Chest Pain',
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        confidence: 0.95,
        evidence: [{ textSegmentId: 'turn-1', verbatimText: 'chest pain', startChar: 0, endChar: 10 }],
        provenance: { sourceId: 'turn-1', sourceType: 'PATIENT_VOICE' },
      }),
    ];

    const emptySoap = {
      subjective: { chief_complaint: 'Chest pain' },
      objective: {},
      assessment: {},
      plan: {},
    } as any;

    const bundle = exportToFHIRBundle(mockPatient, emptySoap, { canonicalFacts: facts });
    const conditionEntry = bundle.entry.find((e) => e.resource.resourceType === 'Condition');

    expect(conditionEntry).toBeDefined();
    expect(conditionEntry?.resource.verificationStatus.coding[0].code).toBe('unconfirmed');
  });

  // 19. Patient-reported medication maps to MedicationStatement, NOT MedicationRequest
  it('19. maps patient-reported medications to MedicationStatement, NOT MedicationRequest', () => {
    const facts = [
      createClinicalFact({
        domain: 'MEDICATION',
        code: 'MED_METFORMIN',
        term: 'Metformin 500mg',
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        confidence: 0.9,
        attributes: { dosage: '500mg', frequency: 'BD' },
        evidence: [{ textSegmentId: 'turn-1', verbatimText: 'Metformin 500mg BD', startChar: 0, endChar: 18 }],
        provenance: { sourceId: 'turn-1', sourceType: 'PATIENT_VOICE' },
      }),
    ];

    const emptySoap = {
      subjective: { current_medications: ['Metformin 500mg'] },
      objective: {},
      assessment: {},
      plan: { prescriptions: [] }, // No physician prescriptions!
    } as any;

    const bundle = exportToFHIRBundle(mockPatient, emptySoap, { canonicalFacts: facts });

    const medStmt = bundle.entry.find((e) => e.resource.resourceType === 'MedicationStatement');
    const medReq = bundle.entry.find((e) => e.resource.resourceType === 'MedicationRequest');

    expect(medStmt).toBeDefined();
    expect(medStmt?.resource.medicationCodeableConcept.text).toContain('Metformin');
    expect(medReq).toBeUndefined(); // Zero MedicationRequest!
  });

  // 20. Zero MedicationRequest when plan has no clinician prescriptions
  it('20. produces zero MedicationRequest when plan has no clinician prescriptions', () => {
    const emptySoap = {
      subjective: {},
      objective: {},
      assessment: {},
      plan: { prescriptions: [] },
    } as any;

    const bundle = exportToFHIRBundle(mockPatient, emptySoap);
    const medRequests = bundle.entry.filter((e) => e.resource.resourceType === 'MedicationRequest');
    expect(medRequests.length).toBe(0);
  });

  // 21. Zero AllergyIntolerance when allergy is UNKNOWN / NOT_ELICITED
  it('21. produces zero AllergyIntolerance when allergy is UNKNOWN or NOT_ELICITED', () => {
    const facts = [
      createClinicalFact({
        domain: 'ALLERGY',
        code: 'ALLERGY_DRUG_GENERAL',
        term: 'Drug Allergy',
        assertion: 'UNKNOWN',
        elicitation: 'NOT_ELICITED',
        temporality: 'CURRENT',
        confidence: 0.5,
        evidence: [],
        provenance: { sourceId: 'kiosk-intake', sourceType: 'SYSTEM_INFERRED' },
      }),
    ];

    const emptySoap = {
      subjective: { allergies: ['Not elicited / Not documented'] },
      objective: {},
      assessment: {},
      plan: {},
    } as any;

    const bundle = exportToFHIRBundle(mockPatient, emptySoap, { canonicalFacts: facts });
    const allergies = bundle.entry.filter((e) => e.resource.resourceType === 'AllergyIntolerance');
    expect(allergies.length).toBe(0);
  });

  // 22. Red-flag safety: SYM_CHEST_PAIN triggers cardiovascular alert via canonical facts
  it('22. SYM_CHEST_PAIN triggers cardiovascular red-flag alert directly via canonical facts', () => {
    const facts = extractCanonicalFacts('सीने में दर्द हो रहा है', { language: 'hi', sourceType: 'PATIENT_VOICE' });
    const alerts = evaluateRedFlagsFromFacts(facts);

    expect(alerts.length).toBeGreaterThan(0);
    const chestAlert = alerts.find((a) => a.ruleId.includes('CHEST_PAIN'));
    expect(chestAlert).toBeDefined();
    expect(chestAlert?.title).toContain('Chest');

    // Also verify emergency triage detector
    const emergency = detectEmergencyFromFacts(facts);
    // Note: acute chest pain alone triggers high-priority red flag; when breathlessness combined it triggers critical emergency
    const comboFacts = [
      ...facts,
      createClinicalFact({
        domain: 'SYMPTOM',
        code: 'SYM_BREATHLESSNESS',
        term: 'Breathlessness',
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        temporality: 'CURRENT',
        confidence: 0.9,
        evidence: [{ textSegmentId: 't2', verbatimText: 'सांस फूल रही है', startChar: 0, endChar: 15 }],
        provenance: { sourceId: 't2', sourceType: 'PATIENT_VOICE' },
      }),
    ];
    const comboEmergency = detectEmergencyFromFacts(comboFacts);
    expect(comboEmergency).toBeDefined();
    expect(comboEmergency?.severity).toBe('CRITICAL_EMERGENCY');
    expect(comboEmergency?.triageColor).toBe('Red');
  });

  // 23. True Traceability: Unseen fabricated diagnosis (not on blacklist) is blocked
  it('23. blocks previously unseen fabricated diagnoses (Pneumonia, Pancreatitis) not grounded in facts', () => {
    const facts = [
      createClinicalFact({
        domain: 'symptom',
        code: 'SYM_HEADACHE',
        term: 'Headache',
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        evidence: [{ text: 'sar dard', verbatimText: 'sar dard', startChar: 0, endChar: 8 }],
      }),
    ];

    // Attempting to project "Community-Acquired Pneumonia" or "Acute Pancreatitis" with only headache fact
    const audit = auditProjectionIntegrity(facts, {
      assessment: {
        primary_diagnosis: 'Community-Acquired Pneumonia',
        differential_diagnoses: ['Acute Pancreatitis'],
      },
    });

    expect(audit.safe).toBe(false);
    expect(audit.violations.some((v) => v.type === 'UNGROUNDED_DIAGNOSIS')).toBe(true);
  });

  // 24. True Traceability: Unseen fabricated vitals (BP 140/90, HbA1c 8.2%) blocked
  it('24. blocks ungrounded numerical vitals (BP 140/90) when no vital fact or measurement exists', () => {
    const facts = [
      createClinicalFact({
        domain: 'symptom',
        code: 'SYM_FEVER',
        term: 'Fever',
        assertion: 'AFFIRMED',
        elicitation: 'ELICITED',
        evidence: [{ text: 'bukhar', verbatimText: 'bukhar', startChar: 0, endChar: 6 }],
      }),
    ];

    const audit = auditProjectionIntegrity(facts, {
      objective: {
        vital_signs: 'BP 140/90 mmHg, HR 104 bpm, SpO2 96%',
      },
    });

    expect(audit.safe).toBe(false);
    expect(audit.violations.some((v) => v.type === 'FABRICATED_VITAL_SIGNS')).toBe(true);
  });

  // 25. Conflict Preservation: Patient says "I take Metformin", document says "Metformin discontinued"
  it('25. preserves conflicting evidence without silent overwrite and surfaces reconciliation warning', () => {
    const store = new ClinicalFactStore();

    // Fact 1: Patient verbal report
    const patientVoiceFact = createClinicalFact({
      domain: 'medication',
      code: 'MED_METFORMIN',
      canonicalId: 'MED_METFORMIN',
      term: 'Metformin',
      preferredTerm: 'Metformin',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      value: 'Metformin 500mg',
      attributes: { drugName: 'Metformin', dosage: '500mg', status: 'active' },
      evidence: [{ verbatimText: 'I take Metformin 500mg daily', text: 'I take Metformin 500mg daily', startChar: 0, endChar: 28 }],
      provenance: { sourceType: 'PATIENT_VOICE', sourceId: 'turn-1', extractionEngine: 'voice_nlp' },
    });

    // Fact 2: Uploaded discharge summary
    const documentFact = createClinicalFact({
      domain: 'medication',
      code: 'MED_METFORMIN',
      canonicalId: 'MED_METFORMIN',
      term: 'Metformin',
      preferredTerm: 'Metformin',
      assertion: 'NEGATED',
      elicitation: 'ELICITED',
      value: 'Metformin discontinued',
      attributes: { drugName: 'Metformin', status: 'discontinued', isDiscontinued: true },
      evidence: [{ verbatimText: 'Metformin discontinued due to GI intolerance', text: 'Metformin discontinued', startChar: 0, endChar: 22 }],
      provenance: { sourceType: 'UPLOADED_DOCUMENT', sourceId: 'doc-01', extractionEngine: 'document_ocr' },
    });

    store.addFact(patientVoiceFact);
    store.addFact(documentFact);

    // Invariant: Both facts survive with full provenance
    expect(store.getFacts().length).toBe(2);
    const conflicts = store.getConflictingFacts('MED_METFORMIN');
    expect(conflicts.length).toBe(2);
    expect(conflicts[0].provenance.sourceType).toBe('PATIENT_VOICE');
    expect(conflicts[1].provenance.sourceType).toBe('UPLOADED_DOCUMENT');

    // Downstream summary projection surfaces the conflict warning banner
    const intake: StructuredPatientIntake = {
      intakeId: 'intake-conf-test',
      startedAt: new Date().toISOString(),
      chiefComplaint: 'Routine checkup',
      patientDemographics: { fullName: 'Test Patient', age: 45, gender: 'Male' },
      socratesHpi: {} as any,
      pastMedicalHistory: [],
      pastSurgicalHistory: [],
      familyHistory: [],
      personalHistory: {} as any,
      reviewOfSystems: {} as any,
      currentMedications: [],
      knownAllergies: [],
      conversationTurns: [],
      clinicalFacts: [patientVoiceFact, documentFact],
      redFlagsDetected: [],
      isComplete: true,
    };

    const summary = generateStructuredSummary(intake, null, 'Allopathic', []);
    expect(summary.sections.drugAndAllergy).toContain('CONFLICT DETECTED');
    expect(summary.sections.drugAndAllergy).toContain('reconciliation');
  });

  // 26. Medication Safety: Unseen medication maps strictly to MedicationStatement, NEVER MedicationRequest
  it('26. maps unseen medication "Levothyroxine 50mcg OD" to MedicationStatement, NEVER MedicationRequest', () => {
    const levoFact = createClinicalFact({
      domain: 'medication',
      code: 'MED_LEVOTHYROXINE',
      term: 'Levothyroxine',
      preferredTerm: 'Levothyroxine',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      attributes: { dosage: '50mcg', frequency: 'OD', route: 'oral' },
      evidence: [{ verbatimText: 'taking Levothyroxine 50mcg every morning', startChar: 0, endChar: 38 }],
      provenance: { sourceType: 'PATIENT_VOICE', extractionEngine: 'voice_nlp' },
    });

    const bundle = exportToFHIRBundle(mockPatient, { subjective: {}, objective: {}, assessment: {}, plan: { prescriptions: [] } } as any, {
      canonicalFacts: [levoFact],
    });

    const medStatements = bundle.entry.filter((e) => e.resource.resourceType === 'MedicationStatement');
    const medRequests = bundle.entry.filter((e) => e.resource.resourceType === 'MedicationRequest');

    expect(medStatements.length).toBe(1);
    expect(medStatements[0].resource.medicationCodeableConcept?.text).toContain('Levothyroxine');
    expect(medRequests.length).toBe(0);
  });

  // 27. AYUSH Boundary: Unseen AYUSH value remains patient-reported subjective observation
  it('27. keeps unseen AYUSH value "Kapha-Vata Prakriti" as patient-reported, never clinician Pariksha', () => {
    const facts = extractCanonicalFacts('Meri prakriti Kapha-Vata hai aur mandagni rehti hai', {
      language: 'hi',
      sourceType: 'PATIENT_VOICE',
    });

    const prakritiFact = facts.find((f) => f.code.includes('PRAKRITI'));
    expect(prakritiFact).toBeDefined();
    expect(prakritiFact?.reporterType).toBe('PATIENT_REPORTED');
    expect(prakritiFact?.term).toContain('Patient-Reported');

    const agniFact = facts.find((f) => f.code.includes('AGNI'));
    expect(agniFact).toBeDefined();
    expect(agniFact?.term).toContain('Mandagni');
    expect(agniFact?.reporterType).toBe('PATIENT_REPORTED');
  });

  // 28. Safety: Negated chest pain does NOT trigger red flag
  it('28. does NOT trigger cardiovascular red-flag when chest pain is explicitly NEGATED', () => {
    const facts = [
      createClinicalFact({
        domain: 'symptom',
        code: 'SYM_CHEST_PAIN',
        term: 'Chest Pain',
        assertion: 'NEGATED', // Patient denied chest pain
        elicitation: 'ELICITED',
        evidence: [{ verbatimText: 'seene me dard nahi hai', startChar: 0, endChar: 21 }],
        provenance: { sourceType: 'PATIENT_VOICE' },
      }),
    ];

    const alerts = evaluateRedFlagsFromFacts(facts);
    expect(alerts.length).toBe(0);

    const emergency = detectEmergencyFromFacts(facts);
    expect(emergency).toBeNull();
  });

  // 29. Contrastive Negation: "BP ka problem nahi hai lekin sar dard hai"
  it('29. correctly extracts hypertension as NEGATED and headache as AFFIRMED with spans', () => {
    const text = 'BP ka problem nahi hai lekin sar dard bahut rehta hai';
    const facts = extractCanonicalFacts(text, { language: 'hi', sourceType: 'PATIENT_VOICE' });

    const bp = facts.find((f) => f.code.includes('HYPERTENSION'));
    const headache = facts.find((f) => f.code.includes('HEADACHE'));

    expect(bp).toBeDefined();
    expect(bp?.assertion).toBe('NEGATED');
    expect(bp?.elicitation).toBe('ELICITED');

    expect(headache).toBeDefined();
    expect(headache?.assertion).toBe('AFFIRMED');
    expect(headache?.elicitation).toBe('ELICITED');
    expect(headache?.evidence[0].verbatimText).toContain('sar dard');
  });

  // 30. Full Assertion + Elicitation Semantics & Raw Evidence Preservation
  it('30. preserves complete raw evidence and assertion/elicitation state without collapse', () => {
    // 1. Patient says "I don't know about allergies" -> UNKNOWN + ELICITED
    const uncertFacts = extractCanonicalFacts('I don\'t know about allergies', {
      sourceType: 'PATIENT_VOICE',
      language: 'en',
    });
    const uncertAllergy = uncertFacts.find((f) => f.domain.toLowerCase() === 'allergy');
    expect(uncertAllergy).toBeDefined();
    expect(uncertAllergy?.assertion).toBe('UNKNOWN');
    expect(uncertAllergy?.elicitation).toBe('ELICITED');
    expect(uncertAllergy?.evidence.length).toBeGreaterThan(0);

    // 2. Unelicited allergy -> UNKNOWN + NOT_ELICITED with 0 evidence
    const unelicited = runHeadlessClinicalExtractionPipeline([], { includeUnelicitedAllergy: true });
    const unelFact = unelicited.facts.find((f) => f.domain.toLowerCase() === 'allergy');
    expect(unelFact?.assertion).toBe('UNKNOWN');
    expect(unelFact?.elicitation).toBe('NOT_ELICITED');
    expect(unelFact?.evidence.length).toBe(0);

    // 3. Raw evidence survives with full provenance metadata
    const chestFact = extractCanonicalFacts('seene me dard hai', {
      sourceType: 'PATIENT_VOICE',
      sourceId: 'session-turn-1',
      language: 'hi',
    })[0];

    expect(chestFact.evidence[0].verbatimText).toBeDefined();
    expect(chestFact.evidence[0].startChar).toBeGreaterThanOrEqual(0);
    expect(chestFact.evidence[0].endChar).toBeGreaterThan(chestFact.evidence[0].startChar);
    expect(chestFact.provenance.sourceType).toBe('PATIENT_VOICE');
    expect(chestFact.provenance.sourceId).toBe('session-turn-1');
    expect(chestFact.provenance.language).toBe('hi');
    expect(chestFact.provenance.extractionEngine).toBeDefined();
    expect(chestFact.provenance.timestamp).toBeDefined();
    expect(chestFact.confidence).toBeGreaterThan(0);
  });
});

