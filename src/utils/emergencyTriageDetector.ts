import { EmergencyTriageAlert } from '../types';
import { ClinicalFact } from '../clinical/clinicalFactModel';

export const TRIAGE_STORAGE_KEY = 'medscribe_triage_alerts_v1';

export interface EmergencyRule {
  id: string;
  category: string;
  patternDescription: string;
  primaryRegex: RegExp;
  secondaryRegex?: RegExp;
  severity: 'CRITICAL_EMERGENCY' | 'HIGH_PRIORITY';
  triageColor: 'Red' | 'Yellow';
  actionDirectives: string[];
}

/**
 * Deterministic Clinical Emergency Rules
 * Follows the high-accuracy rule pattern established in drugInteractionChecker.ts
 */
export const EMERGENCY_TRIAGE_RULES: EmergencyRule[] = [
  {
    id: 'EMERG_CHEST_PAIN_DYSPNEA',
    category: 'Acute Cardiovascular Crisis (ACS / Myocardial Infarction)',
    patternDescription: 'Chest pain combined with shortness of breath, diaphoresis, or radiating pain',
    primaryRegex: /\b(chest\s+pain|chest\s+pressure|crushing\s+chest|heavy\s+chest|tightness\s+in\s+chest|heart\s+attack|angina|dolor\s+de\s+pecho|presi[oó]n\s+en\s+el\s+pecho)\b|सीने\s*में\s*(तेज़\s*)?दर्द|छाती\s*में\s*दर्द/i,
    secondaryRegex: /\b(shortness\s+of\s+breath|breathless|breathlessness|difficulty\s+breathing|can'?t\s+breathe|dyspnea|sweat|sweating|diaphoresis|left\s+arm|jaw\s+pain|radiat|dificultad\s+para\s+respirar|falta\s+de\s+aire|sudoraci[oó]n|brazo\s+izquierdo)\b|सांस\s*(लेने\s*में\s*तकलीफ|फूल|चढ़)|पसीना|बाएं\s*हाथ\s*में\s*दर्द/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Dispatch emergency response nurse with crash cart',
      'Keep patient seated upright and resting at kiosk terminal #01',
      'Prepare emergency 12-lead ECG and continuous cardiac monitoring',
      'Check vital signs (BP, SpO2, HR) and prepare supplemental oxygen',
    ],
  },
  {
    id: 'EMERG_STROKE_FAST',
    category: 'Acute Neurological Emergency (Stroke / CVA)',
    patternDescription: 'Stroke-pattern symptoms: facial droop, unilateral weakness, or sudden speech disturbance',
    primaryRegex: /\b(stroke|facial\s+droop|face\s+droop|drooping\s+face|slurred\s+speech|slurring|can'?t\s+speak|difficulty\s+speaking|arm\s+weakness|arm\s+drift|one\s+side\s+weak|numbness\s+on\s+one\s+side|weakness\s+on\s+one\s+side|paralysis|hemiparesis|rostro\s+ca[ií]do|dificultad\s+para\s+hablar|brazo\s+d[eé]bil|par[aá]lisis)\b|लकवा|मुंह\s*टेढ़ा|बोलने\s*में\s*दिक्कत|हाथ\s*में\s*कमजोरी/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Code Stroke triage activation',
      'Record exact Last Known Well (LKW) symptom onset time',
      'Prepare immediate non-contrast CT brain transfer pathway',
      'Check capillary blood glucose immediately to rule out hypoglycemia',
    ],
  },
  {
    id: 'EMERG_THUNDERCLAP_HEADACHE',
    category: 'Intracranial Emergency (Subarachnoid Hemorrhage / Meningitis)',
    patternDescription: 'Sudden severe headache accompanied by vision changes, diplopia, or neck stiffness',
    primaryRegex: /\b(sudden\s+severe\s+headache|worst\s+headache|thunderclap\s+headache|severe\s+headache|explosive\s+headache|dolor\s+de\s+cabeza\s+s[uú]bito|peor\s+dolor\s+de\s+cabeza)\b/i,
    secondaryRegex: /\b(vision\s+change|blurry\s+vision|blurred\s+vision|double\s+vision|diplopia|loss\s+of\s+vision|cannot\s+see|stiff\s+neck|neck\s+stiffness|vomit|vomiting|confusion|visi[oó]n\s+borrosa|visi[oó]n\s+doble|cuello\s+r[ií]gido)\b/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Alert Attending Physician for STAT neurological assessment',
      'Assess Glasgow Coma Scale (GCS) and pupil reactivity',
      'Evaluate for meningeal signs (Kernig / Brudzinski)',
      'Prepare urgent neuroimaging / emergency department transfer',
    ],
  },
  {
    id: 'EMERG_ACUTE_RESPIRATORY_FAILURE',
    category: 'Acute Severe Respiratory Distress',
    patternDescription: 'Severe breathlessness, stridor, choking, or inability to complete sentences',
    primaryRegex: /\b(choking|stridor|gasping\s+for\s+air|cannot\s+breathe\s+at\s+all|can'?t\s+breathe\s+at\s+all|blue\s+lips|cyanosis|suffocating|severe\s+wheezing|ahog[aá]ndose|no\s+puedo\s+respirar|labios\s+azules)\b/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Bring suction and emergency airway kit to kiosk',
      'Administer high-flow oxygen via non-rebreather mask',
      'Prepare nebulization (Salbutamol/Ipratropium) if severe bronchospasm',
      'Notify casualty airway team immediately',
    ],
  },
  {
    id: 'EMERG_MASSIVE_HEMORRHAGE',
    category: 'Acute Severe Hemorrhage',
    patternDescription: 'Coughing up blood (hemoptysis) or vomiting blood (hematemesis)',
    primaryRegex: /\b(coughing\s+(up\s+)?blood|hemoptysis|vomiting\s+blood|hematemesis|massive\s+bleeding|heavy\s+bleeding|tosiendo\s+sangre|vomitando\s+sangre|sangrado\s+masivo)\b/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Bedside clinical assessment and large-bore IV access',
      'Position patient safely to prevent aspiration',
      'Stat crossmatch and fluid resuscitation protocol',
      'Direct urgent transfer to emergency resuscitation bay',
    ],
  },
  {
    id: 'EMERG_FEVER_ALTERED_SENSORIUM',
    category: 'Severe Sepsis / Meningoencephalitis',
    patternDescription: 'High fever accompanied by confusion, stiff neck, delirium, or seizures',
    primaryRegex: /\b(high\s+fever|severe\s+fever|febrile|fiebre\s+alta)\b/i,
    secondaryRegex: /\b(confusion|unresponsive|delirium|stiff\s+neck|neck\s+stiffness|convulsion|seizure|hallucinating|confusi[oó]n|cuello\s+r[ií]gido|convulsiones)\b/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Urgent sepsis / CNS infection screening',
      'Stat blood cultures, lactate, and intravenous access',
      'Immediate physician bedside evaluation',
    ],
  },
  {
    id: 'EMERG_ANAPHYLAXIS',
    category: 'Severe Anaphylactic Reaction',
    patternDescription: 'Throat swelling, tongue swelling, or hives with respiratory distress',
    primaryRegex: /\b(throat\s+(closing|swelling)|tongue\s+swelling|swollen\s+tongue|anaphylaxis|garganta\s+cerrada|lengua\s+hinchada)\b/i,
    secondaryRegex: /\b(difficulty\s+breathing|can'?t\s+breathe|hives|rash|wheezing|dificultad\s+para\s+respirar|urticaria)\b/i,
    severity: 'CRITICAL_EMERGENCY',
    triageColor: 'Red',
    actionDirectives: [
      'IMMEDIATE ACTION: Bring intramuscular Adrenaline / Epinephrine 0.5mg',
      'Maintain airway patency and administer high-flow oxygen',
      'Elevate lower extremities if hypotensive',
    ],
  },
];

