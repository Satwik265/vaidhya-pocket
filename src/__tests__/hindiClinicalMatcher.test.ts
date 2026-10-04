import { describe, it, expect } from 'vitest';
import { analyzeHindiTranscript, ClinicalConcept } from '../clinical/hindiClinicalMatcher';
import hindiSymptoms from '../dictionaries/medical/hindi_symptoms.json';
import hindiNegation from '../dictionaries/medical/hindi_negation.json';
import hindiTemporal from '../dictionaries/medical/hindi_temporal.json';

const dictionary = hindiSymptoms as unknown as ClinicalConcept[];

describe('Hindi Clinical Matcher - Gap Fix Verification', () => {
  it('correctly extracts SYM_CHEST_PAIN with 3-token fuzzy match from "sine me dard hai aur pasina bhi aa raha hai"', () => {
    const transcript = 'sine me dard hai aur pasina bhi aa raha hai';
    const result = analyzeHindiTranscript(transcript, dictionary, hindiNegation, hindiTemporal);

    console.log('Result for chest pain input:', JSON.stringify(result.facts, null, 2));

    const chestPain = result.facts.find((f) => f.conceptId === 'SYM_CHEST_PAIN');
    expect(chestPain).toBeDefined();
    expect(chestPain?.assertion).toBe('present');
    expect(chestPain?.canonicalEnglish).toBe('chest pain');

    const sweating = result.facts.find((f) => f.conceptId === 'SYM_SWEATING');
    expect(sweating).toBeDefined();
    expect(sweating?.assertion).toBe('present');
  });

  it('correctly extracts COND_HYPERTENSION as negated and SYM_HEADACHE as present in "BP ka problem nahi hai lekin sar dard bahut rehta hai"', () => {
    const transcript = 'BP ka problem nahi hai lekin sar dard bahut rehta hai';
    const result = analyzeHindiTranscript(transcript, dictionary, hindiNegation, hindiTemporal);

    console.log('Result for hypertension negation input:', JSON.stringify(result.facts, null, 2));

    const hypertension = result.facts.find((f) => f.conceptId === 'COND_HYPERTENSION');
    expect(hypertension).toBeDefined();
    expect(hypertension?.assertion).toBe('negated');
    expect(hypertension?.canonicalEnglish).toContain('hypertension');

    const headache = result.facts.find((f) => f.conceptId === 'SYM_HEADACHE');
    expect(headache).toBeDefined();
    expect(headache?.assertion).toBe('present');
    expect(headache?.canonicalEnglish).toBe('headache');
  });
});
