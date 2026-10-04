import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { DocumentationConfidenceBadge } from '../components/soap-note/DocumentationConfidenceBadge';
import { SOAPNoteView } from '../components/SOAPNoteView';
import { SOAPNote } from '../types';

const mockSOAPNoteWithConfidence: SOAPNote = {
  subjective: {
    chief_complaint: 'Fever and chills for 3 days',
    history_of_present_illness: 'Patient reports onset of high fever and severe shivering on Tuesday.',
    review_of_systems: 'Denies cough. Reports headache and body pain.',
    current_medications: ['Paracetamol 500mg'],
    allergies: ['NKDA'],
  },
  objective: {
    vital_signs: 'Temp: 38.9 C, BP: 118/76 mmHg, HR: 104 bpm',
    physical_exam: 'Mild conjunctival pallor, soft non-tender abdomen with mild splenomegaly.',
    labs_and_imaging: 'mRDT positive for P. falciparum, Hb: 10.2 g/dL',
  },
  assessment: {
    primary_diagnosis: 'Uncomplicated Plasmodium falciparum Malaria',
    clinical_summary: 'Acute febrile illness supported by positive mRDT in endemic area.',
    differential_diagnoses: ['Typhoid fever', 'Dengue fever'],
  },
  plan: {
    prescriptions: [
      {
        medication: 'Artemether-Lumefantrine (Coartem)',
        dosage: '80/480mg',
        frequency: 'Twice daily for 3 days',
        instructions: 'Take with fatty meal or milk',
      },
    ],
    diagnostic_tests_ordered: ['Repeat Hb in 2 weeks'],
    patient_education: 'Hydration and bed net compliance education provided.',
    follow_up: 'Review in 1 week or sooner if fever persists past 48 hours.',
  },
  safety_alerts: [],
  billing_suggestions: { icd_10_codes: [], cpt_codes: [] },
  documentation_confidence: {
    overall_score: 92,
    subjective: {
      score: 95,
      reasoning: 'Detailed history provided regarding onset and symptoms.',
    },
    objective: {
      score: 90,
      reasoning: 'Vitals and mRDT lab results documented clearly.',
    },
    assessment: {
      score: 90,
      reasoning: 'Primary diagnosis backed by rapid test evidence.',
      missing_information: ['Previous travel history duration'],
    },
    plan: {
      score: 93,
      reasoning: 'Clear dosage, follow-up, and safety netting guidelines given.',
    },
  },
};

describe('Documentation Confidence Component Suite', () => {
  it('renders DocumentationConfidenceBadge correctly with score badge', () => {
    render(
      <DocumentationConfidenceBadge
        sectionName="Subjective (S)"
        confidence={{
          score: 95,
          reasoning: 'Comprehensive symptom timeline.',
        }}
      />
    );

    expect(screen.getByText('Doc Support: 95%')).toBeInTheDocument();
  });

  it('renders overall and section-level documentation confidence inside SOAPNoteView', () => {
    render(
      <SOAPNoteView
        soapNote={mockSOAPNoteWithConfidence}
        onSaveEncounter={() => {}}
        onOpenPrintPrescription={() => {}}
        onUpdateSOAP={vi.fn()}
      />
    );

    // Overall header score
    expect(screen.getByText('Overall Support: 92%')).toBeInTheDocument();

    // Section score badges
    expect(screen.getByText('Doc Support: 95%')).toBeInTheDocument();
    expect(screen.getAllByText('Doc Support: 90%')).toHaveLength(2);
    expect(screen.getByText('Doc Support: 93%')).toBeInTheDocument();
  });
});
