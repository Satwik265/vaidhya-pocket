/**
 * Deterministic Red Flag Safety Engine for Indian Primary Care Kiosk.
 * Evaluates canonical clinical concept combinations (NOT raw keywords).
 * Catches life-threatening emergencies immediately with clear triage guidance.
 */

import { ExtractedClinicalConcept } from '../nlp/codeSwitchingExtractor';
import { ClinicalFact } from './clinicalFactModel';

export interface RedFlagAlert {
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  clinicalSummary: string;
  matchedConcepts: string[];
  recommendedImmediateAction: string;
}

interface RedFlagRule {
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  clinicalSummary: string;
  recommendedImmediateAction: string;
  evaluate: (affirmedConceptIds: Set<string>, allConcepts: ExtractedClinicalConcept[]) => boolean;
}

const DETERMINISTIC_RED_FLAG_RULES: RedFlagRule[] = [
  // 1. Acute Coronary Syndrome: Chest Pain + Dyspnea / Breathlessness
  {
    ruleId: 'RED_FLAG_ACS_DYSPNEA',
    title: 'Possible Acute Coronary Syndrome (Chest Pain + Dyspnea)',
    severity: 'CRITICAL',
    clinicalSummary: 'Patient reports chest pain associated with breathlessness/shortness of breath. High suspicion for myocardial ischemia or infarction.',
    recommendedImmediateAction: 'Priority triage required: Potential acute coronary emergency detected. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('SYM_CHEST_PAIN') && ids.has('SYM_BREATHLESSNESS'),
  },

  // 2. Cardiogenic / Vasovagal Syncope with Chest Pain
  {
    ruleId: 'RED_FLAG_CARDIAC_SYNCOPE',
    title: 'Chest Discomfort with Syncope or Loss of Consciousness',
    severity: 'CRITICAL',
    clinicalSummary: 'Combination of chest symptoms with syncope or altered consciousness suggests dangerous dysrhythmia or major hemodynamic compromise.',
    recommendedImmediateAction: 'Priority triage required: Potential cardiovascular emergency detected. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('SYM_CHEST_PAIN') && (ids.has('SYM_ALTERED_CONSCIOUSNESS') || ids.has('SYM_DIZZINESS')),
  },

  // 3. Acute Stroke / CVA (FAST Signs)
  {
    ruleId: 'RED_FLAG_ACUTE_STROKE',
    title: 'Suspected Acute Stroke (FAST Protocol)',
    severity: 'CRITICAL',
    clinicalSummary: 'Signs of acute focal neurological deficit, facial asymmetry, limb weakness, or sudden altered consciousness.',
    recommendedImmediateAction: 'Priority triage required: Suspected acute stroke symptoms detected. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('EMERG_STROKE_FAST') || (ids.has('SYM_HEADACHE') && ids.has('SYM_ALTERED_CONSCIOUSNESS')),
  },

  // 4. Critical Respiratory Failure / Severe Dyspnea Alone
  {
    ruleId: 'RED_FLAG_SEVERE_DYSPNEA',
    title: 'Severe Breathlessness / Respiratory Distress',
    severity: 'HIGH',
    clinicalSummary: 'Acute dyspnea reported without relief.',
    recommendedImmediateAction: 'Priority triage required: Potential respiratory emergency detected. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('SYM_BREATHLESSNESS'),
  },

  // 5. Unconsciousness / Unresponsive State
  {
    ruleId: 'RED_FLAG_UNRESPONSIVE',
    title: 'Loss of Consciousness / Unresponsive Patient',
    severity: 'CRITICAL',
    clinicalSummary: 'Patient reported to have fainted or become unresponsive.',
    recommendedImmediateAction: 'Priority triage required: Altered consciousness detected. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('SYM_ALTERED_CONSCIOUSNESS') || ids.has('EMERG_UNRESPONSIVE'),
  },

  // 6. Gastrointestinal Hemorrhage (Melena / Hematemesis)
  {
    ruleId: 'RED_FLAG_GI_BLEED',
    title: 'Active Gastrointestinal Bleeding',
    severity: 'HIGH',
    clinicalSummary: 'Evidence of blood in stool or vomiting blood.',
    recommendedImmediateAction: 'Priority triage required: Suspected gastrointestinal bleeding. Alert on-duty medical officer immediately.',
    evaluate: (ids) => ids.has('SYM_BLOOD_IN_STOOL'),
  }
];

