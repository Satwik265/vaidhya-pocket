import {
  PatientInfo,
  SOAPNote,
  StructuredPatientIntake,
  UploadedDocumentRecord,
} from '../types';
import { VerifiedAbhaProfile } from '../components/kiosk/AbhaVerificationStep';
import { checkDrugInteractions } from './drugInteractionChecker';
import { ClinicalFact, createClinicalFact } from '../clinical/clinicalFactModel';
import { ClinicalFactStore } from '../clinical/clinicalFactStore';
import { extractCanonicalFacts } from '../clinical/extractionPipeline';
import { auditProjectionIntegrity } from '../clinical/evidenceGate';

export interface PhysicianReadySummaryResult {
  patientInfo: PatientInfo;
  soapNote: SOAPNote;
  formattedStandardHistoryText: string;
  sections: {
    chiefComplaint: string;
    hpi: string;
    pastMedicalSurgical: string;
    drugAndAllergy: string;
    familyHistory: string;
    personalHistory: string;
    reviewOfSystems: string;
    priorInvestigationsSummary: string;
    ayushIntegrationSummary?: string;
  };
  canonicalFacts: ClinicalFact[];
  clinicalFacts?: ClinicalFact[];
}

/**
 * Generates a physician-ready structured clinical summary as a pure projection of ClinicalFact[].
 * Single Source of Truth Invariant: Does NOT invent symptoms, diagnoses, vitals, or prescriptions.
 */
