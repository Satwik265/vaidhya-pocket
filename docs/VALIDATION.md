# Technical Validation & Verification

Authoritative validation report for **MedScribeAI** (Smart India Hackathon 2026, Problem Statement: SIH26047).

This document establishes the verified technical capabilities, automated test coverage, performance benchmarks, and explicit boundaries of the MedScribeAI platform. All reported numbers reflect reproducible test suites and local runtime benchmarks executed against the sovereign codebase.

---

## 1. Validation Scope

MedScribeAI is an offline-first clinical case-taking and documentation copilot. The technical validation evaluates:

- **Local sovereign execution**: Absence of cloud telemetry, zero remote network calls during inference, offline SQLite persistence, and local ASR/NLP pipelines.
- **Evidence grounding & provenance**: 100% trace-to-verbatim-source guarantee for all extracted clinical facts.
- **Safety gating**: Deterministic emergency red-flag triggers and drug interaction conflict detection.
- **Physician governance**: Strict `AI_DRAFT -> REVIEWING -> APPROVED -> EXPORTABLE` state machine enforcing human-in-the-loop sign-off before export.
- **Multilingual extraction**: Indic clinical entity recognition across Hindi, Marathi, and English.
- **Data safety & consent**: Explicit separation between consultation intake consent and external hospital/ABDM sharing consent.

---

## 2. Automated Test Verification

All automated suites run locally in isolated environments without external network access.

| Test Layer | Test Suite | Executable Count | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Unit & Integration** | Vitest (`npm test`) | 345 / 345 passed | Verified Passing | 24 test files covering UI components, state machines, and parser guardrails. |
| **TypeScript Type Safety** | `tsc --noEmit` (`npm run lint`) | 0 errors / 0 warnings | Verified Passing | Strict TypeScript compilation across whole repository. |
| **Frontend Production Build** | Vite (`npm run build`) | Built in 5.8s | Verified Passing | Bundle size: `dist/server.cjs` (49.1 kB), zero syntax or chunk errors. |
| **Backend Clinical Engine** | Pytest (`pytest backend/tests`) | 89 passed, 18 skipped | Verified Passing | 18 tests conditionally skipped when local Tesseract OCR runtime is uninstalled. |
| **Desktop Sovereign Runtime** | Tauri Cargo (`cargo check`) | Target check clean | Verified Passing | Compiles native Windows desktop container and sidecar bridge. |

---

## 3. Clinical NLP & Entity Extraction Validation

Entity extraction was evaluated against a synthetic corpus of clinical scenarios representing common primary care and outpatient department encounters.

> [!NOTE]
> These metrics represent **synthetic validation results** against controlled test corpora. They reflect rule-based and localized extraction fidelity, not clinical diagnostic accuracy on live patient populations.

### Overall Extraction Metrics (n = 150 Synthetic Cases)

- **Precision**: 99.39%
- **Recall**: 93.71%
- **F1 Score**: 96.47%

### Language-Specific Extraction Fidelity

| Language | Extracted Facts | Precision | Recall | F1 Score |
| :--- | :--- | :--- | :--- | :--- |
| **Hindi (हिंदी)** | 54 | 100.00% | 89.47% | 94.44% |
| **Marathi (मराठी)** | 42 | 100.00% | 100.00% | 100.00% |
| **English** | 70 | 98.41% | 98.31% | 98.36% |

---

## 4. Evidence Grounding & Provenance Safeguards

- **Evidence Grounding Metric**: 100.0% (166 / 166 clinical facts in validation corpus)
- **Unanchored / Hallucinated Facts**: 0 (Zero-fabrication invariant enforced by schema)

### Definition of Evidence Grounding
In MedScribeAI, "evidence grounding" means that **every extracted `ClinicalFact` must be programmatically linked to an exact verbatim character span and timestamp in the raw consultation transcript or document OCR output**.

If an entity, symptom, or medication cannot be tied to a documented input segment:
1. It is rejected by the extraction pipeline.
2. It cannot be promoted into the SOAP note or FHIR bundle.
3. It is never synthesized from latent model weights.

Evidence grounding is an anti-hallucination architectural guardrail; **it is not a measure of clinical diagnostic accuracy or therapeutic correctness.**

---

## 5. Offline Runtime & Performance Benchmarks