/**
 * Detects emergency symptom patterns during live data entry or voice dictation.
 * Returns an EmergencyTriageAlert object if a critical pattern is identified, or null.
 */
export function detectEmergencySymptomPattern(
  inputText: string = '',
  context?: {
    patientName?: string;
    age?: number | string;
    gender?: string;
    abhaId?: string;
    kioskStationId?: string;
    priorHistoryText?: string;
  }
): EmergencyTriageAlert | null {
  if (!inputText || inputText.trim().length < 3) {
    return null;
  }

  const combinedText = `${inputText} ${context?.priorHistoryText || ''}`.trim();

  for (const rule of EMERGENCY_TRIAGE_RULES) {
    const primaryMatch = rule.primaryRegex.exec(combinedText);
    if (!primaryMatch) {
      continue;
    }

    // If secondary regex is specified, both must match
    let matchedKeywords: string[] = [primaryMatch[0]];
    if (rule.secondaryRegex) {
      const secondaryMatch = rule.secondaryRegex.exec(combinedText);
      if (!secondaryMatch) {
        continue;
      }
      matchedKeywords.push(secondaryMatch[0]);
    }

    const alertId = `TRG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const alert: EmergencyTriageAlert = {
      id: alertId,
      timestamp: nowIso,
      patientName: context?.patientName || 'Patient',
      age: context?.age || 'Not documented',
      gender: context?.gender || 'Not documented',
      abhaId: context?.abhaId || 'Not documented',
      kioskStationId: context?.kioskStationId || 'Kiosk #01 (OPD Lobby)',
      emergencyCategory: rule.category,
      detectedPattern: rule.patternDescription,
      matchedKeywords,
      severity: rule.severity,
      triageColor: rule.triageColor,
      triggerInputText: inputText.trim(),
      status: 'active',
      actionDirectives: rule.actionDirectives,
    };

    return alert;
  }

  return null;
}

/**
 * Detects emergency triage conditions directly from canonical ClinicalFact[] instances.
 * Enables emergency identification from affirmed clinical codes (e.g. SYM_CHEST_PAIN, SYM_BREATHLESSNESS)
 * without depending solely on regex matching against English surface text.
 */
export function detectEmergencyFromFacts(
  facts: ClinicalFact[],
  context?: {
    patientName?: string;
    age?: number | string;
    gender?: string;
    abhaId?: string;
    kioskStationId?: string;
    priorHistoryText?: string;
  }
): EmergencyTriageAlert | null {
  const affirmedCodes = new Set(
    facts.filter((f) => f.assertion === 'AFFIRMED').map((f) => f.code)
  );

  // 1. ACS / Acute Chest Pain crisis
  if (
    affirmedCodes.has('SYM_CHEST_PAIN') &&
    (affirmedCodes.has('SYM_BREATHLESSNESS') || affirmedCodes.has('SYM_DYSPNEA'))
  ) {
    const chestFact = facts.find((f) => f.code === 'SYM_CHEST_PAIN' && f.assertion === 'AFFIRMED');
    const alertId = `TRG-FACT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    return {
      id: alertId,
      timestamp: new Date().toISOString(),
      patientName: context?.patientName || 'Patient',
      age: context?.age || 'Not documented',
      gender: context?.gender || 'Not documented',
      abhaId: context?.abhaId || 'Not documented',
      kioskStationId: context?.kioskStationId || 'Kiosk #01 (OPD Lobby)',
      emergencyCategory: 'Acute Cardiovascular Crisis (ACS / Myocardial Infarction)',
      detectedPattern: 'Chest pain combined with shortness of breath (सीने में दर्द + सांस फूलना)',
      matchedKeywords: ['SYM_CHEST_PAIN', 'SYM_BREATHLESSNESS'],
      severity: 'CRITICAL_EMERGENCY',
      triageColor: 'Red',
      triggerInputText: chestFact?.evidence[0]?.verbatimText || 'SYM_CHEST_PAIN + SYM_BREATHLESSNESS',
      status: 'active',
      actionDirectives: [
        'IMMEDIATE ACTION: Dispatch emergency response nurse with crash cart',
        'Keep patient seated upright and resting at kiosk terminal #01',
        'Prepare emergency 12-lead ECG and continuous cardiac monitoring',
        'Check vital signs (BP, SpO2, HR) and prepare supplemental oxygen',
      ],
    };
  }

  return null;
}

