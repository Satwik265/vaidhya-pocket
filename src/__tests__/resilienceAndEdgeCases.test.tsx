import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TranscriptInput } from '../components/TranscriptInput';
import { exportToFHIRBundle } from '../utils/fhirConverter';
import { checkDrugInteractions } from '../utils/drugInteractionChecker';
import { generateOfflineSOAPNote } from '../utils/offlineLocalEngine';
import App from '../App';
import { SOAPNote, PatientInfo } from '../types';

const mockSOAPNote: SOAPNote = {
  subjective: {
    chief_complaint: 'Severe headache and high fever',
    history_of_present_illness: 'Patient reports 4 days of throbbing frontal headache.',
    current_medications: [],
    allergies: [],
  },
  objective: {
    vital_signs: 'BP 118/76, Temp 39.1C, HR 92',
    physical_exam: 'Alert, febrile, no meningeal signs.',
    labs_and_imaging: 'None',
  },
  assessment: {
    primary_diagnosis: 'Acute Febrile Syndrome',
    differential_diagnoses: ['Malaria', 'Dengue'],
    clinical_summary: 'Evaluation indicates uncomplicated acute febrile illness.',
  },
  plan: {
    prescriptions: [
      { medication: 'Paracetamol', dosage: '500mg', frequency: 'QDS', duration: '5 days', instructions: 'Take after meals' },
    ],
    diagnostic_tests_ordered: [],
    patient_education: 'Hydrate well and rest.',
    follow_up: 'Return if fever exceeds 39.5C or new symptoms appear.',
  },
};

