import { ClinicalFact } from './clinical/clinicalFactModel';

export interface PatientInfo {
  id?: string;
  name: string;
  age: number | string;
  sex?: 'Male' | 'Female' | 'Other' | string;
  gender?: string;
  medicalHistory?: string;
  currentMedications?: string;
  knownAllergies?: string;
  encounterType?: string; // e.g. "Routine Follow-up", "Acute Visit", "Antenatal Care"
  clinicLocation?: string;
}

export interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  instructions: string;
  duration?: string;
}

export interface Subjective {
  chief_complaint: string;
  history_of_present_illness: string;
  review_of_systems?: string;
  current_medications: string[];
  allergies: string[];
}

export interface Objective {
  vital_signs: string;
  physical_exam: string;
  labs_and_imaging: string;
}

export interface Assessment {
  primary_diagnosis: string;
  differential_diagnoses: string[];
  clinical_summary: string;
}

export interface Plan {
  prescriptions: Prescription[];
  diagnostic_tests_ordered: string[];
  patient_education: string;
  follow_up: string;
}

export interface ICD10Code {
  code: string;
  description: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface CPTCode {
  code: string;
  description: string;
  rationale: string;
}

export interface BillingSuggestions {
  icd_10_codes: ICD10Code[];
  cpt_codes: CPTCode[];
}

export interface SafetyAlert {
  type: 'Drug Interaction' | 'Allergy Alert' | 'Missing Info' | 'Red Flag' | string;
  severity: 'High' | 'Medium' | 'Low';
  message: string;
}

export interface MetaInfo {
  uncertainty_flagged: boolean;
  time_saved_estimate_minutes: number;
}

export interface SectionDocumentationScore {
  score: number; // 0 - 100 percentage score representing transcript support & detail completeness
  reasoning: string;
  missing_information?: string[];
}

export interface DocumentationConfidence {
  overall_score: number;
  subjective: SectionDocumentationScore;
  objective: SectionDocumentationScore;
  assessment: SectionDocumentationScore;
  plan: SectionDocumentationScore;
}

export interface SOAPNote {
  subjective: Subjective;
  objective: Objective;
  assessment: Assessment;
  plan: Plan;
  billing_suggestions?: BillingSuggestions;
  safety_alerts?: SafetyAlert[];
  meta?: MetaInfo;
  documentation_confidence?: DocumentationConfidence;
}

export interface EncounterRecord {
  id: string;
  timestamp: string;
  patientInfo: PatientInfo;
  transcript: string;
  soapNote: SOAPNote;
  status: 'draft' | 'finalized';
  notesEdited?: boolean;
}

export interface SampleScenario {
  id: string;
  title: string;
  category: string;
  description: string;
  patientInfo: PatientInfo;
  transcript: string;
}

// ==========================================
// STRUCTURED CLINICAL INTAKE (SOCRATES + DISCRETE MEDICAL HISTORY)
// ==========================================

/**
 * SOCRATES Framework for Pain & Symptom Analysis:
 * Site: Location of the symptom
 * Onset: When did it start? Was it sudden or gradual?
 * Character: Nature of pain/symptom (sharp, dull, burning, aching, throbbing, etc.)
 * Radiation: Does it spread/radiate anywhere?
 * Associated symptoms: Other symptoms (nausea, vomiting, dyspnea, fever, diaphoresis)
 * Timing / Duration: Constant, intermittent, fluctuating, frequency
 * Exacerbating / Aggravating factors: What worsens it
 * Relieving factors: What improves it (rest, medications, position)
 * Severity: 1-10 numerical scale or Mild/Moderate/Severe
 */
export interface SocratesHPI {
  site?: string;
  onset?: string;
  character?: string;
  radiation?: string;
  associatedSymptoms?: string[];
  timing?: string;
  exacerbatingFactors?: string[];
  relievingFactors?: string[];
  severity?: number | string; // 1-10 scale or 'Mild' | 'Moderate' | 'Severe'
  progression?: 'Improving' | 'Worsening' | 'Static' | 'Fluctuating' | string;
}

/**
 * Discrete Past Medical History Entry
 */
export interface DiscreteMedicalCondition {
  condition: string;
  diagnosedYear?: string | number;
  status: 'Active' | 'Resolved' | 'Controlled' | 'Unknown';
  currentTreatment?: string;
  notes?: string;
}

/**
 * Discrete Past Surgical History Entry
 */
export interface DiscreteSurgery {
  procedure: string;
  approximateYear?: string | number;
  hospitalOrSurgeon?: string;
  complications?: string;
}

/**
 * Discrete Family History Entry
 */
export interface DiscreteFamilyHistory {
  relationship: 'Father' | 'Mother' | 'Sibling' | 'Maternal Grandparent' | 'Paternal Grandparent' | 'Child' | 'Other' | string;
  condition: string;
  ageAtOnset?: number | string;
  notes?: string;
}

/**
 * Discrete Personal & Social History
 */
export interface PersonalSocialHistory {
  smokingStatus?: 'Never' | 'Former' | 'Current Smoker' | 'Tobacco Chewer (Gutkha/Khaini)' | 'Unknown';
  alcoholConsumption?: 'Never' | 'Occasional' | 'Moderate' | 'Heavy' | 'Former' | 'Unknown';
  dietType?: 'Vegetarian' | 'Non-Vegetarian' | 'Vegan' | 'Eggetarian' | 'Jain' | string;
  occupation?: string;
  physicalActivityLevel?: 'Sedentary' | 'Light' | 'Moderate' | 'Vigorous';
  sleepQuality?: 'Good' | 'Fair' | 'Insomnia / Disturbed' | 'Poor';
}

/**
 * Review of Systems (ROS) Structured Checklist
 */
export interface ReviewOfSystemsChecklist {
  general?: {
    fever?: boolean;
    chills?: boolean;
    weightLoss?: boolean;
    fatigue?: boolean;
    nightSweats?: boolean;
  };
  cardiovascular?: {
    chestPain?: boolean;
    palpitations?: boolean;
    orthopnea?: boolean;
    edemaOrSwelling?: boolean;
  };
  respiratory?: {
    shortnessOfBreath?: boolean;
    cough?: boolean;
    wheezing?: boolean;
    hemoptysis?: boolean;
    sputumProduction?: boolean;
  };
  gastrointestinal?: {
    abdominalPain?: boolean;
    nauseaOrVomiting?: boolean;
    heartburnOrAcidReflux?: boolean;
    diarrhea?: boolean;
    constipation?: boolean;
    lossOfAppetite?: boolean;
  };
  genitourinary?: {
    dysuriaOrPainfulUrination?: boolean;
    increasedFrequency?: boolean;
    hematuria?: boolean;
  };
  musculoskeletal?: {
    jointPain?: boolean;
    jointSwelling?: boolean;
    muscleAches?: boolean;
    stiffness?: boolean;
  };
  neurological?: {
    headache?: boolean;
    dizziness?: boolean;
    numbnessOrTingling?: boolean;
    weakness?: boolean;
    alteredSensorium?: boolean;
  };
  integumentary?: {
    rash?: boolean;
    itching?: boolean;
    skinLesions?: boolean;
  };
  otherNotes?: string[];
}

/**
 * Discrete Medication
 */
export interface DiscreteMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  purpose?: string;
  compliance?: 'Regular' | 'Irregular' | 'Discontinued';
}