/**
 * Gets all saved alerts from localStorage (fallback & local sync)
 */
export function getLocalTriageAlerts(): EmergencyTriageAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TRIAGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves or updates alert in localStorage and dispatches storage event for cross-tab sync
 */
export function saveLocalTriageAlert(alert: EmergencyTriageAlert): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalTriageAlerts();
    const index = existing.findIndex((a) => a.id === alert.id);
    let updated: EmergencyTriageAlert[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = alert;
    } else {
      updated = [alert, ...existing];
    }
    localStorage.setItem(TRIAGE_STORAGE_KEY, JSON.stringify(updated));
    // Trigger window event for in-tab listeners
    window.dispatchEvent(new CustomEvent('triage-alert-updated', { detail: alert }));
  } catch (err) {
    console.error('Failed to save triage alert to localStorage:', err);
  }
}

/**
 * Publishes an alert to both backend API and local store
 */
export async function publishEmergencyAlert(alert: EmergencyTriageAlert): Promise<void> {
  // 1. Immediately store locally for zero-latency UI update
  saveLocalTriageAlert(alert);

  // 2. Broadcast to backend server route
  try {
    await fetch('/api/triage/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alert),
    });
  } catch (e) {
    console.warn('Could not post triage alert to backend, preserved in local storage queue:', e);
  }
}

/**
 * Plays an audible emergency alert chime via Web Audio API
 */
export function playEmergencyAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play two-tone medical alert chime (880Hz -> 659Hz)
    const now = ctx.currentTime;
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.25); // E5
    gain2.gain.setValueAtTime(0.3, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.7);
  } catch (err) {
    // AudioContext autoplay restrictions are handled gracefully
    console.debug('Audio chime unable to play:', err);
  }
}
