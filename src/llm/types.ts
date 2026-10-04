// PHASE1-POCKET
export type LLMBackendKind = 'stub' | 'webllm' | 'native';

export interface LLMStats {
  tokensPerSec?: number;
  ttftMs?: number;
  totalMs?: number;
  outputTokens?: number;
}

export interface LocalLLM {
  readonly name: string;
  readonly backend: LLMBackendKind;
  /** Resolves true only when the model can actually run on this device right now. */
  isAvailable(): Promise<boolean>;
  generate(prompt: string, opts?: { maxTokens?: number; temperature?: number }): Promise<string>;
  stats(): LLMStats;
}

/** A fact as proposed by an LLM, before verification. */
export interface LLMProposedFact {
  category: 'symptom' | 'condition' | 'medication' | 'allergy' | 'vital' | 'investigation' | string;
  concept: string;
  assertion: 'AFFIRMED' | 'NEGATED' | 'SUSPECTED' | 'UNKNOWN' | string;
  evidence: string;
}

export interface GatedResult {
  kept: Array<LLMProposedFact & { start: number; end: number }>;
  dropped: Array<{ fact: LLMProposedFact; reason: 'evidence_not_in_transcript' | 'empty_evidence' | 'invalid_shape' }>;
  /** dropped / proposed, i.e. how much of the raw LLM output was not grounded in the transcript. */
  rawFabricationRate: number;
  /** After gating, always recomputed on the kept set; must be 0 by construction. */
  gatedFabricationRate: number;
  proposedCount: number;
  usedFallback: boolean;
  llmName: string;
  llmStats: LLMStats;
}
