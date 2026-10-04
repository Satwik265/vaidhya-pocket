/**
 * Deterministic Clinical Policy Engine for MediKiosk.
 * Specifies required clinical information domains (e.g. SOCRATES protocol,
 * cardiovascular history, respiratory history, AYUSH holistic indicators)
 * so questions are medically structured and not left to arbitrary AI speculation.
 */

export interface ClinicalDomainRequirement {
  domainId: string;
  name: string;
  description: string;
  requiredForConcepts: string[]; // Canonical IDs that trigger this requirement
  isMandatoryForSafety: boolean;
  ayushRelevant?: boolean;
}

export const CLINICAL_POLICIES: Record<string, ClinicalDomainRequirement[]> = {
  // SOCRATES Pain & Chest Pain Policy
  SYM_CHEST_PAIN: [
    { domainId: 'site', name: 'Site / Location', description: 'Exact retrosternal or localized position', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'onset', name: 'Onset & Duration', description: 'Sudden vs gradual, duration in minutes/hours/days', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'character', name: 'Character', description: 'Crushing, pressure, heaviness, sharp, or burning', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'radiation', name: 'Radiation', description: 'Radiation to left arm, shoulder, jaw, neck, or back', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'associated_dyspnea', name: 'Associated Dyspnea', description: 'Presence of shortness of breath / breathing difficulty', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'associated_sweating', name: 'Diaphoresis / Sweating', description: 'Cold sweats or profuse perspiration', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'associated_syncope', name: 'Syncope / Lightheadedness', description: 'Loss of consciousness or near-fainting', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
    { domainId: 'cardiac_history', name: 'Past Cardiovascular History', description: 'Known HTN, DM, prior MI, stent, or family history of CAD', requiredForConcepts: ['SYM_CHEST_PAIN'], isMandatoryForSafety: true },
  ],

  // Breathlessness / Dyspnea Policy
  SYM_BREATHLESSNESS: [
    { domainId: 'onset', name: 'Onset & Timing', description: 'Acute sudden onset vs progressive chronic exertional dyspnea', requiredForConcepts: ['SYM_BREATHLESSNESS'], isMandatoryForSafety: true },
    { domainId: 'orthopnea', name: 'Orthopnea / PND', description: 'Breathing difficulty when lying flat or waking at night', requiredForConcepts: ['SYM_BREATHLESSNESS'], isMandatoryForSafety: true },
    { domainId: 'associated_cough', name: 'Cough & Sputum', description: 'Productive cough, pink frothy sputum, or wheeze', requiredForConcepts: ['SYM_BREATHLESSNESS'], isMandatoryForSafety: true },
    { domainId: 'chest_pain_screen', name: 'Chest Pain Screening', description: 'Pleuritic or ischaemic chest discomfort', requiredForConcepts: ['SYM_BREATHLESSNESS'], isMandatoryForSafety: true },
  ],

  // Fever Policy
  SYM_FEVER: [
    { domainId: 'duration', name: 'Duration of Fever', description: 'Number of days fever has been active', requiredForConcepts: ['SYM_FEVER'], isMandatoryForSafety: true },
    { domainId: 'pattern_chills', name: 'Pattern & Chills / Rigors', description: 'Continuous vs intermittent, presence of shivering (malaria/dengue screen)', requiredForConcepts: ['SYM_FEVER'], isMandatoryForSafety: true },
    { domainId: 'localizing_symptoms', name: 'Localizing Symptoms', description: 'Cough, dysuria, abdominal pain, rash, neck stiffness', requiredForConcepts: ['SYM_FEVER'], isMandatoryForSafety: true },
    { domainId: 'ayush_agni', name: 'Agni / Digestive Fire (AYUSH)', description: 'Appetite loss (Aruchi) or coated tongue (Aama)', requiredForConcepts: ['SYM_FEVER'], isMandatoryForSafety: false, ayushRelevant: true },
  ],

  // Headache Policy
  SYM_HEADACHE: [
    { domainId: 'onset_speed', name: 'Speed of Onset', description: 'Thunderclap (peaked in seconds) vs gradual', requiredForConcepts: ['SYM_HEADACHE'], isMandatoryForSafety: true },
    { domainId: 'neuro_deficits', name: 'Neurological Deficits', description: 'Visual disturbance, limb weakness, facial asymmetry, speech difficulty', requiredForConcepts: ['SYM_HEADACHE'], isMandatoryForSafety: true },
    { domainId: 'neck_stiffness', name: 'Meningism Screen', description: 'Stiff neck, photophobia, high fever', requiredForConcepts: ['SYM_HEADACHE'], isMandatoryForSafety: true },
  ]
};

export interface EvaluatedPolicyStatus {
  activeChiefComplaints: string[];
  totalRequiredDomains: number;
  completedDomains: string[];
  missingDomains: ClinicalDomainRequirement[];
  nextSuggestedDomain?: ClinicalDomainRequirement;
}

/**
 * Evaluates which clinical domains have been satisfied in the current encounter.
 */
export function evaluateInterviewProgress(
  detectedConceptIds: string[],
  documentedFactKeys: string[]
): EvaluatedPolicyStatus {
  const activeChiefComplaints: string[] = [];
  const requiredDomains: ClinicalDomainRequirement[] = [];
  const documentedSet = new Set(documentedFactKeys.map(k => k.toLowerCase()));

  for (const conceptId of detectedConceptIds) {
    if (CLINICAL_POLICIES[conceptId]) {
      activeChiefComplaints.push(conceptId);
      for (const domain of CLINICAL_POLICIES[conceptId]) {
        if (!requiredDomains.some(d => d.domainId === domain.domainId)) {
          requiredDomains.push(domain);
        }
      }
    }
  }

  const completedDomains: string[] = [];
  const missingDomains: ClinicalDomainRequirement[] = [];

  for (const domain of requiredDomains) {
    if (documentedSet.has(domain.domainId.toLowerCase())) {
      completedDomains.push(domain.domainId);
    } else {
      missingDomains.push(domain);
    }
  }

  return {
    activeChiefComplaints,
    totalRequiredDomains: requiredDomains.length,
    completedDomains,
    missingDomains,
    nextSuggestedDomain: missingDomains[0],
  };
}