/**
 * Discrete Allergy
 */
export interface DiscreteAllergy {
  allergen: string;
  allergyType?: 'Drug' | 'Food' | 'Environmental' | 'Other';
  reaction?: string;
  severity?: 'Mild' | 'Moderate' | 'Severe (Anaphylaxis)';
}

/**
 * Single turn in the conversational intake interview
 */
export interface InterviewTurn {
  turnNumber: number;
  timestamp: string;
  question: string;
  questionCategory: string;
  answer: string;
  inputMode: 'voice' | 'touch_pill' | 'scale' | 'typed';
  optionsProvided?: string[];
}

/**
 * Complete Structured Patient Intake Model
 * Collected by MediKiosk pre-consultation engine and feeds into downstream clinical summaries.
 */
export interface StructuredPatientIntake {
  intakeId: string;
  startedAt: string;
  completedAt?: string;
  abhaId?: string;
  clinicalDepartment?: 'Allopathic' | 'Ayurveda (AYUSH)';
  patientDemographics: {
    fullName: string;
    age: number | string;
    gender: string;
    mobile?: string;
    state?: string;
  };
  chiefComplaint: string;
  socratesHpi: SocratesHPI;
  pastMedicalHistory: DiscreteMedicalCondition[];
  pastSurgicalHistory: DiscreteSurgery[];
  familyHistory: DiscreteFamilyHistory[];
  personalHistory: PersonalSocialHistory;
  reviewOfSystems: ReviewOfSystemsChecklist;
  currentMedications: DiscreteMedication[];
  knownAllergies: DiscreteAllergy[];
  ayushHistory?: AYUSHHistory;
  uploadedDocuments?: UploadedDocumentRecord[];
  conversationTurns: InterviewTurn[];
  clinicalFacts?: ClinicalFact[];
  triageClassification?: 'Green (Routine)' | 'Yellow (Priority)' | 'Red (Immediate Emergency)';
  redFlagsDetected: string[];
  isComplete: boolean;
}