export function generatePhysicianReadyIntakeSummary(
  intake: StructuredPatientIntake | null,
  verifiedProfile: VerifiedAbhaProfile | null,
  clinicalDepartment: 'Allopathic' | 'Ayurveda (AYUSH)',
  uploadedDocs: UploadedDocumentRecord[] = [],
  explicitFacts?: ClinicalFact[]
): PhysicianReadySummaryResult {
  const isAyush = clinicalDepartment === 'Ayurveda (AYUSH)';

  // 1. Gather or Extract Canonical Facts
  let facts: ClinicalFact[] = [];
  if (explicitFacts && explicitFacts.length > 0) {
    facts = [...explicitFacts];
  } else if (intake?.clinicalFacts && intake.clinicalFacts.length > 0) {
    facts = [...intake.clinicalFacts];
  } else {
    // Adapter path: Extract facts from raw intake text without inventing
    const combinedTexts: string[] = [];
    if (intake?.chiefComplaint) combinedTexts.push(intake.chiefComplaint);
    if (intake?.conversationTurns) {
      for (const turn of intake.conversationTurns) {
        if (turn.answer) combinedTexts.push(turn.answer);
      }
    }
    facts = extractCanonicalFacts(combinedTexts.join('. '), {
      language: 'hi',
      sourceType: 'PATIENT_VOICE',
    });
  }

  // Ingest facts from uploaded documents to ensure single canonical source of truth
  if (uploadedDocs && uploadedDocs.length > 0) {
    for (const doc of uploadedDocs) {
      if (doc.extractedData?.medications) {
        for (const med of doc.extractedData.medications) {
          const medName = med.name || 'Medication';
          const code = `MED_${medName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
          const isDiscontinued =
            (med.status || '').toLowerCase().includes('discontinued') ||
            (med.instructions || '').toLowerCase().includes('discontinued') ||
            (med.frequency || '').toLowerCase().includes('discontinued');

          facts.push(
            createClinicalFact({
              domain: 'medication',
              canonicalId: code,
              code,
              preferredTerm: medName,
              term: medName,
              value: `${medName} ${med.dosage || ''}`.trim(),
              assertion: isDiscontinued ? 'NEGATED' : 'AFFIRMED',
              elicitation: 'ELICITED',
              temporality: isDiscontinued ? 'HISTORICAL' : 'CURRENT',
              attributes: {
                drugName: medName,
                dose: med.dosage,
                frequency: med.frequency,
                status: isDiscontinued ? 'discontinued' : 'active',
                isDiscontinued,
              },
              evidence: [
                {
                  text: `${medName} ${med.dosage || ''} [From ${doc.fileName}]`.trim(),
                  verbatimText: `${medName} ${med.dosage || ''}`.trim(),
                  startChar: 0,
                  endChar: medName.length,
                },
              ],
              provenance: {
                sourceType: 'UPLOADED_DOCUMENT',
                sourceId: doc.id,
                extractionEngine: 'document_ocr',
                confidence: 0.95,
                timestamp: doc.uploadedAt || new Date().toISOString(),
              },
            })
          );
        }
      }
    }
  }

  // 2. Patient Demographics Normalization
  const fullName = verifiedProfile?.fullName || intake?.patientDemographics?.fullName || 'Not documented';
  const age = verifiedProfile?.age || intake?.patientDemographics?.age || 'Not documented';
  const gender = (verifiedProfile?.gender || intake?.patientDemographics?.gender || 'Not documented') as 'Male' | 'Female' | 'Other';
  const abhaId = verifiedProfile?.abhaId || intake?.abhaId || 'Not documented';

  // 3. Section 1: Chief Complaint
  const affirmedSymptoms = facts.filter((f) => f.domain === 'symptom' && f.assertion === 'AFFIRMED');
  let chiefComplaint = intake?.chiefComplaint || '';
  if (!chiefComplaint || chiefComplaint.toLowerCase().includes('consultation intake')) {
    if (affirmedSymptoms.length > 0) {
      chiefComplaint = affirmedSymptoms.map((s) => s.preferredTerm).join(', ');
    } else if (isAyush && intake?.ayushHistory?.nidanaSamprapti?.chiefComplaintAyush) {
      chiefComplaint = intake.ayushHistory.nidanaSamprapti.chiefComplaintAyush;
    } else {
      chiefComplaint = 'Not documented';
    }
  }

  // 4. Section 2: HPI (SOCRATES + Anchored Fact Evidence)
  const socrates = intake?.socratesHpi || {};
  const site = socrates.site || 'Not documented';
  const onset = socrates.onset || 'Not documented';
  const character = socrates.character || 'Not documented';
  const radiation = socrates.radiation || 'Not documented';
  const severity = socrates.severity ? `${socrates.severity}/10 on numerical rating scale` : 'Not documented';
  const timing = socrates.timing || 'Not documented';
  const exacerbating = socrates.exacerbatingFactors?.length ? socrates.exacerbatingFactors.join(', ') : 'Not documented';
  const relieving = socrates.relievingFactors?.length ? socrates.relievingFactors.join(', ') : 'Not documented';

  let hpiText = `Patient presents with ${chiefComplaint}.
- Site: ${site}
- Onset: ${onset}
- Character: ${character}
- Radiation: ${radiation}
- Severity: ${severity}
- Timing / Duration: ${timing}
- Exacerbating Factors: ${exacerbating}
- Relieving Factors: ${relieving}`;

  // Helper to extract evidence text safely from FactEvidence[]
  const getEvText = (f: ClinicalFact): string => {
    if (!f || !f.evidence) return '';
    if (Array.isArray(f.evidence)) {
      return f.evidence[0]?.verbatimText || f.evidence[0]?.text || '';
    }
    return (f.evidence as any).verbatimText || (f.evidence as any).text || '';
  };

  // Evidence grounding lines
  if (affirmedSymptoms.length > 0) {
    hpiText += `\n\nAffirmed Symptom Evidence (Canonical Facts):`;
    for (const sym of affirmedSymptoms) {
      hpiText += `\n• ${sym.preferredTerm} [AFFIRMED] — Evidence: "${getEvText(sym)}" (Source: ${sym.provenance.sourceType}, Conf: ${Math.round(sym.provenance.confidence * 100)}%)`;
    }
  }

  const negatedSymptoms = facts.filter((f) => f.domain === 'symptom' && f.assertion === 'NEGATED');
  if (negatedSymptoms.length > 0) {
    hpiText += `\n\nExplicitly Denied / Negated Symptoms:`;
    for (const sym of negatedSymptoms) {
      hpiText += `\n• ${sym.preferredTerm} [NEGATED] — Evidence: "${getEvText(sym)}" (Source: ${sym.provenance.sourceType})`;
    }
  }

  if (isAyush && intake?.ayushHistory) {
    const samprapti = intake.ayushHistory.nidanaSamprapti;
    const doshas = samprapti?.sampraptiGhatakas?.doshaInvolved?.join(', ') || 'Not documented';
    const dushya = samprapti?.sampraptiGhatakas?.dushyaInvolved?.join(', ') || 'Not documented';
    const srotas = samprapti?.sampraptiGhatakas?.srotasInvolved?.join(', ') || 'Not documented';
    const ama = samprapti?.sampraptiGhatakas?.amaPresence || 'Not documented';

    hpiText += `\n\nAyurvedic Pathogenesis (Patient-Reported & Kiosk Intake):
- Dosha Mentioned: ${doshas}
- Dushya: ${dushya}
- Srotas: ${srotas}
- Ama Status: ${ama}`;
  }

  // 5. Section 3: Past Medical & Surgical History
  const affirmedConditions = facts.filter((f) => f.domain === 'condition' && f.assertion === 'AFFIRMED');
  const negatedConditions = facts.filter((f) => f.domain === 'condition' && f.assertion === 'NEGATED');
  const discreteConditions = intake?.pastMedicalHistory || [];

  let medicalHistoryLines: string[] = [];
  if (affirmedConditions.length > 0) {
    affirmedConditions.forEach((c) => {
      medicalHistoryLines.push(`- ${c.preferredTerm} [AFFIRMED] (Evidence: "${getEvText(c)}")`);
    });
  } else if (discreteConditions.length > 0) {
    discreteConditions.forEach((c) => {
      medicalHistoryLines.push(`- ${c.condition}${c.diagnosedYear ? ` (Diagnosed ${c.diagnosedYear})` : ''}: ${c.status || 'Active'}`);
    });
  } else {
    medicalHistoryLines.push('- None documented');
  }

  if (negatedConditions.length > 0) {
    medicalHistoryLines.push('\nExplicitly Denied Past Conditions:');
    negatedConditions.forEach((c) => {
      medicalHistoryLines.push(`- ${c.preferredTerm} [NEGATED] (Evidence: "${getEvText(c)}")`);
    });
  }
  const medicalHistoryText = medicalHistoryLines.join('\n');

  const surgeries = intake?.pastSurgicalHistory || [];
  const surgicalHistoryText = surgeries.length > 0
    ? surgeries.map((s) => `- ${s.procedure}${s.approximateYear ? ` (${s.approximateYear})` : ''}`).join('\n')
    : '- None documented';

  const pastMedicalSurgicalText = `Past Medical History:\n${medicalHistoryText}\n\nPast Surgical History:\n${surgicalHistoryText}`;

  // 6. Section 4: Drug & Allergy History
  const factStore = new ClinicalFactStore(intake?.intakeId, facts);
  const medConflicts = factStore.getAllConflicts();

  const medFacts = facts.filter((f) => f.domain.toLowerCase() === 'medication' && f.assertion === 'AFFIRMED');
  const allMedsFormatted: string[] = [];

  // Add from canonical facts
  medFacts.forEach((mf) => {
    const label = `${mf.preferredTerm}${mf.value && mf.value !== mf.preferredTerm ? ` (${mf.value})` : ''} [Source: ${mf.provenance.sourceType}]`;
    if (!allMedsFormatted.some((m) => m.toLowerCase().includes(mf.preferredTerm.toLowerCase()))) {
      allMedsFormatted.push(label);
    }
  });

  // Conflict warning banner for discordant medications across patient voice vs document
  const conflictWarnings: string[] = [];
  for (const [id, confFacts] of medConflicts.entries()) {
    if (confFacts[0]?.domain.toLowerCase() === 'medication') {
      const patientClaim = confFacts.find((f) => f.provenance.sourceType === 'PATIENT_VOICE' || f.provenance.sourceType === 'PATIENT_TEXT');
      const docClaim = confFacts.find((f) => f.provenance.sourceType === 'UPLOADED_DOCUMENT');
      if (patientClaim && docClaim) {
        const ptStatus = patientClaim.assertion === 'AFFIRMED' ? 'currently taking' : 'denied';
        const docStatus = (docClaim.attributes as any)?.isDiscontinued || docClaim.assertion === 'NEGATED' ? 'discontinued' : 'active';
        conflictWarnings.push(
          `[CLINICAL CONFLICT DETECTED]: Patient reports ${ptStatus} ${patientClaim.preferredTerm}, but Uploaded Document indicates ${docClaim.preferredTerm} is ${docStatus}. Requires attending clinician reconciliation.`
        );
      } else {
        conflictWarnings.push(
          `[CLINICAL CONFLICT DETECTED] for ${confFacts[0].preferredTerm}: Multiple contradictory assertions recorded across encounter sources. Requires attending clinician reconciliation.`
        );
      }
    }
  }

  let drugHistoryText = allMedsFormatted.length > 0
    ? allMedsFormatted.map((m, i) => `${i + 1}. ${m}`).join('\n')
    : 'None documented';

  if (conflictWarnings.length > 0) {
    drugHistoryText += `\n\n${conflictWarnings.join('\n')}`;
  }

  // Allergies: STRICT SEMANTICS (Unknown != Negated!)
  const affirmedAllergies = facts.filter((f) => f.domain === 'allergy' && f.assertion === 'AFFIRMED');
  const negatedAllergies = facts.filter((f) => f.domain === 'allergy' && f.assertion === 'NEGATED');

  let allergyHistoryText = '';
  const allergiesFormatted: string[] = [];

  if (affirmedAllergies.length > 0) {
    affirmedAllergies.forEach((a) => {
      const line = `${a.preferredTerm} [AFFIRMED] (Evidence: "${getEvText(a)}")`;
      allergiesFormatted.push(line);
    });
    allergyHistoryText = allergiesFormatted.map((a) => `- ${a}`).join('\n');
  } else if (negatedAllergies.length > 0) {
    // Explicit denial
    allergyHistoryText = `- No Known Drug Allergies (NKDA) [Patient explicitly denied: "${getEvText(negatedAllergies[0])}"]`;
    allergiesFormatted.push('NKDA (Explicitly verified)');
  } else {
    // UNELICITED / UNKNOWN — NEVER claim NKDA!
    allergyHistoryText = '- Not elicited / Not documented during this pre-consultation encounter';
  }

  const drugAndAllergyText = `Current Medications:\n${drugHistoryText}\n\nKnown Allergies:\n${allergyHistoryText}`;

  // 7. Section 5: Family History
  const family = intake?.familyHistory || [];
  const familyHistoryText = family.length > 0
    ? family.map((f) => `- ${f.relationship}: ${f.condition}`).join('\n')
    : '- None documented';

  // 8. Section 6: Personal History & AYUSH Constitutional Profile
  const personal = intake?.personalHistory || {};
  const diet = personal.dietType || 'Not documented';
  const smoking = personal.smokingStatus || 'Not documented';
  const alcohol = personal.alcoholConsumption || 'Not documented';
  const sleep = personal.sleepQuality || 'Not documented';
  const activity = personal.physicalActivityLevel || 'Not documented';

  let personalHistoryText = `- Diet: ${diet}\n- Tobacco/Smoking: ${smoking}\n- Alcohol: ${alcohol}\n- Sleep Hygiene: ${sleep}\n- Physical Activity: ${activity}`;

  const prakritiFacts = facts.filter((f) => f.domain === 'ayush' && f.canonicalId.includes('PRAKRITI'));
  if (prakritiFacts.length > 0 || (isAyush && intake?.ayushHistory)) {
    const pFact = prakritiFacts[0];
    const prakritiVal = pFact ? pFact.value : intake?.ayushHistory?.dashavidhaPariksha?.prakriti?.dominantPrakriti;
    const agni = intake?.ayushHistory?.dashavidhaPariksha?.aharaShakti?.agniType || 'Not documented';
    const kostha = intake?.ayushHistory?.aharaVihara?.kosthaNature || 'Not documented';

    personalHistoryText += `\n\nAyurvedic Constitutional Profile:
- Patient-Reported Constitutional Tendency (Prakriti): ${prakritiVal ? `${prakritiVal} (Subjective patient report; formal Dashavidha Pariksha pending physician examination)` : 'Not documented'}
- Agni (Digestive Fire): ${agni}
- Kostha (Bowel Pattern): ${kostha}
- Nidra (Sleep): ${intake?.ayushHistory?.aharaVihara?.viharaHabits?.nidraPattern || 'Not documented'}`;
  }

  // 9. Section 7: Review of Systems (ROS) — Strict Elicitation Semantics!
  const hasChestPain = facts.some((f) => f.canonicalId === 'SYM_CHEST_PAIN' && f.assertion === 'AFFIRMED');
  const deniesChestPain = facts.some((f) => f.canonicalId === 'SYM_CHEST_PAIN' && f.assertion === 'NEGATED');

  const hasDyspnea = facts.some((f) => (f.canonicalId === 'SYM_BREATHLESSNESS' || f.canonicalId === 'SYM_COUGH') && f.assertion === 'AFFIRMED');
  const deniesDyspnea = facts.some((f) => (f.canonicalId === 'SYM_BREATHLESSNESS' || f.canonicalId === 'SYM_COUGH') && f.assertion === 'NEGATED');

  const hasGI = facts.some((f) => ['SYM_ABDOMINAL_PAIN', 'SYM_VOMITING', 'SYM_DIARRHEA'].includes(f.canonicalId) && f.assertion === 'AFFIRMED');
  const deniesGI = facts.some((f) => ['SYM_ABDOMINAL_PAIN', 'SYM_VOMITING', 'SYM_DIARRHEA'].includes(f.canonicalId) && f.assertion === 'NEGATED');

  const hasNeuro = facts.some((f) => ['SYM_HEADACHE', 'SYM_DIZZINESS'].includes(f.canonicalId) && f.assertion === 'AFFIRMED');
  const deniesNeuro = facts.some((f) => ['SYM_HEADACHE', 'SYM_DIZZINESS'].includes(f.canonicalId) && f.assertion === 'NEGATED');

  const hasFever = facts.some((f) => f.canonicalId === 'SYM_FEVER' && f.assertion === 'AFFIRMED');
  const deniesFever = facts.some((f) => f.canonicalId === 'SYM_FEVER' && f.assertion === 'NEGATED');

  const rosLines: string[] = [
    `- General: ${hasFever ? 'Positive for fever' : deniesFever ? 'Explicitly denies fever' : 'Not elicited / Not documented'}`,
    `- Cardiovascular: ${hasChestPain ? 'Positive for chest discomfort' : deniesChestPain ? 'Explicitly denies chest pain' : 'Not elicited / Not documented'}`,
    `- Respiratory: ${hasDyspnea ? 'Positive for respiratory symptoms' : deniesDyspnea ? 'Explicitly denies shortness of breath' : 'Not elicited / Not documented'}`,
    `- Gastrointestinal: ${hasGI ? 'Positive for GI symptoms' : deniesGI ? 'Explicitly denies abdominal symptoms' : 'Not elicited / Not documented'}`,
    `- Neurological: ${hasNeuro ? 'Positive for neurological/headache symptoms' : deniesNeuro ? 'Explicitly denies headache/neurological symptoms' : 'Not elicited / Not documented'}`,
    `- Genitourinary: Not elicited / Not documented`,
    `- Musculoskeletal: Not elicited / Not documented`,
    `- Integumentary: Not elicited / Not documented`,
  ];
  const reviewOfSystemsText = rosLines.join('\n');

  // 10. Section 8: Prior Investigations Summary
  let priorInvestigationsText = '';
  if (uploadedDocs.length > 0) {
    const docSummaries = uploadedDocs.map((doc, idx) => {
      let details = `[Doc ${idx + 1}] ${doc.fileName} (Status: ${doc.status})`;
      if (doc.extractedData?.investigations && doc.extractedData.investigations.length > 0) {
        details += '\n  Lab Investigations:';
        doc.extractedData.investigations.forEach((inv) => {
          details += `\n    • ${inv.testName}: ${inv.value} ${inv.unit || ''} (Ref: ${inv.referenceRange || 'Standard'})${inv.isOutOfRange ? ' [OUT-OF-RANGE]' : ''}`;
        });
      }
      return details;
    });
    priorInvestigationsText = docSummaries.join('\n\n');
  } else {
    priorInvestigationsText = 'No prior physical lab records, prescription slips, or discharge summaries were scanned at the kiosk terminal during this intake session.';
  }

  // 11. Format Pre-Consultation Summary String
  const formattedStandardHistoryText = `================================================================================
PRE-CONSULTATION INTAKE SUMMARY (PHYSICIAN CONFIRMATION SCREEN)
Patient: ${fullName} | Age: ${age}y | Sex: ${gender} | ABHA: ${abhaId}
Department: ${clinicalDepartment} | Station: MediKiosk-Terminal-01
================================================================================

1. CHIEF COMPLAINT:
${chiefComplaint}

2. HISTORY OF PRESENT ILLNESS (HPI):
${hpiText}

3. PAST MEDICAL & SURGICAL HISTORY:
${pastMedicalSurgicalText}

4. DRUG & ALLERGY HISTORY:
${drugAndAllergyText}

5. FAMILY HISTORY:
${familyHistoryText}

6. PERSONAL HISTORY:
${personalHistoryText}

7. REVIEW OF SYSTEMS (ROS):
${reviewOfSystemsText}

8. PRIOR INVESTIGATIONS SUMMARY:
${priorInvestigationsText}
================================================================================`;

  // 12. PatientInfo for Clinician Workstation
  const patientInfoObj: PatientInfo = {
    name: fullName,
    age,
    sex: gender,
    medicalHistory: `Pre-consultation kiosk intake (${clinicalDepartment}). ${affirmedConditions.map((c) => c.preferredTerm).join(', ') || 'No chronic conditions documented'}.`,
    currentMedications: allMedsFormatted.join('; ') || 'None documented',
    knownAllergies: allergiesFormatted.join('; ') || 'Not elicited / Not documented',
    encounterType: `${clinicalDepartment} Pre-Consultation Handoff`,
    clinicLocation: 'OPD Consultation Wing • Station 01',
  };

  // 13. Map to Standard SOAPNote Structure (ZERO FABRICATION ENFORCED!)
  // Assessment is ONLY set if an explicit clinician-diagnosed fact exists. Kiosk never invents GERD or Amlapitta!
  const clinicianDiagnoses = facts.filter((f) => f.domain === 'condition' && f.provenance.sourceType === 'CLINICIAN_ENTERED');
  const primaryDiagnosis = clinicianDiagnoses.length > 0
    ? clinicianDiagnoses[0].preferredTerm
    : 'Pending attending physician evaluation';

  const soapNoteObj: SOAPNote = {
    subjective: {
      chief_complaint: chiefComplaint,
      history_of_present_illness: hpiText,
      review_of_systems: reviewOfSystemsText,
      current_medications: allMedsFormatted,
      allergies: allergiesFormatted,
    },
    objective: {
      vital_signs: 'Self-reported at kiosk terminal: Not documented. Formal triage vitals pending nursing intake.',
      physical_exam: isAyush
        ? 'Pre-consultation intake. In-person Ashtavidha & Dashavidha Pariksha pending physician examination.'
        : 'Pre-consultation kiosk self-service intake. In-person physical examination pending attending physician consultation.',
      labs_and_imaging: priorInvestigationsText,
    },
    assessment: {
      primary_diagnosis: primaryDiagnosis,
      differential_diagnoses: [], // Never fabricate differentials for unreviewed intake!
      clinical_summary: formattedStandardHistoryText,
    },
    plan: {
      prescriptions: [], // ZERO-FABRICATION: Kiosk terminal NEVER orders prescriptions!
      diagnostic_tests_ordered: [],
      patient_education: isAyush
        ? 'AIIA OPD Intake completed. Please proceed to consultation room for pulse and constitutional examination.'
        : 'General intake completed. Please proceed to the waiting area until your token is called.',
      follow_up: 'Immediate handoff to attending physician in OPD consultation room.',
    },
    billing_suggestions: {
      icd_10_codes: [], // ZERO-FABRICATION: Billing codes require clinician diagnostic confirmation!
      cpt_codes: [],
    },
    safety_alerts: [],
    meta: {
      uncertainty_flagged: facts.some((f) => f.assertion === 'SUSPECTED' || f.assertion === 'UNKNOWN'),
      time_saved_estimate_minutes: 10,
    },
    documentation_confidence: {
      overall_score: facts.length > 0 ? Math.round(facts.reduce((acc, f) => acc + f.provenance.confidence, 0) / facts.length * 100) : 70,
      subjective: { score: 90, reasoning: 'Derived directly from patient-anchored canonical facts.' },
      objective: { score: uploadedDocs.length > 0 ? 85 : 50, reasoning: uploadedDocs.length > 0 ? 'Document labs extracted.' : 'No objective data elicited at kiosk.' },
      assessment: { score: clinicianDiagnoses.length > 0 ? 90 : 40, reasoning: clinicianDiagnoses.length > 0 ? 'Physician diagnosis recorded.' : 'Awaiting clinician assessment.' },
      plan: { score: 50, reasoning: 'Prescription orders and diagnostic tests pending physician evaluation.' },
    },
  };

  // Run drug interactions check for safety alerts
  const autoAlerts = checkDrugInteractions(
    soapNoteObj.plan?.prescriptions || [],
    allMedsFormatted.join(' '),
    pastMedicalSurgicalText,
    allergiesFormatted.join(' ')
  );
  soapNoteObj.safety_alerts = autoAlerts;

  // Run the Evidence Gatekeeper audit on the generated projection
  const audit = auditProjectionIntegrity({
    diagnoses: primaryDiagnosis !== 'Pending attending physician evaluation' ? [primaryDiagnosis] : [],
    vitals: soapNoteObj.objective.vital_signs,
    prescriptions: soapNoteObj.plan.prescriptions,
    facts,
  });

  if (!audit.safe) {
    console.error('[EvidenceGate] Projection audit failed violations:', audit.ungroundedElements);
  }

  return {
    patientInfo: patientInfoObj,
    soapNote: soapNoteObj,
    formattedStandardHistoryText,
    sections: {
      chiefComplaint,
      hpi: hpiText,
      pastMedicalSurgical: pastMedicalSurgicalText,
      drugAndAllergy: drugAndAllergyText,
      familyHistory: familyHistoryText,
      personalHistory: personalHistoryText,
      reviewOfSystems: reviewOfSystemsText,
      priorInvestigationsSummary: priorInvestigationsText,
      ayushIntegrationSummary: isAyush ? 'Ayurvedic Prakriti, Agni, Kostha & Samprapti integrated.' : undefined,
    },
    canonicalFacts: facts,
    clinicalFacts: facts,
  };
}

export const generateStructuredSummary = generatePhysicianReadyIntakeSummary;

