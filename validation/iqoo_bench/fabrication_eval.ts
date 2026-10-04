// PHASE1-POCKET  run: npx tsx validation/iqoo_bench/fabrication_eval.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { StubLLM } from '../../src/llm/stubLLM';
import { runGatedPipeline } from '../../src/llm/gatedPipeline';

const here = dirname(fileURLToPath(import.meta.url));
const { transcripts } = JSON.parse(readFileSync(join(here, 'transcripts.json'), 'utf-8')) as { transcripts: string[] };
mkdirSync(join(here, 'out'), { recursive: true });

(async () => {
  let proposed = 0, dropped = 0, kept = 0, keptBad = 0;
  const llm = new StubLLM(2);
  for (const t of transcripts) {
    const r = await runGatedPipeline(llm, t);
    proposed += r.proposedCount; dropped += r.dropped.length; kept += r.kept.length;
    keptBad += Math.round(r.gatedFabricationRate * r.kept.length);
  }
  const out = {
    status: 'STUB_ONLY',
    caveat: 'Stub LLM injects fabricated facts by design. This validates gate mechanics, NOT any real model. Real-LLM rate must be measured on the phone via ?bench=1&llm=webllm.',
    transcripts: transcripts.length, proposed, dropped, kept,
    rawFabricationRate: proposed ? +(dropped / proposed).toFixed(4) : 0,
    gatedFabricationRate: kept ? +(keptBad / kept).toFixed(4) : 0,
  };
  writeFileSync(join(here, 'out', 'fabrication.json'), JSON.stringify(out, null, 2));
  console.log(out);
})();
