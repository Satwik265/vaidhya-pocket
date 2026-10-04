// PHASE1-POCKET  run: npx tsx validation/iqoo_bench/heldout_extraction.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runPocketPipeline } from '../../src/pocket/pipeline';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, 'heldout_cases.json'), 'utf-8'));
mkdirSync(join(here, 'out'), { recursive: true });

if (data.isExample) {
  writeFileSync(join(here, 'out', 'heldout.json'), JSON.stringify({ status: 'NOT MEASURED', reason: 'only EXAMPLE cases present' }, null, 2));
  console.log('Held-out: NOT MEASURED (example cases only)');
  process.exit(0);
}

const per: Record<string, { tp: number; fp: number; fn: number; n: number }> = {};
for (const c of data.cases) {
  const r = runPocketPipeline(c.text);
  const got = new Set(r.grounded.map((g) => `${g.fact.code}|${g.fact.assertion}`));
  const exp = new Set<string>(c.expected.map((e: any) => `${e.code}|${e.assertion}`));
  const d = (per[c.lang] ||= { tp: 0, fp: 0, fn: 0, n: 0 });
  d.n++;
  for (const g of got) exp.has(g) ? d.tp++ : d.fp++;
  for (const e of exp) if (!got.has(e)) d.fn++;
}
const out: any = {};
for (const [k, d] of Object.entries(per)) {
  const p = d.tp / Math.max(1, d.tp + d.fp), r = d.tp / Math.max(1, d.tp + d.fn);
  out[k] = { cases: d.n, precision: +p.toFixed(4), recall: +r.toFixed(4), f1: +((2 * p * r) / Math.max(1e-9, p + r)).toFixed(4) };
}
writeFileSync(join(here, 'out', 'heldout.json'), JSON.stringify({ status: 'MEASURED', per_language: out }, null, 2));
console.log('Held-out:', out);
