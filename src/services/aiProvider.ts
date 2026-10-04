/**
 * Clinical AI Provider Abstraction.
 *
 * Decouples frontend consumption from specific AI execution engines.
 * Supports sovereign local Python execution with no cloud augmentation.
 */

import { clinicalAIClient, ClinicalFact } from './clinicalAIClient';

export interface ClinicalExtractionOptions {
  language?: string;
  sourceId?: string;
}

export interface ClinicalAIProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  extractFacts(text: string, options?: ClinicalExtractionOptions): Promise<ClinicalFact[]>;
}

/**
 * Local sovereign Python/FastAPI extraction provider.
 * Operates on-device with deterministic NLP and guaranteed provenance.
 */
export class LocalPythonProvider implements ClinicalAIProvider {
  readonly name = 'LocalPythonProvider';

  async isAvailable(): Promise<boolean> {
    return clinicalAIClient.healthCheck();
  }

  async extractFacts(text: string, options?: ClinicalExtractionOptions): Promise<ClinicalFact[]> {
    return clinicalAIClient.extractClinicalFacts(
      text,
      options?.language || 'hi',
      options?.sourceId || 'encounter-live'
    );
  }
}


/**
 * Fallback used when the local sidecar is unreachable (e.g. on a phone with no Python core).
 * Returns no facts and never calls the network. Browser-side extraction lives in
 * src/clinical/extractionPipeline.ts and is used directly by the Pocket flow.
 */
export class NoNetworkFallbackProvider implements ClinicalAIProvider {
  readonly name = 'NoNetworkFallbackProvider';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async extractFacts(_text: string, _options?: ClinicalExtractionOptions): Promise<ClinicalFact[]> {
    return [];
  }
}

/**
 * Hybrid orchestrator: Prefers the sovereign local Python core, otherwise returns no facts (never cloud).
 */
export class HybridClinicalProvider implements ClinicalAIProvider {
  readonly name = 'HybridClinicalProvider';

  constructor(
    private localProvider: ClinicalAIProvider = new LocalPythonProvider(),
    private fallbackProvider: ClinicalAIProvider = new NoNetworkFallbackProvider()
  ) {}

  async isAvailable(): Promise<boolean> {
    const localAvailable = await this.localProvider.isAvailable();
    if (localAvailable) return true;
    return this.fallbackProvider.isAvailable();
  }

  async extractFacts(text: string, options?: ClinicalExtractionOptions): Promise<ClinicalFact[]> {
    const localUp = await this.localProvider.isAvailable();
    if (localUp) {
      return this.localProvider.extractFacts(text, options);
    }
    return this.fallbackProvider.extractFacts(text, options);
  }
}

export const activeClinicalProvider = new HybridClinicalProvider();
