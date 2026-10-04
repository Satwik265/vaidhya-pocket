import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Header } from '../components/Header';
import { PatientForm } from '../components/PatientForm';
import { TranscriptInput } from '../components/TranscriptInput';
import { SOAPNoteView } from '../components/SOAPNoteView';
import { SafetyAlertsPanel } from '../components/SafetyAlertsPanel';
import { BillingCodingPanel } from '../components/BillingCodingPanel';
import { PrintPrescriptionModal } from '../components/PrintPrescriptionModal';
import { EncounterHistoryModal } from '../components/EncounterHistoryModal';
import { ClinicAnalyticsModal } from '../components/ClinicAnalyticsModal';
import { LandingPage } from '../components/LandingPage';
import { PatientInfo, SOAPNote } from '../types';

const mockPatientInfo: PatientInfo = {
  name: 'Jane Doe',
  age: 35,
  sex: 'Female',
  medicalHistory: 'None',
  currentMedications: 'None',
  knownAllergies: 'NKDA',
  encounterType: 'Consultation',
  clinicLocation: 'Rural Clinic A',
};

const mockSOAPNote: SOAPNote = {
  subjective: {
    chief_complaint: 'Fever and chills',
    history_of_present_illness: '3 day history of high grade fever.',
    review_of_systems: 'Denies cough.',
    current_medications: ['Paracetamol'],
    allergies: ['NKDA'],
  },
  objective: {
    vital_signs: 'BP 120/80, Temp 38.5C, HR 88',
    physical_exam: 'Alert, mild dehydration.',
    labs_and_imaging: 'RDT positive for P. falciparum',
  },
  assessment: {
    primary_diagnosis: 'Uncomplicated Malaria',
    differential_diagnoses: ['Typhoid Fever', 'Viral Syndrome'],
    clinical_summary: 'Acute febrile illness consistent with malaria.',
  },
  plan: {
    prescriptions: [
      {
        medication: 'Artemether-Lumefantrine',
        dosage: '20/120mg',
        frequency: 'BD for 3 days',
        instructions: 'Take with fatty meal',
      },
    ],
    diagnostic_tests_ordered: ['Blood smear'],
    patient_education: 'Hydrate well and return if fever persists.',
    follow_up: 'Follow up in 3 days.',
  },
  safety_alerts: [
    {
      type: 'Drug-Drug Interaction',
      severity: 'Low',
      message: 'Monitor for mild gastrointestinal upset.',
    },
  ],
  billing_suggestions: {
    icd_10_codes: [
      {
        code: 'B54',
        description: 'Unspecified malaria',
        confidence: 'High',
      },
    ],
    cpt_codes: [
      {
        code: '99213',
        description: 'Office visit low complexity',
        rationale: 'Established patient with acute uncomplicated illness.',
      },
    ],
  },
  meta: {
    uncertainty_flagged: false,
    time_saved_estimate_minutes: 12,
  },
};

describe('Component Smoke Tests', () => {
  it('renders Header component without crashing', () => {
    render(
      <Header
        onOpenHistory={vi.fn()}
        onOpenAnalytics={vi.fn()}
        onSelectSampleScenario={vi.fn()}
        totalEncountersCount={5}
        safetyAlertsCount={1}
      />
    );
    expect(screen.getByText(/MedScribe/i)).toBeInTheDocument();
  });

  it('renders PatientForm component without crashing', () => {
    render(
      <PatientForm
        patientInfo={mockPatientInfo}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
  });

  it('renders TranscriptInput component without crashing', () => {
    render(
      <TranscriptInput
        transcript="Patient presents with fever."
        onChangeTranscript={vi.fn()}
        onSelectScenario={vi.fn()}
        onGenerateSOAP={vi.fn()}
        isGenerating={false}
      />
    );
    expect(screen.getByDisplayValue(/Patient presents with fever/i)).toBeInTheDocument();
  });

  it('renders SOAPNoteView component without crashing', () => {
    render(
      <SOAPNoteView
        soapNote={mockSOAPNote}
        onUpdateSOAP={vi.fn()}
        onOpenPrintPrescription={vi.fn()}
        onSaveEncounter={vi.fn()}
      />
    );
    expect(screen.getByText('Structured SOAP Note Workspace')).toBeInTheDocument();
    expect(screen.getByText('Uncomplicated Malaria')).toBeInTheDocument();
  });

  it('renders SafetyAlertsPanel component without crashing', () => {
    render(
      <SafetyAlertsPanel
        safetyAlerts={mockSOAPNote.safety_alerts}
        meta={mockSOAPNote.meta}
      />
    );
    expect(screen.getByText(/Clinical Safety & Interaction Alerts/i)).toBeInTheDocument();
  });

  it('renders BillingCodingPanel component without crashing', () => {
    render(
      <BillingCodingPanel
        billingSuggestions={mockSOAPNote.billing_suggestions}
      />
    );
    expect(screen.getByText(/Automated Billing & Coding Suggestions/i)).toBeInTheDocument();
    expect(screen.getByText('B54')).toBeInTheDocument();
  });

  it('renders PrintPrescriptionModal component without crashing', () => {
    render(
      <PrintPrescriptionModal
        patientInfo={mockPatientInfo}
        soapNote={mockSOAPNote}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Print Patient Prescription & Advice Slip/i)).toBeInTheDocument();
  });

  it('renders EncounterHistoryModal component without crashing', () => {
    render(
      <EncounterHistoryModal
        encounters={[]}
        onLoadEncounter={vi.fn()}
        onDeleteEncounter={vi.fn()}
        onClearAll={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Saved Clinical Encounters History/i)).toBeInTheDocument();
  });

  it('renders ClinicAnalyticsModal component without crashing', () => {
    render(
      <ClinicAnalyticsModal
        encounters={[]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Clinic Documentation & Impact Analytics/i)).toBeInTheDocument();
  });

  it('renders LandingPage component without crashing', () => {
    render(<LandingPage onLaunchWorkstation={vi.fn()} />);
    expect(screen.getByText(/AI-Powered Clinical Documentation & Safety Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Transparent Clinic Pricing/i)).toBeInTheDocument();
  });
});
