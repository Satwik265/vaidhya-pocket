import { describe, it, expect } from 'vitest';
import { generateOfflineSOAPNote } from '../utils/offlineLocalEngine';
import { PatientInfo } from '../types';

describe('Offline Local Model NLP Engine', () => {
  const samplePatient: PatientInfo = {
    name: 'Kashish Patel',
    age: 42,
    gender: 'Female',
    encounterType: 'Acute Consultation',
    clinicLocation: 'Community Health Post',
    medicalHistory: 'No chronic illness',
    currentMedications: 'Paracetamol 500mg',
    knownAllergies: 'NKDA',
  };

  it('generates structured SOAP note for malaria case offline (demo mode)', () => {
    const transcript = 'Patient presents with high fever 39.1C, chills, rigors, and positive malaria RDT.';
    const note = generateOfflineSOAPNote(samplePatient, transcript, 'en', { isDemoMode: true });

    expect(note.subjective.chief_complaint).toContain('fever');
    expect(note.assessment.primary_diagnosis).toBe('Uncomplicated Plasmodium falciparum Malaria');
    expect(note.billing_suggestions.icd_10_codes[0].code).toBe('B50.9');
    expect(note.plan.prescriptions.length).toBeGreaterThan(0);
    expect(note.plan.prescriptions[0].medication).toContain('Artemether-Lumefantrine');
    expect(note.documentation_confidence?.overall_score).toBeGreaterThan(0);
  });

  it('generates structured SOAP note for hypertension case offline (demo mode)', () => {
    const transcript = 'Blood pressure screening today shows BP 152/94 mmHg, patient complains of mild morning headache.';
    const note = generateOfflineSOAPNote(samplePatient, transcript, 'en', { isDemoMode: true });

    expect(note.assessment.primary_diagnosis).toBe('Essential Primary Hypertension (Stage 2)');
    expect(note.billing_suggestions.icd_10_codes[0].code).toBe('I10');
    expect(note.plan.prescriptions.some((p) => p.medication === 'Lisinopril')).toBe(true);
  });

  it('generates structured SOAP note for otitis media case offline (demo mode)', () => {
    const transcript = 'Right ear pain, crying, fever. Otoscopy shows bulging erythematous right tympanic membrane.';
    const note = generateOfflineSOAPNote(samplePatient, transcript, 'en', { isDemoMode: true });

    expect(note.assessment.primary_diagnosis).toContain('Otitis Media');
    expect(note.plan.prescriptions.some((p) => p.medication === 'Amoxicillin')).toBe(true);
  });

  it('generates structured SOAP note for gastroenteritis case offline (demo mode)', () => {
    const transcript = 'Watery diarrhea 5 times today, abdominal cramps, vomiting. Mild dehydration.';
    const note = generateOfflineSOAPNote(samplePatient, transcript, 'en', { isDemoMode: true });

    expect(note.assessment.primary_diagnosis).toContain('Gastroenteritis');
    expect(note.plan.prescriptions.some((p) => p.medication.includes('ORS'))).toBe(true);
  });

  it('includes section documentation confidence and safety alerts in offline mode', () => {
    const transcript = 'Patient with history of hypertension taking Lisinopril presented with severe headache.';
    const note = generateOfflineSOAPNote(samplePatient, transcript);

    expect(note.documentation_confidence).toBeDefined();
    expect(note.documentation_confidence?.subjective.score).toBeGreaterThanOrEqual(60);
    expect(note.meta.uncertainty_flagged).toBe(false);
  });

  describe('Hindi Offline Clinical NLP Integration', () => {
    it('correctly extracts positive findings and temporal duration from Romanized Hindi', () => {
      const transcript = 'Mujhe do din se bahut tez bukhar aur sirdard hai.';
      const note = generateOfflineSOAPNote(samplePatient, transcript, 'hi');

      expect(note.subjective.chief_complaint).toContain('fever');
      expect(note.subjective.history_of_present_illness).toContain('Fever [PRESENT]');
      expect(note.subjective.history_of_present_illness).toContain('Headache [PRESENT]');
      expect(note.subjective.history_of_present_illness).toContain('2 days');
      expect(note.assessment.primary_diagnosis).toBe('Unspecified Acute Febrile Illness');
      expect(note.billing_suggestions.icd_10_codes.some((c) => c.code === 'R50.9')).toBe(true);
      expect(note.documentation_confidence?.overall_score).toBeGreaterThanOrEqual(80);
    });

    it('safety check: NEVER documents negated symptoms as positive conditions or billing codes', () => {
      // Patient has fever and headache, but explicitly denies chest pain and hypertension
      const transcript = 'Do din se bukhar hai aur sirdard hai. Seene me koi dard nahi hai aur BP ki bimari nahi hai.';
      const note = generateOfflineSOAPNote(samplePatient, transcript, 'hi');

      // 1. Primary diagnosis MUST NOT be chest pain or hypertension
      expect(note.assessment.primary_diagnosis).not.toContain('Chest Pain');
      expect(note.assessment.primary_diagnosis).not.toContain('Hypertension');
      expect(note.assessment.primary_diagnosis).toBe('Unspecified Acute Febrile Illness');

      // 2. Billing ICD-10 codes MUST NOT contain R07.9 (chest pain) or I10 (hypertension)
      const icdCodes = note.billing_suggestions.icd_10_codes.map((c) => c.code);
      expect(icdCodes).not.toContain('R07.9');
      expect(icdCodes).not.toContain('I10');
      expect(icdCodes).toContain('R50.9'); // Fever should be present

      // 3. Negated items must be explicitly marked as NEGATED in HPI with evidence and confidence
      expect(note.subjective.history_of_present_illness).toContain('[NEGATED]');
      expect(note.subjective.history_of_present_illness).toMatch(/Chest Pain|Hypertension/);

      // 4. ROS must document cardiovascular as denying chest pain
      expect(note.subjective.review_of_systems).toContain('Cardiovascular: Explicitly denies chest pain / hypertension');

      // 5. Prescriptions MUST NOT contain Lisinopril (antihypertensive) or Aspirin (STAT chest pain protocol)
      expect(note.plan.prescriptions.some((p) => p.medication.includes('Lisinopril'))).toBe(false);
      expect(note.plan.prescriptions.some((p) => p.medication.includes('Aspirin'))).toBe(false);
    });

    it('triggers Red Flag safety alert when emergency symptoms are affirmed in Hindi', () => {
      const transcript = 'Seene me bahut tez dard ho raha hai aur saans lene me takleef hai.';
      const note = generateOfflineSOAPNote(samplePatient, transcript, 'hi');

      const redFlags = note.safety_alerts.filter((a) => a.type === 'Red Flag');
      expect(redFlags.length).toBeGreaterThan(0);
      expect(redFlags[0].message).toContain('Chest Pain');
      expect(note.assessment.primary_diagnosis).toContain('Chest Pain');
      expect(note.billing_suggestions.icd_10_codes.some((c) => c.code === 'R07.9')).toBe(true);
    });

    it('preserves verbatim patient evidence and confidence in HPI and clinical summary', () => {
      const transcript = 'मुझे तीन दिन से खांसी और हल्का बुखार है। उल्टी नहीं हुई है।';
      const note = generateOfflineSOAPNote(samplePatient, transcript, 'hi');

      expect(note.subjective.history_of_present_illness).toContain('Evidence: "');
      expect(note.subjective.history_of_present_illness).toContain('Confidence:');
      expect(note.assessment.clinical_summary).toContain('Verbatim patient phrases and confidence scores preserved');

      // Spanish language limitation alert should NOT be present for Hindi
      const languageAlerts = note.safety_alerts.filter((a) => a.type === 'Language Limitation Alert');
      expect(languageAlerts.length).toBe(0);
    });
  });
});
