import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentUploadStep } from '../components/kiosk/DocumentUploadStep';
import { UploadedDocumentRecord } from '../types';

describe('DocumentUploadStep & Multimodal Vision Document Flow', () => {
  const mockDocuments: UploadedDocumentRecord[] = [
    {
      id: 'doc_1',
      fileName: 'Blood_Test_Feb2024.jpg',
      fileType: 'image/jpeg',
      fileSize: 120000,
      uploadedAt: '2024-02-15T10:00:00.000Z',
      effectiveDate: '2024-02-14',
      status: 'completed',
      extractedData: {
        documentType: 'lab_report',
        documentDate: '2024-02-14',
        facilityOrDoctor: 'Apex Diagnostics',
        diagnoses: ['Type 2 Diabetes Mellitus', 'Dyslipidemia'],
        medications: [],
        investigations: [
          {
            testName: 'HbA1c',
            value: '8.4',
            unit: '%',
            referenceRange: '< 5.7 %',
            isOutOfRange: true,
            flagSeverity: 'high',
            interpretation: 'HbA1c 8.4% is significantly elevated indicating uncontrolled diabetes.',
          },
          {
            testName: 'Serum Creatinine',
            value: '0.9',
            unit: 'mg/dL',
            referenceRange: '0.7 - 1.3 mg/dL',
            isOutOfRange: false,
            flagSeverity: 'normal',
            interpretation: 'Serum creatinine is within normal limits.',
          },
        ],
        clinicalSummary: 'Diabetic panel with elevated HbA1c.',
      },
    },
    {
      id: 'doc_2',
      fileName: 'Old_Prescription_Jan2024.jpg',
      fileType: 'image/jpeg',
      fileSize: 95000,
      uploadedAt: '2024-01-22T08:30:00.000Z',
      effectiveDate: '2024-01-20',
      status: 'completed',
      extractedData: {
        documentType: 'prescription',
        documentDate: '2024-01-20',
        facilityOrDoctor: 'Dr. Gupta Clinic',
        diagnoses: ['Essential Hypertension'],
        medications: [
          {
            name: 'Telmisartan',
            dosage: '40 mg',
            frequency: 'OD',
            duration: '30 days',
            instructions: 'Morning after food',
          },
        ],
        investigations: [],
        clinicalSummary: 'Antihypertensive prescription.',
      },
    },
  ];

  it('renders upload step with camera and file upload options', () => {
    const handleUpdate = vi.fn();
    const handleNext = vi.fn();
    const handleBack = vi.fn();

    render(
      <DocumentUploadStep
        documents={[]}
        onUpdateDocuments={handleUpdate}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    expect(screen.getByRole('heading', { name: /Upload Past Medical Records/i })).toBeInTheDocument();
    expect(screen.getByText(/Take Photo with Camera/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Image or File/i)).toBeInTheDocument();
    expect(screen.getByText(/Instant Kiosk Test Samples:/i)).toBeInTheDocument();
  });

  it('highlights out-of-range lab results reusing the SafetyAlertsPanel visual pattern', () => {
    const handleUpdate = vi.fn();
    const handleNext = vi.fn();
    const handleBack = vi.fn();

    render(
      <DocumentUploadStep
        documents={mockDocuments}
        onUpdateDocuments={handleUpdate}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    // Should display the abnormal laboratory values banner
    expect(screen.getByText(/Abnormal Laboratory Values Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Abnormal/i)).toBeInTheDocument();

    // Should display the specific out of range alert
    expect(screen.getByText(/HbA1c 8.4% is significantly elevated indicating uncontrolled diabetes/i)).toBeInTheDocument();
    expect(screen.getByText(/High Severity/i)).toBeInTheDocument();
  });

  it('sorts multiple documents chronologically and allows toggling sort order', () => {
    const handleUpdate = vi.fn();
    const handleNext = vi.fn();
    const handleBack = vi.fn();

    render(
      <DocumentUploadStep
        documents={mockDocuments}
        onUpdateDocuments={handleUpdate}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    // Check sort button exists
    const sortBtn = screen.getByRole('button', { name: /Sorted: Newest First/i });
    expect(sortBtn).toBeInTheDocument();

    // Toggle sort order
    fireEvent.click(sortBtn);
    expect(screen.getByRole('button', { name: /Sorted: Oldest First/i })).toBeInTheDocument();
  });

  it('navigates to next step with proceed button', () => {
    const handleUpdate = vi.fn();
    const handleNext = vi.fn();
    const handleBack = vi.fn();

    render(
      <DocumentUploadStep
        documents={mockDocuments}
        onUpdateDocuments={handleUpdate}
        onNext={handleNext}
        onBack={handleBack}
      />
    );

    const proceedBtn = screen.getByRole('button', { name: /Proceed to Summary/i });
    fireEvent.click(proceedBtn);
    expect(handleNext).toHaveBeenCalledTimes(1);
  });
});
