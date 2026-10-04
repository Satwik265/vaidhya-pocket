# Phase 8.6 Runtime Validation — Final Gate Report

## Final Status Summary

| Component | MODEL LOADABILITY | INFERENCE | ACCURACY | PACKAGING |
|---|---|---|---|---|
| ASR (IndicConformer) | PROVEN | PROVEN (synthetic) | DEFERRED | — |
| OCR (Tesseract) | BINARY ABSENT | BLOCKED | DEFERRED | — |
| NLP/NER (deterministic) | N/A | PROVEN | VALIDATED | — |
| ClinicalFact pipeline | N/A | PROVEN | VALIDATED | — |

---

## GATE A — Physical Model Artifacts

### Deployment Directory

```
D:\MedscribeAI\models\asr\indic-conformer\
  model.int8.onnx    196,977,855 bytes
  config.json              735 bytes
  README.md              8,902 bytes
  vocab.json            68,706 bytes   (5632 BPE tokens, source: sulabhkatiyar)
  tokens.txt            73,238 bytes   (5633 lines, blank=<blk> at index 5632)
```

### Model Registry

| Field | Value |
|---|---|
| Absolute path | `D:\MedscribeAI\models\asr\indic-conformer\model.int8.onnx` |
| File size | 196,977,855 bytes |
| SHA-256 | `b99a01834cd1a72cd9be682a0b9543df6b152ef7dfceba88d3dbf59fbb77075d` |
| HF repository | `meetsync/indic-conformer-onnx-sherpa` |
| Exact revision | `e19ba0d2f49c243fe4ce79ae3334526a03e753ae` |
| Original model | `ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large` |
| Conversion type | Third-party ONNX/INT8 (NOT official AI4Bharat release) |
| License | MIT |
| Quantization | INT8 |

### ONNX Tensor Contract (Verified Against Physical Model)

Verified via `onnxruntime.InferenceSession.get_inputs()` / `get_outputs()` and `get_modelmeta()`:

```
ONNX Metadata:
  producer_name   : onnx.quantize
  model_type      : EncDecCTCModelBPE
  model_author    : ai4bharat
  vocab_size      : 5633
  subsampling_factor: 4
  normalize_type  : per_feature

INPUTS:
  name='processed_signal'        shape=['batch', 80, 'time']  dtype=tensor(float)
  name='processed_signal_length' shape=['batch']              dtype=tensor(int64)

OUTPUTS:
  name='log_probs'               shape=['batch', 'time_out', 5633]  dtype=tensor(float)
  name='output_length'           shape=['batch']                    dtype=tensor(int64)

CTC blank token: index 5632  (<blk>)
Basis: NeMo EncDecCTCModelBPE places blank at vocab_size-1.
BPE vocab: indices 0..5631 (5632 tokens from sulabhkatiyar vocab.json).
```

### Runtime Decision

| Option | Status |
|---|---|
| sherpa-onnx OfflineRecognizer (`from_nemo_ctc`) | **SELECTED & ACTIVE** — authoritative C++ `OfflineNemoEncDecCtcModel` with native NeMo 80-mel filterbank & SentencePiece BPE decoding |
| onnxruntime-cpu CTC | **FALLBACK** — retained as fallback runtime |

---

## GATE B — Physical Inference Proof

> **AUDIO SOURCE: SYNTHETIC 440 Hz sine tone. NOT real speech.**
> This proves inference execution only. WER is NOT measured. See Gate C.

```
MODEL STATUS       : LOADED
MODEL PATH         : D:\MedscribeAI\models\asr\indic-conformer\model.int8.onnx
MODEL SHA256       : b99a01834cd1a72cd9be682a0b9543df6b152ef7dfceba88d3dbf59fbb77075d
EXECUTION PROVIDER : CPUExecutionProvider (onnxruntime)
AUDIO SOURCE       : SYNTHETIC 440Hz sine tone (NOT real speech)
AUDIO DURATION     : 1.000s
SAMPLE RATE        : 16000 Hz
AUDIO RMS          : 0.28281
INPUT SHAPE        : (1, 80, 103)
LOG_PROBS SHAPE    : (1, 26, 5633)
OUTPUT LENGTH      : 26
INFERENCE LATENCY  : 36.2ms
RTF                : 0.0362
TRANSCRIPT         : 'हा'  (meaningless output from sine tone)
```

The transcript `'हा'` originates from model inference on a 440 Hz sine tone. It is meaningless. It confirms that:
- The full preprocessing pipeline executes (audio → mel spectrogram → ONNX → CTC decode)
- The CTC blank (index 5632) is correctly excluded
- The BPE vocab maps token IDs to Hindi script characters

**ASR MODEL: AVAILABLE**
**ASR: SMOKE_VALIDATED**

---

## GATE C — Human Speech

ASR ACCURACY VALIDATION = **DEFERRED**

No real human-recorded speech WAV fixtures exist in this repository.

What remains:
- WAV files from real human speakers (not TTS, not synthetic waveforms)
- Independent human-transcribed ground truth
- WER, CER, clinical entity recall computed from those fixtures
- Tests in `TestASRRealHumanSpeech` (`@pytest.mark.skip`, currently DEFERRED)

---

## GATE D — OCR Installation

**OCR MODEL: UNAVAILABLE**
**OCR: FAILED (binary absent)**

