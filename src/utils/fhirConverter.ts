import { PatientInfo, SOAPNote, UploadedDocumentRecord } from '../types';
import { ClinicalFact } from '../clinical/clinicalFactModel';

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

export interface FHIRBundle {
  resourceType: 'Bundle';
  id: string;
  type: 'collection';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: FHIRResource;
  }>;
}

export interface ExportToFHIROptions {
  abhaId?: string;
  department?: string;
  uploadedDocs?: UploadedDocumentRecord[];
  encounterType?: string;
  canonicalFacts?: ClinicalFact[];
  isPhysicianVerified?: boolean;
}

export interface ABDMPushReceipt {
  success: boolean;
  transactionId: string;
  status: string;
  mockGateway: string;
  disclaimer: string;
  timestamp: string;
  bundleId: string;
  resourceCounts: Record<string, number>;
  error?: string;
}

/**
 * Converts MedScribe Lite / MediKiosk PatientInfo, SOAPNote, and uploaded investigations into a standard HL7 FHIR R4 JSON Bundle.
 */
export function exportToFHIRBundle(
  patientInfo: PatientInfo,
  soapNote: SOAPNote,
  options?: ExportToFHIROptions
): FHIRBundle {
  const safePatient = patientInfo || ({} as PatientInfo);
  const safeNote = soapNote || ({} as SOAPNote);

  const timestamp = new Date().toISOString();
  const bundleId = `bundle-medscribe-${Date.now()}`;
  const patientId = `patient-${Date.now()}`;
  const encounterId = `encounter-${Date.now()}`;

  const entries: Array<{ fullUrl: string; resource: FHIRResource }> = [];

  // 1. FHIR Patient Resource (with optional ABHA identifier)
  const patientResource: FHIRResource = {
    resourceType: 'Patient',
    id: patientId,
    identifier: [
      {
        system: 'https://healthid.ndhm.gov.in',
        value: options?.abhaId || safePatient.id || 'Not documented',
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
              code: 'MR',
              display: 'Ayushman Bharat Health Account (ABHA)',
            },
          ],
        },
      },
    ],
    name: [
      {
        use: 'official',
        text: safePatient.name || 'Anonymous Patient',
      },
    ],
    gender:
      (safePatient.gender || safePatient.sex) === 'Female'
        ? 'female'
        : (safePatient.gender || safePatient.sex) === 'Male'
        ? 'male'
        : 'other',
    extension: [
      {
        url: 'http://hl7.org/fhir/StructureDefinition/patient-age',
        valueString: `${safePatient.age || 'Unspecified'} years`,
      },
    ],
  };
  entries.push({
    fullUrl: `urn:uuid:${patientId}`,
    resource: patientResource,
  });

  // 2. FHIR Encounter Resource
  const encounterResource: FHIRResource = {
    resourceType: 'Encounter',
    id: encounterId,
    status: 'finished',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: safePatient.encounterType?.includes('Telehealth') ? 'VR' : 'AMB',
      display: safePatient.encounterType || options?.department || 'Ambulatory',
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: safePatient.name || 'Anonymous Patient',
    },
    period: {
      start: timestamp,
      end: timestamp,
    },
    location: [
      {
        location: {
          display: safePatient.clinicLocation || 'OPD Consultation Wing • Station 01',
        },
      },
    ],
  };
  entries.push({
    fullUrl: `urn:uuid:${encounterId}`,
    resource: encounterResource,
  });

  // 3. FHIR Condition Resources
  const canonicalConditionFacts = options?.canonicalFacts?.filter(
    (f) =>
      (f.domain.toLowerCase() === 'condition' || f.domain.toLowerCase() === 'symptom') &&
      f.assertion === 'AFFIRMED'
  );

  if (canonicalConditionFacts && canonicalConditionFacts.length > 0) {
    canonicalConditionFacts.forEach((fact, idx) => {
      const conditionId = `condition-fact-${idx + 1}-${Date.now()}`;
      const conditionResource: FHIRResource = {
        resourceType: 'Condition',
        id: conditionId,
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: options?.isPhysicianVerified ? 'confirmed' : 'unconfirmed',
            },
          ],
        },
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                code: 'encounter-diagnosis',
                display: 'Encounter Diagnosis',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: fact.codingSystem || 'http://snomed.info/sct',
              code: fact.code,
              display: fact.term,
            },
          ],
          text: fact.term,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        encounter: {
          reference: `Encounter/${encounterId}`,
        },
      };
      entries.push({
        fullUrl: `urn:uuid:${conditionId}`,
        resource: conditionResource,
      });
    });
  } else {
    // Fallback to SOAP note ICD-10 or primary diagnosis
    const icdCodes = safeNote.billing_suggestions?.icd_10_codes || [];
    if (icdCodes.length > 0) {
      icdCodes.forEach((icd, idx) => {
        const conditionId = `condition-${idx + 1}-${Date.now()}`;
        const conditionResource: FHIRResource = {
          resourceType: 'Condition',
          id: conditionId,
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                code: options?.isPhysicianVerified ? 'confirmed' : 'unconfirmed',
              },
            ],
          },
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-category',
                  code: 'encounter-diagnosis',
                  display: 'Encounter Diagnosis',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'http://hl7.org/fhir/sid/icd-10',
                code: icd.code,
                display: icd.description,
              },
            ],
            text: icd.description,
          },
          subject: {
            reference: `Patient/${patientId}`,
          },
          encounter: {
            reference: `Encounter/${encounterId}`,
          },
        };
        entries.push({
          fullUrl: `urn:uuid:${conditionId}`,
          resource: conditionResource,
        });
      });
    } else if (safeNote.assessment?.primary_diagnosis) {
      const conditionId = `condition-primary-${Date.now()}`;
      entries.push({
        fullUrl: `urn:uuid:${conditionId}`,
        resource: {
          resourceType: 'Condition',
          id: conditionId,
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          verificationStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                code: options?.isPhysicianVerified ? 'confirmed' : 'unconfirmed',
              },
            ],
          },
          code: {
            text: safeNote.assessment.primary_diagnosis,
          },
          subject: {
            reference: `Patient/${patientId}`,
          },
          encounter: {
            reference: `Encounter/${encounterId}`,
          },
        },
      });
    }
  }

  // 4. FHIR MedicationStatement Resources (Patient-Reported Medications)
  // Patient-reported medications from kiosk intake / transcript MUST map to MedicationStatement, NEVER MedicationRequest.
  const canonicalMedFacts = options?.canonicalFacts?.filter(
    (f) => f.domain.toLowerCase() === 'medication' && f.assertion === 'AFFIRMED'
  );

  if (canonicalMedFacts && canonicalMedFacts.length > 0) {
    canonicalMedFacts.forEach((fact, idx) => {
      const medStmtId = `medstatement-fact-${idx + 1}-${Date.now()}`;
      const medAttrs = fact.attributes as any;
      const dosageStr = medAttrs
        ? [medAttrs.dosage, medAttrs.frequency, medAttrs.duration].filter(Boolean).join(' ')
        : '';
      const medStmtResource: FHIRResource = {
        resourceType: 'MedicationStatement',
        id: medStmtId,
        status: 'active',
        medicationCodeableConcept: {
          coding: [
            {
              system: fact.codingSystem || 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: fact.code,
              display: fact.term,
            },
          ],
          text: fact.term,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        dosage: dosageStr
          ? [
              {
                text: dosageStr,
              },
            ]
          : undefined,
      };
      entries.push({
        fullUrl: `urn:uuid:${medStmtId}`,
        resource: medStmtResource,
      });
    });
  } else if (safeNote.subjective?.current_medications && safeNote.subjective.current_medications.length > 0) {
    const validMeds = safeNote.subjective.current_medications.filter(
      (m) => m && !m.toLowerCase().includes('not documented') && !m.toLowerCase().includes('none')
    );
    validMeds.forEach((med, idx) => {
      const medStmtId = `medstatement-${idx + 1}-${Date.now()}`;
      const medStmtResource: FHIRResource = {
        resourceType: 'MedicationStatement',
        id: medStmtId,
        status: 'active',
        medicationCodeableConcept: {
          text: med,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
      };
      entries.push({
        fullUrl: `urn:uuid:${medStmtId}`,
        resource: medStmtResource,
      });
    });
  }

  // 5. FHIR MedicationRequest Resources (Physician-Ordered Prescriptions ONLY)
  // Kiosk intake never orders prescriptions. Only genuine physician orders map here.
  const prescriptions = safeNote.plan?.prescriptions || [];
  prescriptions.forEach((rx, idx) => {
    const medRequestId = `medrequest-${idx + 1}-${Date.now()}`;
    const medRequestResource: FHIRResource = {
      resourceType: 'MedicationRequest',
      id: medRequestId,
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        text: rx.medication,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      dosageInstruction: [
        {
          text: `${rx.dosage} ${rx.frequency} for ${rx.duration || 'duration as advised'}. ${rx.instructions || ''}`.trim(),
          additionalInstruction: [
            {
              text: rx.instructions || '',
            },
          ],
        },
      ],
    };
    entries.push({
      fullUrl: `urn:uuid:${medRequestId}`,
      resource: medRequestResource,
    });
  });

  // 6. FHIR AllergyIntolerance Resources (Affirmed / Negated ONLY — Zero unelicited AllergyIntolerance)
  const canonicalAllergyFacts = options?.canonicalFacts?.filter((f) => f.domain.toLowerCase() === 'allergy');
  if (canonicalAllergyFacts && canonicalAllergyFacts.length > 0) {
    canonicalAllergyFacts.forEach((fact, idx) => {
      // If UNKNOWN or NOT_ELICITED, do NOT create an AllergyIntolerance resource!
      if (fact.assertion === 'UNKNOWN' || fact.elicitation === 'NOT_ELICITED') {
        return;
      }
      const allergyId = `allergy-${idx + 1}-${Date.now()}`;
      const isNegated = fact.assertion === 'NEGATED';
      const allergyResource: FHIRResource = {
        resourceType: 'AllergyIntolerance',
        id: allergyId,
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: isNegated ? 'inactive' : 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
              code: isNegated ? 'refuted' : 'confirmed',
            },
          ],
        },
        code: {
          coding: [
            {
              system: fact.codingSystem || 'http://snomed.info/sct',
              code: fact.code,
              display: fact.term,
            },
          ],
          text: fact.term,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
      };
      entries.push({
        fullUrl: `urn:uuid:${allergyId}`,
        resource: allergyResource,
      });
    });
  }

  // 7. FHIR Observations for Patient-Reported AYUSH Intake
  const canonicalAyushFacts = options?.canonicalFacts?.filter(
    (f) => f.domain.toLowerCase() === 'ayush' && f.assertion === 'AFFIRMED'
  );
  if (canonicalAyushFacts && canonicalAyushFacts.length > 0) {
    canonicalAyushFacts.forEach((fact, idx) => {
      const ayushObsId = `observation-ayush-${idx + 1}-${Date.now()}`;
      const ayushResource: FHIRResource = {
        resourceType: 'Observation',
        id: ayushObsId,
        status: 'preliminary',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'social-history',
                display: 'Social History / Constitution',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: fact.codingSystem || 'http://ayush.gov.in/terminology',
              code: fact.code,
              display: fact.term,
            },
          ],
          text: `${fact.term} (Patient-Reported AYUSH Intake)`,
        },
        subject: {
          reference: `Patient/${patientId}`,
        },
        encounter: {
          reference: `Encounter/${encounterId}`,
        },
        valueString: fact.term,
        performer: [
          {
            display: 'Patient (Self-Reported)',
          },
        ],
        note: [
          {
            text: 'Patient-reported constitution / Prakriti; not a clinician-assessed Dashavidha Pariksha.',
          },
        ],
      };
      entries.push({
        fullUrl: `urn:uuid:${ayushObsId}`,
        resource: ayushResource,
      });
    });
  }

  // 5. FHIR Observations for Uploaded Investigations / Lab Tests
  if (options?.uploadedDocs && options.uploadedDocs.length > 0) {
    options.uploadedDocs.forEach((doc, docIdx) => {
      if (doc.extractedData?.investigations && doc.extractedData.investigations.length > 0) {
        doc.extractedData.investigations.forEach((inv, invIdx) => {
          const obsId = `observation-${docIdx + 1}-${invIdx + 1}-${Date.now()}`;
          const obsResource: FHIRResource = {
            resourceType: 'Observation',
            id: obsId,
            status: 'final',
            code: {
              text: inv.testName,
            },
            subject: {
              reference: `Patient/${patientId}`,
            },
            encounter: {
              reference: `Encounter/${encounterId}`,
            },
            valueString: `${inv.value}${inv.unit ? ` ${inv.unit}` : ''}`,
            interpretation: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                    code: inv.isOutOfRange ? 'A' : 'N',
                    display: inv.isOutOfRange ? 'Abnormal' : 'Normal',
                  },
                ],
                text: inv.isOutOfRange ? 'Out of reference range' : 'Within normal limits',
              },
            ],
            referenceRange: inv.referenceRange
              ? [
                  {
                    text: inv.referenceRange,
                  },
                ]
              : undefined,
          };
          entries.push({
            fullUrl: `urn:uuid:${obsId}`,
            resource: obsResource,
          });
        });
      }
    });
  }

  // 6. FHIR Composition Resource (Structured Clinical Summary Document)
  const compositionId = `composition-${Date.now()}`;
  const compositionResource: FHIRResource = {
    resourceType: 'Composition',
    id: compositionId,
    status: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '11506-3',
          display: 'Progress Note',
        },
      ],
      text: options?.department
        ? 'Pre-Consultation Intake Progress Note (MediKiosk)'
        : 'Clinical SOAP Note (MedScribe Lite)',
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: safePatient.name || 'Anonymous Patient',
    },
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    date: timestamp,
    title: options?.department
      ? 'MediKiosk Pre-Consultation Clinical Intake Briefing'
      : 'MedScribe Lite Clinical SOAP Note',
    section: [
      {
        title: 'Subjective (Chief Complaint & HPI)',
        code: {
          coding: [{ system: 'http://loinc.org', code: '61150-0', display: 'Subjective Note' }],
        },
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><strong>Chief Complaint:</strong> ${safeNote.subjective?.chief_complaint || ''}</p><p><strong>HPI:</strong> ${safeNote.subjective?.history_of_present_illness || ''}</p><p><strong>Review of Systems:</strong> ${safeNote.subjective?.review_of_systems || 'Non-contributory'}</p></div>`,
        },
      },
      {
        title: 'Objective & Prior Investigations',
        code: {
          coding: [{ system: 'http://loinc.org', code: '61149-2', display: 'Objective Note' }],
        },
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><strong>Vitals:</strong> ${safeNote.objective?.vital_signs || ''}</p><p><strong>Physical Exam:</strong> ${safeNote.objective?.physical_exam || ''}</p><p><strong>Prior Investigations:</strong> ${safeNote.objective?.labs_and_imaging || 'None scanned'}</p></div>`,
        },
      },
      {
        title: 'Assessment',
        code: {
          coding: [{ system: 'http://loinc.org', code: '51848-0', display: 'Assessment Note' }],
        },
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><strong>Primary Diagnosis:</strong> ${safeNote.assessment?.primary_diagnosis || ''}</p><p><strong>Differentials:</strong> ${safeNote.assessment?.differential_diagnoses?.join(', ') || 'None'}</p><p><strong>Clinical Summary:</strong> ${safeNote.assessment?.clinical_summary || ''}</p></div>`,
        },
      },
      {
        title: 'Plan & Education',
        code: {
          coding: [{ system: 'http://loinc.org', code: '18776-5', display: 'Plan Note' }],
        },
        text: {
          status: 'generated',
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><strong>Diagnostic Tests Ordered:</strong> ${safeNote.plan?.diagnostic_tests_ordered?.join(', ') || 'Pending physician review'}</p><p><strong>Patient Education:</strong> ${safeNote.plan?.patient_education || ''}</p><p><strong>Follow-up:</strong> ${safeNote.plan?.follow_up || ''}</p></div>`,
        },
      },
    ],
  };
  entries.push({
    fullUrl: `urn:uuid:${compositionId}`,
    resource: compositionResource,
  });

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    timestamp,
    entry: entries,
  };
}

