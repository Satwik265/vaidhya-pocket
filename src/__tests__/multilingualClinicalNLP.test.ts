import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../speech/languageDetection';
import { extractMultilingualConcepts } from '../nlp/codeSwitchingExtractor';
import { normalizeMedications } from '../nlp/medicationNormalizer';
import { extractTemporalExpressions } from '../nlp/temporalNormalizer';
import { evaluateRedFlags } from '../clinical/redFlagRules';
import { normalizeIndianClinicalText } from '../nlp/normalizer';

import englishFixtures from '../test-fixtures/multilingual/english.json';
import hindiFixtures from '../test-fixtures/multilingual/hindi.json';
import marathiFixtures from '../test-fixtures/multilingual/marathi.json';
import tamilFixtures from '../test-fixtures/multilingual/tamil.json';
import gujaratiFixtures from '../test-fixtures/multilingual/gujarati.json';

describe('Multilingual Indian Clinical NLP & Voice Pipeline', () => {

  // Test Fixture Validation Suites
  describe('Test Fixtures Verification', () => {
    const suites = [
      { name: 'English (en-IN)', fixtures: englishFixtures, expectedLocale: 'en-IN' },
      { name: 'Hindi (hi-IN)', fixtures: hindiFixtures, expectedLocale: 'hi-IN' },
      { name: 'Marathi (mr-IN)', fixtures: marathiFixtures, expectedLocale: 'mr-IN' },
      { name: 'Tamil (ta-IN)', fixtures: tamilFixtures, expectedLocale: 'ta-IN' },
      { name: 'Gujarati (gu-IN)', fixtures: gujaratiFixtures, expectedLocale: 'gu-IN' },
    ];

    for (const suite of suites) {
      describe(`${suite.name} Fixture Suite`, () => {
        suite.fixtures.forEach((item, index) => {
          it(`Fixture ${index + 1}: "${item.input}"`, () => {
            // 1. Language Detection
            const langResult = detectLanguage(item.input, suite.expectedLocale as any);
            expect(langResult.language).toBe(item.expectedLanguage);

            // 2. Concept Extraction
            const concepts = extractMultilingualConcepts(item.input, 'patient_voice', item.expectedLanguage);
            const foundConceptIds = concepts.map(c => c.conceptId);

            for (const expectedConcept of item.expectedConcepts) {
              expect(foundConceptIds).toContain(expectedConcept);
            }

            // 3. Negations
            for (const negatedConceptId of item.expectedNegations) {
              const matched = concepts.find(c => c.conceptId === negatedConceptId);
              expect(matched?.assertion).toBe('negated');
            }

            // 4. Temporal Expressions
            if (item.expectedTemporalValues.length > 0) {
              const temporals = extractTemporalExpressions(item.input);
              expect(temporals.length).toBeGreaterThan(0);
              const exp = item.expectedTemporalValues[0];
              if (exp.value !== undefined) {
                expect(temporals[0].value).toBe(exp.value);
              }
              if (exp.unit !== undefined) {
                expect(temporals[0].unit).toBe(exp.unit);
              }
            }

            // 5. Red Flags
            const redFlags = evaluateRedFlags(concepts);
            const foundRuleIds = redFlags.map(r => r.ruleId);
            for (const expectedFlag of item.expectedRedFlags) {
              expect(foundRuleIds).toContain(expectedFlag);
            }
          });
        });
      });
    }
  });

  // Comprehensive Language 50+ Test Matrices
  describe('Hindi (hi-IN) - 50 Comprehensive Sub-Tests', () => {
    // 1. Native script
    it('1. native: सीने में दर्द', () => {
      const concepts = extractMultilingualConcepts('सीने में दर्द हो रहा है');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('2. native: सांस फूलना', () => {
      const concepts = extractMultilingualConcepts('सांस फूलने की शिकायत है');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('3. native: तेज बुखार', () => {
      const concepts = extractMultilingualConcepts('मरीज को तेज बुखार है');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('4. native: सिरदर्द', () => {
      const concepts = extractMultilingualConcepts('दोपहर से सिरदर्द हो रहा है');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('5. native: पेट दर्द', () => {
      const concepts = extractMultilingualConcepts('पेट दर्द की समस्या है');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });
    it('6. native: उल्टी', () => {
      const concepts = extractMultilingualConcepts('सुबह से उल्टी आ रही है');
      expect(concepts.some(c => c.conceptId === 'SYM_VOMITING')).toBe(true);
    });
    it('7. native: चक्कर', () => {
      const concepts = extractMultilingualConcepts('चलने पर चक्कर आ रहे हैं');
      expect(concepts.some(c => c.conceptId === 'SYM_DIZZINESS')).toBe(true);
    });
    it('8. native: खांसी', () => {
      const concepts = extractMultilingualConcepts('सूखी खांसी आ रही है');
      expect(concepts.some(c => c.conceptId === 'SYM_COUGH')).toBe(true);
    });
    it('9. native: मधुमेह', () => {
      const concepts = extractMultilingualConcepts('मुझे मधुमेह की बीमारी है');
      expect(concepts.some(c => c.conceptId === 'DIS_DIABETES')).toBe(true);
    });
    it('10. native: उच्च रक्तचाप', () => {
      const concepts = extractMultilingualConcepts('उच्च रक्तचाप का मरीज हूं');
      expect(concepts.some(c => c.conceptId === 'DIS_HYPERTENSION')).toBe(true);
    });

    // 2. Romanized speech
    it('11. romanized: seene mein dard', () => {
      const concepts = extractMultilingualConcepts('seene mein dard hai');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('12. romanized: saans phoolna', () => {
      const concepts = extractMultilingualConcepts('saans phool raha hai');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('13. romanized: bukhar', () => {
      const concepts = extractMultilingualConcepts('tez bukhar hai');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('14. romanized: sar dard', () => {
      const concepts = extractMultilingualConcepts('sar mein dard ho raha hai');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('15. romanized: pet dard', () => {
      const concepts = extractMultilingualConcepts('pet mein dard hai');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });

    // 3. Code-switching
    it('16. code-switching: Mujhe chest mein bahut pain hai', () => {
      const concepts = extractMultilingualConcepts('Mujhe chest mein bahut pain hai');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('17. code-switching: breathlessness ho rahi hai', () => {
      const concepts = extractMultilingualConcepts('Mujhe breathlessness ho rahi hai');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('18. code-switching: headache bahut severe hai', () => {
      const concepts = extractMultilingualConcepts('headache bahut severe hai');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('19. code-switching: stomach pain ho raha hai', () => {
      const concepts = extractMultilingualConcepts('stomach pain ho raha hai');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });
    it('20. code-switching: BP high chal raha hai', () => {
      const concepts = extractMultilingualConcepts('BP high chal raha hai');
      expect(concepts.some(c => c.conceptId === 'DIS_HYPERTENSION')).toBe(true);
    });

    // 4. Colloquial speech
    it('21. colloquial: seena dab raha hai', () => {
      const concepts = extractMultilingualConcepts('seena dab raha hai');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('22. colloquial: badan garam hai', () => {
      const concepts = extractMultilingualConcepts('badan garam hai');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('23. colloquial: sar phat raha hai', () => {
      const concepts = extractMultilingualConcepts('sar phat raha hai');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('24. colloquial: pet mein marod', () => {
      const concepts = extractMultilingualConcepts('pet mein marod ho rahi hai');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });
    it('25. colloquial: aankhon ke aage andhera', () => {
      const concepts = extractMultilingualConcepts('aankhon ke aage andhera aa gaya');
      expect(concepts.some(c => c.conceptId === 'SYM_DIZZINESS')).toBe(true);
    });

    // 5. Negation
    it('26. negation: BP nahi hai', () => {
      const concepts = extractMultilingualConcepts('BP nahi hai');
      const bp = concepts.find(c => c.conceptId === 'DIS_HYPERTENSION');
      expect(bp?.assertion).toBe('negated');
    });
    it('27. negation: bukhar nahi hai', () => {
      const concepts = extractMultilingualConcepts('bukhar nahi hai');
      const f = concepts.find(c => c.conceptId === 'SYM_FEVER');
      expect(f?.assertion).toBe('negated');
    });
    it('28. negation: seene mein dard bilkul nahi hai', () => {
      const concepts = extractMultilingualConcepts('seene mein dard bilkul nahi hai');
      const cp = concepts.find(c => c.conceptId === 'SYM_CHEST_PAIN');
      expect(cp?.assertion).toBe('negated');
    });
    it('29. negation clause: BP nahi hai lekin bukhar hai', () => {
      const concepts = extractMultilingualConcepts('BP nahi hai lekin bukhar hai');
      expect(concepts.find(c => c.conceptId === 'DIS_HYPERTENSION')?.assertion).toBe('negated');
      expect(concepts.find(c => c.conceptId === 'SYM_FEVER')?.assertion).toBe('affirmed');
    });
    it('30. negation: sugar ki bimari nahi hai', () => {
      const concepts = extractMultilingualConcepts('sugar ki bimari nahi hai');
      expect(concepts.find(c => c.conceptId === 'DIS_DIABETES')?.assertion).toBe('negated');
    });

    // 6. Temporal expressions
    it('31. temporal: 3 din se', () => {
      const t = extractTemporalExpressions('3 din se bukhar hai');
      expect(t[0].value).toBe(3);
      expect(t[0].unit).toBe('days');
    });
    it('32. temporal: kal se', () => {
      const t = extractTemporalExpressions('kal se dard hai');
      expect(t[0].value).toBe(1);
      expect(t[0].unit).toBe('days');
    });
    it('33. temporal: 2 hafte se', () => {
      const t = extractTemporalExpressions('2 hafte se khansi hai');
      expect(t[0].value).toBe(2);
      expect(t[0].unit).toBe('weeks');
    });
    it('34. temporal: 5 mahine se', () => {
      const t = extractTemporalExpressions('5 mahine se dikkat hai');
      expect(t[0].value).toBe(5);
      expect(t[0].unit).toBe('months');
    });
    it('35. temporal: bachpan se', () => {
      const t = extractTemporalExpressions('bachpan se asthma hai');
      expect(t[0].unit).toBe('childhood');
    });

    // 7. Medication names
    it('36. med: metformin', () => {
      const m = normalizeMedications('metformin le raha hoon');
      expect(m.some(x => x.canonicalId === 'RX_METFORMIN')).toBe(true);
    });
    it('37. med: dolo 650', () => {
      const m = normalizeMedications('fever ke liye dolo 650 li');
      expect(m.some(x => x.canonicalId === 'RX_PARACETAMOL')).toBe(true);
    });
    it('38. med: amlong', () => {
      const m = normalizeMedications('bp ke liye amlong khata hoon');
      expect(m.some(x => x.canonicalId === 'RX_AMLODIPINE')).toBe(true);
    });
    it('39. med: omez', () => {
      const m = normalizeMedications('gas ke liye omez li');
      expect(m.some(x => x.canonicalId === 'RX_OMEPRAZOLE')).toBe(true);
    });
    it('40. med: asthalin', () => {
      const m = normalizeMedications('sans ke liye asthalin pump hai');
      expect(m.some(x => x.canonicalId === 'RX_SALBUTAMOL')).toBe(true);
    });

    // 8. Noisy ASR variants
    it('41. asr: met for men -> RX_METFORMIN', () => {
      const m = normalizeMedications('doctor ne met for men likhi thi');
      expect(m.some(x => x.canonicalId === 'RX_METFORMIN')).toBe(true);
    });
    it('42. asr: cinema dard -> seene mein dard', () => {
      const { cleaned } = normalizeIndianClinicalText('cinema dard hai');
      expect(cleaned).toContain('seene mein dard');
    });
    it('43. asr: chase pain -> chest pain', () => {
      const { cleaned } = normalizeIndianClinicalText('chase pain ho raha hai');
      expect(cleaned).toContain('chest pain');
    });
    it('44. asr: sans phoolna', () => {
      const concepts = extractMultilingualConcepts('sans phoolna shuru hua');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('45. asr: dolow 650 -> dolo', () => {
      const { cleaned } = normalizeIndianClinicalText('dolow 650 khayi');
      expect(cleaned).toContain('dolo');
    });

    // 9. Red flags
    it('46. red flag: chest pain + saans phoolna', () => {
      const concepts = extractMultilingualConcepts('seene mein dard aur saans phoolna');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_ACS_DYSPNEA')).toBe(true);
    });
    it('47. red flag: chest pain + behoshi', () => {
      const concepts = extractMultilingualConcepts('seene mein dard tha aur behosh ho gaye');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_CARDIAC_SYNCOPE')).toBe(true);
    });
    it('48. red flag: stroke fast chehra tedha', () => {
      const concepts = extractMultilingualConcepts('chehra tedha ho gaya aur aawaz ladkhada rahi hai');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_ACUTE_STROKE')).toBe(true);
    });
    it('49. red flag: blood in stool', () => {
      const concepts = extractMultilingualConcepts('potty mein khoon aa raha hai');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_GI_BLEED')).toBe(true);
    });
    it('50. unknown words: non-medical text extracts no false positives', () => {
      const concepts = extractMultilingualConcepts('aaj dukan par gaye the aur chai pi');
      expect(concepts.length).toBe(0);
    });
  });

  describe('Marathi (mr-IN) - 50 Comprehensive Sub-Tests', () => {
    // 1. Native script
    it('1. native: छातीत दुखणे', () => {
      const concepts = extractMultilingualConcepts('छातीत दुखणे सुरू झाले आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('2. native: श्वास घेण्यास त्रास', () => {
      const concepts = extractMultilingualConcepts('श्वास घेण्यास त्रास होत आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('3. native: ताप', () => {
      const concepts = extractMultilingualConcepts('खूप ताप आला आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('4. native: डोकेदुखी', () => {
      const concepts = extractMultilingualConcepts('सकाळपासून डोकेदुखी आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('5. native: पोटदुखी', () => {
      const concepts = extractMultilingualConcepts('पोटात दुखत आहे खूप');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });
    it('6. native: उलटी', () => {
      const concepts = extractMultilingualConcepts('दोनदा उलटी झाली');
      expect(concepts.some(c => c.conceptId === 'SYM_VOMITING')).toBe(true);
    });
    it('7. native: जुलाब', () => {
      const concepts = extractMultilingualConcepts('पातळ संडास आणि जुलाब लागली आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_DIARRHEA')).toBe(true);
    });
    it('8. native: चक्कर येणे', () => {
      const concepts = extractMultilingualConcepts('डोळ्यासमोर अंधारी येऊन चक्कर आली');
      expect(concepts.some(c => c.conceptId === 'SYM_DIZZINESS')).toBe(true);
    });
    it('9. native: मधुमेह', () => {
      const concepts = extractMultilingualConcepts('मधुमेह आणि साखरेचा त्रास आहे');
      expect(concepts.some(c => c.conceptId === 'DIS_DIABETES')).toBe(true);
    });
    it('10. native: उच्च रक्तदाब', () => {
      const concepts = extractMultilingualConcepts('रक्तदाब वाढला आहे');
      expect(concepts.some(c => c.conceptId === 'DIS_HYPERTENSION')).toBe(true);
    });

    // 2. Romanized speech
    it('11. romanized: chhatit dukhtay', () => {
      const concepts = extractMultilingualConcepts('mala chhatit dukhtay');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('12. romanized: mala chhatit khup dukhta', () => {
      const concepts = extractMultilingualConcepts('mala chhatit khup dukhta');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('13. romanized: dam lagto ahe', () => {
      const concepts = extractMultilingualConcepts('dam lagto ahe mala');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('14. romanized: khup taap ahe', () => {
      const concepts = extractMultilingualConcepts('khup taap ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('15. romanized: doke dukhat ahe', () => {
      const concepts = extractMultilingualConcepts('doke dukhat ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });

    // 3. Code-switching
    it('16. code-switching: mala tin divasapasun fever ahe', () => {
      const concepts = extractMultilingualConcepts('मला तीन दिवसांपासून fever आहे');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('17. code-switching: chest pain ahe', () => {
      const concepts = extractMultilingualConcepts('mala chest pain ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('18. code-switching: BP high ahe', () => {
      const concepts = extractMultilingualConcepts('BP high zala ahe');
      expect(concepts.some(c => c.conceptId === 'DIS_HYPERTENSION')).toBe(true);
    });
    it('19. code-switching: sugar chi bimari ahe', () => {
      const concepts = extractMultilingualConcepts('sugar chi bimari ahe');
      expect(concepts.some(c => c.conceptId === 'DIS_DIABETES')).toBe(true);
    });
    it('20. code-switching: breathing problem ahe', () => {
      const concepts = extractMultilingualConcepts('mala breathing problem ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });

    // 4. Colloquial speech
    it('21. colloquial: chhati bharun aali', () => {
      const concepts = extractMultilingualConcepts('chhati bharun aali ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('22. colloquial: ang garam zala ahe', () => {
      const concepts = extractMultilingualConcepts('ang garam zala ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('23. colloquial: doke phut-te', () => {
      const concepts = extractMultilingualConcepts('doke phut-te ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });
    it('24. colloquial: potat morada aala', () => {
      const concepts = extractMultilingualConcepts('potat morada aala ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_ABDOMINAL_PAIN')).toBe(true);
    });
    it('25. colloquial: dolyasamor andhari aali', () => {
      const concepts = extractMultilingualConcepts('dolyasamor andhari aali');
      expect(concepts.some(c => c.conceptId === 'SYM_DIZZINESS')).toBe(true);
    });

    // 5. Negation
    it('26. negation: BP nahi ahe', () => {
      const concepts = extractMultilingualConcepts('BP nahi ahe');
      expect(concepts.find(c => c.conceptId === 'DIS_HYPERTENSION')?.assertion).toBe('negated');
    });
    it('27. negation: taap nahi', () => {
      const concepts = extractMultilingualConcepts('taap nahi');
      expect(concepts.find(c => c.conceptId === 'SYM_FEVER')?.assertion).toBe('negated');
    });
    it('28. negation: chhatit tras nahi', () => {
      const concepts = extractMultilingualConcepts('chhatit tras nahi');
      expect(concepts.find(c => c.conceptId === 'SYM_CHEST_PAIN')?.assertion).toBe('negated');
    });
    it('29. negation clause: taap nahi pan doke dukhtay', () => {
      const concepts = extractMultilingualConcepts('taap nahi pan doke dukhtay');
      expect(concepts.find(c => c.conceptId === 'SYM_FEVER')?.assertion).toBe('negated');
      expect(concepts.find(c => c.conceptId === 'SYM_HEADACHE')?.assertion).toBe('affirmed');
    });
    it('30. negation: sakhar rog nahi', () => {
      const concepts = extractMultilingualConcepts('sakhar rog nahi');
      expect(concepts.find(c => c.conceptId === 'DIS_DIABETES')?.assertion).toBe('negated');
    });

    // 6. Temporal expressions
    it('31. temporal: don divasapasun', () => {
      const t = extractTemporalExpressions('don divasapasun taap ahe');
      expect(t[0].value).toBe(2);
      expect(t[0].unit).toBe('days');
    });
    it('32. temporal: kalpasun', () => {
      const t = extractTemporalExpressions('kalpasun dukhta ahe');
      expect(t[0].value).toBe(1);
      expect(t[0].unit).toBe('days');
    });
    it('33. temporal: teen aathavade', () => {
      const t = extractTemporalExpressions('teen athavade zale');
      expect(t[0].value).toBe(3);
      expect(t[0].unit).toBe('weeks');
    });
    it('34. temporal: don mahinyanpasun', () => {
      const t = extractTemporalExpressions('don mahinyanpasun tras ahe');
      expect(t[0].value).toBe(2);
      expect(t[0].unit).toBe('months');
    });
    it('35. temporal: lahanpana pasun', () => {
      const t = extractTemporalExpressions('lahanpana pasun asthma ahe');
      expect(t[0].unit).toBe('childhood');
    });

    // 7. Medication names
    it('36. med: metformin', () => {
      const m = normalizeMedications('sakhar sathi metformin gheto');
      expect(m.some(x => x.canonicalId === 'RX_METFORMIN')).toBe(true);
    });
    it('37. med: crocin', () => {
      const m = normalizeMedications('tap sathi crocin goli ghetli');
      expect(m.some(x => x.canonicalId === 'RX_PARACETAMOL')).toBe(true);
    });
    it('38. med: amlong', () => {
      const m = normalizeMedications('bp sathi amlong gheto');
      expect(m.some(x => x.canonicalId === 'RX_AMLODIPINE')).toBe(true);
    });
    it('39. med: pan 40', () => {
      const m = normalizeMedications('pitta sathi pan 40 ghetli');
      expect(m.some(x => x.canonicalId === 'RX_OMEPRAZOLE')).toBe(true);
    });
    it('40. med: asthalin pump', () => {
      const m = normalizeMedications('dam sathi asthalin cha pump ahe');
      expect(m.some(x => x.canonicalId === 'RX_SALBUTAMOL')).toBe(true);
    });

    // 8. Noisy ASR variants
    it('41. asr: chatit dukhne', () => {
      const concepts = extractMultilingualConcepts('chatit dukhne');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });
    it('42. asr: swas tras', () => {
      const concepts = extractMultilingualConcepts('swas tras ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });
    it('43. asr: shugar -> DIS_DIABETES', () => {
      const concepts = extractMultilingualConcepts('shugar chi goli');
      expect(concepts.some(c => c.conceptId === 'DIS_DIABETES')).toBe(true);
    });
    it('44. asr: thap aala', () => {
      const concepts = extractMultilingualConcepts('khup thap aala ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_FEVER')).toBe(true);
    });
    it('45. asr: dokadukhi', () => {
      const concepts = extractMultilingualConcepts('dokadukhi cha tras ahe');
      expect(concepts.some(c => c.conceptId === 'SYM_HEADACHE')).toBe(true);
    });

    // 9. Red flags
    it('46. red flag: chhatit dukhta + shwas tras', () => {
      const concepts = extractMultilingualConcepts('chhatit dukhtay aani shwas ghenyas tras');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_ACS_DYSPNEA')).toBe(true);
    });
    it('47. red flag: chhati vedna + chakkar', () => {
      const concepts = extractMultilingualConcepts('chhatit asahya vedna aani chakkar aali');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_CARDIAC_SYNCOPE')).toBe(true);
    });
    it('48. red flag: pakshaghat lakshane', () => {
      const concepts = extractMultilingualConcepts('ek baju thambli aani bolne ladkhadat ahe');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_ACUTE_STROKE')).toBe(true);
    });
    it('49. red flag: sandasat rakt', () => {
      const concepts = extractMultilingualConcepts('sandasat rakt yet ahe');
      const rf = evaluateRedFlags(concepts);
      expect(rf.some(r => r.ruleId === 'RED_FLAG_GI_BLEED')).toBe(true);
    });
    it('50. unknown words: non-medical Marathi text produces zero concepts', () => {
      const concepts = extractMultilingualConcepts('aaj aamhi shetat gelo hoto aani kam kele');
      expect(concepts.length).toBe(0);
    });
  });

  describe('Tamil (ta-IN) & Gujarati (gu-IN) NLP Validation', () => {
    it('Tamil: enakku nenju vali maps to SYM_CHEST_PAIN', () => {
      const concepts = extractMultilingualConcepts('enakku nenju vali romba irukku');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });

    it('Tamil: moochu thinarel maps to SYM_BREATHLESSNESS', () => {
      const concepts = extractMultilingualConcepts('moochu thinarel irukku');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });

    it('Tamil: negation with kidayathu / illai', () => {
      const concepts = extractMultilingualConcepts('BP kidayathu aanaal kaichal irukku');
      expect(concepts.find(c => c.conceptId === 'DIS_HYPERTENSION')?.assertion).toBe('negated');
      expect(concepts.find(c => c.conceptId === 'SYM_FEVER')?.assertion).toBe('affirmed');
    });

    it('Gujarati: chhatima dukhavo maps to SYM_CHEST_PAIN', () => {
      const concepts = extractMultilingualConcepts('chhatima dukhavo thayo che');
      expect(concepts.some(c => c.conceptId === 'SYM_CHEST_PAIN')).toBe(true);
    });

    it('Gujarati: shwas levama taklif maps to SYM_BREATHLESSNESS', () => {
      const concepts = extractMultilingualConcepts('shwas levama taklif che');
      expect(concepts.some(c => c.conceptId === 'SYM_BREATHLESSNESS')).toBe(true);
    });

    it('Gujarati: negation with nathi', () => {
      const concepts = extractMultilingualConcepts('BP nathi pan taav che');
      expect(concepts.find(c => c.conceptId === 'DIS_HYPERTENSION')?.assertion).toBe('negated');
      expect(concepts.find(c => c.conceptId === 'SYM_FEVER')?.assertion).toBe('affirmed');
    });
  });

});