/**
 * ==========================================
 * AYUSH / AYURVEDA CLINICAL INTAKE (DASHAVIDHA PARIKSHA + AHARA-VIHARA + NIDANA/SAMPRAPTI)
 * Aligned with Ministry of AYUSH & All India Institute of Ayurveda (AIIA) Guidelines
 * ==========================================
 */

export type DoshaType =
  | 'Vata'
  | 'Pitta'
  | 'Kapha'
  | 'Vata-Pitta'
  | 'Pitta-Kapha'
  | 'Vata-Kapha'
  | 'Tridoshaja / Samadosha';

/**
 * 1. Prakriti - Deha Prakriti (Physical & Mental Dosha Constitution)
 */
export interface PrakritiAssessment {
  dominantPrakriti?: DoshaType;
  vataTraits?: string[];
  pittaTraits?: string[];
  kaphaTraits?: string[];
  observations?: string;
}

/**
 * 2. Vikriti - Current Morbid Dosha Imbalance / Aggravation
 */
export interface VikritiAssessment {
  aggravatedDosha?: ('Vata' | 'Pitta' | 'Kapha' | 'Vata-Pitta' | 'Pitta-Kapha' | 'Vata-Kapha' | 'Sannipata')[];
  manifestations?: string[];
  primaryDushyaAffected?: ('Rasa' | 'Rakta' | 'Mamsa' | 'Meda' | 'Asthi' | 'Majja' | 'Shukra')[];
  severity?: 'Alpa (Mild)' | 'Madhya (Moderate)' | 'Teevra (Severe)';
}

/**
 * Dashavidha Pariksha (Ten-Fold Ayurvedic Clinical Examination)
 * Charaka Samhita Vimana Sthana Chapter 8 / AIIA Standard Protocol
 */
export interface DashavidhaPariksha {
  // 1. Prakriti (Natural Constitution)
  prakriti?: PrakritiAssessment;

  // 2. Vikriti (Pathological Morbidity / Imbalance)
  vikriti?: VikritiAssessment;

  // 3. Sara (Quality & Tissue Essence / Dhatu Excellence)
  sara?: {
    tissueType?: 'Twak/Rasa' | 'Rakta' | 'Mamsa' | 'Meda' | 'Asthi' | 'Majja' | 'Shukra' | 'Satva';
    grade?: 'Pravara (Superior/Excellent)' | 'Madhyama (Medium/Average)' | 'Avara (Inferior/Poor)';
    observations?: string;
  };

  // 4. Samhanana (Body Compactness & Skeletal-Muscular Architecture)
  samhanana?: {
    status?: 'Susamhata (Well-compact / Robust)' | 'Madhyama (Moderate build)' | 'Asamhata (Loose / Frail / Asthenic)';
    description?: string;
  };

  // 5. Pramana (Anthropometric Proportions & Stature)
  pramana?: {
    proportionStatus?: 'Sama (Normal / Well-proportioned)' | 'Heena (Undersized / Stunted)' | 'Ati-Dirgha (Overgrown / Very Tall)' | 'Ati-Hrasva (Dwarf / Short)';
    heightCm?: number;
    weightKg?: number;
  };

  // 6. Satmya (Habituation, Adaptability & Concordance)
  satmya?: {
    adaptationType?: 'Sarvarasa Satmya (Adapted to all 6 tastes / Versatile)' | 'Vyavayi Satmya (Moderate adaptation)' | 'Ekarasa Satmya (Limited adaptation / Habitual diet)';
    tolerances?: string[];
  };

  // 7. Sattva (Mental Temperament & Psychic Resilience)
  sattva?: {
    resilienceLevel?: 'Pravara Sattva (High psychic endurance / Calm & Resilient)' | 'Madhyama Sattva (Moderate psychic endurance)' | 'Avara Sattva (Low endurance / Anxious & Vulnerable)';
    manasikaDosha?: ('Rajas' | 'Tamas' | 'Satva Dominant')[];
  };