/**
 * Runs deterministic red-flag rules against affirmed canonical clinical concepts.
 * Ignores concepts that were explicitly negated (e.g. "BP nahi hai" or "chest pain nahi hai").
 */
export function evaluateRedFlags(extractedConcepts: ExtractedClinicalConcept[]): RedFlagAlert[] {
  // Only affirmed concepts contribute to clinical red flags!
  const affirmedConcepts = extractedConcepts.filter(c => c.assertion === 'affirmed');
  const affirmedIds = new Set(affirmedConcepts.map(c => c.conceptId));

  const alerts: RedFlagAlert[] = [];

  for (const rule of DETERMINISTIC_RED_FLAG_RULES) {
    if (rule.evaluate(affirmedIds, extractedConcepts)) {
      const matched = affirmedConcepts
        .filter(c => affirmedIds.has(c.conceptId))
        .map(c => `${c.conceptId} (${c.surfaceText})`);

      alerts.push({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        clinicalSummary: rule.clinicalSummary,
        matchedConcepts: matched,
        recommendedImmediateAction: rule.recommendedImmediateAction,
      });
    }
  }

  return alerts;
}

/**
 * Evaluates red-flag rules against canonical ClinicalFact[] instances.
 * Only AFFIRMED facts trigger red-flag alerts.
 */
export function evaluateRedFlagsFromFacts(facts: ClinicalFact[]): RedFlagAlert[] {
  const affirmedFacts = facts.filter((f) => f.assertion === 'AFFIRMED');
  const affirmedCodes = new Set(affirmedFacts.map((f) => f.code));
  const alerts: RedFlagAlert[] = [];

  // 1. Acute Coronary Syndrome: Chest Pain + Dyspnea / Breathlessness
  if (
    affirmedCodes.has('SYM_CHEST_PAIN') &&
    (affirmedCodes.has('SYM_BREATHLESSNESS') || affirmedCodes.has('SYM_DYSPNEA'))
  ) {
    alerts.push({
      ruleId: 'RED_FLAG_ACS_DYSPNEA',
      title: 'Possible Acute Coronary Syndrome (Chest Pain + Dyspnea)',
      severity: 'CRITICAL',
      clinicalSummary:
        'Patient reports chest pain associated with breathlessness/shortness of breath. High suspicion for myocardial ischemia or infarction.',
      matchedConcepts: ['SYM_CHEST_PAIN', 'SYM_BREATHLESSNESS'],
      recommendedImmediateAction:
        'Priority triage required: Potential acute coronary emergency detected. Alert on-duty medical officer immediately.',
    });
  } else if (affirmedCodes.has('SYM_CHEST_PAIN')) {
    // Acute chest pain alone
    const chestFact = affirmedFacts.find((f) => f.code === 'SYM_CHEST_PAIN');
    alerts.push({
      ruleId: 'RED_FLAG_CHEST_PAIN_ACUTE',
      title: 'Acute Chest Discomfort / Pain',
      severity: 'HIGH',
      clinicalSummary:
        'Patient reports acute chest pain/discomfort (सीने में दर्द). Immediate cardiovascular evaluation indicated.',
      matchedConcepts: [`SYM_CHEST_PAIN (${chestFact?.evidence[0]?.verbatimText || chestFact?.term})`],
      recommendedImmediateAction:
        'Priority triage required: Acute chest pain reported. Alert on-duty medical officer immediately.',
    });
  }

  // 2. Severe Breathlessness alone
  if (
    (affirmedCodes.has('SYM_BREATHLESSNESS') || affirmedCodes.has('SYM_DYSPNEA')) &&
    !affirmedCodes.has('SYM_CHEST_PAIN')
  ) {
    const breathFact = affirmedFacts.find(
      (f) => f.code === 'SYM_BREATHLESSNESS' || f.code === 'SYM_DYSPNEA'
    );
    alerts.push({
      ruleId: 'RED_FLAG_SEVERE_DYSPNEA',
      title: 'Severe Breathlessness / Respiratory Distress',
      severity: 'HIGH',
      clinicalSummary: 'Acute dyspnea reported without relief.',
      matchedConcepts: [
        `SYM_BREATHLESSNESS (${breathFact?.evidence[0]?.verbatimText || breathFact?.term})`,
      ],
      recommendedImmediateAction:
        'Priority triage required: Potential respiratory emergency detected. Alert on-duty medical officer immediately.',
    });
  }

  return alerts;
}
