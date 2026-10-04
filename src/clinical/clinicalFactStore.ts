/**
 * Encounter-level ClinicalFact Store.
 *
 * Appends and indexes canonical ClinicalFact instances during an encounter.
 * CRITICAL INVARIANT: Preserves conflicting evidence (e.g. verbal denial vs. written history)
 * without destructive overwrites.
 */

import { ClinicalFact, FactDomain, FactAssertion } from './clinicalFactModel';

export class ClinicalFactStore {
  private facts: ClinicalFact[] = [];
  private encounterId?: string;

  constructor(encounterId?: string, initialFacts: ClinicalFact[] = []) {
    this.encounterId = encounterId;
    if (initialFacts.length > 0) {
      this.addFacts(initialFacts);
    }
  }

  /**
   * Appends a new fact to the encounter repository.
   * If a fact with identical canonicalId exists with conflicting assertion or source,
   * BOTH are preserved with full provenance.
   */
  addFact(fact: ClinicalFact): void {
    if (!fact || !fact.canonicalId) return;

    const factEvText = Array.isArray(fact.evidence)
      ? fact.evidence[0]?.text || fact.evidence[0]?.verbatimText
      : (fact.evidence as any)?.text;

    // Check for exact duplicate (same canonicalId, assertion, and exact evidence text)
    const isExactDuplicate = this.facts.some((f) => {
      const fEvText = Array.isArray(f.evidence)
        ? f.evidence[0]?.text || f.evidence[0]?.verbatimText
        : (f.evidence as any)?.text;
      return (
        f.canonicalId === fact.canonicalId &&
        f.assertion === fact.assertion &&
        fEvText === factEvText &&
        f.provenance.sourceType === fact.provenance.sourceType
      );
    });

    if (isExactDuplicate) {
      return;
    }

    const assigned: ClinicalFact = {
      ...fact,
      encounterId: fact.encounterId || this.encounterId,
    };

    this.facts.push(assigned);
  }

  addFacts(facts: ClinicalFact[]): void {
    for (const fact of facts) {
      this.addFact(fact);
    }
  }

  getFacts(): ClinicalFact[] {
    return [...this.facts];
  }

  getFactsByDomain(domain: FactDomain): ClinicalFact[] {
    return this.facts.filter((f) => f.domain === domain);
  }

  getAffirmedFacts(domain?: FactDomain): ClinicalFact[] {
    return this.facts.filter(
      (f) => f.assertion === 'AFFIRMED' && (!domain || f.domain === domain)
    );
  }

  getNegatedFacts(domain?: FactDomain): ClinicalFact[] {
    return this.facts.filter(
      (f) => f.assertion === 'NEGATED' && (!domain || f.domain === domain)
    );
  }

  hasFact(canonicalId: string, assertion?: FactAssertion): boolean {
    return this.facts.some(
      (f) => f.canonicalId === canonicalId && (!assertion || f.assertion === assertion)
    );
  }

  /**
   * Returns all recorded facts for a given canonical concept ID where
   * different assertions exist (e.g. one AFFIRMED and one NEGATED from different sources)
   * OR where contradictory status attributes exist (e.g. active vs discontinued).
   */
  getConflictingFacts(canonicalId: string): ClinicalFact[] {
    const matching = this.facts.filter((f) => f.canonicalId === canonicalId);
    if (matching.length < 2) return [];

    const distinctAssertions = new Set(matching.map((f) => f.assertion));
    if (distinctAssertions.size > 1) {
      return matching;
    }

    // Check for contradictory status or discontinuation attributes
    const statuses = matching.map((f) => {
      const attrs = f.attributes as any;
      if (attrs?.status) return attrs.status.toLowerCase();
      if (attrs?.isDiscontinued === true) return 'discontinued';
      const termOrVal = `${f.preferredTerm} ${f.value || ''}`.toLowerCase();
      if (termOrVal.includes('discontinued') || termOrVal.includes('stopped')) return 'discontinued';
      return 'active';
    });

    const distinctStatuses = new Set(statuses);
    if (distinctStatuses.size > 1) {
      return matching;
    }

    return [];
  }

  /**
   * Returns all concept conflicts detected across the entire encounter.
   */
  getAllConflicts(): Map<string, ClinicalFact[]> {
    const conflicts = new Map<string, ClinicalFact[]>();
    const allIds = new Set(this.facts.map((f) => f.canonicalId));
    for (const id of allIds) {
      const conf = this.getConflictingFacts(id);
      if (conf.length > 0) {
        conflicts.set(id, conf);
      }
    }
    return conflicts;
  }

  clear(): void {
    this.facts = [];
  }
}