  // 8. Ahara Shakti (Digestive Capacity & Ingestion Power)
  aharaShakti?: {
    abhyavaharanaShakti?: 'Pravara (High intake capacity)' | 'Madhyama (Average intake)' | 'Avara (Poor intake)';
    jaranaShakti?: 'Pravara (Fast / Strong digestion)' | 'Madhyama (Normal digestion)' | 'Avara (Slow / Sluggish digestion)';
    agniType?: 'Samagni (Balanced digestive fire)' | 'Vishamagni (Variable / Irregular fire)' | 'Tikshnagni (Excessive / Intense fire)' | 'Mandagni (Low / Slow fire)';
  };

  // 9. Vyayama Shakti (Physical Work Capacity & Exercise Tolerance)
  vyayamaShakti?: {
    capacityLevel?: 'Pravara (High physical stamina)' | 'Madhyama (Moderate endurance)' | 'Avara (Poor / Quickly fatigued)';
    dailyExertionLevel?: string;
  };

  // 10. Vaya (Chronological & Biological Age Phase)
  vaya?: {
    stage?: 'Bala (Childhood / Growth stage - Kapha dominant)' | 'Madhyama (Youth / Adulthood - Pitta dominant)' | 'Vriddha (Geriatric / Aging - Vata dominant)';
    approximateYears?: number | string;
  };
}

/**
 * Ahara-Vihara (Dietary & Daily Lifestyle Habits in Ayurveda)
 */
export interface AharaViharaHistory {
  dietPatterns?: {
    aharaTiming?: 'Kala Bhojana (Fixed regular meals)' | 'Akala Bhojana (Irregular timings)' | 'Adhyashana (Eating before prior meal is digested)';
    rasaPredominance?: ('Madhura (Sweet)' | 'Amla (Sour)' | 'Lavana (Salty)' | 'Katu (Pungent / Spicy)' | 'Tikta (Bitter)' | 'Kashaya (Astringent)')[];
    foodNature?: 'Snigdha (Oily / Nourishing)' | 'Ruksha (Dry / Light)' | 'Ushna (Hot / Fresh)' | 'Sheeta (Cold / Refrigerated / Stale)' | 'Guru (Heavy)';
    waterIntakePattern?: string;
  };
  kosthaNature?: 'Krura Kostha (Hard stools / Constipated tendency)' | 'Mridu Kostha (Loose stools / Rapid evacuation)' | 'Madhyama Kostha (Regular normal bowel movement)';
  viharaHabits?: {
    nidraPattern?: 'Sukha Nidra (Sound restful sleep)' | 'Alpanidra / Anidra (Disturbed / Insomnia)' | 'Atinidra (Excessive sleep / Drowsiness)';
    ratriJagarana?: boolean;
    divasvapna?: boolean;
    vyayamaRoutine?: string;
    manasikaStress?: 'Low' | 'Moderate' | 'High / Chinta';
    environmentalExposure?: string;
  };
}

/**
 * Nidana & Samprapti (Etiological Factors & Disease Pathogenesis)
 */
export interface NidanaSampraptiHistory {
  chiefComplaintAyush?: string;
  durationAyush?: string;
  identifiedNidana?: {
    aharajaNidana?: string[];
    viharajaNidana?: string[];
    manasikaNidana?: string[];
    kalaRituNidana?: string[];
  };
  sampraptiGhatakas?: {
    doshaInvolved?: string[];
    dushyaInvolved?: string[];
    srotasInvolved?: ('Pranavaha' | 'Annavaha' | 'Rasavaha' | 'Raktavaha' | 'Mamsavaha' | 'Medovaha' | 'Asthivaha' | 'Majjavaha' | 'Shukravaha' | 'Purishavaha' | 'Mutravaha' | 'Swedavaha' | 'Manovaha')[];
    srotoDushtiPrakara?: ('Sanga (Obstruction)' | 'Atipravritti (Excessive flow)' | 'Siragranthi (Nodular dilation)' | 'Vimargagamana (Extravasation / Wrong passage)')[];
    amaPresence?: 'Nirama (No Ama / Toxin free)' | 'Saama (Associated with metabolic Ama / Endotoxins)';
  };
  prognosisObservation?: 'Sadhya (Easily curable)' | 'Krichhra-Sadhya (Curable with difficulty)' | 'Yapya (Manageable / Chronic)' | 'Asadhya (Incurable)';
}

