import { describe, it, expect } from 'vitest';
import { checkDrugInteractions } from '../utils/drugInteractionChecker';
import { DRUG_INTERACTION_DATABASE } from '../data/drugInteractions';
import { Prescription } from '../types';

describe('Drug Interaction Database', () => {
  it('contains valid interaction rules in database', () => {
    expect(DRUG_INTERACTION_DATABASE.length).toBeGreaterThan(0);
    DRUG_INTERACTION_DATABASE.forEach((rule) => {
      expect(rule.id).toBeTruthy();
      expect(rule.drugA).toBeTruthy();
      expect(rule.drugB).toBeTruthy();
      expect(rule.severity).toMatch(/high|medium|low/);
      expect(rule.title).toBeTruthy();
    });
  });

  it('detects NSAID + Antihypertensive drug-drug interaction', () => {
    const prescriptions: Prescription[] = [
      { medication: 'Ibuprofen', dosage: '400mg', frequency: 'TID', duration: '5 days', instructions: 'Take with food' },
    ];
    const currentMeds = 'Lisinopril 10mg daily';
    const history = 'Essential Hypertension';

    const alerts = checkDrugInteractions(prescriptions, currentMeds, history, '');
    expect(alerts.length).toBeGreaterThan(0);
    const nsaidAlert = alerts.find((a) => a.message.includes('NSAID + Antihypertensive Interaction'));
    expect(nsaidAlert).toBeDefined();
    expect(nsaidAlert?.severity).toBe('High');
  });

  it('detects NSAID + CKD drug-condition interaction', () => {
    const prescriptions: Prescription[] = [
      { medication: 'Diclofenac', dosage: '50mg', frequency: 'BID', duration: '7 days', instructions: 'For joint pain' },
    ];
    const currentMeds = 'None';
    const history = 'Stage 3 Chronic Kidney Disease (CKD)';

    const alerts = checkDrugInteractions(prescriptions, currentMeds, history, '');
    expect(alerts.length).toBeGreaterThan(0);
    const ckdAlert = alerts.find((a) => a.message.includes('NSAID Use in Renal Impairment / CKD'));
    expect(ckdAlert).toBeDefined();
    expect(ckdAlert?.severity).toBe('High');
  });

  it('detects allergy contraindication for penicillin allergy with amoxicillin', () => {
    const prescriptions: Prescription[] = [
      { medication: 'Amoxicillin', dosage: '500mg', frequency: 'TID', duration: '7 days', instructions: 'Finish full course' },
    ];
    const allergies = 'Penicillin (Severe hives & anaphylaxis)';

    const alerts = checkDrugInteractions(prescriptions, '', '', allergies);
    expect(alerts.length).toBeGreaterThan(0);
    const allergyAlert = alerts.find((a) => a.type === 'Allergy Alert');
    expect(allergyAlert).toBeDefined();
    expect(allergyAlert?.message).toContain('CRITICAL ALLERGY CONTRAINDICATION');
  });

  it('returns no alerts for safe combinations', () => {
    const prescriptions: Prescription[] = [
      { medication: 'Paracetamol', dosage: '500mg', frequency: 'QID', duration: '3 days', instructions: 'PRN fever' },
    ];
    const currentMeds = 'Multivitamin';
    const history = 'No chronic illnesses';
    const allergies = 'NKDA';

    const alerts = checkDrugInteractions(prescriptions, currentMeds, history, allergies);
    expect(alerts.length).toBe(0);
  });
});
