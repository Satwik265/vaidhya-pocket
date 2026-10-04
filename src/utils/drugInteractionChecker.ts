import { Prescription, SafetyAlert } from '../types';
import { DRUG_INTERACTION_DATABASE } from '../data/drugInteractions';

/**
 * Deterministically checks newly prescribed medications against current medications and medical history.
 * Returns an array of SafetyAlert objects.
 */
export function checkDrugInteractions(
  prescriptions: Prescription[] = [],
  currentMedicationsText: string = '',
  medicalHistoryText: string = '',
  allergiesText: string = ''
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const combinedHistory = `${currentMedicationsText} ${medicalHistoryText}`.toLowerCase();
  const prescribedMedNames = prescriptions.map((p) => (p.medication || '').toLowerCase());

  // 1. Check Allergy Contraindications
  if (allergiesText && allergiesText.toLowerCase() !== 'nkda' && allergiesText.toLowerCase() !== 'none') {
    const knownAllergies = allergiesText.toLowerCase();
    prescribedMedNames.forEach((med) => {
      if (!med) return;
      // Check if allergy string contains medication name or class
      if (knownAllergies.includes(med) || (med.includes('amoxicillin') && knownAllergies.includes('penicillin'))) {
        alerts.push({
          type: 'Allergy Alert',
          severity: 'High',
          message: `CRITICAL ALLERGY CONTRAINDICATION: Prescribed medication '${med}' conflicts with documented patient allergy '${allergiesText}'.`,
        });
      }
    });
  }

  // 2. Check for Duplicate Prescriptions
  const seenMeds = new Set<string>();
  prescriptions.forEach((p) => {
    const medName = (p.medication || '').trim().toLowerCase();
    if (!medName) return;
    if (seenMeds.has(medName)) {
      if (!alerts.some((a) => a.message.includes(`DUPLICATE PRESCRIPTION DETECTED: '${p.medication}'`))) {
        alerts.push({
          type: 'Drug Interaction',
          severity: 'Medium',
          message: `DUPLICATE PRESCRIPTION DETECTED: '${p.medication}' is prescribed multiple times in the plan.`,
        });
      }
    } else {
      seenMeds.add(medName);
    }
  });

  // 3. Check Database Rules for Drug-Drug and Drug-Condition Interactions
  DRUG_INTERACTION_DATABASE.forEach((rule) => {
    const patternA = new RegExp(rule.drugA, 'i');
    const patternB = new RegExp(rule.drugB, 'i');

    // Check if Drug A is in prescribed medications
    const matchesDrugAInPrescriptions = prescribedMedNames.some((med) => patternA.test(med));
    const matchesDrugBInPrescriptions = prescribedMedNames.some((med) => patternB.test(med));

    const matchesDrugAInHistory = patternA.test(combinedHistory);
    const matchesDrugBInHistory = patternB.test(combinedHistory);

    let isTriggered = false;
    let matchedDetails = '';

    if (rule.type === 'drug-drug') {
      // Trigger if one drug is prescribed and the other is either prescribed OR in current medications
      if (matchesDrugAInPrescriptions && (matchesDrugBInPrescriptions || matchesDrugBInHistory)) {
        isTriggered = true;
        matchedDetails = `${rule.title}: ${rule.mechanism} Recommendation: ${rule.recommendation}`;
      } else if (matchesDrugBInPrescriptions && matchesDrugAInHistory) {
        isTriggered = true;
        matchedDetails = `${rule.title}: ${rule.mechanism} Recommendation: ${rule.recommendation}`;
      }
    } else if (rule.type === 'drug-condition') {
      // Trigger if drug is prescribed and condition is in medical history
      if (matchesDrugAInPrescriptions && matchesDrugBInHistory) {
        isTriggered = true;
        matchedDetails = `${rule.title}: ${rule.mechanism} Recommendation: ${rule.recommendation}`;
      }
    }

    if (isTriggered) {
      // Capitalize severity to match SafetyAlert interface ('High' | 'Medium' | 'Low')
      const formattedSeverity = (rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)) as 'High' | 'Medium' | 'Low';
      
      // Avoid adding duplicate alert messages
      if (!alerts.some((a) => a.message.includes(rule.title))) {
        alerts.push({
          type: 'Drug Interaction',
          severity: formattedSeverity,
          message: matchedDetails,
        });
      }
    }
  });

  // 4. Check for Medications Absent from Curated Database ("Not Checked")
  prescriptions.forEach((p) => {
    const rawMedName = (p.medication || '').trim();
    if (!rawMedName) return;
    const isCurated = DRUG_INTERACTION_DATABASE.some((rule) => {
      const patternA = new RegExp(rule.drugA, 'i');
      const patternB = new RegExp(rule.drugB, 'i');
      return patternA.test(rawMedName) || patternB.test(rawMedName);
    });
    if (!isCurated) {
      alerts.push({
        type: 'Missing Info',
        severity: 'Low',
        message: `Unchecked Medication: '${rawMedName}' is not present in the curated local interaction database and was not checked.`,
      });
    }
  });

  return alerts;
}
