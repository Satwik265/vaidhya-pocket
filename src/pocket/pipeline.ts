// PHASE1-POCKET
import type { PatientInfo, SOAPNote, SafetyAlert } from '../types';
import type { ClinicalFact } from '../clinical/clinicalFactModel';
import { extractCanonicalFacts } from '../clinical/extractionPipeline';
import { evaluateRedFlagsFromFacts, type RedFlagAlert } from '../clinical/redFlagRules';
import { generateOfflineSOAPNote } from '../utils/offlineLocalEngine';
import { checkDrugInteractions } from '../utils/drugInteractionChecker';
import { groundFacts, type GroundedFact, type RejectedFact } from './groundFacts';

export interface StageTimings {
  extractMs: number;
  groundMs: number;
  redFlagMs: number;
  soapMs: number;
  totalMs: number;
}

export interface PocketResult {
  transcript: string;
  grounded: GroundedFact[];
  rejected: RejectedFact[];
  redFlags: RedFlagAlert[];
  soap: SOAPNote;
  drugAlerts: SafetyAlert[];
  timings: StageTimings;
}

export const DEFAULT_PATIENT: PatientInfo = {
  name: 'Synthetic Patient',
  age: 45,
  sex: 'Male',
  medicalHistory: '',
  currentMedications: '',
  knownAllergies: '',
  encounterType: 'Acute Visit',
};

const isHindiLike = (t: string) =>
  /[\u0900-\u097F]/.test(t) || /\b(dard|bukhar|sar|seene|saans|ulti|dast|khasi|nahi|nahin|hai|din|mein)\b/i.test(t);

/** Text -> verbatim-grounded facts -> red flags -> SOAP draft -> drug/allergy checks. Fully offline. */
export function runPocketPipeline(transcript: string, patient: PatientInfo = DEFAULT_PATIENT): PocketResult {
  const t0 = performance.now();
  const text = transcript.trim();
  const facts: ClinicalFact[] = extractCanonicalFacts(text, {
    encounterId: `pocket-${Date.now()}`,
    sourceType: 'PATIENT_TEXT',
    language: isHindiLike(text) ? 'hi' : 'en',
  });
  const t1 = performance.now();
  const { grounded, rejected } = groundFacts(facts, text);
  const t2 = performance.now();
  const redFlags = evaluateRedFlagsFromFacts(grounded.map((g) => g.fact));
  const t3 = performance.now();

  const soap = generateOfflineSOAPNote(patient, text, isHindiLike(text) ? 'hi' : 'en');

  // Zero-fabrication overrides: the legacy engine can emit canned complaint/diagnosis text for some inputs.
  // In Pocket mode the draft may only contain what the patient said (grounded spans) or an explicit "not established".
  const affirmedSymptoms = grounded
    .filter((g) => g.fact.assertion === 'AFFIRMED' && String(g.fact.domain).toLowerCase() === 'symptom')
    .map((g) => g.span.text);
  soap.subjective.chief_complaint = affirmedSymptoms.length ? affirmedSymptoms.join('; ') : 'Not stated';
  soap.assessment.primary_diagnosis = 'Not established. For clinician assessment.';
  soap.assessment.differential_diagnoses = [];
  soap.assessment.clinical_summary = `Draft from ${grounded.length} fact(s) quoted from the transcript. Clinician review and approval required.`;
  soap.plan.prescriptions = [];
  soap.billing_suggestions = undefined;

  const drugAlerts = checkDrugInteractions(
    [],
    [patient.currentMedications || '', ...grounded.filter((g) => String(g.fact.domain).toLowerCase() === 'medication').map((g) => g.fact.preferredTerm)].join(', '),
    patient.medicalHistory || '',
    [patient.knownAllergies || '', ...grounded.filter((g) => String(g.fact.domain).toLowerCase() === 'allergy').map((g) => g.fact.preferredTerm)].join(', ')
  );
  const t4 = performance.now();

  return {
    transcript: text,
    grounded,
    rejected,
    redFlags,
    soap,
    drugAlerts,
    timings: { extractMs: t1 - t0, groundMs: t2 - t1, redFlagMs: t3 - t2, soapMs: t4 - t3, totalMs: t4 - t0 },
  };
}

/** Sample consultations (synthetic). */
export const POCKET_SAMPLES: Array<{ id: string; label: string; text: string }> = [
  { id: 'chest', label: 'Hinglish: chest pain', text: 'Mujhe seene mein dard hai aur saans phoolti hai, do din se. Bukhar nahi hai. BP ka problem nahi hai.' },
  { id: 'fever', label: 'Hinglish: fever + headache', text: 'Teen din se bukhar hai aur sar dard hai, ulti nahi hai. Paracetamol 500mg liya tha.' },
  { id: 'en', label: 'English: metformin + allergy', text: 'Patient reports chest pain with shortness of breath for 2 days. No fever. Takes Tab. Metformin 500mg BD. Allergic to penicillin.' },
];
