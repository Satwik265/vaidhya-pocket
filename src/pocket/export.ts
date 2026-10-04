// PHASE1-POCKET
import type { PatientInfo, SOAPNote } from '../types';
import type { ClinicalFact } from '../clinical/clinicalFactModel';
import { exportToFHIRBundle } from '../utils/fhirConverter';

export type ApprovalState = 'AI_DRAFT' | 'REVIEWING' | 'APPROVED' | 'EXPORTED';

export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function exportFileName(kind: 'json' | 'html', encounterId: string, d = new Date()): string {
  return `vaidhya_${encounterId}_${stamp(d)}.${kind}`;
}

/** Export is only permitted after clinician approval. */
export function assertExportAllowed(state: ApprovalState): void {
  if (state !== 'APPROVED' && state !== 'EXPORTED') {
    throw new Error('EXPORT_BLOCKED: clinician approval required before export.');
  }
}

export function buildFhirJson(state: ApprovalState, patient: PatientInfo, soap: SOAPNote, facts: ClinicalFact[]): string {
  assertExportAllowed(state);
  const bundle = exportToFHIRBundle(patient, soap, { canonicalFacts: facts, isPhysicianVerified: true });
  return JSON.stringify(bundle, null, 2);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export function soapToText(soap: SOAPNote): string {
  const s = soap.subjective;
  return [
    'SOAP NOTE (clinician-approved draft)',
    `S: ${s.chief_complaint}`,
    `   HPI: ${s.history_of_present_illness}`,
    `   Medications: ${(s.current_medications || []).join(', ') || 'None documented'}`,
    `   Allergies: ${(s.allergies || []).join(', ') || 'Not documented'}`,
    `O: Vitals: ${soap.objective.vital_signs}`,
    `A: ${soap.assessment.primary_diagnosis}`,
    `P: ${soap.plan.follow_up || 'Per clinician'}`,
  ].join('\n');
}

export function soapToHtml(soap: SOAPNote, patientName: string): string {
  return `<!doctype html><meta charset="utf-8"><title>SOAP - ${esc(patientName)}</title><body style="font-family:system-ui;max-width:720px;margin:24px auto;line-height:1.5"><h2>SOAP note: ${esc(patientName)}</h2><pre style="white-space:pre-wrap">${esc(soapToText(soap))}</pre><p><small>Documentation assistant output. Approved by clinician. Synthetic demo data.</small></p></body>`;
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
