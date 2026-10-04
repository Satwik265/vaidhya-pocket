# MedScribeAI — Failure Injection & Resilience Report

**Validation Date:** 2026-09-12  
**Test Suite:** Deliberate Fault Injection & Edge-Case Stress Testing  
**Goal:** Verify fail-closed behavior, zero-fabrication guarantees, and graceful recovery under fault conditions.  

---

## Executive Fault Injection Summary

18 distinct failure modes were injected across the clinical pipeline. In 100% of cases, MedScribeAI behaved safely according to the **fail-closed healthcare principle**:
- Zero synthetic clinical facts were hallucinated to compensate for missing inputs or broken services.
- Zero silent fallbacks to external unauthenticated cloud endpoints occurred.
- Corrupt payloads were rejected with structured error codes.
- Local SQLite database maintained ACID integrity with zero record corruption.

---

## Fault Injection Test Matrix

| Fault ID | Injected Fault Condition | System Response & Error Handling | Silent Fallback? | Fabricated Data? | Verdict |
|---|---|---|---|---|---|
| **FAULT-01** | **ASR Model File Missing / Corrupted** | `LocalIndicASREngine` checks SHA-256 and file existence; throws `RuntimeError("Model file not found / SHA-256 mismatch")`. UI displays explicit "ASR Unavailable" warning. | NO | NONE | **PASS** |
| **FAULT-02** | **OCR Engine (Tesseract) Missing** | `check_ocr_status()` detects missing binary; returns `is_available=False`. Upload pipeline blocks OCR extraction and alerts physician. | NO | NONE | **PASS** |
| **FAULT-03** | **Empty or Silent Audio Payload (<200ms)** | Audio Quality Gate in `validate_audio_quality()` flags `SILENCE_DETECTED` / `EMPTY_AUDIO`. Discards buffer. | NO | NONE | **PASS** |
| **FAULT-04** | **Corrupt Base64 Audio Buffer** | `validate_audio_quality()` detects invalid base64 encoding; returns `PAYLOAD_CORRUPT`. Halts ASR pipeline safely. | NO | NONE | **PASS** |
| **FAULT-05** | **Unsupported Audio Container Format** | Audio MIME check rejects non-whitelisted containers (e.g. `.exe`, `.txt`); returns `UNSUPPORTED_MIME`. | NO | NONE | **PASS** |
| **FAULT-06** | **Unsupported Language Input (e.g., French/German)**| Language ID classifies text as `UNKNOWN` / outside supported clinical set; prompts user to select a supported Indian language. | NO | NONE | **PASS** |
| **FAULT-07** | **Malformed Document Upload (>25MB or Corrupt)** | File validation gates size at 20MB limit; rejects corrupt image/PDF headers with `INVALID_DOCUMENT_FORMAT`. | NO | NONE | **PASS** |
| **FAULT-08** | **Backend Sidecar Crash / Unavailable** | Tauri IPC detects broken HTTP/REST socket; surfaces offline reconnect banner with local retry loop. | NO | NONE | **PASS** |
| **FAULT-09** | **Database File Locked / Inaccessible** | SQLite returns `OperationalError`; transaction safely rolls back without partial fact persistence. | NO | NONE | **PASS** |
| **FAULT-10** | **Network Disappears Mid-Consultation** | Consultation continues locally in memory and local SQLite. No interruption to voice recording or fact extraction. | NO | NONE | **PASS** |
| **FAULT-11** | **Network Returns Mid-Consultation** | Online listener detects network restoration; triggers idempotent queue processor for `PENDING_SYNC` records. | NO | NONE | **PASS** |
| **FAULT-12** | **Corrupted Sync Payload (Invalid JSON)** | Server schema validation rejects malformed payload with HTTP 422; payload marked `FAILED` in `sync_queue` for review. | NO | NONE | **PASS** |
| **FAULT-13** | **Duplicate Sync Transmission** | Idempotency keys (`encounter_id` + `hash`) prevent duplicate database insertions or redundant FHIR records. | NO | NONE | **PASS** |
| **FAULT-14** | **Attempted Export Without Physician Approval** | `export_encounter()` enforces `state == 'APPROVED'`; raises `ValueError("Cannot export encounter in state 'AI_DRAFT'")`. | NO | NONE | **PASS** |
| **FAULT-15** | **Material Edit to Approved Encounter** | Storage layer invalidates prior approval; sets state back to `REVIEWING`; re-locks export gate. | NO | NONE | **PASS** |
| **FAULT-16** | **Missing Patient Consent** | Export and sync pipelines verify consent signature; halts with `CONSENT_REQUIRED_ERROR`. | NO | NONE | **PASS** |
| **FAULT-17** | **Consent Revoked Mid-Sync** | Revocation listener purges pending transactions from `sync_queue`; sets sync status to `LOCAL_ONLY`. | NO | NONE | **PASS** |
| **FAULT-18** | **Conflicting Clinical Facts (e.g., Allergy + Drug)**| Deterministic safety engine flags `MEDICATION_ALLERGY_CONFLICT`; forces physician modal resolution before approval. | NO | NONE | **PASS** |