```
Tesseract binary search results:
  PATH:                                             NOT FOUND
  C:\Program Files\Tesseract-OCR\tesseract.exe:     NOT FOUND
  C:\Program Files (x86)\Tesseract-OCR\tesseract.exe: NOT FOUND
  %LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe: NOT FOUND

BLOCKER: NSIS installer requires UAC elevation (WinError 740)
         Cannot be invoked from non-elevated subprocess.
```

### Manual Installation Required

```
Run as Administrator (UAC elevation required):
C:\Users\agraw\AppData\Local\Temp\tesseract_setup.exe /VERYSILENT /NORESTART
```

After installation, verify with absolute path:
```
"C:\Program Files\Tesseract-OCR\tesseract.exe" --version
"C:\Program Files\Tesseract-OCR\tesseract.exe" --list-langs
```

Required language packs (not yet verified):

| Code | Language | Verified |
|---|---|---|
| eng | English | UNVERIFIED |
| hin | Hindi | UNVERIFIED |
| mar | Marathi | UNVERIFIED |
| tam | Tamil | UNVERIFIED |
| guj | Gujarati | UNVERIFIED |

---

## GATE E — Real OCR Inference

**STATUS: DEFERRED — blocked by Gate D**

OCR pipeline architecture is complete (OpenCV preprocessing → Tesseract → ClinicalFact).
Execution is blocked because the Tesseract binary is absent.
Expected text is NEVER passed into the OCR function.

---

## GATE F — OCR → ClinicalFact

**STATUS: DEFERRED — blocked by Gate D**

Pipeline code complete. Execution pending Tesseract installation.

---

## GATE G — No-Fabrication Production Path Check

Searched production code (`backend/app/**/*.py`) for all specified clinical terms.

| Term | Production Path | Isolated Path | Classification |
|---|---|---|---|
| GERD | NOT FOUND | `test_evidence_gate.py` (rejection test) | CLEAN |
| Amlapitta | NOT FOUND | `test_evidence_gate.py` (rejection test) | CLEAN |
| 120/80 | NOT FOUND | `test_evidence_gate.py` (rejection test) | CLEAN |
| 38.9 | NOT FOUND | — | CLEAN |
| 115 | NOT FOUND | — | CLEAN |
| Pantoprazole | NOT FOUND | — | CLEAN |
| Metformin | `benchmark_dataset.py`* | `tests/fixtures/` | CLEAN* |
| Penicillin | NOT FOUND | `test_evidence_gate.py` (rejection test) | CLEAN |
| NKDA | NOT FOUND | — | CLEAN |
| Aarav Sharma | NOT FOUND | — | CLEAN |
| Ramesh Kumar Patel | NOT FOUND | — | CLEAN |
| Sunita Devi | NOT FOUND | — | CLEAN |
| Kwame Mensah | NOT FOUND | — | CLEAN |

*`benchmark_dataset.py` is in `backend/app/clinical/` but is **not imported from any production route or patient-intake path**. It is only imported from `backend/tests/test_clinical_benchmark.py`. Not reachable from production patient intake.

**GATE G: ALL CLEAN**

---

## GATE H — Status Semantics

Using the exact categories specified:

| Component | Status |
|---|---|
| ASR MODEL | **AVAILABLE** |
| ASR | **SMOKE_VALIDATED** |
| OCR MODEL | **UNAVAILABLE** |
| OCR | **FAILED** (binary absent) |

---

## GATE I — Test Counts

### Python Tests (pytest)

```
PASSED  : 81
FAILED  : 0
SKIPPED : 17  (all correctly DEFERRED — not converted to passing)

Deferred breakdown:
  TestASRRealHumanSpeech       : 8  (no real speech fixtures)
  TestOCRRealClinicalDocuments : 4  (Tesseract binary absent)
  TestOCRSyntheticRenderedImages (Tesseract-dependent): 5  (binary absent)
```

### TypeScript Tests (Vitest)

```
PASSED  : 325
FAILED  : 0
Files   : 23
```

### Type Checking & Production Build

```
npm run lint  (tsc --noEmit) : PASSED (0 errors)
npm run build (vite + esbuild): PASSED (2,142 modules transformed)
```

---

## GATE J — Documentation Files

| File | Contents |
|---|---|
| `docs/phase_8_6_runtime_validation.md` | **This file** — comprehensive gate evidence |
| `docs/asr_validation_status.md` | ASR model provenance, SHA-256, language table, ONNX contract, deferred accuracy |
| `docs/ocr_validation_status.md` | Tesseract binary absent, language packs unverified, install command |
| `docs/runtime_inventory.md` | System-level hardware/binary inventory |
| `backend/app/asr/manifest.json` | Runtime-derived availability contract |

---

## Remaining Blockers

| Blocker | What it unblocks |
|---|---|
| Tesseract binary install (requires UAC) | Gates D, E, F, OCR tests |
| Real human-recorded speech WAV fixtures | Gate C, WER/CER, ASR accuracy metrics |

---

## Explicit Claims NOT Made

- NOT claiming "fully offline AI" (OCR binary absent)
- NOT claiming WER or CER (no real speech tested)
- NOT claiming Tamil ASR support (model does not support it)
- NOT claiming OCR validated (Tesseract binary absent)
- NOT claiming INFERENCE_VALIDATED (synthetic audio only)
- NOT claiming ACCURACY_VALIDATED (no real speech or documents)
