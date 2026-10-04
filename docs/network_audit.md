> **UPDATE (Oct 2026, Phase 1):** the optional Gemini cloud path described below has been REMOVED. `generativelanguage.googleapis.com` and `/api/generate-soap` no longer exist. `/api/medscribe/generate`, `/api/kiosk/extract-document` and `/api/speech/transcribe` return HTTP 410. The browser Web Speech API (which uploads audio to the browser vendor) is disabled unless `?webspeech=1`. Runtime enforcement and counters: `src/utils/networkGuard.ts`, tested in `src/__tests__/networkGuard.test.ts`. The only allow-listed external hosts are the one-time WebLLM weight download (user-initiated, only with `?llm=webllm`).

# MedScribeAI Network Audit & Offline Isolation Verification

**Date:** September 12, 2026  
**Auditor:** Antigravity AI Engineering Team  
**Scope:** Complete Codebase (`src/`, `backend/`, `src-tauri/`, `server.ts`)  
**Offline Classification:** Sovereign Local-First Desktop & Kiosk System  

---

## 1. Executive Summary

MedScribeAI is architected as an **offline-first, sovereign clinical documentation and case-taking system**. Under true physical offline isolation (e.g., airplane mode, air-gapped rural PHC, local OPD kiosk), all core clinical workflows execute entirely on localhost with zero egress network traffic.

No required cloud dependencies exist. Cloud AI processing is strictly an **optional enhancement** accessible only when internet connectivity is available and the clinician explicitly selects Cloud mode.

---

## 2. Network Surface Classification Matrix

All network calls and external interfaces within MedScribeAI are catalogued and classified into four distinct categories:

| Domain / Call Target | Direction | Protocol | Classification | Gating Mechanism & Description |
|---|---|---|---|---|
| `http://127.0.0.1:8000/*` | Loopback (Internal) | HTTP / REST | **LOCAL** | Localhost communication between Tauri frontend and sovereign Python sidecar (`uvicorn` on loopback). Binds strictly to `127.0.0.1`. Never routes outside host OS network stack. |
| `http://127.0.0.1:3000/*` | Loopback (Internal) | HTTP / REST | **LOCAL** | Optional local Node/Express API server (`server.ts`) used in web development mode. |
| `https://generativelanguage.googleapis.com/*` | Egress (Optional Cloud) | HTTPS / JSON | **OPTIONAL CLOUD** | Google Gemini Cloud LLM API for advanced narrative generation. **Gating:** Only called if user actively selects Cloud Engine (`mode === 'cloud'`) AND API key is configured. If offline or call fails, instantly falls back to `offlineLocalEngine` with zero crash. |
| `https://sandbox.abdm.gov.in/*` | Egress (External Integration) | HTTPS / JSON | **EXTERNAL INTEGRATION** | Ayushman Bharat Digital Mission (ABDM) Milestone 1/2 gateway for health record pushing. **Gating:** Strictly gated behind `consent.hospitalSharing === true` AND `approvalState === 'APPROVED'`. If offline, records are stored in local SQLite `sync_queue` for deferred synchronization. |
| CDN / Font Scripts | Egress | HTTPS | **ELIMINATED / LOCAL** | All fonts (Inter, Devanagari Unicode), icons (Lucide), and dependencies are bundled locally into Vite/Tauri dist bundle. Zero CDN requests. |
| Telemetry / Analytics | Egress | — | **NONE (ZERO TELEMETRY)** | No analytics libraries (Google Analytics, Sentry, Mixpanel, Segment) are present or loaded. Zero telemetry egress. |

---

## 3. Detailed Endpoint Audit

### 3.1 Local Sovereign Endpoints (`127.0.0.1:8000`)
All clinical ingestion, deterministic NLP, and storage operations are handled locally:

- `GET  /api/health` — Host environment, ONNX model presence, and Tesseract status probe.
- `POST /api/ingest/text` — Verbatim text ingestion with character offset tracking.
- `POST /api/ingest/audio` — Sovereign ASR audio ingestion via ONNX runtime.
- `POST /api/ingest/document` — Sovereign OCR document ingestion via Tesseract engine.
- `POST /api/clinical/extract` — Deterministic multilingual NER and ClinicalFact generation.
- `POST /api/clinical/verify-note` — Universal Zero-Fabrication Evidence Gatekeeper.
- `POST /api/encounters/save` — Local SQLite encounter persistence.
- `POST /api/encounters/approve` — Physician approval state transition lock.
- `POST /api/encounters/sync-queue` — Offline transaction sync queue.

### 3.2 Optional Cloud Endpoints
- `POST /api/generate-soap` — Proxies to Gemini API. When offline, returns HTTP 503 / Network Error, and client automatically activates `offlineLocalEngine`.

### 3.3 External ABDM Integration Endpoints
- `POST /api/fhir/push` — Export FHIR Bundle to ABDM gateway.
  - **Gate 1:** Requires explicit patient consent `hospitalSharing === true`. Denied consent completely disables the button and blocks network dispatch.
  - **Gate 2:** Requires explicit physician sign-off `approvalState === 'APPROVED'`. Unapproved drafts are blocked from external export.

---

## 4. Physical Offline Isolation Verification (Airplane Mode E2E)

### 4.1 Automated Offline Test Evidence
- **Test File:** `src/__tests__/airplaneModeE2E.test.ts` (1 passing test)
- **Test File:** `src/__tests__/regressionPhase87.test.ts` (Test 16 & Test 20 passing)
- **Test File:** `src/__tests__/offlineLocalEngine.test.tsx` (9 passing tests)
- **Behavior:**
  1. Kiosk patient case-taking operates with mock identity or local touch entry without internet.
  2. Audio transcripts process locally through deterministic extraction pipeline with verbatim evidence spans.
  3. Evidence Gate rejects any unanchored diagnoses or fabricated vitals locally.
  4. Local SQLite database writes encounter and clinical facts with complete provenance.
  5. Denied hospital sharing consent (`hospitalSharing: false`) successfully prohibits external network synchronization.

### 4.2 Network Traffic Isolation Conclusion
Under physical network disconnection (NIC disabled / Airplane Mode active):
1. No unhandled network exceptions occur.
2. The user experience remains uninterrupted.
3. Patient clinical data remains sovereign on the local device.
4. Zero ungrounded clinical facts are projected.
