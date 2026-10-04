import { describe, it, expect } from 'vitest';
import { exportToFHIRBundle } from '../utils/fhirConverter';
import { PatientInfo, SOAPNote } from '../types';

describe('FHIR R4 Converter', () => {
  const samplePatient: PatientInfo = {
    name: 'Amina Bello',
    age: 34,
    gender: 'Female',
    encounterType: 'Outpatient Consultation',
    clinicLocation: 'Rural Health Post',
  };

  const sampleSOAPNote: SOAPNote = {
    subjective: {
      chief_complaint: 'High fever and chills for 3 days',
      history_of_present_illness: 'Patient presents with acute onset rigors and headache.',
      current_medications: ['Paracetamol 500mg'],
      allergies: ['NKDA'],
    },
    objective: {
      vital_signs: 'BP 115/75, Temp 38.9C, HR 98 bpm',
      physical_exam: 'Mild splenomegaly noted.',
      labs_and_imaging: 'Rapid Diagnostic Test (RDT) positive for Plasmodium falciparum.',
    },
    assessment: {
      primary_diagnosis: 'Uncomplicated Plasmodium falciparum Malaria',
      differential_diagnoses: ['Typhoid Fever', 'Dengue Fever'],
      clinical_summary: 'Acute febrile illness confirmed malarial infection via RDT.',
    },
    plan: {
      prescriptions: [
        {
          medication: 'Artemether-Lumefantrine (Coartem)',
          dosage: '20/120mg',
          frequency: 'BID',
          duration: '3 days',
          instructions: 'Take with fatty food or milk',
        },
      ],
      diagnostic_tests_ordered: ['Complete Blood Count (CBC)'],
      patient_education: 'Hydrate well, complete full 3-day antimalarial regimen.',
      follow_up: 'Return to clinic if fever persists beyond 48 hours.',
    },
    billing_suggestions: {
      icd_10_codes: [
        { code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified', confidence: 'High' },
      ],
      cpt_codes: [
        { code: '99213', description: 'Office visit, established patient', rationale: 'Low-to-moderate complexity' },
      ],
    },
  };

  it('generates a valid FHIR R4 Bundle structure', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.id).toContain('bundle-medscribe-');
    expect(bundle.entry.length).toBeGreaterThan(0);
  });

  it('maps Patient resource correctly', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    const patientEntry = bundle.entry.find((e) => e.resource.resourceType === 'Patient');
    expect(patientEntry).toBeDefined();
    expect(patientEntry?.resource.name[0].text).toBe('Amina Bello');
    expect(patientEntry?.resource.gender).toBe('female');
  });

  it('maps Encounter resource correctly', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    const encounterEntry = bundle.entry.find((e) => e.resource.resourceType === 'Encounter');
    expect(encounterEntry).toBeDefined();
    expect(encounterEntry?.resource.status).toBe('finished');
    expect(encounterEntry?.resource.location[0].location.display).toBe('Rural Health Post');
  });

  it('maps Condition resource with ICD-10 codings', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    const conditionEntry = bundle.entry.find((e) => e.resource.resourceType === 'Condition');
    expect(conditionEntry).toBeDefined();
    expect(conditionEntry?.resource.code.coding[0].code).toBe('B50.9');
    expect(conditionEntry?.resource.code.coding[0].system).toBe('http://hl7.org/fhir/sid/icd-10');
  });

  it('maps MedicationRequest resource for prescriptions', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    const medReqEntry = bundle.entry.find((e) => e.resource.resourceType === 'MedicationRequest');
    expect(medReqEntry).toBeDefined();
    expect(medReqEntry?.resource.medicationCodeableConcept.text).toBe('Artemether-Lumefantrine (Coartem)');
    expect(medReqEntry?.resource.dosageInstruction[0].text).toContain('20/120mg BID for 3 days');
  });

  it('maps Composition resource with LOINC-coded SOAP sections', () => {
    const bundle = exportToFHIRBundle(samplePatient, sampleSOAPNote);
    const compositionEntry = bundle.entry.find((e) => e.resource.resourceType === 'Composition');
    expect(compositionEntry).toBeDefined();
    expect(compositionEntry?.resource.title).toBe('MedScribe Lite Clinical SOAP Note');
    expect(compositionEntry?.resource.section.length).toBe(4);
  });
});
