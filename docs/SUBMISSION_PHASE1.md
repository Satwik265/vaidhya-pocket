# SUBMISSION_PHASE1: iQOO Hackathon 2026 Grand Finale (direct entry)

Deadline: 5 Oct 2026, 11:59 PM IST. Register for the Finale AND submit the idea (team leader only). Track: **Open Innovation**.

## 1. Title
**Vaidhya Pocket: an on-device clinical scribe that cannot lie**

## 2. Description (paste into the form)
Vaidhya Pocket turns a clinic conversation in Hindi, Marathi, Hinglish or English, or a photo of a prescription, into a structured SOAP draft and a FHIR record entirely on the phone. Its core idea is a verification gate: a small local language model may propose clinical facts, but every fact must quote the patient's own words from the transcript, or it is dropped before the clinician sees it. A deterministic red-flag engine alerts on emergencies such as chest pain with breathlessness, and nothing is exported until the clinician approves. The app runs as an offline-capable PWA with a live network meter that shows zero bytes uploaded in airplane mode, and a laptop-to-phone workflow through Office Kit. It is built for rural clinics with poor connectivity and for privacy-sensitive patient data. It is a documentation assistant, not a diagnostic tool.

(About 160 words. The form needs 50+ characters.)

## 3. What is real vs the Finale build
| Component | Status today | Evidence |
|---|---|---|
| Rule-based fact extraction, Hindi/Hinglish/English, negation | **Real** (prior work, reused) | `src/clinical/*`, 379 tests pass |
| Verbatim grounding layer (exact quotes only, rejects partial-word matches) | **Real** (new) | `src/pocket/groundFacts.ts`, `groundFacts.test.ts` |
| Red-flag alerts, drug/allergy checks | **Real** (prior work) | `redFlagRules.ts`, `drugInteractionChecker.ts` |
| SOAP draft with no canned diagnosis | **Real** (new overrides) | `pocketPipeline.test.ts` |
| Approval-gated FHIR R4 / SOAP export | **Real** | `src/pocket/export.ts`, tests |
| Network guard + bytes-uploaded meter | **Real** (new) | `networkGuard.ts`, `networkGuard.test.ts` |
| Cloud removal (Gemini, cloud speech/vision) | **Real** | routes return 410; grep shows no Gemini calls |
| Offline PWA, phone-first 6-step flow | **Built and unit-tested; not yet run on a phone** | `npm run build`, `pocketUI.test.tsx` |
| On-device OCR (Tesseract.js eng+hin bundled) | **Verified in Node on a generated prescription image; browser/phone not yet tested** | `browserOcr.ts` |
| Evidence-gated LLM layer | **Real mechanism; verified only with a scripted stub** | `src/llm/*`, `gatedPipeline.test.ts` |
| Real in-browser LLM (WebLLM, WebGPU) | **Implemented, not yet run** | `?llm=webllm` |
| On-device speech recognition | **Finale build** (mic button disabled and labelled) | planned: sherpa-onnx / IndicConformer INT8 |
| NPU inference on the Snapdragon chip | **Finale build** | planned: Qualcomm Genie/QNN, CPU fallback |
| Phone-measured benchmarks | **NOT MEASURED** | `docs/BENCHMARKS.md` |

## 4. Prior work disclosed (originality)
This repository (MedScribeAI / Vaidhya) is prior work: the rule engine, evidence gate, FHIR converter, red-flag rules, dictionaries and tests. Phase 1 additions are tagged `// PHASE1-POCKET` in each new file. Finale-window code will be written in a new repository. Confirm the originality wording with the organisers before ticking the form's confirmation box.

## 5. Deck (6 slides)
1. **Problem.** Rural clinics: weak connectivity, no time to document, cloud scribes (Nuance DAX, Suki) send patient audio off-site. LLM scribes can invent facts. A fabricated allergy or symptom in a record is a patient-safety event.
2. **Solution + demo flow.** Speak or scan -> facts that quote the patient -> SOAP draft -> red-flag alert -> clinician approves -> FHIR to the clinic laptop. Screenshot of the Pocket flow.
3. **The novelty: the evidence gate.** Raw LLM proposes, gate verifies. Diagram of the pipeline. Example: a fabricated "diabetes" fact is struck through because no such words appear in the transcript. Honest limit: the gate guarantees a quote exists, not that the interpretation is right, so the clinician approves.
4. **Phone and hardware.** On-device only, airplane-mode proof with the live bytes-uploaded meter, camera OCR, Office Kit loop. Finale plan: on-device ASR and NPU LLM via Qualcomm Genie, CPU fallback.
5. **Benchmarks (plan + status).** Table from `docs/BENCHMARKS.md`: ASR WER, held-out extraction F1, raw vs gated fabrication rate, latency p50/p95, NPU vs CPU tokens/s, battery, temperature, bytes uploaded. Show NOT MEASURED honestly; reference only: Llama 3.2 1B (w4a16) on Snapdragon 8 Elite Gen 5 via Genie is published at roughly 64 tokens/s.
6. **Real vs Finale build + risks.** The table in section 3, the 48-hour plan, and the safety statement.

## 6. Demo video shot list (60 to 90 s)
0-10 s problem on screen. 10-25 s airplane mode ON, Device Proof chip visible. 25-45 s paste a Hinglish consult (laptop-to-phone via Office Kit), facts highlight their quotes. 45-55 s red-flag banner. 55-70 s run the demo model, show the fabricated fact struck through and the 0% gated rate (say clearly it is a scripted stand-in). 70-85 s approve, export FHIR, file lands on the laptop. 85-90 s "bytes uploaded: 0". Do not fake a mic demo.

## 7. Form answers
Android proficiency: choose honestly (Intermediate only if you have built Android or React Native apps). LLM proficiency: "Cloud APIs only" unless you have actually run a local model; if you run one through Ollama or llama.cpp before submitting, choose "Experimented with local LLMs". Prototype URL: deploy `npm run build` output (for example on Vercel); open it once online so the service worker caches, then test airplane mode.

## 8. Before you click submit (15-minute checklist)
- [ ] `npm install && npm test` passes; `npm run build` passes
- [ ] Deploy `dist/`, open on a phone, install to home screen, switch to airplane mode, run the flow, screenshot the Device Proof chip
- [ ] Test the Scan button with a real phone photo (OCR in the browser is not yet phone-tested)
- [ ] Re-read section 3 and delete anything you cannot demonstrate
- [ ] Safety line stays: documentation assistant, clinician approves, synthetic data only
