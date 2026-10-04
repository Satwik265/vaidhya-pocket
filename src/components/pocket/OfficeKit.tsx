// PHASE1-POCKET
import React, { useState } from 'react';
import type { ApprovalState } from '../../pocket/export';
import { copyToClipboard } from '../../pocket/export';

export function ImportFromLaptop({ onImport }: { onImport: (text: string) => void }) {
  const [msg, setMsg] = useState('');
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) {
        setMsg('Clipboard is empty.');
        return;
      }
      onImport(t);
      setMsg('Received via clipboard');
    } catch {
      setMsg('Clipboard blocked. Paste into the box instead.');
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={paste} className="min-h-[48px] px-4 rounded-xl bg-indigo-600 text-white font-semibold" data-testid="paste-from-laptop">
        Paste from laptop
      </button>
      {msg && <span className="text-xs text-slate-600" data-testid="import-msg">{msg}</span>}
    </div>
  );
}

interface ExportProps {
  state: ApprovalState;
  onDownloadFhir: () => void;
  onDownloadHtml: () => void;
  onCopySummary: () => Promise<void> | void;
}

export function ExportToLaptop({ state, onDownloadFhir, onDownloadHtml, onCopySummary }: ExportProps) {
  const ok = state === 'APPROVED' || state === 'EXPORTED';
  const cls = (primary: boolean) =>
    `min-h-[48px] px-4 rounded-xl font-semibold ${primary ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-900'} ${ok ? '' : 'opacity-40 cursor-not-allowed'}`;
  return (
    <div className="flex flex-col gap-2">
      {!ok && <p className="text-xs text-amber-700" data-testid="export-locked">Export is locked until the clinician approves the note.</p>}
      <div className="flex gap-2 flex-wrap">
        <button disabled={!ok} onClick={onDownloadFhir} className={cls(true)} data-testid="export-fhir">FHIR .json</button>
        <button disabled={!ok} onClick={onDownloadHtml} className={cls(false)} data-testid="export-html">SOAP .html</button>
        <button disabled={!ok} onClick={() => void onCopySummary()} className={cls(false)} data-testid="export-copy">Copy summary</button>
      </div>
      <p className="text-xs text-slate-500">Files save to Downloads, where Office Kit file transfer picks them up.</p>
    </div>
  );
}

export { copyToClipboard };
