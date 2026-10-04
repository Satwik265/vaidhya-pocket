## [Unreleased] - Vaidhya Pocket (iQOO Phase 1)
### Added
- Phone-first Pocket flow, Device Proof panel, installable offline PWA, `?bench=1` device benchmark page
- `networkGuard`, verbatim grounding layer, evidence-gated local-LLM layer (stub + WebLLM), on-device OCR (Tesseract.js, eng+hin bundled)
- Office Kit I/O (paste import, FHIR/SOAP export, clipboard), approval-gated export
- Benchmark harness (`npm run bench`) generating `docs/BENCHMARKS.md`; `docs/SUBMISSION_PHASE1.md`
### Removed
- All Gemini cloud calls and the `@google/genai` dependency; cloud routes now return 410
### Changed
- Browser Web Speech dictation is opt-in only (`?webspeech=1`) because it uploads audio to the browser vendor
- Legacy tests updated for sovereign mode (375 -> 379 tests)

# Changelog

All notable changes to MedScribeAI are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-09-12

### Added
- **Sovereign Desktop Architecture**: Native desktop application shell built on Tauri v2 and Rust, managing a bundled Python FastAPI clinical sidecar process on loopback.
- **Local On-Device ASR**: Embedded INT8 quantized IndicConformer model (`model.int8.onnx`, 187.85 MB) executing on ONNX Runtime CPU execution provider with sub-100ms inference latency.
- **Deterministic Clinical NLP Core**: Rule-based information extraction across English, Hindi, Marathi, Gujarati, and Tamil. Achieves 96.47% F1-score on a 150-case gold-standard benchmark.
- **Universal Zero-Fabrication Evidence Gate**: Hard architectural enforcement ensuring 100% of emitted clinical facts are anchored to verbatim source utterances with zero ungrounded hallucinations.
- **Deterministic Safety Engine**: Real-time evaluation of acute red-flag conditions (acute coronary syndrome, respiratory distress, hemorrhage) with emergency staff alerts (< 0.01 ms latency).
- **Transactional SQLite Storage**: Sovereign local relational persistence (`encounters`, `clinical_facts`, `fact_evidence`, `audit_log`, `sync_queue`) with collision-free UUID audit records.
- **Physician Approval State Machine**: Hardened clinical lifecycle (`AI_DRAFT` -> `REVIEWING` -> `APPROVED` -> `EXPORTED`). Material edits invalidate approval; export is gated behind approval.
- **FHIR R4 Export Foundation**: Standard-compliant FHIR R4 Bundle generation (`Patient`, `Encounter`, `Condition`, `Observation`, `MedicationStatement`).
- **Comprehensive Verification Suite**: 345 passing frontend tests, 89 passing backend tests, and empirical performance benchmarks.

### Changed
- Refactored clinical data model to canonical `ClinicalFact` source-of-truth with provenance, assertion, temporality, and experiencer tagging.
- Hardened privacy posture with zero third-party telemetry, zero external dependencies in `LOCAL_ONLY` mode, and offline airplane-mode support.

## [1.5.0] - 2026-08-15

### Added
- **Patient Kiosk Case-Taking**: Touch-first self-service intake kiosk for outpatient departments under SIH Problem Statement 26047.
- **AYUSH Clinical Intake**: Structured 10-fold Dashavidha Pariksha, Ahara (dietary), and Vihara (lifestyle) assessment modules.
- **SOCRATES Symptom Engine**: Systematic inquiry into symptom site, onset, character, radiation, associations, timing, exacerbating factors, and severity.
- **Granular Consent Management**: Explicit, revocable consent capture with digital signature canvas and hospital sharing controls.
- **Simulated ABDM Sandbox**: 14-digit ABHA format and Luhn checksum validation with simulated sandbox gateway response.

## [1.0.0] - 2026-07-28

### Added
- Initial web-based clinical documentation prototype.
- SOAP note generation pipeline with ICD-10 and CPT billing suggestions.
- Real-time drug interaction checking engine.
- Multilingual interface supporting English and Hindi.
