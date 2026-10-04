import { describe, it, expect } from 'vitest';
import {
  SovereignClinicalStorageEngine,
  EncounterRepository,
  ClinicalFactRepository,
} from '../storage/clinicalRepositories';
import { createClinicalFact } from '../clinical/clinicalFactModel';

describe('Phase 8M — Sovereign Clinical Storage & Physician Approval Gate', () => {
  it('1. initializes encounter in AI_DRAFT state and LOCAL_ONLY sync status', () => {
    const engine = new SovereignClinicalStorageEngine();
    const enc = engine.encounters.create('pat-100');

    expect(enc.state).toBe('AI_DRAFT');
    expect(enc.syncStatus).toBe('LOCAL_ONLY');
    expect(enc.syncAttempts).toBe(0);
  });

  it('2. strictly prohibits export before physician approval', () => {
    const engine = new SovereignClinicalStorageEngine();
    const enc = engine.encounters.create('pat-101');

    expect(() => {
      engine.exportEncounter(enc.id, 'actor-exporter');
    }).toThrowError(/Cannot export encounter in state 'AI_DRAFT'/);
  });

  it('3. transitions AI_DRAFT -> APPROVED -> EXPORTED with audit log tracking', () => {
    const engine = new SovereignClinicalStorageEngine();
    const enc = engine.encounters.create('pat-102');

    // Approve
    const approved = engine.approveEncounter(enc.id, 'dr-kapoor');
    expect(approved.state).toBe('APPROVED');
    expect(approved.approvedBy).toBe('dr-kapoor');
    expect(approved.syncStatus).toBe('PENDING_SYNC');

    // Export
    const exported = engine.exportEncounter(enc.id, 'dr-kapoor');
    expect(exported.state).toBe('EXPORTED');

    // Verify audit logs
    const logs = engine.audit.getLogsForEncounter(enc.id);
    expect(logs.length).toBe(2);
    expect(logs.some((l) => l.action === 'APPROVE')).toBe(true);
    expect(logs.some((l) => l.action === 'EXPORT')).toBe(true);
  });

  it('4. strictly prohibits modifying facts on an APPROVED encounter without new revision', () => {
    const engine = new SovereignClinicalStorageEngine();
    const enc = engine.encounters.create('pat-103');

    const fact = createClinicalFact({
      factId: 'fact-chest-pain',
      domain: 'symptom',
      canonicalId: 'SYM_CHEST_PAIN',
      preferredTerm: 'Chest Pain',
      assertion: 'AFFIRMED',
      elicitation: 'ELICITED',
      temporality: 'CURRENT',
      evidence: [
        {
          text: 'chest pain',
          verbatimText: 'chest pain',
          startOffset: 0,
          endOffset: 10,
        },
      ],
      provenance: {
        sourceType: 'PATIENT_VOICE',
        language: 'en',
        extractionEngine: 'test',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      },
    });

    // Save in draft state -> succeeds
    engine.facts.saveFact(fact, enc.id);
    expect(engine.facts.getFactsForEncounter(enc.id).length).toBe(1);

    // Approve encounter
    engine.approveEncounter(enc.id, 'dr-kapoor');

    // Attempting to save new fact on approved encounter -> MUST throw error
    expect(() => {
      engine.facts.saveFact(fact, enc.id);
    }).toThrowError(/Cannot modify facts on encounter/);
  });

  it('5. resolves conflicts in favor of local physician edits over remote cloud updates', () => {
    const engine = new SovereignClinicalStorageEngine();
    const localFact = {
      id: 'fact-htn',
      encounterId: 'enc-1',
      domain: 'condition' as const,
      canonicalCode: 'COND_HYPERTENSION',
      term: 'Hypertension (Local Physician Confirmed)',
      assertion: 'AFFIRMED' as const,
      elicitation: 'ELICITED' as const,
      temporality: 'CHRONIC' as const,
      experiencer: 'PATIENT' as const,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
    };

    const remotePayload = {
      term: 'Hypertension (Remote AI Guess)',
      confidence: 0.6,
      assertion: 'NEGATED' as const,
    };

    // When edited locally by physician, local fact ALWAYS wins
    const resolved = engine.resolveConflict(localFact, remotePayload, true);
    expect(resolved.term).toBe('Hypertension (Local Physician Confirmed)');
    expect(resolved.assertion).toBe('AFFIRMED');
    expect(resolved.confidence).toBe(1.0);
  });

  it('6. enqueues and tracks sync status in SyncQueueRepository', () => {
    const engine = new SovereignClinicalStorageEngine();
    const item = engine.syncQueue.enqueue('ENCOUNTER', 'enc-200', 'CREATE', { state: 'APPROVED' });

    expect(item.status).toBe('PENDING');
    const pending = engine.syncQueue.peekPending();
    expect(pending.length).toBe(1);

    engine.syncQueue.markStatus(item.id, 'SYNCING');
    expect(item.retryCount).toBe(1);

    engine.syncQueue.markStatus(item.id, 'SYNCED');
    expect(engine.syncQueue.peekPending().length).toBe(0);
  });
});
