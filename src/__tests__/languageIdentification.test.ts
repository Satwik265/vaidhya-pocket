import { describe, it, expect } from 'vitest';
import { identifyClinicalLanguage } from '../clinical/languageIdentification';

describe('Sovereign Clinical Language Identification (Phase 8C)', () => {
  it('identifies native Devanagari Hindi with high confidence', () => {
    const res = identifyClinicalLanguage('सीने में दर्द हो रहा है और बुखार भी है');
    expect(res.language).toBe('hi');
    expect(res.locale).toBe('hi-IN');
    expect(res.script).toBe('Devanagari');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.isLowConfidence).toBe(false);
  });

  it('disambiguates native Devanagari Marathi from Hindi', () => {
    const res = identifyClinicalLanguage('माझ्या पोटात खूप दुखत आहे आणि खूप त्रास होतोय');
    expect(res.language).toBe('mr');
    expect(res.locale).toBe('mr-IN');
    expect(res.script).toBe('Devanagari');
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('identifies native Tamil script accurately', () => {
    const res = identifyClinicalLanguage('எனக்கு நெஞ்சில் கடுமையான வலி இருக்கிறது');
    expect(res.language).toBe('ta');
    expect(res.locale).toBe('ta-IN');
    expect(res.script).toBe('Tamil');
    expect(res.confidence).toBe(0.98);
  });

  it('identifies native Gujarati script accurately', () => {
    const res = identifyClinicalLanguage('મને છાતીમાં ખૂબ દુખાવો થાય છે');
    expect(res.language).toBe('gu');
    expect(res.locale).toBe('gu-IN');
    expect(res.script).toBe('Gujarati');
    expect(res.confidence).toBe(0.98);
  });

  it('identifies standard clinical English', () => {
    const res = identifyClinicalLanguage('Patient reports severe chest pain radiating to the left arm for two days.');
    expect(res.language).toBe('en');
    expect(res.script).toBe('Latin');
    expect(res.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('identifies Romanized Hindi through distinctive lexical particles', () => {
    const res = identifyClinicalLanguage('mujhe bukhar aur khansi hai');
    expect(res.language).toBe('hi');
    expect(res.script).toBe('Latin');
    expect(res.method).toBe('lexical_heuristic');
  });

  it('identifies Romanized Marathi through distinctive particles', () => {
    const res = identifyClinicalLanguage('mala khup tras hoto aani potat dukhtay');
    expect(res.language).toBe('mr');
    expect(res.script).toBe('Latin');
  });

  it('flags code-switching when English medical concepts appear inside Indic frame', () => {
    const res = identifyClinicalLanguage('mujhe chest pain ho raha hai aur vomiting bhi aa rahi hai');
    expect(res.isCodeSwitched).toBe(true);
    expect(res.language).toBe('hi');
  });

  it('returns explicit low confidence for empty or ambiguous short inputs', () => {
    const res = identifyClinicalLanguage('');
    expect(res.isLowConfidence).toBe(true);
    expect(res.method).toBe('prior');
  });
});
