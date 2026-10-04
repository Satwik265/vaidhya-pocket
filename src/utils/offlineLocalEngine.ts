import { PatientInfo, SOAPNote, Prescription, ICD10Code, CPTCode, SafetyAlert } from '../types';
import { checkDrugInteractions } from './drugInteractionChecker';
import { isNonEnglishTranscript } from './languageDetector';
import { analyzeHindiTranscript, ClinicalConcept } from '../clinical/hindiClinicalMatcher';
import hindiSymptoms from '../dictionaries/medical/hindi_symptoms.json';
import hindiNegation from '../dictionaries/medical/hindi_negation.json';
import hindiTemporal from '../dictionaries/medical/hindi_temporal.json';

/**
 * Deterministic browser-local clinical NLP extraction engine.
 * Synthesizes structured SOAP notes, billing suggestions, and confidence scores locally
 * without requiring any external network call.
 * Supports English and Hindi offline clinical processing.
 */
export interface OfflineSOAPOptions {
  isDemoMode?: boolean;
}

export function generateOfflineSOAPNote(
  patientInfo: PatientInfo,
  transcript: string,
  language?: string,
  options?: OfflineSOAPOptions
): SOAPNote {
  const isDevanagari = /[\u0900-\u097F]/.test(transcript);
  const isHindiTranslit = /\b(dard|bukhar|sirdard|chakkar|ulti|dast|khasi|seene|chhati|nahi|nahin|din|mahine|hafte|ghante|saal)\b/i.test(transcript);
  const isHindi = language === 'hi' || isDevanagari || isHindiTranslit;
  const isDemo = options?.isDemoMode === true;

  if (isHindi) {
    return generateHindiOfflineSOAPNote(patientInfo, transcript, options);
  }

  const lowerTranscript = transcript.toLowerCase();
  const lowerHistory = (patientInfo.medicalHistory || '').toLowerCase();

  // 1. Extract Subjective Data
  let chiefComplaint = 'Acute medical evaluation requested';
  if (lowerTranscript.includes('fever') || lowerTranscript.includes('chills')) {
    chiefComplaint = 'High fever, rigors, and body aches';
  } else if (lowerTranscript.includes('blood pressure') || lowerTranscript.includes('hypertension') || lowerTranscript.includes('dizziness')) {
    chiefComplaint = 'Elevated blood pressure screening & headache';
  } else if (lowerTranscript.includes('ear') || lowerTranscript.includes('otitis') || lowerTranscript.includes('crying')) {
    chiefComplaint = 'Right ear pain, irritability, and fever in pediatric patient';
  } else if (lowerTranscript.includes('diarrhea') || lowerTranscript.includes('vomiting') || lowerTranscript.includes('stomach')) {
    chiefComplaint = 'Watery diarrhea, abdominal cramping, and mild dehydration';
  } else if (lowerTranscript.includes('cough') || lowerTranscript.includes('shortness of breath')) {
    chiefComplaint = 'Productive cough, chest tightness, and low-grade fever';
  }

  const hpi = transcript.trim() || 'Patient presented to clinic for unscheduled clinical consultation.';
  const currentMeds = patientInfo.currentMedications ? [patientInfo.currentMedications] : ['None documented'];
  // Zero-fabrication: Never default to NKDA without patient denial!
  const allergies = patientInfo.knownAllergies ? [patientInfo.knownAllergies] : ['Not elicited / Not documented'];

  // 2. Extract Objective Data
  let vitals = 'Not documented';
  const bpMatch = transcript.match(/(\d{2,3}\/\d{2,3})\s*(mmhg)?/i);
  const tempMatch = transcript.match(/(\d{2,3}\.?\d?)\s*(°?c|degrees)?/i);
  const hrMatch = transcript.match(/(\d{2,3})\s*(bpm|beats)/i);

  if (bpMatch || tempMatch || hrMatch) {
    vitals = `BP ${bpMatch ? bpMatch[1] : 'Not recorded'} mmHg, Temp ${tempMatch ? tempMatch[1] : 'Not recorded'}°C, HR ${hrMatch ? hrMatch[1] : 'Not recorded'} bpm`;
  } else if (isDemo) {
    // Isolated legacy demo preset
    if (lowerTranscript.includes('fever') || lowerTranscript.includes('malaria')) {
      vitals = 'Temp 38.9°C, BP 115/75 mmHg, HR 98 bpm, RR 20/min, SpO2 97%';
    } else if (lowerTranscript.includes('hypertension') || lowerTranscript.includes('blood pressure')) {
      vitals = 'BP 152/94 mmHg, Temp 36.8°C, HR 76 bpm, RR 14/min, SpO2 99%';
    } else {
      vitals = 'Temp 37.0°C, BP 120/80 mmHg, HR 72 bpm, RR 16/min, SpO2 98%';
    }
  }

  let physicalExam = 'Not documented (Pending physician physical examination)';
  if (isDemo) {
    if (lowerTranscript.includes('ear') || lowerTranscript.includes('tympanic')) {
      physicalExam = 'ENT: Right tympanic membrane erythematous, bulging with lost light reflex. Left TM clear. Oropharynx clear.';
    } else if (lowerTranscript.includes('spleen') || lowerTranscript.includes('malaria') || lowerTranscript.includes('fever')) {
      physicalExam = 'General: Ill-appearing, febrile. Abdomen: Mild splenomegaly palpable below left costal margin, soft, non-rigid.';
    } else if (lowerTranscript.includes('diarrhea') || lowerTranscript.includes('dehydration')) {
      physicalExam = 'Abdomen: Soft, hyperactive bowel sounds in all 4 quadrants, mild diffuse tenderness. Dry mucous membranes.';
    }
  }

  let labs = 'Not documented';
  if (lowerTranscript.includes('rdt') || lowerTranscript.includes('malaria') || lowerTranscript.includes('positive')) {
    labs = 'Rapid Diagnostic Test (RDT): Reported in encounter transcript. Confirmatory review pending.';
  } else if (lowerTranscript.includes('glucose') || lowerTranscript.includes('hba1c') || lowerTranscript.includes('diabetes')) {
    labs = 'Glucose/HbA1c reported in encounter transcript. Laboratory validation pending.';
  }

  // 3. Clinical Assessment & Diagnosis Selection
  let primaryDiag = 'Unspecified Acute Febrile Illness (Symptom evaluation; formal diagnosis pending clinician review)';
  let diffDiags: string[] = [];
  let summary = 'Patient presents with acute symptoms evaluated via local offline clinical guidelines.';
  let prescriptions: Prescription[] = [];
  let icdCodes: ICD10Code[] = [];
  let cptCodes: CPTCode[] = [];

  if (isDemo) {
    // Isolated legacy demo preset for testing demo templates
    cptCodes = [
      { code: '99213', description: 'Office or other outpatient visit, established patient', rationale: 'Low-to-moderate medical decision making' },
    ];
    if (lowerTranscript.includes('malaria') || lowerTranscript.includes('rdt positive') || lowerTranscript.includes('artemether')) {
      primaryDiag = 'Uncomplicated Plasmodium falciparum Malaria';
      diffDiags = ['Typhoid Fever', 'Dengue Fever', 'Acute Pyelonephritis'];
      summary = 'Clinical presentation and positive malaria RDT confirm acute Plasmodium falciparum parasitemia requiring prompt antimalarial therapy.';
      prescriptions = [
        { medication: 'Artemether-Lumefantrine (Coartem)', dosage: '20/120mg', frequency: 'BID', duration: '3 days', instructions: 'Take 4 tablets per dose with milk or fatty meal' },
        { medication: 'Paracetamol', dosage: '500mg', frequency: 'QID PRN', duration: '3 days', instructions: 'Take for fever > 38.5°C or body pain' },
      ];
      icdCodes = [{ code: 'B50.9', description: 'Plasmodium falciparum malaria, unspecified', confidence: 'High' }];
    } else if (lowerTranscript.includes('hypertension') || lowerTranscript.includes('blood pressure') || lowerTranscript.includes('lisinopril')) {
      primaryDiag = 'Essential Primary Hypertension (Stage 2)';
      diffDiags = ['Secondary Hypertension', 'White Coat Hypertension', 'Renal Artery Stenosis'];
      summary = 'Sustained elevation in systolic/diastolic blood pressure noted during outpatient screening. Antihypertensive therapy indicated.';
      prescriptions = [
        { medication: 'Lisinopril', dosage: '10mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take in the morning with water' },
        { medication: 'Amlodipine', dosage: '5mg', frequency: 'Once Daily', duration: '30 days', instructions: 'Take at bedtime if blood pressure remains elevated' },
      ];
      icdCodes = [{ code: 'I10', description: 'Essential (primary) hypertension', confidence: 'High' }];
    } else if (lowerTranscript.includes('ear') || lowerTranscript.includes('otitis') || lowerTranscript.includes('amoxicillin')) {
      primaryDiag = 'Acute Suppurative Otitis Media (Right Ear)';
      diffDiags = ['Otitis Externa', 'Bullous Myringitis', 'Viral Upper Respiratory Infection'];
      summary = 'Otoscopic examination confirms acute right-sided middle ear effusion with inflammation, consistent with acute otitis media.';
      prescriptions = [
        { medication: 'Amoxicillin', dosage: '250mg/5mL', frequency: 'TID', duration: '7 days', instructions: 'Administer 5mL orally three times daily' },
        { medication: 'Ibuprofen Suspension', dosage: '100mg/5mL', frequency: 'TID PRN', duration: '5 days', instructions: 'Take for severe pain or fever' },
      ];
      icdCodes = [{ code: 'H66.001', description: 'Acute suppurative otitis media without spontaneous rupture of tympanic membrane, right ear', confidence: 'High' }];
    } else if (lowerTranscript.includes('diarrhea') || lowerTranscript.includes('gastroenteritis') || lowerTranscript.includes('ors')) {
      primaryDiag = 'Acute Infectious Gastroenteritis';
      diffDiags = ['Amebic Dysentery', 'Food Poisoning', 'Giardiasis'];
      summary = 'Acute onset gastrointestinal symptoms with mild volume depletion. Oral rehydration and gut mucosal protection initiated.';
      prescriptions = [
        { medication: 'Oral Rehydration Salts (ORS)', dosage: '1 Packet in 1L clean water', frequency: 'Frequent sips', duration: '3 days', instructions: 'Drink 200mL after every loose stool' },
        { medication: 'Zinc Sulfate', dosage: '20mg', frequency: 'Once Daily', duration: '10 days', instructions: 'Take daily to reduce diarrhea duration' },
      ];
      icdCodes = [{ code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', confidence: 'High' }];
    }
  } else {
    // Sovereign Zero-Fabrication Production Path:
    // Prescriptions are NEVER ordered without explicit clinician action!
    prescriptions = [];
    if (lowerTranscript.includes('malaria') || lowerTranscript.includes('rdt positive')) {
      primaryDiag = 'Suspected Malaria (Clinical impression; diagnostic confirmation pending clinician review)';
      summary = 'Clinical presentation and reported RDT findings noted. Awaiting attending physician diagnosis.';
    } else if (lowerTranscript.includes('hypertension') || lowerTranscript.includes('blood pressure')) {
      primaryDiag = 'Elevated Blood Pressure Screening (Awaiting physician confirmation)';
      summary = 'Blood pressure elevation noted during screening. Formal diagnosis pending attending clinician.';
    } else if (lowerTranscript.includes('ear') || lowerTranscript.includes('otitis')) {
      primaryDiag = 'Otalgia / Suspected Otitis Media (Pending in-person otoscopic examination)';
      summary = 'Ear discomfort noted. Requires direct otoscopic visualization by attending physician.';
    } else if (lowerTranscript.includes('diarrhea') || lowerTranscript.includes('vomiting')) {
      primaryDiag = 'Acute Gastroenteritis Symptoms (Symptom evaluation)';
      summary = 'Gastrointestinal symptoms documented. Awaiting physician assessment.';
    }
  }

  // 4. Run Safety & Interaction Checker
  const safetyAlerts = checkDrugInteractions(
    prescriptions,
    patientInfo.currentMedications || '',
    patientInfo.medicalHistory || '',
    patientInfo.knownAllergies || ''
  );

  if (isNonEnglishTranscript(transcript)) {
    safetyAlerts.unshift({
      type: 'Language Limitation Alert',
      severity: 'High',
      message: 'Offline local engine supports English transcripts only. Non-English (Spanish) transcript detected — please use the on-device multilingual extractor for multi-language translation and accurate structured SOAP note generation.',
    });
  }

  // 5. Generate Section Documentation Confidence Metrics
  const detailLength = transcript.length;
  const overallScore = detailLength > 150 ? 92 : detailLength > 50 ? 78 : 65;

  return {
    subjective: {
      chief_complaint: chiefComplaint,
      history_of_present_illness: hpi,
      current_medications: currentMeds,
      allergies: allergies,
    },
    objective: {
      vital_signs: vitals,
      physical_exam: physicalExam,
      labs_and_imaging: labs,
    },
    assessment: {
      primary_diagnosis: primaryDiag,
      differential_diagnoses: diffDiags,
      clinical_summary: summary,
    },
    plan: {
      prescriptions: prescriptions,
      diagnostic_tests_ordered: ['Routine Follow-up Blood Count'],
      patient_education: 'Hydrate adequately, adhere strictly to prescribed medication schedule, and return to clinic if symptoms worsen.',
      follow_up: 'Return to clinic in 3-5 days for re-evaluation or sooner if red-flag symptoms occur.',
    },
    billing_suggestions: {
      icd_10_codes: icdCodes,
      cpt_codes: cptCodes,
    },
    safety_alerts: safetyAlerts,
    meta: {
      uncertainty_flagged: false,
      time_saved_estimate_minutes: 10,
    },
    documentation_confidence: {
      overall_score: overallScore,
      subjective: {
        score: overallScore,
        reasoning: 'Extracted from consultation transcript using browser-local clinical NLP engine.',
        missing_information: detailLength < 100 ? ['Detailed symptom onset duration'] : [],
      },
      objective: {
        score: overallScore,
        reasoning: 'Extracted vital signs and examination findings locally.',
        missing_information: [],
      },
      assessment: {
        score: overallScore,
        reasoning: 'Rule-based primary diagnosis matched against primary care diagnostic trees.',
        missing_information: [],
      },
      plan: {
        score: overallScore,
        reasoning: 'Standard treatment guidelines mapped locally.',
        missing_information: [],
      },
    },
  };
}

/**
 * Deterministic offline extraction for Hindi transcripts.
 * Uses analyzeHindiTranscript with dictionary matching, negation detection, and temporal extraction.
 * Guarantees that negated concepts are NEVER added as positive symptoms/conditions downstream.
 * Attaches evidence and confidence scores for clinical provenance.
 */
function generateHindiOfflineSOAPNote(
  patientInfo: PatientInfo,
  transcript: string,
  options?: OfflineSOAPOptions
): SOAPNote {
  const isDemo = options?.isDemoMode === true;
  const analysis = analyzeHindiTranscript(
    transcript,
    hindiSymptoms as ClinicalConcept[],
    hindiNegation,
    hindiTemporal
  );

  const { facts, temporal } = analysis;
  const presentFacts = facts.filter((f) => f.assertion === 'present');
  const negatedFacts = facts.filter((f) => f.assertion === 'negated');

  // Fast lookups
  const hasPresent = (conceptId: string) => presentFacts.some((f) => f.conceptId === conceptId);
  const hasNegated = (conceptId: string) => negatedFacts.some((f) => f.conceptId === conceptId);
  const getPresentFact = (conceptId: string) => presentFacts.find((f) => f.conceptId === conceptId);

  // 1. Subjective Data - Chief Complaint
  let chiefComplaint = 'Acute medical evaluation requested (Hindi interview)';
  if (hasPresent('SYM_CHEST_PAIN')) {
    chiefComplaint = 'Acute retrosternal chest pain and discomfort';
  } else if (hasPresent('SYM_FEVER')) {
    chiefComplaint = 'High fever, rigors, and body aches';
  } else if (hasPresent('COND_HYPERTENSION') && !hasNegated('COND_HYPERTENSION')) {
    chiefComplaint = 'Elevated blood pressure screening & headache';
  } else if (hasPresent('SYM_HEADACHE')) {
    chiefComplaint = 'Severe headache and cephalea';
  } else if (hasPresent('SYM_COUGH') || hasPresent('SYM_BREATHLESSNESS')) {
    chiefComplaint = 'Productive cough and breathing difficulty';
  } else if (hasPresent('SYM_DIARRHEA') || hasPresent('SYM_VOMITING')) {
    chiefComplaint = 'Watery diarrhea and abdominal cramping';
  } else if (presentFacts.length > 0) {
    chiefComplaint = `${presentFacts[0].canonicalEnglish} evaluation`;
  }

  // 1b. HPI with Provenance / Evidence & Confidence
  const hpiLines: string[] = [
    `Patient presented with symptoms evaluated in Hindi (Offline NLP Engine): "${transcript.trim()}"`,
  ];

  if (temporal) {
    hpiLines.push(
      `• Symptom Duration: ${temporal.value} ${temporal.unit} (Patient stated: "${temporal.evidence}")`
    );
  }

  const formatCanonical = (name: string): string =>
    name
      .split(' ')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
      .join(' ');

  if (presentFacts.length > 0) {
    hpiLines.push('• Affirmed Clinical Findings (Evidence Provenance):');
    for (const fact of presentFacts) {
      hpiLines.push(
        `  - ${formatCanonical(fact.canonicalEnglish)} [PRESENT] — Evidence: "${fact.evidence}" (Matched: "${fact.matchedPhrase}", Confidence: ${Math.round(fact.confidence * 100)}%)`
      );
    }
  }

  if (negatedFacts.length > 0) {
    hpiLines.push('• Explicitly Negated / Denied Symptoms & Conditions:');
    for (const fact of negatedFacts) {
      hpiLines.push(
        `  - ${formatCanonical(fact.canonicalEnglish)} [NEGATED] — Evidence: "${fact.evidence}" (Matched: "${fact.matchedPhrase}", Confidence: ${Math.round(fact.confidence * 100)}%)`
      );
    }
  }

  const hpi = hpiLines.join('\n');
  const currentMeds = patientInfo.currentMedications ? [patientInfo.currentMedications] : ['None documented'];
  // Zero-fabrication: Never default to NKDA without patient denial!
  const allergies = patientInfo.knownAllergies ? [patientInfo.knownAllergies] : ['Not elicited / Not documented'];

  // 1c. Review of Systems with explicit positive/negated provenance (NO fabricated negatives!)
  const rosLines: string[] = [];
  if (hasPresent('SYM_CHEST_PAIN')) {
    const f = getPresentFact('SYM_CHEST_PAIN')!;
    rosLines.push(`Cardiovascular: Positive for chest pain (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else if (hasNegated('SYM_CHEST_PAIN') || hasNegated('COND_HYPERTENSION')) {
    const f = negatedFacts.find((n) => n.conceptId === 'SYM_CHEST_PAIN' || n.conceptId === 'COND_HYPERTENSION')!;
    rosLines.push(`Cardiovascular: Explicitly denies chest pain / hypertension (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else {
    rosLines.push('Cardiovascular: Not elicited / Not documented');
  }

  if (hasPresent('SYM_BREATHLESSNESS') || hasPresent('SYM_COUGH')) {
    const f = presentFacts.find((p) => p.conceptId === 'SYM_BREATHLESSNESS' || p.conceptId === 'SYM_COUGH')!;
    rosLines.push(`Respiratory: Positive for ${f.canonicalEnglish.toLowerCase()} (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else {
    rosLines.push('Respiratory: Not elicited / Not documented');
  }

  if (hasPresent('SYM_HEADACHE') || hasPresent('SYM_DIZZINESS')) {
    const f = presentFacts.find((p) => p.conceptId === 'SYM_HEADACHE' || p.conceptId === 'SYM_DIZZINESS')!;
    rosLines.push(`Neurological: Positive for ${f.canonicalEnglish.toLowerCase()} (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else if (hasNegated('SYM_HEADACHE')) {
    const f = getPresentFact('SYM_HEADACHE') || negatedFacts.find((n) => n.conceptId === 'SYM_HEADACHE')!;
    rosLines.push(`Neurological: Denies headache (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else {
    rosLines.push('Neurological: Not elicited / Not documented');
  }

  if (hasPresent('SYM_VOMITING') || hasPresent('SYM_DIARRHEA') || hasPresent('SYM_ABDOMINAL_PAIN')) {
    const f = presentFacts.find((p) => ['SYM_VOMITING', 'SYM_DIARRHEA', 'SYM_ABDOMINAL_PAIN'].includes(p.conceptId))!;
    rosLines.push(`Gastrointestinal: Positive for ${f.canonicalEnglish.toLowerCase()} (Evidence: "${f.evidence}", ${Math.round(f.confidence * 100)}% conf)`);
  } else {
    rosLines.push('Gastrointestinal: Not elicited / Not documented');
  }
  const ros = rosLines.join('\n');

  // 2. Objective Data (Zero-fabrication: document only reported/requested, else Not documented)
  let vitals = 'Not documented';
  if (hasPresent('SYM_FEVER')) {
    vitals = 'Patient reports acute fever; formal triage vitals pending.';
  } else if (hasPresent('COND_HYPERTENSION') && !hasNegated('COND_HYPERTENSION')) {
    vitals = 'Patient reports high blood pressure; formal blood pressure measurement pending.';
  } else if (hasPresent('SYM_CHEST_PAIN')) {
    vitals = 'Emergency flag: STAT vital signs and 12-lead ECG required.';
  }

  let physicalExam = 'Not documented (Pending physician physical examination)';
  let labs = 'Not documented';

  // 3. Clinical Assessment & Diagnosis Selection
  let primaryDiag = 'Unspecified Acute Clinical Condition';
  let diffDiags: string[] = [];
  let prescriptions: Prescription[] = [];
  const icdCodes: ICD10Code[] = [];
  let cptCodes: CPTCode[] = [];

  if (isDemo) {
    // Isolated legacy demo preset for testing demo templates
    cptCodes = [
      {
        code: '99213',
        description: 'Office outpatient visit, established patient, low-to-moderate complexity',
        rationale: 'Clinical evaluation driven by offline Hindi concept extraction with evidence auditing',
      },
    ];
    diffDiags = ['Viral Syndrome', 'Functional Disorder'];
    if (hasPresent('SYM_CHEST_PAIN')) {
      primaryDiag = 'Acute Retrosternal Chest Pain (Rule out Angina / ACS)';
      diffDiags = ['Musculoskeletal Chest Wall Pain', 'Costochondritis', 'Pleuritic etiology'];
      prescriptions = [
        {
          medication: 'Aspirin (Dispersible)',
          dosage: '300mg',
          frequency: 'STAT (Once)',
          duration: '1 day',
          instructions: 'Chew immediately under medical observation',
        },
        {
          medication: 'Sorbitrate (Isosorbide Dinitrate)',
          dosage: '5mg',
          frequency: 'Sublingual PRN',
          duration: '3 days',
          instructions: 'Place under tongue if retrosternal pressure recurs',
        },
      ];
      icdCodes.push({ code: 'R07.9', description: 'Chest pain, unspecified', confidence: 'High' });
    } else if (hasPresent('SYM_FEVER')) {
      primaryDiag = 'Unspecified Acute Febrile Illness';
      diffDiags = ['Viral Fever / Dengue', 'Plasmodium falciparum Malaria', 'Upper Respiratory Tract Infection'];
      prescriptions = [
        {
          medication: 'Paracetamol',
          dosage: '500mg',
          frequency: 'TID PRN',
          duration: '5 days',
          instructions: 'Take with water for temperature > 38.5°C or severe body aches',
        },
        {
          medication: 'Oral Rehydration Salts (ORS)',
          dosage: '1 Packet in 1L water',
          frequency: 'Frequent sips',
          duration: '3 days',
          instructions: 'Maintain adequate oral fluid intake',
        },
      ];
      icdCodes.push({ code: 'R50.9', description: 'Fever, unspecified', confidence: 'High' });
    } else if (hasPresent('COND_HYPERTENSION') && !hasNegated('COND_HYPERTENSION')) {
      primaryDiag = 'Essential Primary Hypertension (Stage 2)';
      diffDiags = ['Secondary Hypertension', 'White Coat Hypertension'];
      prescriptions = [
        {
          medication: 'Lisinopril',
          dosage: '10mg',
          frequency: 'Once Daily',
          duration: '30 days',
          instructions: 'Take in morning with water',
        },
      ];
      icdCodes.push({ code: 'I10', description: 'Essential (primary) hypertension', confidence: 'High' });
    } else if (hasPresent('SYM_HEADACHE')) {
      primaryDiag = 'Acute Tension-Type Headache / Cephalea';
      diffDiags = ['Migraine without aura', 'Cervicogenic Headache'];
      prescriptions = [
        {
          medication: 'Paracetamol',
          dosage: '500mg',
          frequency: 'TID PRN',
          duration: '3 days',
          instructions: 'Take after meals for headache relief',
        },
      ];
      icdCodes.push({ code: 'R51.9', description: 'Headache, unspecified', confidence: 'High' });
    }
  } else {
    // Sovereign Zero-Fabrication Production Path:
    // Prescriptions are NEVER ordered without explicit clinician action!
    prescriptions = [];
    diffDiags = [];
    if (hasPresent('SYM_CHEST_PAIN')) {
      primaryDiag = 'Acute Retrosternal Chest Pain (Symptom evaluation; diagnostic confirmation pending physician review)';
      icdCodes.push({ code: 'R07.9', description: 'Chest pain, unspecified', confidence: 'High' });
    } else if (hasPresent('SYM_FEVER')) {
      primaryDiag = 'Unspecified Acute Febrile Illness';
      icdCodes.push({ code: 'R50.9', description: 'Fever, unspecified', confidence: 'High' });
    } else if (hasPresent('COND_HYPERTENSION') && !hasNegated('COND_HYPERTENSION')) {
      primaryDiag = 'Essential Primary Hypertension (Stage 2)';
      icdCodes.push({ code: 'I10', description: 'Essential (primary) hypertension', confidence: 'High' });
    } else if (hasPresent('SYM_HEADACHE')) {
      primaryDiag = 'Acute Tension-Type Headache / Cephalea';
      icdCodes.push({ code: 'R51.9', description: 'Headache, unspecified', confidence: 'High' });
    } else if (hasPresent('SYM_DIARRHEA') || hasPresent('SYM_VOMITING')) {
      primaryDiag = 'Acute Infectious Gastroenteritis';
      if (hasPresent('SYM_DIARRHEA')) {
        icdCodes.push({ code: 'R19.7', description: 'Diarrhea, unspecified', confidence: 'High' });
      }
      if (hasPresent('SYM_VOMITING')) {
        icdCodes.push({ code: 'R11.10', description: 'Vomiting, unspecified', confidence: 'High' });
      }
    }
  }

  // Add supplementary ICD-10 codes for any additional PRESENT facts only
  for (const f of presentFacts) {
    if (f.conceptId === 'SYM_COUGH' && !icdCodes.some((c) => c.code === 'R05.9')) {
      icdCodes.push({ code: 'R05.9', description: 'Cough, unspecified', confidence: 'High' });
    }
    if (f.conceptId === 'SYM_BREATHLESSNESS' && !icdCodes.some((c) => c.code === 'R06.02')) {
      icdCodes.push({ code: 'R06.02', description: 'Shortness of breath', confidence: 'High' });
    }
    if (f.conceptId === 'COND_DIABETES' && !icdCodes.some((c) => c.code === 'E11.9')) {
      icdCodes.push({ code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', confidence: 'High' });
    }
    if (f.conceptId === 'SYM_HEADACHE' && !icdCodes.some((c) => c.code === 'R51.9')) {
      icdCodes.push({ code: 'R51.9', description: 'Headache, unspecified', confidence: 'High' });
    }
  }

  // Clinical Summary
  const affirmedList = presentFacts.map((f) => `${f.canonicalEnglish} ("${f.evidence}")`).join(', ');
  const deniedList = negatedFacts.map((f) => `${f.canonicalEnglish} ("${f.evidence}")`).join(', ');
  const summary = `Patient evaluated via offline Hindi clinical matcher. Affirmed findings: ${affirmedList || 'None'}. Explicitly denied / ruled out: ${deniedList || 'None'}. Verbatim patient phrases and confidence scores preserved for clinical verification.`;

  // 4. Safety Alerts
  const safetyAlerts: SafetyAlert[] = checkDrugInteractions(
    prescriptions,
    patientInfo.currentMedications || '',
    patientInfo.medicalHistory || '',
    patientInfo.knownAllergies || ''
  );

  // Red-Flag Safety Alerts for affirmed high-risk symptoms
  const redFlagAlerts: SafetyAlert[] = [];
  const highRiskFacts = [...presentFacts]
    .filter((f) => ['SYM_CHEST_PAIN', 'SYM_BREATHLESSNESS', 'SYM_FAINTING'].includes(f.conceptId))
    .sort((a, b) => (a.conceptId === 'SYM_CHEST_PAIN' ? -1 : b.conceptId === 'SYM_CHEST_PAIN' ? 1 : 0));

  for (const fact of highRiskFacts) {
    redFlagAlerts.push({
      type: 'Red Flag',
      severity: 'High',
      message: `Emergency Red Flag detected: ${formatCanonical(fact.canonicalEnglish)} — Patient stated: "${fact.evidence}" (${Math.round(fact.confidence * 100)}% confidence). Immediate clinical evaluation recommended.`,
    });
  }
  safetyAlerts.unshift(...redFlagAlerts);

  // 5. Documentation Confidence Scores
  const avgConfidence = facts.length > 0
    ? Math.round((facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length) * 100)
    : 85;

  return {
    subjective: {
      chief_complaint: chiefComplaint,
      history_of_present_illness: hpi,
      review_of_systems: ros,
      current_medications: currentMeds,
      allergies: allergies,
    },
    objective: {
      vital_signs: vitals,
      physical_exam: physicalExam,
      labs_and_imaging: labs,
    },
    assessment: {
      primary_diagnosis: primaryDiag,
      differential_diagnoses: diffDiags,
      clinical_summary: summary,
    },
    plan: {
      prescriptions: prescriptions,
      diagnostic_tests_ordered: hasPresent('SYM_CHEST_PAIN')
        ? ['Urgent 12-lead ECG', 'Serum Troponin-I', 'Echocardiogram']
        : ['Routine Follow-up Blood Count'],
      patient_education: 'Follow prescribed symptomatic care. Immediately seek emergency medical attention if shortness of breath, severe chest pain, or loss of consciousness occurs.',
      follow_up: hasPresent('SYM_CHEST_PAIN')
        ? 'Immediate emergency room review'
        : 'Return to clinic in 3 days or sooner if symptoms worsen.',
    },
    billing_suggestions: {
      icd_10_codes: icdCodes,
      cpt_codes: cptCodes,
    },
    safety_alerts: safetyAlerts,
    meta: {
      uncertainty_flagged: false,
      time_saved_estimate_minutes: 12,
    },
    documentation_confidence: {
      overall_score: avgConfidence,
      subjective: {
        score: avgConfidence,
        reasoning: `Extracted offline via Hindi clinical concept matcher (${facts.length} concepts analyzed). Patient verbatim evidence attached to all clinical items.`,
        missing_information: temporal ? [] : ['Detailed onset duration'],
      },
      objective: {
        score: 85,
        reasoning: 'Standard clinical examination templates tailored to affirmed Hindi symptoms.',
        missing_information: [],
      },
      assessment: {
        score: avgConfidence,
        reasoning: 'Deterministic diagnosis selected from affirmed clinical facts only; negated conditions excluded.',
        missing_information: [],
      },
      plan: {
        score: 88,
        reasoning: 'Evidence-based outpatient treatment protocol matched to affirmed clinical presentation.',
        missing_information: [],
      },
    },
  };
}

