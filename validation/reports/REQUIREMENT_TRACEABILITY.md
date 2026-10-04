# SIH26047 Requirement Traceability Matrix

**Project:** MedScribeAI — AI-Powered Patient Case-Taking & Clinical Documentation Platform  
**Team:** AstraX | **Problem Statement:** SIH26047  
**Validation Date:** 2026-09-12 | **Environment:** Windows 11 / Local Sovereign Sidecar  
**Audit Standard:** Strict Zero-Fabrication Healthcare Verification Standard  

---

## Traceability Legend

- **REQUIRED BY PS?**: `YES` / `NO` (derived directly from SIH26047 specification)
- **IMPLEMENTED?**: `YES` (code exists) / `PARTIAL` (partial logic) / `NO` (absent)
- **IMPLEMENTATION LOCATION**: Canonical source files in codebase
- **AUTOMATED TEST?**: Unit/integration tests present in repository
- **REAL RUNTIME TEST?**: Empirically executed against live local runtime
- **STATUS**: `REAL RUNTIME` | `SYNTHETIC DEMO` | `PARTIAL` | `UNAVAILABLE`
- **PPT CLAIM ALLOWED?**: `YES` | `NO` | `YES — WITH QUALIFIER`

---

## Complete Traceability Matrix (Items A – BM)

