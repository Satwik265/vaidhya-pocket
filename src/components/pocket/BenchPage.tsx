// PHASE1-POCKET
import React, { useState } from 'react';
import { runPocketPipeline, POCKET_SAMPLES } from '../../pocket/pipeline';
import { StubLLM } from '../../llm/stubLLM';
import { WebLLMBackend } from '../../llm/webllmBackend';
import { runGatedPipeline } from '../../llm/gatedPipeline';
import { getNetworkStats } from '../../utils/networkGuard';

const q = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];

/** ?bench=1 : measures this device. Download the JSON and save it as validation/iqoo_bench/out/latency_phone.json */
export function BenchPage() {
  const [out, setOut] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const useWeb = /[?&]llm=webllm/.test(window.location.search);

  const run = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30));
    const N = 30;
    const st: Record<string, number[]> = { extractMs: [], groundMs: [], redFlagMs: [], soapMs: [], totalMs: [] };
    for (let i = 0; i < 5; i++) runPocketPipeline(POCKET_SAMPLES[0].text);
    for (let i = 0; i < N; i++) {
      const t = runPocketPipeline(POCKET_SAMPLES[i % POCKET_SAMPLES.length].text).timings as any;
      for (const k of Object.keys(st)) st[k].push(t[k]);
    }
    const stages: any = {};
    for (const [k, v] of Object.entries(st)) stages[k] = { p50: +q(v, 0.5).toFixed(2), p95: +q(v, 0.95).toFixed(2) };

    let llm: any = null;
    try {
      const backend = useWeb ? new WebLLMBackend() : new StubLLM(2, 'stub');
      const g = await runGatedPipeline(backend, POCKET_SAMPLES[2].text);
      llm = { backend: backend.name, usedFallback: g.usedFallback, rawFabricationRate: g.rawFabricationRate, gatedFabricationRate: g.gatedFabricationRate, ...g.llmStats };
    } catch (e: any) {
      llm = { error: String(e?.message || e) };
    }
    const net = getNetworkStats();
    setOut({
      status: 'MEASURED',
      device: navigator.userAgent,
      cores: (navigator as any).hardwareConcurrency,
      webgpu: !!(navigator as any).gpu,
      online: navigator.onLine,
      runs: N,
      stages,
      llm,
      network: { payloadBytesUploaded: net.payloadBytesUploaded, blockedRequests: net.blockedRequests },
      takenAt: new Date().toISOString(),
    });
    setBusy(false);
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'latency_phone.json';
    a.click();
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-3">
      <h1 className="text-xl font-bold">Device benchmark</h1>
      <p className="text-sm text-slate-600">Runs the pipeline 30 times on this device{useWeb ? ' and the real WebLLM model' : ' and the stub LLM (add &llm=webllm for a real model)'}.</p>
      <button onClick={run} disabled={busy} className="w-full min-h-[48px] rounded-xl bg-indigo-600 text-white font-bold" data-testid="bench-run">
        {busy ? 'Running...' : 'Run benchmark'}
      </button>
      {out && (
        <>
          <pre className="text-xs bg-slate-100 rounded-xl p-3 overflow-auto" data-testid="bench-out">{JSON.stringify(out, null, 2)}</pre>
          <button onClick={download} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold">Download latency_phone.json</button>
        </>
      )}
    </div>
  );
}
