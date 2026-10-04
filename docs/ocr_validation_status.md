# OCR Validation Status — Phase 8.6

## Overall Status: UNAVAILABLE (Tesseract binary not yet installed)

| Check | Status |
|---|---|
| OpenCV preprocessing pipeline | CONFIRMED |
| pytesseract Python bindings | INSTALLED |
| Tesseract binary (tesseract.exe) | NOT FOUND |
| `tesseract --version` | DEFERRED (binary absent) |
| `tesseract --list-langs` | DEFERRED (binary absent) |
| Raw image -> text inference | DEFERRED (binary absent) |
| Real clinical document OCR | DEFERRED |

## Installation Requirement

OCR requires the Tesseract-OCR binary to be installed separately.

**Recommended installer:** UB-Mannheim Tesseract 5.4.0
- URL: https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe
- Installation requires UAC elevation (standard Windows installer)
- After installation, the pipeline searches absolute paths:
  - `C:\Program Files\Tesseract-OCR\tesseract.exe`
  - `C:\Program Files (x86)\Tesseract-OCR\tesseract.exe`
  - `%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe`

## Language Packs Required

| Tesseract Lang Code | Language |
|---|---|
| `eng` | English |
| `hin` | Hindi (Devanagari) |

> OCR language coverage is independent of ASR language coverage.
> NLP/NER additionally supports Tamil and Gujarati regardless of OCR.

## Zero-Fabrication Invariant

If the Tesseract binary is absent:
- `run_local_ocr_pipeline()` raises `RuntimeError`
- No synthetic text is substituted
- No cloud OCR API is called

## What Remains Deferred

Before OCR can be reported as VALIDATED:

1. Tesseract binary installed at a discoverable absolute path
2. `tesseract --version` succeeds
3. `tesseract --list-langs` returns `eng` and `hin`
4. `run_local_ocr_pipeline()` succeeds on a rendered test image
5. Real scanned clinical documents tested with independent human ground truth

**Test class:** `TestOCRRealClinicalDocuments` in `backend/tests/test_ocr_pipeline.py` — currently `@pytest.mark.skip(reason="DEFERRED")`

## Installation Command (Manual Step Required)

Run the downloaded installer with administrator rights:
```
C:\Users\agraw\AppData\Local\Temp\tesseract_setup.exe /VERYSILENT /NORESTART
```
(Requires UAC elevation — cannot be automated from a non-elevated process.)