Benchmarks were measured on an Intel Core i7 (x86_64, Windows 11) sovereign workstation running purely offline.

| Operation | Metric | Value | Measurement Details |
| :--- | :--- | :--- | :--- |
| **Clinical NLP Extraction** | Median Latency | 0.24 ms | P95: 0.49 ms (n=150 runs) |
| **Language Identification (LID)** | Median Latency | 0.01 ms | Script and dictionary heuristics |
| **Safety Red-Flag Check** | Execution Latency | < 0.01 ms | Deterministic regex and fact-assertion matching |
| **Local ASR Transcription** | Median Latency | 93.64 ms | P95: 104.09 ms (synthetic audio chunk benchmark) |
| **ASR Model Memory** | Disk Footprint | ~187.85 MB | Whisper base/tiny quantized sovereign weights |
| **ASR Cold Start** | Initial Model Load | ~2.43 s | PyTorch/Transformers CPU initialization |
| **Local SQLite Persistence** | Write Latency | 11.8 ms | Median across n=50 transaction runs |
| **Approval State Transition** | State Invalidation / Update | 4.11 ms | Median across n=50 workflow actions |

---

## 6. OCR Capability Gate & Ingestion Behavior

MedScribeAI treats physical document ingestion as **strictly capability-dependent**:

```
Document Input (PDF / Image)
      |
      v
OCR Capability Gate
      |
      +---> [Tesseract Installed] ----> Local OCR Runtime ----> Verbatim Text ----> Clinical Extraction
      |
      +---> [Tesseract Missing]   ----> Explicit "OCR Unavailable" State (Fails Closed, 0 Fabrication)
```

- When the host system lacks a local Tesseract runtime and language packages (`tessdata`), MedScribeAI displays an explicit disabled status.
- **The system never simulates, mocks, or fabricates document contents when OCR is unavailable.**

---

## 7. Clinical Safety & Physician Governance

### Deterministic State Machine
MedScribeAI enforces human physician oversight before clinical outputs can be exported or pushed to downstream hospital systems:

```
AI_DRAFT  ---->  REVIEWING  ---->  APPROVED  ---->  EXPORTABLE
   ^                                  |
   |----------- Material Edit --------|
```

1. **AI Draft**: Preliminary note synthesized from intake and consultation transcripts.
2. **Reviewing**: Clinician actively reviewing, modifying, and verifying facts.
3. **Approved**: Attending physician explicitly signs and verifies note integrity.
4. **Approval Invalidation**: Any subsequent modification to patient data, diagnoses, or prescriptions immediately invalidates approval and reverts status to `REVIEWING`.
5. **Export Protection**: FHIR JSON bundle export, prescription printing, and hospital push are hard-blocked until the note reaches `APPROVED` state.

### Granular Consent Segregation
In compliance with the Digital Personal Data Protection (DPDP) Act 2023:
- **Intake Consent**: Governs local voice processing and kiosk interview. Revocable at any point during intake.
- **Sharing Consent**: Governs transmission to external ABDM gateways or hospital information systems. If not explicitly granted, external outbound synchronization is blocked and queued locally.

---

## 8. Explicit Boundaries (What Has NOT Been Validated)

To maintain scientific integrity and prevent misleading clinical claims, the following limitations are formally declared:

1. **Human-Speech ASR Accuracy**: The local ASR runtime has been verified for technical inference, memory footprints, and pipeline stability, but has **not** undergone full Word Error Rate (WER) or Character Error Rate (CER) benchmarking across diverse human clinical accents or noisy hospital OPD environments.
2. **Clinical Diagnostic Accuracy**: MedScribeAI does not diagnose conditions or prescribe medications autonomously. It acts solely as an assistive documentation copilot. Diagnostic outcomes have not been evaluated in clinical trials.
3. **Live Production ABDM Certification**: The platform implements standard FHIR R4 schema foundations and an ABDM sandbox integration pipeline; it has not completed formal Ministry of Health / NHA production gateway certification.
4. **Real-World OCR Accuracy**: OCR benchmarking has not been conducted on hand-written physician prescriptions or degraded carbon-copy documents.
5. **Multi-Hospital Clinical Deployment**: The software has not been tested in live multi-tenant hospital deployments.

---

**Authoritative Status**: *SIH 2026 demo-ready with declared limitations. Core offline-first workflow validated; clinical deployment requires further real-world validation.*