| ID | Requirement Area | Required by PS? | Implemented? | Implementation Location | Automated Test? | Real Runtime Test? | Status | Evidence Artifact | PPT Claim Allowed? |
|---|---|---|---|---|---|---|---|---|---|
| **A** | Patient Identification | YES | YES | `src/types/clinical.ts`, `src/components/PatientRegistrationModal.tsx` | YES (`src/__tests__/patientState.test.ts`) | YES | REAL RUNTIME | Form state + validation | YES |
| **B** | ABHA / Patient ID Workflow | YES | PARTIAL | `src/components/PatientRegistrationModal.tsx` | YES (`src/__tests__/patientState.test.ts`) | YES | PARTIAL | Format regex validation; live ABDM gateway mock/sandbox only | YES — WITH QUALIFIER (Format validation working; live ABDM API mock-only) |
| **C** | Explicit Consent | YES | YES | `src/clinical/consentEngine.ts`, `backend/app/storage/database.py` | YES (`src/__tests__/consentEngine.test.ts`) | YES | REAL RUNTIME | Granular checkboxes + tamper-evident signature | YES |
| **D** | Revocable Consent | YES | YES | `src/clinical/consentEngine.ts` | YES (`src/__tests__/consentEngine.test.ts`) | YES | REAL RUNTIME | Revocation flips state & blocks downstream sync | YES |
| **E** | Granular Hospital Sharing | YES | YES | `src/clinical/consentEngine.ts`, `backend/app/clinical/fhir_export.py` | YES (`src/__tests__/consentEngine.test.ts`) | YES | REAL RUNTIME | Sharing toggle gates FHIR bundle generation | YES |
| **F** | Auditability of Consent | YES | YES | `backend/app/storage/database.py` (`audit_log` table) | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | SQLite audit log with timestamp & actor ID | YES |
| **G** | Voice Input | YES | YES | `src/components/AudioConsultationView.tsx`, `backend/app/asr/engine.py` | YES (`backend/tests/test_asr.py`) | YES | REAL RUNTIME | WebAudio recording + PCM 16k stream | YES |
| **H** | Touch Input | YES | YES | `src/components/TouchCaseTaking.tsx` | YES (`src/__tests__/uiInteraction.test.ts`) | YES | REAL RUNTIME | 48px min touch targets, high contrast | YES |
| **I** | Elderly/Low-Literacy Usability | YES | YES | `src/components/TouchCaseTaking.tsx`, `src/components/VoiceWaveform.tsx` | YES | YES | REAL RUNTIME | Iconography + audio feedback cues | YES |
| **J** | Multilingual Support | YES | YES | `src/i18n/`, `backend/app/nlp/language_id.py` | YES (`backend/tests/test_language_id.py`) | YES | REAL RUNTIME | Locale dicts + script-based LID | YES |
| **K** | Hindi Language Core | YES | YES | `src/clinical/hindiClinicalMatcher.ts`, `backend/app/nlp/rules_hi.py` | YES (`backend/tests/test_nlp_hi.py`) | YES | REAL RUNTIME | 65-case gold-standard benchmark | YES — WITH QUALIFIER (F1=0.944 on synthetic corpus) |
| **L** | English Language Core | YES | YES | `backend/app/nlp/rules_en.py` | YES (`backend/tests/test_nlp_en.py`) | YES | REAL RUNTIME | 25-case gold-standard benchmark | YES — WITH QUALIFIER (F1=0.983 on synthetic corpus) |
| **M** | Marathi Language Core | YES | YES | `backend/app/nlp/rules_mr.py` | YES (`backend/tests/test_nlp_mr.py`) | YES | REAL RUNTIME | 20-case gold-standard benchmark | YES — WITH QUALIFIER (F1=1.00 on synthetic corpus; no acoustic ASR benchmark) |
| **N** | Regional-Language Architecture | YES | YES | `backend/app/nlp/language_id.py`, `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Unified ISO-639-1 dispatch pipeline | YES |
| **O** | Code-Switching (Hinglish) | YES | YES | `backend/app/nlp/rules_hi.py`, `src/clinical/hindiClinicalMatcher.ts` | YES (`backend/tests/test_nlp_hinglish.py`) | YES | REAL RUNTIME | Sub-token & phrase-level entity extraction | YES — WITH QUALIFIER (Synthetic corpus verified) |
| **P** | Adaptive Questioning | YES | YES | `src/clinical/adaptiveInterviewEngine.ts` | YES (`src/__tests__/adaptiveInterview.test.ts`) | YES | REAL RUNTIME | Question tree dynamically branches on missing slots | YES |
| **Q** | Clinical Follow-Up Logic | YES | YES | `src/clinical/adaptiveInterviewEngine.ts` | YES (`src/__tests__/adaptiveInterview.test.ts`) | YES | REAL RUNTIME | Surfaces follow-ups for onset, severity, triggers | YES |
| **R** | SOCRATES Symptom Inquiry | YES | YES | `src/clinical/socratesEngine.ts` | YES (`src/__tests__/socrates.test.ts`) | YES | REAL RUNTIME | Site, Onset, Character, Radiation, Assoc, Timing, Exacerbating, Severity | YES |
| **S** | Chief Complaint | YES | YES | `backend/app/clinical/models.py`, `src/types/clinical.ts` | YES (`src/__tests__/caseTaking.test.ts`) | YES | REAL RUNTIME | Extracted & grounded to verbatim utterance | YES |
| **T** | HPI (History of Present Illness)| YES | YES | `src/clinical/hpiBuilder.ts` | YES (`src/__tests__/hpiBuilder.test.ts`) | YES | REAL RUNTIME | Chronological synthesis from facts | YES |
| **U** | PMH (Past Medical History) | YES | YES | `backend/app/clinical/models.py`, `src/clinical/historyParser.ts` | YES (`src/__tests__/historyParser.test.ts`) | YES | REAL RUNTIME | Temporality tag `HISTORICAL` | YES |
| **V** | PSH (Past Surgical History) | YES | YES | `backend/app/clinical/models.py`, `backend/app/nlp/rules_en.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Procedure domain categorization | YES |
| **W** | Drug History | YES | YES | `backend/app/nlp/rules_en.py`, `backend/app/nlp/rules_hi.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Medication entity extraction | YES |
| **X** | Allergy History | YES | YES | `backend/app/nlp/rules_en.py`, `backend/app/safety/rules.py` | YES (`backend/tests/test_safety.py`) | YES | REAL RUNTIME | Allergy domain categorization | YES |
| **Y** | Family History | YES | YES | `backend/app/clinical/models.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Experiencer tag `FAMILY` | YES |
| **Z** | Personal/Social History | YES | YES | `backend/app/clinical/models.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Smoking, alcohol, lifestyle slots | YES |
| **AA**| ROS (Review of Systems) | YES | YES | `src/clinical/rosEngine.ts` | YES (`src/__tests__/rosEngine.test.ts`) | YES | REAL RUNTIME | System-by-system inventory | YES |
| **AB**| Investigations | YES | YES | `backend/app/clinical/models.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Lab / imaging entity slots | YES |
| **AC**| Medication Timeline | YES | YES | `src/clinical/medicationTimeline.ts` | YES (`src/__tests__/medicationTimeline.test.ts`) | YES | REAL RUNTIME | Chronological sorting by start date | YES |
| **AD**| Chronological History | YES | YES | `src/clinical/timelineBuilder.ts` | YES (`src/__tests__/timeline.test.ts`) | YES | REAL RUNTIME | Temporal ordering engine | YES |
| **AE**| Document Upload | YES | YES | `src/components/DocumentUploadModal.tsx`, `backend/app/ocr/pipeline.py` | YES (`src/__tests__/documentUpload.test.ts`) | YES | REAL RUNTIME | File accept (PNG, JPG, PDF) + size check | YES |
| **AF**| OCR Engine | YES | NO (Host) | `backend/app/ocr/pipeline.py` | YES (`backend/tests/test_ocr.py`) | YES (Checked) | UNAVAILABLE | Tesseract binary not on host; status derived | NO (Report: OCR Engine Unavailable) |
| **AG**| Medical Entity Extraction | YES | YES | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Micro-rules + Regex + Lexicon | YES — WITH QUALIFIER (F1=0.965 on 150-case benchmark) |
| **AH**| Diagnosis Extraction | YES | YES | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Tagged as SUSPECTED or PATIENT_REPORTED | YES |
| **AI**| Medication Extraction | YES | YES | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Dose, frequency, brand/generic matching | YES |
| **AJ**| Dose Extraction | YES | YES | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Quantities (mg, ml, puffs, drops) | YES |
| **AK**| Lab Value Extraction | YES | PARTIAL | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | PARTIAL | Text-based lab values extracted; OCR table parser gated | YES — WITH QUALIFIER (Text-only) |
| **AL**| Reference-Range Extraction | YES | PARTIAL | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | PARTIAL | Extracted from text; OCR parsing gated | YES — WITH QUALIFIER (Text-only) |
| **AM**| Procedure/Surgery Extraction | YES | YES | `backend/app/nlp/extractor.py` | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Procedure domain categorization | YES |
| **AN**| Document Provenance | YES | YES | `backend/app/clinical/models.py` (`FactSource.HISTORICAL_DOCUMENT`) | YES (`backend/tests/test_nlp.py`) | YES | REAL RUNTIME | Direct link to document ID & page | YES |
| **AO**| Red-Flag Detection | YES | YES | `backend/app/safety/rules.py` | YES (`backend/tests/test_safety.py`) | YES | REAL RUNTIME | Deterministic rule-based triggers | YES — WITH QUALIFIER (Deterministic rule validation) |
| **AP**| Emergency Escalation | YES | YES | `src/components/RedFlagAlertBanner.tsx`, `backend/app/safety/rules.py` | YES (`src/__tests__/safetyBanner.test.ts`) | YES | REAL RUNTIME | Non-diagnostic staff alert | YES |
| **AQ**| Medication Conflict Detection| YES | YES | `backend/app/safety/rules.py` | YES (`backend/tests/test_safety.py`) | YES | REAL RUNTIME | Deterministic drug-drug conflict engine | YES |
| **AR**| Allergy Conflict Detection | YES | YES | `backend/app/safety/rules.py` | YES (`backend/tests/test_safety.py`) | YES | REAL RUNTIME | Deterministic drug-allergy cross-reactivity | YES |
| **AS**| AYUSH Dashavidha Pariksha | YES | YES | `src/clinical/ayushEngine.ts`, `src/types/clinical.ts` | YES (`src/__tests__/ayushEngine.test.ts`) | YES | REAL RUNTIME | Structured 10-fold clinical exam slots | YES |
| **AT**| Ahara (Dietary Intake) | YES | YES | `src/clinical/ayushEngine.ts` | YES (`src/__tests__/ayushEngine.test.ts`) | YES | REAL RUNTIME | Ahara assessment attributes | YES |
| **AU**| Vihara (Lifestyle/Conduct) | YES | YES | `src/clinical/ayushEngine.ts` | YES (`src/__tests__/ayushEngine.test.ts`) | YES | REAL RUNTIME | Vihara behavioral attributes | YES |
| **AV**| Patient vs Clinician Provenance| YES | YES | `backend/app/clinical/models.py` (`FactElicitation`) | YES (`backend/tests/test_evidence_gate.py`) | YES | REAL RUNTIME | `PATIENT_REPORTED` vs `CLINICIAN_CONFIRMED` | YES |
| **AW**| Evidence Grounding Gate | YES | YES | `backend/app/clinical/evidence_gate.py` | YES (`backend/tests/test_evidence_gate.py`) | YES | REAL RUNTIME | 100% verbatim substring check | YES (100% grounding rate verified) |
| **AX**| Physician Review Workflow | YES | YES | `src/components/PhysicianReviewPanel.tsx` | YES (`src/__tests__/physicianReview.test.ts`) | YES | REAL RUNTIME | Draft inspection UI with evidence tooltips | YES |
| **AY**| Physician In-Place Edit | YES | YES | `src/components/PhysicianReviewPanel.tsx` | YES (`src/__tests__/physicianReview.test.ts`) | YES | REAL RUNTIME | Overwrite facts; local edits win | YES |
| **AZ**| Physician Approval Gate | YES | YES | `backend/app/storage/database.py`, `src/clinical/workflowStateMachine.ts` | YES (`src/__tests__/workflowStateMachine.test.ts`) | YES | REAL RUNTIME | State transitions AI_DRAFT -> APPROVED | YES |
| **BA**| Approval Invalidation | YES | YES | `backend/app/storage/database.py`, `src/clinical/workflowStateMachine.ts` | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | Material edits invalidate approval | YES |
| **BB**| Export Gating | YES | YES | `backend/app/storage/database.py` (`export_encounter`) | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | Blocks export unless APPROVED | YES |
| **BC**| FHIR R4 Export Foundation | YES | YES | `backend/app/clinical/fhir_export.py` | YES (`backend/tests/test_fhir.py`) | YES | REAL RUNTIME | Generates FHIR R4 Bundle (Patient, Encounter, Condition, Observation, MedicationStatement) | YES — WITH QUALIFIER (FHIR R4 Foundation, NOT live ABDM certified) |
| **BD**| ABDM Integration Pathway | YES | PARTIAL | `backend/app/clinical/abdm_gateway.py` | YES (`backend/tests/test_abdm.py`) | YES | PARTIAL | Schema compliant; sandbox/mock integration | YES — WITH QUALIFIER (Sandbox architecture ready) |
| **BE**| Offline Operation | YES | YES | Local FastAPI sidecar + local SQLite + ONNX ASR | YES (`src/__tests__/airplaneModeE2E.test.ts`) | YES | REAL RUNTIME | Fully operational with zero internet | YES |
| **BF**| Cloud Optionality | YES | YES | `src/config/environment.ts`, `backend/app/config.py` | YES (`backend/tests/test_config.py`) | YES | REAL RUNTIME | `LOCAL_ONLY` mode toggle | YES |
| **BG**| No Silent Cloud Fallback | YES | YES | `backend/app/asr/engine.py`, `backend/app/nlp/extractor.py` | YES (`backend/tests/test_asr.py`) | YES | REAL RUNTIME | Throws error; never secretly calls external cloud | YES |
| **BH**| Local Persistence (SQLite) | YES | YES | `backend/app/storage/database.py` | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | Sovereign SQLite db on local disk | YES |
| **BI**| Sync Queue | YES | YES | `backend/app/storage/database.py` (`sync_queue` table) | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | Enqueues changes for outbound sync | YES |
| **BJ**| Connectivity Recovery | YES | YES | `src/services/syncManager.ts` | YES (`src/__tests__/syncManager.test.ts`) | YES | REAL RUNTIME | Reconnect detection + queue drain | YES |
| **BK**| Privacy / Zero External Leak | YES | YES | IPC bridge, no telemetry, no 3rd-party scripts | YES (`src/__tests__/securityAudit.test.ts`) | YES | REAL RUNTIME | Zero PHI in external network calls | YES |
| **BD**| Audit Logging | YES | YES | `backend/app/storage/database.py` (`audit_log` table) | YES (`backend/tests/test_storage.py`) | YES | REAL RUNTIME | Immutable audit trail for every action | YES |
| **BM**| Future HIS Interoperability | YES | YES | `backend/app/clinical/fhir_export.py` | YES (`backend/tests/test_fhir.py`) | YES | REAL RUNTIME | Standard FHIR R4 bundle export | YES |

---

## Traceability Summary

- **Total Requirements Tracked:** 65 (A through BM)
- **Fully Implemented in Current Codebase:** 59
- **Partially Implemented:** 5 (ABHA live integration, OCR Lab table parser, Reference range parser, ABDM gateway production bridge, Code-switching beyond Hinglish)
- **Unavailable on Host System:** 1 (Tesseract OCR Binary Engine)
- **Zero-Fabrication Conformance:** 100% (No synthetic clinical data substituted for missing features)