/**
 * Complete AYUSH / Ayurveda History Model
 * Distinct interface that coexists with allopathic structure in StructuredPatientIntake
 */
export interface AYUSHHistory {
  department: 'Ayurveda (AYUSH)';
  facilityStandard: 'Ministry of AYUSH / AIIA Outpatient Guidelines';
  recordedAt: string;
  dashavidhaPariksha: DashavidhaPariksha;
  aharaVihara: AharaViharaHistory;
  nidanaSamprapti: NidanaSampraptiHistory;
  additionalAyushNotes?: string;
}

/**
 * Response format for the per-turn adaptive question endpoint
 */
export interface AdaptiveInterviewTurnResponse {
  question: string;
  category:
    | 'chief_complaint'
    | 'socrates_onset'
    | 'socrates_character'
    | 'socrates_radiation'
    | 'socrates_severity'
    | 'socrates_associated'
    | 'socrates_timing'
    | 'socrates_exacerbating_relieving'
    | 'past_history'
    | 'medications_allergies'
    | 'review_of_systems'
    | 'conclusion'
    | 'ayush_chief_complaint'
    | 'ayush_prakriti'
    | 'ayush_vikriti'
    | 'ayush_sara_samhanana'
    | 'ayush_pramana_satmya'
    | 'ayush_sattva_vyayama'
    | 'ayush_ahara_shakti_agni'
    | 'ayush_kostha_ahara'
    | 'ayush_vihara_nidra'
    | 'ayush_vaya'
    | 'ayush_ahara_vihara'
    | 'ayush_nidana_samprapti';
  suggestedOptions: string[];
  inputType: 'choice_or_voice' | 'scale_1_to_10' | 'yes_no';
  extractedData?: {
    socratesPatch?: Partial<SocratesHPI>;
    chiefComplaint?: string;
    pastConditions?: string[];
    medications?: string[];
    allergies?: string[];
    rosFlags?: Record<string, boolean>;
    ayushPatch?: Partial<AYUSHHistory>;
  };
  redFlags?: string[];
  triagePriority?: 'routine' | 'urgent' | 'emergency';
  isComplete: boolean;
  clinicalSummarySoFar?: string;
}

/**
 * ==========================================
 * DOCUMENT UPLOAD & MULTIMODAL EXTRACTION TYPES
 * Phase 6 Sub-phase (e) - Prescriptions, Lab Reports, Discharge Summaries
 * ==========================================
 */

export interface ExtractedLabResult {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isOutOfRange: boolean;
  flagSeverity?: 'high' | 'medium' | 'low' | 'normal';
  interpretation?: string;
}

export interface ExtractedMedication {
  name: string;
  dosage: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  status?: string;
}

export interface ExtractedDocumentData {
  documentType: 'prescription' | 'lab_report' | 'discharge_summary' | 'other';
  documentDate?: string;
  extractedDateConfidence?: 'high' | 'medium' | 'low' | 'inferred';
  facilityOrDoctor?: string;
  diagnoses: string[];
  medications: ExtractedMedication[];
  investigations: ExtractedLabResult[];
  clinicalSummary?: string;
  criticalFlags?: string[];
}

export interface UploadedDocumentRecord {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
  uploadedAt: string;
  effectiveDate: string; // ISO or YYYY-MM-DD string used for chronological sorting
  status: 'uploading' | 'analyzing' | 'completed' | 'error';
  errorMessage?: string;
  extractedData?: ExtractedDocumentData;
}

/**
 * ==========================================
 * REAL-TIME EMERGENCY TRIAGE ALERT TYPES
 * Phase 6 Sub-phase (f) - Real-time Red Flag Interrupt & Triage Queue
 * ==========================================
 */

export interface EmergencyTriageAlert {
  id: string;
  timestamp: string;
  patientName: string;
  age: number | string;
  gender: string;
  abhaId?: string;
  kioskStationId: string;
  emergencyCategory: string;
  detectedPattern: string;
  matchedKeywords: string[];
  severity: 'CRITICAL_EMERGENCY' | 'HIGH_PRIORITY';
  triageColor: 'Red' | 'Yellow';
  triggerInputText: string;
  status: 'active' | 'staff_en_route' | 'attended' | 'resolved';
  staffNotes?: string;
  actionDirectives: string[];
  acknowledgedAt?: string;
}