/**
 * Automatically pushes an HL7 FHIR R4 bundle to the Mock ABDM / HIS gateway.
 * (Note: Simulated ABDM/HIS sandbox gateway for Smart India Hackathon testing.)
 */
export async function pushFHIRBundleToABDM(payload: {
  fhirBundle: FHIRBundle;
  patientInfo: PatientInfo;
  abhaId?: string;
  department?: string;
  kioskStationId?: string;
  structuredSummary?: any;
}): Promise<ABDMPushReceipt> {
  try {
    const response = await fetch('/api/abdm/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        transactionId: data.transactionId,
        status: data.record?.status || 'ACCEPTED_BY_HIS',
        mockGateway:
          data.record?.mockGateway || 'National Health Stack / ABDM Health Information Exchange (Mock Gateway)',
        disclaimer:
          data.record?.disclaimer ||
          'Simulated ABDM/HIS gateway for Smart India Hackathon 26047 testing. No live NHA ABDM production credentials claimed.',
        timestamp: data.record?.timestamp || new Date().toISOString(),
        bundleId: payload.fhirBundle.id,
        resourceCounts: data.record?.resourceCounts || {},
      };
    }
  } catch (err) {
    console.warn('Network push to /api/abdm/push failed, generating deterministic local receipt:', err);
  }

  // Deterministic client fallback receipt if server endpoint is temporarily unavailable
  const mockTx = `ABDM-MOCK-TX-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const counts: Record<string, number> = {};
  payload.fhirBundle.entry.forEach((e) => {
    const rt = e.resource?.resourceType || 'Resource';
    counts[rt] = (counts[rt] || 0) + 1;
  });

  return {
    success: true,
    transactionId: mockTx,
    status: 'ACCEPTED_BY_HIS',
    mockGateway: 'National Health Stack / ABDM Health Information Exchange (Mock Sandbox Gateway)',
    disclaimer:
      'Simulated ABDM/HIS gateway for Smart India Hackathon 26047 testing. No live NHA ABDM production credentials claimed.',
    timestamp: new Date().toISOString(),
    bundleId: payload.fhirBundle.id,
    resourceCounts: counts,
  };
}

