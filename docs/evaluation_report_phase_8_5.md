# MedScribeAI — Phase 8.5 Sovereign Local AI Runtime & Clinical Reality-Check Evaluation Report

**Date**: September 2026
**System**: MedScribeAI Sovereign Clinical Kiosk Runtime
**Audit Scope**: Phase 8.5 Independent Reality-Check & Verification Audit

---

## 1. Reality Check Summary & Claim Classification Matrix

Every architectural capability and claimed metric has been independently tested and classified into one of five standard operational states:
- **VALIDATED**: Fully executed, measured, and verified on real host runtime.
- **PARTIALLY VALIDATED**: Real deterministic components executed; dependent on unbundled physical model weights or system binaries for end-to-end inference.
- **CONFIGURED**: Code scaffolding, build configuration, and process management exist and are syntactically valid, but binary is uncompiled or unexecuted.
- **UNAVAILABLE**: Required external binary or physical model weights are absent from local storage.
- **DEFERRED**: Intentionally held back for subsequent deployment packaging phases.

### Reality Check Classification Matrix

| Capability / Metric | Phase 8.5 Claim | Independent Audit Finding | Reality-Check Classification |
| :--- | :--- | :--- | :--- |
| **Local ASR Pipeline** | Real IndicConformer ONNX inference | Pipeline code exists (`backend/app/asr/engine.py`), but `models/` folder does not exist on disk. No `.onnx` files found. `local_asr_engine.transcribe()` reports `UNAVAILABLE`. | **UNAVAILABLE / NOT VALIDATED** |
| **ASR WER (4.2%)** | 4.2% Clean WER, 2.1% CER | Evaluated on unit test fixtures (`backend/tests/fixtures/speech_samples.py`) where simulated ASR output was hardcoded to equal ground truth. **Not** derived from real acoustic inference. | **SIMULATED FIXTURE (CLAIM DOWNGRADED)** |
| **Clinical Term Recall** | 96.8% Clinical Recall | Evaluated on test fixtures. Real NLP extractor achieves 94.83% on held-out text. | **PARTIALLY VALIDATED** (Text NLP real; Acoustic simulated) |
| **Negation Preservation**| 100.0% Negation Preservation | Verified in deterministic NLP extraction and safety triage. | **VALIDATED** |
| **Local OCR Preprocessing**| OpenCV CLAHE, Bilateral, Otsu, Deskew | Genuinely runs in Python OpenCV (`preprocess_image_for_ocr`). Measured latency: 35-41 ms, Peak RAM: 4.6-16.8 MB. | **VALIDATED** |
| **Local OCR Recognition** | Real Tesseract Text Extraction | `where.exe tesseract` fails. Tesseract binary not installed on host PATH. Pipeline correctly refuses to fabricate text and returns `UNAVAILABLE`. | **UNAVAILABLE / NOT VALIDATED** |
| **Handwriting OCR** | Hand-written prescription support | Raw handwriting OCR without Tesseract/TrOCR is impossible on host. Handwriting support is strictly unavailable. | **UNAVAILABLE** |
| **Clinical Benchmark** | 150-Case Clinical Benchmark | Benchmark dataset created by clinical domain developers. Tested on 50-case held-out test split (zero rule tuning): Precision 100%, Recall 94.83%, F1 97.35%, Assertion 98.18%, Temporality 100%, Experiencer 98.18%. | **VALIDATED** (Held-Out Test Split) |
| **Zero Fabrication / Hallucination** | 0% Hallucination Rate | 0 unanchored facts emitted across all 150 benchmark cases. All unanchored diagnoses/vitals/prescriptions/allergies blocked by Evidence Gate. | **VALIDATED** |
| **Safety Engine** | Deterministic Red Flag Triage | "Chest pain nahi hai" -> 0 alerts. Affirmed chest pain + dyspnea -> ACS alert. Contrastive negation -> Severe dyspnea alert (ACS blocked). Zero treatment directives emitted. | **VALIDATED** |
| **Evidence Gatekeeper** | Zero-Fabrication Enforcement | Unsupported GERD/Amlapitta blocked; fake vitals blocked; unauthorized prescriptions blocked; ungrounded allergies blocked; invalid character offsets rejected. | **VALIDATED** |
| **Offline Intake Lifecycle** | 0 external network requests | Intercepted in E2E test; 0 network calls emitted. Store, NLP, Safety, FHIR export function 100% locally. | **VALIDATED** (Deterministic Core) |
| **Offline End-to-End Inference** | Offline ASR + OCR + NLP | Full end-to-end audio-to-text and image-to-text fails offline due to missing model weights and Tesseract binary. | **PARTIALLY VALIDATED** |
| **Tauri 2 Packaging** | Packaged desktop application | Scaffolding (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`) exists. Tauri CLI is not installed on system. Binary is not compiled or packaged. | **CONFIGURED (NOT EXECUTED)** |
| **ABDM Integration** | Real ABDM Gateway integration | Mock sandbox schemas and pre-integration stubs. Zero live ABDM network access or NHA certification. | **MOCK / DEFERRED (UNAVAILABLE)** |

---

## 2. ASR Reality Check & Metric Validation

### 2.1 Acoustic Model Audit
- **Code Location**: `backend/app/asr/engine.py`
- **Expected Model Path**: `models/indic_conformer_ctc.onnx` or `models/whisper_base_int8.onnx`
- **Actual Directory Check**: The `models/` directory **does not exist** in the repository root. No ONNX weights exist locally.
- **Runtime Execution**:
  ```python
  from app.asr.engine import local_asr_engine
  local_asr_engine.transcribe(audio_bytes)
  # Raises: RuntimeError("Local IndicConformer ONNX inference model unavailable.")
  # Status: is_available=False, status='UNAVAILABLE'
  ```
- **Verdict**: **`ASR = NOT VALIDATED`**. No real acoustic model inference was run on the host system.

### 2.2 Metric Validation (WER, CER, Clinical Recall)
- **Source of Claimed Metrics**: Inspected `backend/tests/fixtures/speech_samples.py` and `backend/tests/test_asr_engine.py`.
- **Finding**: In `test_asr_engine.py`, the test cases used `speech_samples` where `simulated_asr_output` was identical to `ground_truth_transcript` (e.g. Clean condition WER: 0 errors / 24 words = 0.0%, overall average with simulated noise substitutions: 4.2%).
- **Distinction**:
  - **REAL MODEL RESULT**: **UNAVAILABLE / NOT VALIDATED** (No ONNX model weights).
  - **UNIT TEST RESULT**: 4.2% WER and 2.1% CER were computed against hardcoded simulated test fixtures, **not** a physical acoustic model.
- **Correction**: The claim of 4.2% WER as an empirical model benchmark is **withdrawn from documentation**.

---

## 3. OCR Reality Check & Document Quality

### 3.1 Host Environment Check
- Command: `where.exe tesseract`
- Result: `INFO: Could not find files for the given pattern(s)`
- Command: `tesseract --version`
- Result: Executable not found. `resolve_tesseract_cmd()` returns `None`.

### 3.2 OpenCV Preprocessing Pipeline (Genuinely Real)
The OpenCV preprocessing pipeline is implemented in `backend/app/ocr/pipeline.py` (`preprocess_image_for_ocr`):
- Grayscale conversion
- Contrast Limited Adaptive Histogram Equalization (CLAHE, `clipLimit=2.0, tileGridSize=(8, 8)`)
- Bilateral filtering (`d=7, sigmaColor=50, sigmaSpace=50`)
- Otsu adaptive binarization (`cv2.THRESH_BINARY + cv2.THRESH_OTSU`)
- MinAreaRect deskew angle estimation

**Empirical Performance on Host Hardware (Intel Core Ultra 5 125H)**:
- **Prescription (800x1200)**: 41.16 ms, Peak RAM: 4.66 MB
- **Lab Report (1200x1600)**: 38.41 ms, Peak RAM: 9.23 MB
- **Discharge Summary (1600x2200)**: 35.24 ms, Peak RAM: 16.86 MB

### 3.3 Document Quality Audit Across Fixtures

| Document Category | Document Type | Preprocessing Status | Optical Recognition Status | Clinical Fact Extraction (via text) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Printed Prescription** | Dr. R. K. Sharma Rx | **VALIDATED** (38 ms) | **UNAVAILABLE** (Binary absent) | **VALIDATED** (Metformin, Telmisartan extracted) |
| **2. Printed Hindi Document**| हिन्दी परामर्श पर्ची | **VALIDATED** (39 ms) | **UNAVAILABLE** (Binary absent) | **VALIDATED** (मधुमेह, उच्च रक्तचाप extracted) |
| **3. Lab Report** | Metro Pathology HbA1c | **VALIDATED** (38 ms) | **UNAVAILABLE** (Binary absent) | **VALIDATED** (HbA1c 8.4%, Glucose extracted) |
| **4. Discharge Summary** | City Care Discharge Note | **VALIDATED** (35 ms) | **UNAVAILABLE** (Binary absent) | **VALIDATED** (Hypertension, Asthma extracted) |
| **5. Handwritten Prescription**| Dr. S. K. Gupta Rx | **VALIDATED** (41 ms) | **UNAVAILABLE** (Binary absent) | **UNAVAILABLE** (No handwriting OCR capability) |

*Zero Fabrication Invariant*: When raw image bytes are passed without pre-extracted text, the pipeline raises `RuntimeError("Local Tesseract OCR binary not detected on system PATH.")` and emits **zero synthetic facts**.

---

## 4. Clinical Benchmark Audit & Held-Out Test Evaluation

### 4.1 Benchmark Dataset Methodology
- **File**: `backend/app/clinical/benchmark_dataset.py` (150 clinical cases).
- **Origin**: Synthesized by clinical software developers to model outpatient clinical dialogues across 12 medical specialties.
- **Rule Tuning Audit**: The deterministic regex rules in `backend/app/nlp/extractor.py` were historically authored by inspecting common clinical phrases. To avoid overfitting bias, an independent evaluation split was established:
  - **DEV Set**: 100 cases (67%)
  - **HELD-OUT TEST Set**: 50 cases (33%) spanning all 6 supported languages. No rule modifications were permitted based on held-out error analysis.

### 4.2 Held-Out Test Set Results (50 Cases)

| Metric | Measured on Held-Out Test Set (50 Cases) | Target Threshold | Status |
| :--- | :--- | :--- | :--- |
| **Precision** | **1.0000 (100.0%)** | ≥ 0.9000 | **PASS** |
| **Recall** | **0.9483 (94.83%)** | ≥ 0.9000 | **PASS** |
| **F1 Score** | **0.9735 (97.35%)** | ≥ 0.9000 | **PASS** |
| **Assertion Accuracy** | **0.9818 (98.18%)** | ≥ 0.9200 | **PASS** |
| **Temporality Accuracy**| **1.0000 (100.0%)** | ≥ 0.9000 | **PASS** |
| **Experiencer Accuracy**| **0.9818 (98.18%)** | ≥ 0.9500 | **PASS** |
| **Hallucination / Fabrication Rate** | **0.00% (0 unanchored facts)** | 0.00% | **PASS** |

### 4.3 Linguistic Distribution of Held-Out Test Set (50 Cases)
- **Hindi (Devanagari)**: 12 cases
- **Hinglish (Romanized Hindi)**: 10 cases
- **English**: 8 cases
- **Marathi (देवनागरी)**: 7 cases
- **Tamil (தமிழ்)**: 7 cases
- **Gujarati (ગુજરાતી)**: 6 cases

---

## 5. Clinical Safety & Evidence Gate Validation

### 5.1 Safety Rule Invariants
Tested in `backend/tests/test_safety_benchmark.py`:
1. **Negative Assertion Safety**:
   - Input: `"Chest pain nahi hai."`
   - Emitted Facts: `SYM_CHEST_PAIN` (`assertion: NEGATED`)
   - Emitted Alerts: **0 red flags**. (Negated symptom does not trigger ischemic heart alert).
2. **ACS Red Flag Combination**:
   - Input: `"Chest pain hai aur saans lene mein dikkat hai."`
   - Emitted Facts: `SYM_CHEST_PAIN` (`PRESENT`) + `SYM_BREATHLESSNESS` (`PRESENT`)
   - Emitted Alerts: `RED_FLAG_ACS_DYSPNEA` (`severity: CRITICAL`), immediate physician triage flagged.
3. **Contrastive Negation Safety**:
   - Input: `"Chest pain nahi hai lekin saans lene mein bahut dikkat hai."`
   - Emitted Facts: `SYM_CHEST_PAIN` (`NEGATED`) + `SYM_BREATHLESSNESS` (`PRESENT`)
   - Emitted Alerts: `RED_FLAG_SEVERE_DYSPNEA` (`severity: HIGH`). ACS alert is **not** triggered.
4. **Zero Treatment Directive Invariant**:
   - Every alert is strictly marked `is_triage_only: true`.
   - Verified that zero treatment directives, prescription recommendations, or dosage instructions are emitted.

### 5.2 Evidence Gate Enforcement
Tested in `backend/tests/test_evidence_gate.py` and `src/__tests__/canonicalClinicalFacts.test.ts`:
- **Unanchored Diagnosis Injection**: Injected `"Gastroesophageal Reflux Disease (GERD)"` and `"Amlapitta"` without supporting text facts -> **REJECTED** (`UNANCHORED_GERD_AMLAPITTA`).
- **Fabricated Vitals Injection**: Injected `"120/80 mmHg"` into summary without vital fact -> **REJECTED** (`FABRICATED_VITAL_SIGNS`).
- **Fabricated Prescription Injection**: Injected `"Tab Metformin 500mg"` without clinician sign-off -> **REJECTED** (`FABRICATED_PRESCRIPTION`).
- **Unanchored Allergy Injection**: Injected unanchored allergy claim -> **REJECTED** (`UNANCHORED_ALLERGY`).
- **Invalid Provenance Offset**: Attempted fact with `end_char < start_char` -> **REJECTED** at Pydantic schema validation.

---

## 6. Fabrication Audit Across Production Codebase

Audited all occurrences of potential fallback strings (`GERD`, `Amlapitta`, `Metformin`, `Telmisartan`, `Pantoprazole`, `Aspirin`, `Lisinopril`, `Amoxicillin`, `120/80`, `72 bpm`, `HbA1c`, `NKDA`, `diagnosis =`, `prescription =`):

| Occurrence Location | Purpose / Context | Classification | Safety Evaluation |
| :--- | :--- | :--- | :--- |
| `backend/app/clinical/evidence_gate.py` | Blacklist of forbidden synthetic diagnoses | **SAFETY RULE** | Approved (enforces rejection) |
| `src/clinical/evidenceGate.ts` | Blacklist of forbidden synthetic diagnoses | **SAFETY RULE** | Approved (enforces rejection) |
| `backend/app/nlp/extractor.py` | Regex patterns matching clinical medications | **PRODUCTION (DICTIONARY)** | Approved (only matches verbatim text) |
| `src/utils/offlineLocalEngine.ts` | Demo encounter pre-fills | **DEMO ONLY** | Approved: Strictly gated behind `if (isDemo)`. In production (`isDemo === false`), output is empty or `Pending physician evaluation`. |
| `backend/tests/` | Unit test fixtures | **TEST** | Isolated to test directories |
| `docs/` | Architectural documentation | **DOCUMENTATION** | Informational |

**Conclusion**: Zero synthetic clinical data is reachable from any production patient intake path.

---

## 7. Airplane-Mode & Tauri Desktop Status

### 7.1 Airplane-Mode Network Audit
- Verified in `src/__tests__/airplaneModeE2E.test.ts`: Exactly **0 external HTTP/HTTPS/WebSocket network calls** were emitted during a complete patient intake flow.
- The deterministic NLP, clinical fact store, safety engine, and FHIR export function 100% locally.
- However, physical acoustic and optical recognition cannot be executed in offline mode on this host because model weights and Tesseract binaries are not installed.
- **Classification**: **`PARTIALLY VALIDATED`** (Core deterministic engine validated; weights/binaries missing).

### 7.2 Tauri Desktop Packaging Status
- Files present: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/main.rs`.
- `cargo-tauri` / `@tauri-apps/cli` is **not installed** on the system (`cargo tauri --version` returned command not found).
- Python sidecar binary (`src-tauri/binaries/medscribe-backend-*.exe`) is not yet frozen or bundled.
- Headless cargo compilation on this host encountered Windows OS file-locking (sharing violation os error 32) on intermediate object files.
- **Classification**: **`CONFIGURED (NOT EXECUTED / UNPACKAGED)`**.

---

## 8. Real Performance Benchmarks (Empirical Measurements)

Measured on Intel Core Ultra 5 125H (14 cores, 16 GB RAM, Windows 11):

| Module | Operation | Input Size / Parameters | Latency | Peak Memory |
| :--- | :--- | :--- | :--- | :--- |
| **OpenCV Preprocessing** | Grayscale + CLAHE + Denoise + Otsu + Deskew | 800 x 1200 (Prescription) | **41.16 ms** | 4.66 MB |
| **OpenCV Preprocessing** | Grayscale + CLAHE + Denoise + Otsu + Deskew | 1200 x 1600 (Lab Report) | **38.41 ms** | 9.23 MB |
| **OpenCV Preprocessing** | Grayscale + CLAHE + Denoise + Otsu + Deskew | 1600 x 2200 (Discharge Summary) | **35.24 ms** | 16.86 MB |
| **Deterministic NLP** | Extract Clinical Facts (English) | 55 chars (Short sentence) | **29.77 ms** (warmup) | 106.9 KB |
| **Deterministic NLP** | Extract Clinical Facts (Hindi) | 93 chars (Medium utterance) | **1.75 ms** | 15.8 KB |
| **Deterministic NLP** | Extract Clinical Facts (English) | 324 chars (Long encounter) | **2.57 ms** | 21.4 KB |
| **Safety Engine** | Evaluate Red Flags & Clinical Triage | 5 Clinical Facts | **0.007 ms** (7 µs) | In-register |
| **Evidence Gate** | Integrity Audit of Projections | 5 Facts + Diagnoses + Rx + Vitals | **0.377 ms** | In-register |

---

## 9. Non-Negotiable Compliance & Disclaimers

1. **Rule 1 & Rule 2 (Zero Fabrication)**: No synthetic fallback data exists in production intake paths. Unanchored clinical assertions are strictly blocked by the Evidence Gate.
2. **Rule 6 (Physician Approval Gate)**: All clinical facts, draft summaries, and proposed orders remain marked pending until explicit clinician sign-off.
3. **Rule 7 (Offline Honesty)**: The deterministic core is 100% offline. Local ASR and OCR text extraction are honestly reported as `UNAVAILABLE` due to missing weights/binaries.
4. **Rule 8 (ABDM Disclaimer)**: MedScribeAI does **NOT** claim active or certified integration with the Ayushman Bharat Digital Mission (ABDM) Gateway. All ABDM functions operate under explicit sandbox mock schemas until formal NHA institutional certification is granted.
