// PHASE1-POCKET
import React, { useMemo, useRef, useState } from 'react';
import { DeviceProofPanel, type OfficeKitCounters } from './DeviceProofPanel';
import { ImportFromLaptop, ExportToLaptop } from './OfficeKit';
import { runPocketPipeline, POCKET_SAMPLES, DEFAULT_PATIENT, type PocketResult } from '../../pocket/pipeline';
import { runGatedPipeline } from '../../llm/gatedPipeline';
import { StubLLM } from '../../llm/stubLLM';
import { WebLLMBackend } from '../../llm/webllmBackend';
import type { GatedResult, LocalLLM } from '../../llm/types';
import { browserOcr } from '../../ocr/browserOcr';
import { extractCanonicalFacts } from '../../clinical/extractionPipeline';
import {
  type ApprovalState,
  buildFhirJson,
  copyToClipboard,
  downloadText,
  exportFileName,
  soapToHtml,
  soapToText,
} from '../../pocket/export';

function Highlighted({ text, spans }: { text: string; spans: Array<{ start: number; end: number; negated: boolean }> }) {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cur = 0;
  sorted.forEach((s, i) => {
    if (s.start < cur) return;
    if (s.start > cur) parts.push(<span key={`t${i}`}>{text.slice(cur, s.start)}</span>);
    parts.push(
      <mark key={`m${i}`} className={`px-0.5 rounded ${s.negated ? 'bg-sky-200' : 'bg-yellow-200'}`}>
        {text.slice(s.start, s.end)}
      </mark>
    );
    cur = s.end;
  });
  if (cur < text.length) parts.push(<span key="end">{text.slice(cur)}</span>);
  return <p className="whitespace-pre-wrap leading-relaxed text-slate-800" data-testid="highlighted">{parts}</p>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
      <h2 className="font-bold text-slate-900 flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PocketApp() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const wantWebLLM = /[?&]llm=webllm/.test(search);

  const [text, setText] = useState('');
  const [result, setResult] = useState<PocketResult | null>(null);
  const [state, setState] = useState<ApprovalState>('AI_DRAFT');
  const [office, setOffice] = useState<OfficeKitCounters>({ imports: 0, exports: 0, copies: 0 });
  const [gated, setGated] = useState<GatedResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState('');
  const [ocrMs, setOcrMs] = useState<{ preprocess: number; ocr: number } | undefined>();
  const [llmBusy, setLlmBusy] = useState(false);
  const [llmMsg, setLlmMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const llm: LocalLLM = useMemo(() => (wantWebLLM ? new WebLLMBackend(undefined, (p) => setLlmMsg(`Loading model ${(p * 100).toFixed(0)}%`)) : new StubLLM(2, 'Demo model (stub, not a real LLM)')), [wantWebLLM]);

  const analyse = (input = text) => {
    if (!input.trim()) return;
    setResult(runPocketPipeline(input, DEFAULT_PATIENT));
    setGated(null);
    setState('AI_DRAFT');
  };

  const onScan = async (file?: File | null) => {
    if (!file) return;
    setOcrBusy(true);
    setOcrMsg('Reading on-device...');
    try {
      const b64: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(new Error('read failed'));
        r.readAsDataURL(file);
      });
      const ocr = await browserOcr.extractText({ kind: 'document', fileBase64: b64, fileName: file.name, mimeType: file.type || 'image/jpeg' });
      setOcrMs(browserOcr.lastStageMs);
      const next = text ? `${text}\n${ocr.text}` : ocr.text;
      setText(next);
      setOcrMsg(`Scanned ${ocr.text.length} characters on-device (${Math.round(ocr.latencyMs)} ms). Review the text, then analyse.`);
    } catch (e: any) {
      setOcrMsg(String(e?.message || 'OCR_FAILED'));
    } finally {
      setOcrBusy(false);
    }
  };

  const runLlm = async () => {
    if (!result) return;
    setLlmBusy(true);
    setLlmMsg('');
    try {
      const g = await runGatedPipeline(llm, result.transcript);
      setGated(g);
      if (g.usedFallback) setLlmMsg('LLM unavailable or invalid output. Using the rule engine only.');
    } catch (e: any) {
      setLlmMsg(String(e?.message || 'LLM error'));
    } finally {
      setLlmBusy(false);
    }
  };

  const spans = (result?.grounded || []).map((g) => ({ start: g.span.start, end: g.span.end, negated: g.fact.assertion === 'NEGATED' }));
  const encId = result?.grounded[0]?.fact.encounterId || 'enc';

  const fhir = () => {
    if (!result) return;
    downloadText(exportFileName('json', encId), buildFhirJson(state, DEFAULT_PATIENT, result.soap, result.grounded.map((g) => g.fact)), 'application/json');
    setOffice((o) => ({ ...o, exports: o.exports + 1 }));
    setState('EXPORTED');
  };
  const html = () => {
    if (!result) return;
    downloadText(exportFileName('html', encId), soapToHtml(result.soap, DEFAULT_PATIENT.name), 'text/html');
    setOffice((o) => ({ ...o, exports: o.exports + 1 }));
  };
  const copy = async () => {
    if (!result) return;
    if (await copyToClipboard(soapToText(result.soap))) setOffice((o) => ({ ...o, copies: o.copies + 1 }));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <DeviceProofPanel timings={result?.timings} ocrMs={ocrMs} llmLabel={llm.name} llmStats={gated?.llmStats} office={office} />
      <main className="max-w-md mx-auto p-3 space-y-3">
        <header className="pt-2">
          <h1 className="text-2xl font-extrabold">Vaidhya Pocket</h1>
          <p className="text-sm text-slate-600">On-device clinical scribe. Every fact must quote the patient's own words.</p>
          <p className="text-xs text-amber-700 mt-1">Documentation assistant only. Not a diagnosis. Synthetic demo data.</p>
        </header>

        <Step n={1} title="Input">
          <div className="flex gap-2 flex-wrap">
            {POCKET_SAMPLES.map((s) => (
              <button key={s.id} className="min-h-[48px] px-3 rounded-xl bg-slate-200 text-sm font-medium" onClick={() => { setText(s.text); analyse(s.text); }}>
                {s.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Type or paste the consultation (Hindi, Hinglish, Marathi or English)"
            className="w-full rounded-xl border border-slate-300 p-3 text-base"
            data-testid="transcript-input"
          />
          <div className="flex gap-2 flex-wrap items-center">
            <button disabled className="min-h-[48px] px-4 rounded-xl bg-slate-300 text-slate-600" title="On-device speech model is part of the Finale build">
              Mic (on-device ASR: Finale build)
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={ocrBusy} className="min-h-[48px] px-4 rounded-xl bg-slate-800 text-white font-semibold" data-testid="scan-btn">
              {ocrBusy ? 'Scanning...' : 'Scan document'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onScan(e.target.files?.[0])} />
            <ImportFromLaptop onImport={(t) => { setText(t); setOffice((o) => ({ ...o, imports: o.imports + 1 })); analyse(t); }} />
          </div>
          {ocrMsg && <p className="text-xs text-slate-600" data-testid="ocr-msg">{ocrMsg}</p>}
          <button onClick={() => analyse()} className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-bold" data-testid="analyse-btn">
            Analyse on this device
          </button>
        </Step>

        {result && (
          <>
            <Step n={2} title={`Facts quoted from the transcript (${result.grounded.length})`}>
              <Highlighted text={result.transcript} spans={spans} />
              <ul className="space-y-2" data-testid="fact-list">
                {result.grounded.map((g) => (
                  <li key={g.fact.factId + g.span.start} className="rounded-xl border border-slate-200 p-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <b>{g.fact.preferredTerm}</b>
                      <span className={`text-xs px-2 rounded-full ${g.fact.assertion === 'NEGATED' ? 'bg-sky-100 text-sky-800' : 'bg-yellow-100 text-yellow-900'}`}>{g.fact.assertion}</span>
                    </div>
                    <div className="text-slate-600">"{g.span.text}"</div>
                    {g.conflict && <div className="text-xs text-red-700">Conflicting mentions. Clinician must confirm.</div>}
                  </li>
                ))}
              </ul>
              {result.rejected.length > 0 && (
                <p className="text-xs text-slate-500" data-testid="rejected-note">
                  {result.rejected.length} candidate fact(s) withheld: no exact quote in the transcript, a partial-word match, or a duplicate.
                </p>
              )}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">Raw LLM vs evidence-gated</b>
                  <button onClick={runLlm} disabled={llmBusy} className="min-h-[48px] px-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold" data-testid="run-llm">
                    {llmBusy ? 'Running...' : `Run ${llm.backend === 'stub' ? 'demo model' : 'local LLM'}`}
                  </button>
                </div>
                {llm.backend === 'stub' && <p className="text-xs text-amber-700">Demo model is a scripted stand-in that injects fabricated facts to show the gate working. It is not a measurement of any real LLM. Use ?llm=webllm for a real in-browser model (WebGPU).</p>}
                {llmMsg && <p className="text-xs text-slate-600">{llmMsg}</p>}
                {gated && !gated.usedFallback && (
                  <div data-testid="gated-panel" className="space-y-2">
                    <label className="flex items-center gap-2 text-sm min-h-[48px]">
                      <input type="checkbox" checked={showRaw} onChange={(e) => setShowRaw(e.target.checked)} /> Show raw LLM output
                    </label>
                    <p className="text-sm">
                      Raw fabrication rate: <b>{(gated.rawFabricationRate * 100).toFixed(0)}%</b> ({gated.dropped.length}/{gated.proposedCount}). After gate: <b>{(gated.gatedFabricationRate * 100).toFixed(0)}%</b>.
                    </p>
                    <ul className="space-y-1 text-sm">
                      {gated.kept.map((k, i) => (
                        <li key={`k${i}`} className="text-emerald-800">Kept: {k.concept} ("{k.evidence}")</li>
                      ))}
                      {showRaw &&
                        gated.dropped.map((d, i) => (
                          <li key={`d${i}`} className="text-red-700 line-through" data-testid="dropped-fact">
                            {d.fact?.concept} ("{d.fact?.evidence}") <span className="no-underline text-xs">(no evidence in transcript)</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </Step>

            <Step n={3} title="SOAP draft">
              <pre className="whitespace-pre-wrap text-sm bg-slate-50 rounded-xl p-3" data-testid="soap-text">{soapToText(result.soap)}</pre>
            </Step>

            <Step n={4} title="Safety alerts">
              {result.redFlags.length === 0 && result.drugAlerts.length === 0 && <p className="text-sm text-slate-600">No red flags or drug conflicts detected in the quoted facts.</p>}
              {result.redFlags.map((a) => (
                <div key={a.ruleId} className="rounded-xl bg-red-50 border border-red-300 p-3 text-sm" data-testid="red-flag">
                  <b className="text-red-800">{a.severity}: {a.title}</b>
                  <p>{a.recommendedImmediateAction}</p>
                </div>
              ))}
              {result.drugAlerts.map((a, i) => (
                <div key={i} className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm">{a.message}</div>
              ))}
            </Step>

            <Step n={5} title="Clinician approval">
              <p className="text-sm text-slate-600">Status: <b data-testid="approval-state">{state}</b></p>
              <div className="flex gap-2">
                {state === 'AI_DRAFT' && <button className="min-h-[48px] px-4 rounded-xl bg-slate-800 text-white" onClick={() => setState('REVIEWING')}>Start review</button>}
                {state === 'REVIEWING' && <button className="min-h-[48px] px-4 rounded-xl bg-emerald-600 text-white font-semibold" onClick={() => setState('APPROVED')} data-testid="approve-btn">Approve note</button>}
              </div>
            </Step>

            <Step n={6} title="Export to laptop (Office Kit)">
              <ExportToLaptop state={state} onDownloadFhir={fhir} onDownloadHtml={html} onCopySummary={copy} />
            </Step>
          </>
        )}
        <footer className="text-center text-xs text-slate-500 py-4">
          Prior work disclosed: rule engine, evidence gate, FHIR converter from MedScribeAI. Phone-first shell, network guard, on-device OCR and LLM gate are Phase 1 additions.
        </footer>
      </main>
    </div>
  );
}
