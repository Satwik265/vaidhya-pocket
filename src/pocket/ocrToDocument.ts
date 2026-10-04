// PHASE1-POCKET
import type { ExtractedDocumentData, ExtractedMedication } from '../types';
import { extractCanonicalFacts } from '../clinical/extractionPipeline';
import { evaluateRedFlagsFromFacts } from '../clinical/redFlagRules';
import { groundFacts } from './groundFacts';
import type { ClinicalDocumentType } from '../ocr/ocrProvider';

/**
 * Converts raw on-device OCR text into the document record used by the kiosk UI.
 * Only facts that survive verbatim grounding against the OCR text are kept. Nothing is invented.
 */
export function ocrTextToExtractedData(text: string, docType: ClinicalDocumentType, fallbackDate: string): ExtractedDocumentData {
  const facts = extractCanonicalFacts(text, { sourceType: 'UPLOADED_DOCUMENT', language: 'en' });
  const { grounded } = groundFacts(facts, text);

  const meds: ExtractedMedication[] = [];
  const diagnoses: string[] = [];
  for (const g of grounded) {
    const f = g.fact;
    if (f.assertion !== 'AFFIRMED') continue;
    const dom = String(f.domain).toLowerCase();
    if (dom === 'medication') {
      const a: any = f.attributes || {};
      meds.push({
        name: a.drugName || f.preferredTerm,
        dosage: [a.dose || a.dosage, a.unit].filter(Boolean).join(' ') || 'Not documented',
        frequency: a.frequency,
        duration: a.duration,
        status: 'active',
      });
    } else if (dom === 'condition') {
      diagnoses.push(f.preferredTerm);
    }
  }
  const dateMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/) || null;
  const flags = evaluateRedFlagsFromFacts(grounded.map((g) => g.fact)).map((a) => a.title);

  return {
    documentType: (['prescription', 'lab_report', 'discharge_summary'].includes(docType) ? docType : 'other') as ExtractedDocumentData['documentType'],
    documentDate: dateMatch ? dateMatch[0] : fallbackDate,
    extractedDateConfidence: dateMatch ? 'medium' : 'low',
    facilityOrDoctor: 'Not documented',
    diagnoses: Array.from(new Set(diagnoses)),
    medications: meds,
    investigations: [],
    clinicalSummary: `On-device OCR read ${text.trim().length} characters; ${grounded.length} fact(s) grounded in the document text. Clinician review required.`,
    criticalFlags: flags,
  };
}
