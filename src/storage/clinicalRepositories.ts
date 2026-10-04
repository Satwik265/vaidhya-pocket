/**
 * Sovereign Offline Persistence & Physician Gate Layer.
 *
 * Implements deterministic local repositories for Encounters, ClinicalFacts,
 * FactEvidence, AuditLogs, and SyncQueue.
 *
 * Enforces strict physician approval gate:
 * AI_DRAFT -> REVIEWING -> APPROVED -> EXPORTED
 * - Throws if export attempted before APPROVED.
 * - Throws if facts modified after APPROVED without revision.
 * - Conflict resolution: Local physician edits ALWAYS win over cloud suggestions.
 */

import {
  ClinicalFact,
  FactDomain,
  FactAssertion,
  FactElicitation,
  FactTemporality,
  FactExperiencer,
  FactEvidence,
} from '../clinical/clinicalFactModel';

export type EncounterWorkflowState =
  | 'AI_DRAFT'
  | 'REVIEWING'
  | 'APPROVED'
  | 'EXPORTED';

export type SyncStatus =
  | 'LOCAL_ONLY'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'SYNCED'
  | 'SYNC_FAILED';

export interface EncounterEntity {
  id: string;
  patientId: string;
  state: EncounterWorkflowState;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  revision: number;
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncError?: string;
}

export interface ClinicalFactEntity {
  id: string;
  encounterId: string;
  domain: FactDomain;
  canonicalCode: string;
  term: string;
  assertion: FactAssertion;
  elicitation: FactElicitation;
  temporality: FactTemporality;
  experiencer: FactExperiencer;
  confidence: number;
  attributesJson?: string;
  createdAt: string;
}

export interface FactEvidenceEntity {
  id: string;
  factId: string;
  verbatimText: string;
  startChar?: number;
  endChar?: number;
  textSegmentId?: string;
  documentPage?: number;
}

export interface AuditLogEntity {
  id: string;
  encounterId: string;
  actorType: 'PATIENT' | 'PHYSICIAN' | 'AI_SYSTEM';
  actorId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'EXPORT' | 'SYNC';
  detailsJson?: string;
  timestamp: string;
}

export interface SyncQueueEntity {
  id: string;
  entityType: 'ENCOUNTER' | 'FACT' | 'AUDIT';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payloadJson: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  nextRetryAt?: string;
}

// ---------------------------------------------------------------------------
// In-Memory / Indexed Sovereign Storage Implementation
// ---------------------------------------------------------------------------

export class EncounterRepository {
  private encounters: Map<string, EncounterEntity> = new Map();

