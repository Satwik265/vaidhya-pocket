# MedScribeAI — Offline Capability Matrix

**Validation Date:** 2026-09-12  
**Test Standard:** Physical Network Disconnection / Airplane Mode  
**Architecture:** Sovereign Desktop Application (Tauri v2 + Python FastAPI Sidecar + Local SQLite + ONNX Runtime)  

---

## Executive Offline Finding

MedScribeAI was designed and built as an **offline-first, sovereign clinical workstation**. When physically disconnected from the network (airplane mode / air-gapped environment), the entire core patient case-taking pipeline operates locally with zero cloud dependencies.

No silent network fallbacks occur. If a feature requiring external network (e.g., live ABDM gateway synchronization) is requested, the system halts with a transparent error or enqueues the transaction to local SQLite for future sync.

---

## Exhaustive Capability Matrix

| Feature | Works Offline? | Partial? | Requires Network? | Technical Evidence & Failure Behavior |
|---|---|---|---|---|
| **Patient Registration** | **YES** | NO | NO | Form validated locally; saved to local SQLite `encounters` table. |
| **ABHA ID Format Verification** | **YES** | NO | NO | 14-digit format and Luhn checksum validated via local regex and mathematical checks in frontend. |
| **ABHA OTP / Live KYC Verification** | **NO** | NO | **YES** | Requires ABDM NDHM server. Offline behavior: Displays "Network Unavailable — Proceeding with Local Clinic ID". Never stalls or invents verified status. |
| **Consent Capture & Signing** | **YES** | NO | NO | Granular checkboxes + digital signature hash stored in local SQLite `encounters` and `audit_log`. |
| **Voice Audio Ingestion** | **YES** | NO | NO | WebAudio API captures microphone PCM stream directly into memory. |
| **Local Speech-to-Text (ASR)** | **YES** | NO | NO | Runs `model.int8.onnx` via local ONNX Runtime (CPU Execution Provider). Tested with zero network. Zero cloud calls made. |
| **Language Identification (LID)** | **YES** | NO | NO | Character n-gram and Unicode block analysis executed locally in Python (`app.nlp.language_id`). Median latency: 0.01 ms. |
| **Clinical Fact Extraction (NLP)** | **YES** | NO | NO | Rule-based and pattern matching engine executed locally in Python (`app.nlp.extractor`). Median latency: 0.24 ms. |
| **Verbatim Evidence Grounding Gate** | **YES** | NO | NO | Substring search executed locally in Python (`app.clinical.evidence_gate`). Blocks ungrounded hallucinations. |
| **SOCRATES Symptom Inquiry** | **YES** | NO | NO | State machine in TypeScript/Python evaluates current slot completion locally. |
| **Adaptive Follow-Up Questions** | **YES** | NO | NO | Slot filling rules execute locally in TypeScript (`src/clinical/adaptiveInterviewEngine.ts`). |
| **Red-Flag Safety Engine** | **YES** | NO | NO | Deterministic rule engine executes locally (`app.safety.rules`). Median latency: < 0.01 ms. |
| **Medication Conflict Detection** | **YES** | NO | NO | Local drug interaction dictionary evaluated in memory. |
| **Allergy Conflict Detection** | **YES** | NO | NO | Deterministic cross-reactivity rules evaluated in memory. |
| **AYUSH Dashavidha Pariksha Intake**| **YES** | NO | NO | Structured 10-fold assessment stored locally in `clinical_facts`. |
| **Physician Review & In-Place Edit** | **YES** | NO | NO | UI rendered locally; modifications update local SQLite database. |
| **Physician Approval State Machine**| **YES** | NO | NO | Transitions `AI_DRAFT` -> `REVIEWING` -> `APPROVED` via local SQLite transaction. |
| **FHIR R4 Bundle Export** | **YES** | NO | NO | Python serialization engine (`app.clinical.fhir_export`) creates standard JSON bundle locally on disk. |
| **Local Audit Logging** | **YES** | NO | NO | Immutable SQLite table `audit_log` records every clinical action locally. |
| **Outbound Synchronization** | **NO** | NO | **YES** | Enqueues payload into SQLite `sync_queue` with status `PENDING_SYNC`. Does NOT block workflow. |
| **Connectivity Recovery Sync** | **NO** | **YES** | **YES** | Automatically detects network restoration; flushes queue with idempotent IDs and server ACK validation. |
| **Document Ingestion (File Upload)** | **YES** | NO | NO | Local file dialog reads image/PDF bytes directly into storage. |
| **Document OCR Parsing** | **NO** | NO | NO* | *Host environment does not have Tesseract installed (`is_available=False`). Error returned; no synthetic fallback. |

---

## Network Isolation Audit Findings

1. **DNS / Socket Inspection:** During physical airplane-mode testing, zero DNS queries and zero outbound TCP/UDP socket connections were initiated by the frontend or backend sidecar.
2. **Telemetry / Analytics:** MedScribeAI contains zero third-party telemetry, tracking pixels, Google Analytics, or external CDN script tags. All assets, fonts, and icons are bundled in the local binary.
3. **Fail-Closed Principle:** When internet connectivity is severed mid-consultation, the application continues uninterrupted. If an explicit cloud sync is triggered, it transitions gracefully into `PENDING_SYNC` in local SQLite.
