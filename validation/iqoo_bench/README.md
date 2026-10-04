# iQOO benchmark harness

Every number in `docs/BENCHMARKS.md` is produced by these scripts. Missing input -> `NOT MEASURED`. Nothing is hand-typed.

| Script | Needs from you | Output |
|---|---|---|
| `wer_eval.py` | 30 real clips + `asr_clips/manifest.csv` (file,lang,reference) and `asr_clips/hypotheses.json` (file -> transcript from the ASR under test) | `out/asr.json` |
| `heldout_extraction.ts` | `heldout_cases.json`: write 50 NEW cases AFTER freezing the rules. The 5 shipped cases are marked EXAMPLE and are not reported as results | `out/heldout.json` |
| `fabrication_eval.ts` | `transcripts.json` (100 transcripts for the real run). Runs the evidence gate. With the stub LLM it validates gate mechanics only; real-LLM runs use the in-app `?bench=1` page on the phone | `out/fabrication.json` |
| `?bench=1` page (in the app) | A phone with the app open | latency JSON download (p50/p95 per stage), then copy to `out/latency_phone.json` |
| `make_report.py` | the files above | `../../docs/BENCHMARKS.md` |

Run: `npm run bench` (runs everything that has inputs, then builds the report).
