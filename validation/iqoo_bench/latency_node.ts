// PHASE1-POCKET  run: npx tsx validation/iqoo_bench/latency_node.ts   (DEV MACHINE number, not a phone number)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { runPocketPipeline, POCKET_SAMPLES } from '../../src/pocket/pipeline';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, 'out'), { recursive: true });
const q = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
const N = 30;
const stages: Record<string, number[]> = { extractMs: [], groundMs: [], redFlagMs: [], soapMs: [], totalMs: [] };
for (let i = 0; i < 5; i++) runPocketPipeline(POCKET_SAMPLES[0].text); // warm-up
for (let i = 0; i < N; i++) {
  const t = runPocketPipeline(POCKET_SAMPLES[i % POCKET_SAMPLES.length].text).timings as any;
  for (const k of Object.keys(stages)) stages[k].push(t[k]);
}
const res: any = {};
for (const [k, v] of Object.entries(stages)) res[k] = { p50: +q(v, 0.5).toFixed(2), p95: +q(v, 0.95).toFixed(2) };
const out = { status: 'MEASURED', device: `DEV MACHINE (node ${process.version}, ${os.cpus()[0]?.model}), not a phone`, runs: N, stages: res };
writeFileSync(join(here, 'out', 'latency_node.json'), JSON.stringify(out, null, 2));
console.log(out);