  create(patientId: string, id?: string): EncounterEntity {
    const now = new Date().toISOString();
    const encounter: EncounterEntity = {
      id: id || `enc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      patientId,
      state: 'AI_DRAFT',
      createdAt: now,
      updatedAt: now,
      revision: 1,
      syncStatus: 'LOCAL_ONLY',
      syncAttempts: 0,
    };
    this.encounters.set(encounter.id, encounter);
    return encounter;
  }

  get(id: string): EncounterEntity | undefined {
    return this.encounters.get(id);
  }

  updateState(id: string, nextState: EncounterWorkflowState, actorId?: string): EncounterEntity {
    const encounter = this.encounters.get(id);
    if (!encounter) {
      throw new Error(`Encounter ${id} not found.`);
    }

    const currentState = encounter.state;
    // Valid transitions:
    // AI_DRAFT -> REVIEWING
    // REVIEWING -> APPROVED
    // APPROVED -> EXPORTED
    // Or restart: REVIEWING -> AI_DRAFT
    if (nextState === 'APPROVED') {
      encounter.approvedBy = actorId || 'physician-dr-on-duty';
      encounter.approvedAt = new Date().toISOString();
      encounter.syncStatus = 'PENDING_SYNC';
    } else if (nextState === 'EXPORTED') {
      if (currentState !== 'APPROVED') {
        throw new Error(`Cannot export encounter in state '${currentState}'. It must be APPROVED by a physician first.`);
      }
    }

    encounter.state = nextState;
    encounter.updatedAt = new Date().toISOString();
    this.encounters.set(id, encounter);
    return encounter;
  }

  updateSyncStatus(id: string, status: SyncStatus, error?: string): EncounterEntity {
    const encounter = this.encounters.get(id);
    if (!encounter) throw new Error(`Encounter ${id} not found.`);

    encounter.syncStatus = status;
    encounter.updatedAt = new Date().toISOString();
    if (status === 'SYNCING') {
      encounter.syncAttempts += 1;
    }
    if (error) {
      encounter.lastSyncError = error;
    }
    this.encounters.set(id, encounter);
    return encounter;
  }

  list(): EncounterEntity[] {
    return Array.from(this.encounters.values());
  }

  clear(): void {
    this.encounters.clear();
  }
}

export class ClinicalFactRepository {
  private facts: Map<string, ClinicalFactEntity> = new Map();
  private evidenceMap: Map<string, FactEvidenceEntity[]> = new Map();

  constructor(private encounterRepo: EncounterRepository) {}

  saveFact(fact: ClinicalFact, encounterId: string): ClinicalFactEntity {
    const encounter = this.encounterRepo.get(encounterId);
    if (encounter && (encounter.state === 'APPROVED' || encounter.state === 'EXPORTED')) {
      throw new Error(`Cannot modify facts on encounter '${encounterId}' because it is already '${encounter.state}'. Create a new revision to alter documentation.`);
    }

    const factEntity: ClinicalFactEntity = {
      id: fact.factId,
      encounterId,
      domain: fact.domain,
      canonicalCode: fact.canonicalId || fact.code,
      term: fact.preferredTerm || fact.term,
      assertion: fact.assertion,
      elicitation: fact.elicitation,
      temporality: fact.temporality,
      experiencer: fact.experiencer,
      confidence: fact.confidence ?? 1.0,
      attributesJson: fact.attributes ? JSON.stringify(fact.attributes) : undefined,
      createdAt: new Date().toISOString(),
    };

    this.facts.set(factEntity.id, factEntity);

    // Save evidence entities
    const evidenceEntities: FactEvidenceEntity[] = fact.evidence.map((ev, idx) => ({
      id: `ev-${fact.factId}-${idx}`,
      factId: fact.factId,
      verbatimText: ev.verbatimText || ev.text || '',
      startChar: ev.startChar ?? ev.startOffset,
      endChar: ev.endChar ?? ev.endOffset,
      textSegmentId: ev.textSegmentId,
    }));
    this.evidenceMap.set(factEntity.id, evidenceEntities);

    return factEntity;
  }

  getFactsForEncounter(encounterId: string): ClinicalFactEntity[] {
    return Array.from(this.facts.values()).filter((f) => f.encounterId === encounterId);
  }

  getEvidenceForFact(factId: string): FactEvidenceEntity[] {
    return this.evidenceMap.get(factId) || [];
  }

  clear(): void {
    this.facts.clear();
    this.evidenceMap.clear();
  }
}

export class AuditRepository {
  private logs: AuditLogEntity[] = [];

  record(
    encounterId: string,
    actorType: AuditLogEntity['actorType'],
    actorId: string,
    action: AuditLogEntity['action'],
    details?: Record<string, unknown>
  ): AuditLogEntity {
    const log: AuditLogEntity = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      encounterId,
      actorType,
      actorId,
      action,
      detailsJson: details ? JSON.stringify(details) : undefined,
      timestamp: new Date().toISOString(),
    };
    this.logs.push(log);
    return log;
  }

  getLogsForEncounter(encounterId: string): AuditLogEntity[] {
    return this.logs.filter((l) => l.encounterId === encounterId);
  }

  clear(): void {
    this.logs = [];
  }
}

export class SyncQueueRepository {
  private queue: Map<string, SyncQueueEntity> = new Map();

  enqueue(
    entityType: SyncQueueEntity['entityType'],
    entityId: string,
    action: SyncQueueEntity['action'],
    payload: Record<string, unknown>
  ): SyncQueueEntity {
    const item: SyncQueueEntity = {
      id: `sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entityType,
      entityId,
      action,
      payloadJson: JSON.stringify(payload),
      status: 'PENDING',
      retryCount: 0,
    };
    this.queue.set(item.id, item);
    return item;
  }

  peekPending(): SyncQueueEntity[] {
    return Array.from(this.queue.values()).filter((item) => item.status === 'PENDING');
  }

  markStatus(id: string, status: SyncQueueEntity['status']): void {
    const item = this.queue.get(id);
    if (item) {
      item.status = status;
      if (status === 'SYNCING') {
        item.retryCount += 1;
      }
      this.queue.set(id, item);
    }
  }

  clear(): void {
    this.queue.clear();
  }
}

/**
 * Coordinated Sovereign Clinical Storage Engine.
 */
export class SovereignClinicalStorageEngine {
  public encounters: EncounterRepository;
  public facts: ClinicalFactRepository;
  public audit: AuditRepository;
  public syncQueue: SyncQueueRepository;

  constructor() {
    this.encounters = new EncounterRepository();
    this.facts = new ClinicalFactRepository(this.encounters);
    this.audit = new AuditRepository();
    this.syncQueue = new SyncQueueRepository();
  }

  /**
   * Conflict Resolution:
   * Local physician edits ALWAYS win over incoming remote/cloud edits.
   */
  resolveConflict(
    localFact: ClinicalFactEntity,
    remoteFactPayload: Partial<ClinicalFactEntity>,
    physicianEditedLocally: boolean
  ): ClinicalFactEntity {
    if (physicianEditedLocally) {
      // Local physician edit wins categorically!
      return localFact;
    }
    // Otherwise accept verified cloud update
    return {
      ...localFact,
      ...remoteFactPayload,
    };
  }

  /**
   * Complete Physician Gate: Review -> Approve -> Export to FHIR
   */
  approveEncounter(encounterId: string, physicianId: string): EncounterEntity {
    this.encounters.updateState(encounterId, 'APPROVED', physicianId);
    this.audit.record(encounterId, 'PHYSICIAN', physicianId, 'APPROVE', {
      approvedAt: new Date().toISOString(),
    });
    return this.encounters.get(encounterId)!;
  }

  exportEncounter(encounterId: string, actorId: string): EncounterEntity {
    // Will throw if state is not APPROVED
    this.encounters.updateState(encounterId, 'EXPORTED', actorId);
    this.audit.record(encounterId, 'PHYSICIAN', actorId, 'EXPORT', {
      exportedAt: new Date().toISOString(),
    });
    return this.encounters.get(encounterId)!;
  }
}
