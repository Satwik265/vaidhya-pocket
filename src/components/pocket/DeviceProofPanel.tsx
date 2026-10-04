// PHASE1-POCKET
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { getNetworkStats, subscribeNetworkStats } from '../../utils/networkGuard';
import type { StageTimings } from '../../pocket/pipeline';

export interface OfficeKitCounters {
  imports: number;
  exports: number;
  copies: number;
}

interface Props {
  timings?: StageTimings;
  ocrMs?: { preprocess: number; ocr: number };
  llmLabel: string;
  llmStats?: { ttftMs?: number; tokensPerSec?: number; totalMs?: number };
  office: OfficeKitCounters;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const u = () => setOn(true);
    const d = () => setOn(false);
    window.addEventListener('online', u);
    window.addEventListener('offline', d);
    return () => {
      window.removeEventListener('online', u);
      window.removeEventListener('offline', d);
    };
  }, []);
  return on;
}

function useBattery(): string {
  const [b, setB] = useState('n/a');
  useEffect(() => {
    let alive = true;
    (navigator as any).getBattery?.().then((bat: any) => {
      const upd = () => alive && setB(`${Math.round(bat.level * 100)}%${bat.charging ? ' (charging)' : ''}`);
      upd();
      bat.addEventListener('levelchange', upd);
      bat.addEventListener('chargingchange', upd);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return b;
}

const fmt = (n?: number) => (n === undefined || Number.isNaN(n) ? 'n/a' : `${n.toFixed(n < 10 ? 1 : 0)} ms`);

export function DeviceProofPanel({ timings, ocrMs, llmLabel, llmStats, office }: Props) {
  const online = useOnline();
  const net = useSyncExternalStore(subscribeNetworkStats, getNetworkStats);
  const battery = useBattery();
  const [open, setOpen] = useState(false);
  const sent = net.payloadBytesUploaded;

  return (
    <div className="sticky top-0 z-30 bg-slate-900 text-white text-xs">
      <button
        className="w-full flex items-center justify-between gap-2 px-3 py-2 min-h-[48px]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="device-proof-toggle"
      >
        <span className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${online ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black'}`}>
            {online ? 'ONLINE' : 'AIRPLANE / OFFLINE'}
          </span>
          <span data-testid="bytes-sent" className="font-mono">
            {sent} B uploaded
          </span>
          <span className="font-mono">{net.blockedRequests} blocked</span>
        </span>
        <span aria-hidden>{open ? '▲' : '▼'} Device proof</span>
      </button>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono" data-testid="device-proof-body">
          <span className="text-slate-400">Inference backend</span>
          <span>CPU / WASM + rules</span>
          <span className="text-slate-400">Local LLM</span>
          <span>{llmLabel}</span>
          <span className="text-slate-400">LLM TTFT / tok/s</span>
          <span>
            {fmt(llmStats?.ttftMs)} / {llmStats?.tokensPerSec ? llmStats.tokensPerSec.toFixed(1) : 'n/a'}
          </span>
          <span className="text-slate-400">Extract / ground</span>
          <span>
            {fmt(timings?.extractMs)} / {fmt(timings?.groundMs)}
          </span>
          <span className="text-slate-400">Red flags / SOAP</span>
          <span>
            {fmt(timings?.redFlagMs)} / {fmt(timings?.soapMs)}
          </span>
          <span className="text-slate-400">OCR prep / OCR</span>
          <span>
            {fmt(ocrMs?.preprocess)} / {fmt(ocrMs?.ocr)}
          </span>
          <span className="text-slate-400">Battery</span>
          <span>{battery}</span>
          <span className="text-slate-400">Requests allowed / blocked</span>
          <span>
            {net.allowedRequests} / {net.blockedRequests}
          </span>
          <span className="text-slate-400">Office Kit (in / out / copy)</span>
          <span data-testid="office-counters">
            {office.imports} / {office.exports} / {office.copies}
          </span>
          {net.lastBlocked && (
            <>
              <span className="text-slate-400">Last blocked</span>
              <span className="truncate">{net.lastBlocked}</span>
            </>
          )}
          <span className="col-span-2 text-slate-500 mt-1">
            Timings are measured on this device in this session. Nothing here is a benchmark claim.
          </span>
        </div>
      )}
    </div>
  );
}