describe('Clinical AI Resilience & Edge-Case Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  /* ========================================================================
   * 1. TranscriptInput & On-Device Pipeline Resilience
   * ======================================================================== */
  describe('1. TranscriptInput & On-Device Pipeline Resilience', () => {
    it('disables generate button when transcript is empty and no audio is uploaded', () => {
      const handleGenerate = vi.fn();
      render(
        <TranscriptInput
          transcript=""
          onChangeTranscript={vi.fn()}
          onSelectScenario={vi.fn()}
          onGenerateSOAP={handleGenerate}
          isGenerating={false}
        />
      );

      const generateBtn = screen.getByRole('button', { name: /Generate Bento SOAP Note/i });
      expect(generateBtn).toBeDisabled();

      fireEvent.click(generateBtn);
      expect(handleGenerate).not.toHaveBeenCalled();
    });

    it('handles extremely long transcripts (10,000+ words) gracefully without crashing', () => {
      const repeatedWord = 'patient ';
      const longTranscript = repeatedWord.repeat(10000); // 10,000 words (~80,000 chars)

      render(
        <TranscriptInput
          transcript={longTranscript}
          onChangeTranscript={vi.fn()}
          onSelectScenario={vi.fn()}
          onGenerateSOAP={vi.fn()}
          isGenerating={false}
        />
      );

      expect(screen.getByText(/10000 words/i)).toBeInTheDocument();
      const textarea = screen.getByPlaceholderText(/Type, paste, or dictate doctor-patient conversation here/i);
      expect((textarea as HTMLTextAreaElement).value.length).toBeGreaterThan(60000);
    });

    it('generates the SOAP note on-device and makes NO network request, even when the network is broken', async () => {
      // Sovereign mode: the cloud route is gone. Any fetch would be a regression, so make it fail loudly.
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch (Network Error)'));

      render(<App />);

      const launchBtn = screen.getAllByRole('button', { name: /Launch Workstation/i })[0];
      fireEvent.click(launchBtn);

      const generateBtn = screen.getByRole('button', { name: /Generate Bento SOAP Note/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/Structured SOAP Note Workspace/i)).toBeInTheDocument();
      });
      expect(screen.queryByText(/Cloud API unavailable/i)).not.toBeInTheDocument();
      const soapCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/api/medscribe/generate'));
      expect(soapCalls).toHaveLength(0);
    });
  });

  /* ========================================================================
   * 2. Offline Engine Fallback & Mid-Session Mode Toggle Integrity
   * ======================================================================== */
  describe('2. Offline Engine Fallback & Mode Toggle Integrity', () => {
    it('generates a valid fallback SOAP note offline', () => {
      const patientInfo: PatientInfo = {
        name: 'Test Patient',
        age: 40,
        sex: 'Female',
        medicalHistory: 'Hypertension',
        currentMedications: 'Lisinopril 10mg',
        knownAllergies: 'Penicillin',
      };
      const transcript = 'Doctor: Patient complains of high blood pressure and headache. BP is 150/90.';

      const note = generateOfflineSOAPNote(patientInfo, transcript, 'en', { isDemoMode: true });
      expect(note).toBeDefined();
      expect(note.subjective.chief_complaint).toBeTruthy();
      expect(note.assessment.primary_diagnosis).toBeTruthy();
      expect(note.plan.prescriptions.length).toBeGreaterThan(0);
    });

    it('preserves existing SOAP note state when toggling Cloud/Offline mode mid-session', async () => {
      render(<App />);

      const launchBtn = screen.getAllByRole('button', { name: /Launch Workstation/i })[0];
      fireEvent.click(launchBtn);

      // Toggle offline mode ON
      const offlineToggle = screen.getByTitle(/Switch to Local Browser-Only Engine/i);
      fireEvent.click(offlineToggle);
      expect(screen.getByText(/Offline Engine Active/i)).toBeInTheDocument();

      // Generate offline note
      const generateBtn = screen.getByRole('button', { name: /Generate Bento SOAP Note/i });
      fireEvent.click(generateBtn);

      await waitFor(() => {
        expect(screen.getByText(/Structured SOAP Note Workspace/i)).toBeInTheDocument();
      });

      // Now toggle offline mode OFF mid-session
      const cloudToggle = screen.getByTitle(/Cloud mode removed/i);
      fireEvent.click(cloudToggle);
      expect(screen.getByText(/Cloud disabled \(sovereign\)/i)).toBeInTheDocument();

      // Confirm note workspace is STILL present and not corrupted/reset
      expect(screen.getByText(/Structured SOAP Note Workspace/i)).toBeInTheDocument();
    });
  });

  /* ========================================================================
   * 3. Drug Interaction Checker Edge-Case Coverage
   * ======================================================================== */
  describe('3. Drug Interaction Checker Edge Cases', () => {
    it('returns zero alerts when prescription list is empty', () => {
      const alerts = checkDrugInteractions([], 'Lisinopril', 'Hypertension', 'None');
      expect(alerts).toEqual([]);
    });

    it('detects conflicting duplicate prescription entries in the plan', () => {
      const duplicatePrescriptions = [
        { medication: 'Ibuprofen', dosage: '400mg', frequency: 'TID', duration: '5 days', instructions: '' },
        { medication: 'Ibuprofen', dosage: '400mg', frequency: 'TID', duration: '5 days', instructions: '' },
      ];

      const alerts = checkDrugInteractions(duplicatePrescriptions, '', '', '');
      const duplicateAlert = alerts.find((a) => a.message.includes('DUPLICATE PRESCRIPTION DETECTED'));
      expect(duplicateAlert).toBeDefined();
      expect(duplicateAlert?.severity).toBe('Medium');
    });

    it('flags uncurated medications absent from local database as "not checked"', () => {
      const uncuratedPrescriptions = [
        { medication: 'ExoticDrugXYZ', dosage: '10mg', frequency: 'Daily', duration: '30 days', instructions: '' },
      ];

      const alerts = checkDrugInteractions(uncuratedPrescriptions, '', '', '');
      const uncuratedAlert = alerts.find((a) => a.message.includes('Unchecked Medication'));
      expect(uncuratedAlert).toBeDefined();
      expect(uncuratedAlert?.type).toBe('Missing Info');
      expect(uncuratedAlert?.message).toContain("Unchecked Medication: 'ExoticDrugXYZ' is not present in the curated local interaction database and was not checked.");
    });
  });

  /* ========================================================================
   * 4. FHIR Export Robustness
   * ======================================================================== */
  describe('4. FHIR Export Robustness', () => {
    it('produces a valid FHIR Bundle when patient info has missing or empty fields', () => {
      const partialPatientInfo: PatientInfo = {
        name: '',
        age: '',
        sex: 'Male',
      };

      const bundle = exportToFHIRBundle(partialPatientInfo, mockSOAPNote);
      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');

      const patientResource = bundle.entry.find((e) => e.resource.resourceType === 'Patient')?.resource;
      expect(patientResource).toBeDefined();
      expect(patientResource?.name[0].text).toBe('Anonymous Patient');
      expect(patientResource?.extension[0].valueString).toBe('Unspecified years');
    });

    it('handles null/undefined patient or soapNote objects gracefully without throwing', () => {
      const bundleNull = exportToFHIRBundle(null as any, null as any);
      expect(bundleNull.resourceType).toBe('Bundle');
      expect(bundleNull.entry.length).toBeGreaterThan(0);
    });
  });

  /* ========================================================================
   * 5. Rapid Interactions & Race Conditions
   * ======================================================================== */
  describe('5. UI Race Conditions & Rapid Interactions', () => {
    it('prevents double-submission when generation is already in progress', () => {
      const handleGenerate = vi.fn();
      render(
        <TranscriptInput
          transcript="Patient with fever"
          onChangeTranscript={vi.fn()}
          onSelectScenario={vi.fn()}
          onGenerateSOAP={handleGenerate}
          isGenerating={true}
        />
      );

      const generateBtn = screen.getByRole('button', { name: /Analyzing Clinical Transcript.../i });
      expect(generateBtn).toBeDisabled();

      fireEvent.click(generateBtn);
      expect(handleGenerate).not.toHaveBeenCalled();
    });

    it('handles rapid modal toggles without crashing or throwing state errors', async () => {
      render(<App />);

      const launchBtn = screen.getAllByRole('button', { name: /Launch Workstation/i })[0];
      fireEvent.click(launchBtn);

      // Open History Modal
      const historyBtn = screen.getByTitle(/View Encounters History/i);
      fireEvent.click(historyBtn);
      expect(screen.getByText(/Saved Clinical Encounters History/i)).toBeInTheDocument();

      // Immediately Close History Modal
      const closeHistoryBtn = screen.getByLabelText('Close modal');
      fireEvent.click(closeHistoryBtn);

      // Open Analytics Modal
      const analyticsBtn = screen.getByTitle(/Clinic Productivity Metrics/i);
      fireEvent.click(analyticsBtn);
      expect(screen.getByText(/Clinic Documentation & Impact Analytics/i)).toBeInTheDocument();
    });
  });
});
