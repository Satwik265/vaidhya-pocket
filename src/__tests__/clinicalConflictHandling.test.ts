/**
 * Clinical Conflict Handling and Non-Destructive Preservation Test Suite.
 *
 * Validates Phase 8.5-F requirements:
 * 1. Document Rx Metformin 500mg BD (AFFIRMED, UPLOADED_DOCUMENT).
 * 2. Patient verbal discontinuation "Metformin maine band kar di" (NEGATED, PATIENT_VOICE).
 * 3. Both facts are preserved without silent overwrite in ClinicalFactStore.
 * 4. Conflict is surfaced explicitly via getConflictingFacts() and getAllConflicts().
 * 5. Full provenance, evidence spans, and attributes are preserved for both facts.
 */

import { describe, it, expect } from 'vitest';
import { ClinicalFactStore } from '../clinical/clinicalFactStore';
import {
  extractMedicationFacts,
  extractCanonicalFacts,
} from '../clinical/extractionPipeline';
import { createClinicalFact } from '../clinical/clinicalFactModel';

describe('Clinical Conflict Handling (Phase 8.5-F)', () => {
  it('detects verbal discontinuation and emits NEGATED assertion with discontinued status', () => {
    const patientUtterance = 'Metformin maine band kar di';
    const facts = extractMedicationFacts(patientUtterance, {
      sourceType: 'PATIENT_VOICE',
      language: 'hi',
    });

    expect(facts.length).toBeGreaterThanOrEqual(1);
    const metforminFact = facts.find((f) => f.canonicalId === 'RX_METFORMIN');
    expect(metforminFact).toBeDefined();
    expect(metforminFact?.assertion).toBe('NEGATED');
    expect(metforminFact?.provenance.sourceType).toBe('PATIENT_VOICE');
    expect(metforminFact?.attributes).toBeDefined();
    expect((metforminFact?.attributes as any)?.status).toBe('discontinued');
    expect((metforminFact?.attributes as any)?.isDiscontinued).toBe(true);
    expect(metforminFact?.evidence[0].text).toContain('band kar di');
  });

  it('preserves both documented Rx and patient verbal discontinuation without silent overwrite', () => {
    const store = new ClinicalFactStore('encounter-test-conflict-01');

    // 1. Fact from uploaded prescription document: Tab Metformin 500mg BD
    const documentText = 'Tab. Metformin 500mg BD';
    const docFacts = extractMedicationFacts(documentText, {
      sourceType: 'UPLOADED_DOCUMENT',
      sourceId: 'doc-rx-scan-001',
      language: 'en',
    });

    expect(docFacts.length).toBeGreaterThanOrEqual(1);
    const docMetformin = docFacts.find((f) => f.canonicalId === 'RX_METFORMIN');
    expect(docMetformin).toBeDefined();
    expect(docMetformin?.assertion).toBe('AFFIRMED');
    expect(docMetformin?.provenance.sourceType).toBe('UPLOADED_DOCUMENT');
    expect((docMetformin?.attributes as any)?.dose).toBe('500');
    expect((docMetformin?.attributes as any)?.frequency).toBe('BD');

    // Add document fact to store
    store.addFact(docMetformin!);

    // 2. Fact from live patient speech intake: "Metformin maine band kar di"
    const verbalText = 'Metformin maine band kar di';
    const voiceFacts = extractMedicationFacts(verbalText, {
      sourceType: 'PATIENT_VOICE',
      sourceId: 'audio-turn-003',
      language: 'hi',
    });

    expect(voiceFacts.length).toBeGreaterThanOrEqual(1);
    const voiceMetformin = voiceFacts.find((f) => f.canonicalId === 'RX_METFORMIN');
    expect(voiceMetformin).toBeDefined();
    expect(voiceMetformin?.assertion).toBe('NEGATED');
    expect(voiceMetformin?.provenance.sourceType).toBe('PATIENT_VOICE');

    // Add verbal fact to store
    store.addFact(voiceMetformin!);

    // 3. Assert BOTH facts are preserved in the ClinicalFactStore
    const allStoredFacts = store.getFacts();
    expect(allStoredFacts.length).toBe(2);

    // Assert both sources remain intact
    const storedDocFact = allStoredFacts.find(
      (f) => f.provenance.sourceType === 'UPLOADED_DOCUMENT'
    );
    const storedVoiceFact = allStoredFacts.find(
      (f) => f.provenance.sourceType === 'PATIENT_VOICE'
    );

    expect(storedDocFact).toBeDefined();
    expect(storedVoiceFact).toBeDefined();

    expect(storedDocFact?.assertion).toBe('AFFIRMED');
    expect(storedVoiceFact?.assertion).toBe('NEGATED');

    // 4. Conflict detection query
    const conflicts = store.getConflictingFacts('RX_METFORMIN');
    expect(conflicts.length).toBe(2);

    const allConflictsMap = store.getAllConflicts();
    expect(allConflictsMap.has('RX_METFORMIN')).toBe(true);
    expect(allConflictsMap.get('RX_METFORMIN')?.length).toBe(2);
  });

  it('detects multiple language variants of medication discontinuation', () => {
    const testCases = [
      { text: 'Maine Metformin lena band kar diya', expectedAssertion: 'NEGATED' },
      { text: 'I have stopped taking Metformin', expectedAssertion: 'NEGATED' },
      { text: 'Metformin discontinued last week', expectedAssertion: 'NEGATED' },
      { text: 'Tab Metformin 500mg nahi le raha', expectedAssertion: 'NEGATED' },
      { text: 'Metformin 500mg le raha hu roz', expectedAssertion: 'AFFIRMED' },
    ];

    for (const tc of testCases) {
      const facts = extractMedicationFacts(tc.text, {
        sourceType: 'PATIENT_VOICE',
      });
      const metFact = facts.find((f) => f.canonicalId === 'RX_METFORMIN');
      expect(metFact).toBeDefined();
      expect(metFact?.assertion).toBe(tc.expectedAssertion);
    }
  });

  it('surfaces status conflict when both are affirmed but have divergent status attributes', () => {
    const store = new ClinicalFactStore('encounter-test-status-conflict');

    const activeFact = createClinicalFact({
      domain: 'medication',
      canonicalId: 'RX_AMLODIPINE',
      preferredTerm: 'Amlodipine 5mg',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      attributes: { status: 'active', dose: '5mg' },
      provenance: { sourceType: 'UPLOADED_DOCUMENT', extractionEngine: 'doc_ocr', confidence: 0.95, timestamp: new Date().toISOString() },
    });

    const discontinuedFact = createClinicalFact({
      domain: 'medication',
      canonicalId: 'RX_AMLODIPINE',
      preferredTerm: 'Amlodipine discontinued',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      attributes: { status: 'discontinued', isDiscontinued: true },
      provenance: { sourceType: 'PATIENT_VOICE', extractionEngine: 'speech_nlp', confidence: 0.95, timestamp: new Date().toISOString() },
    });

    store.addFact(activeFact);
    store.addFact(discontinuedFact);

    const conflicts = store.getConflictingFacts('RX_AMLODIPINE');
    expect(conflicts.length).toBe(2);
  });
});
