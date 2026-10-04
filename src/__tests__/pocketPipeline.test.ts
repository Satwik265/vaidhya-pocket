// PHASE1-POCKET
import { describe, it, expect } from 'vitest';
import { runPocketPipeline, POCKET_SAMPLES, DEFAULT_PATIENT } from '../pocket/pipeline';
import { assertExportAllowed, buildFhirJson, exportFileName, soapToText } from '../pocket/export';
import { ocrTextToExtractedData } from '../pocket/ocrToDocument';

describe('pocket pipeline', () => {
  it('chest pain + breathlessness raises a CRITICAL red flag and grounds facts', () => {
    const r = runPocketPipeline(POCKET_SAMPLES[0].text);
    expect(r.redFlags.some((a) => a.ruleId === 'RED_FLAG_ACS_DYSPNEA')).toBe(true);
    expect(r.grounded.length).toBeGreaterThan(0);
    expect(r.timings.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('SOAP draft contains no canned diagnosis or complaint the patient did not say', () => {
    const r = runPocketPipeline(POCKET_SAMPLES[1].text); // fever + headache, no rigors
    expect(r.soap.subjective.chief_complaint.toLowerCase()).not.toContain('rigors');
    expect(r.soap.assessment.primary_diagnosis).toMatch(/Not established/);
    expect(r.soap.plan.prescriptions).toEqual([]);
    expect(r.soap.billing_suggestions).toBeUndefined();
  });

  it('negated symptom is not listed as the chief complaint', () => {
    const r = runPocketPipeline('Bukhar nahi hai. Sar dard hai.');
    expect(r.soap.subjective.chief_complaint.toLowerCase()).not.toContain('bukhar');
  });

  it('every grounded span is an exact substring of the transcript', () => {
    for (const s of POCKET_SAMPLES) {
      const r = runPocketPipeline(s.text);
      for (const g of r.grounded) expect(r.transcript.slice(g.span.start, g.span.end)).toBe(g.span.text);
    }
  });
});

describe('approval-gated export', () => {
  const r = runPocketPipeline(POCKET_SAMPLES[2].text);
  const facts = r.grounded.map((g) => g.fact);

  it('blocks export before approval', () => {
    expect(() => buildFhirJson('AI_DRAFT', DEFAULT_PATIENT, r.soap, facts)).toThrow(/EXPORT_BLOCKED/);
    expect(() => buildFhirJson('REVIEWING', DEFAULT_PATIENT, r.soap, facts)).toThrow(/EXPORT_BLOCKED/);
    expect(() => assertExportAllowed('APPROVED')).not.toThrow();
  });

  it('after approval produces a FHIR Bundle with a Patient', () => {
    const b = JSON.parse(buildFhirJson('APPROVED', DEFAULT_PATIENT, r.soap, facts));
    expect(b.resourceType).toBe('Bundle');
    expect(b.entry.some((e: any) => e.resource.resourceType === 'Patient')).toBe(true);
  });

  it('file name follows the Office Kit convention', () => {
    expect(exportFileName('json', 'enc1', new Date(2026, 9, 9, 14, 5))).toBe('vaidhya_enc1_20261009-1405.json');
    expect(soapToText(r.soap)).toContain('SOAP NOTE');
  });
});

describe('ocr text -> document', () => {
  it('extracts only grounded medications and never invents', () => {
    const d = ocrTextToExtractedData('Rx\nTab. Metformin 500mg BD\nTab. Paracetamol 500mg SOS', 'prescription', '2026-10-04');
    expect(d.documentType).toBe('prescription');
    expect(d.medications.length).toBeGreaterThan(0);
    expect(d.diagnoses).toEqual([]);
  });
  it('blank text gives an empty record', () => {
    const d = ocrTextToExtractedData('   ', 'unknown', '2026-10-04');
    expect(d.medications).toEqual([]);
    expect(d.documentType).toBe('other');
  });
});
