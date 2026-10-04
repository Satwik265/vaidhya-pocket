# MedScribeAI Sovereign Clinical AI Core (`backend/`)

## 1. Overview & Architectural Role

The `backend/` service provides a sovereign, offline-capable Python/FastAPI clinical intelligence service for the MedScribeAI platform. It establishes a strict clinical boundary where unstructured speech, text, or document inputs are normalized into verifiable `ClinicalFact` models with immutable evidence grounding.

```
React (TypeScript Kiosk & Workstation)
          │
          ▼
   clinicalAIClient.ts  (Unified Client Boundary)
          │
          ▼
   FastAPI Core (backend/app/)
          │
  ┌───────┼────────┬──────────┐
  ▼       ▼        ▼          ▼
 Local   Local    Local    Local
  ASR     OCR      NLP     Safety
[PLAN]  [PLAN]   [IMPL]    [PLAN]
  │       │        │          │
  └───────┴────────┴──────────┘
                  │
                  ▼
          ClinicalFact[]
                  │
        Evidence / Provenance
                  │
          Physician Review
                  │
            FHIR R4 / DB
```

---

## 2. Implementation Status: Implemented vs. Planned

| Capability | Status | Implementation Details |
| :--- | :--- | :--- |
| **FastAPI Service Core** | **IMPLEMENTED** | `GET /health`, `GET /version`, `POST /api/v1/clinical/extract` running with CORS on `127.0.0.1:8000`. |
| **Canonical ClinicalFact Model** | **IMPLEMENTED** | Pydantic v2 models with assertion (`present`, `negated`, `uncertain`, `suspected`, `conditional`, `not_elicited`), temporality, experiencer, vitals, and evidence spans. |
| **Evidence & Provenance Tracking** | **IMPLEMENTED** | `FactProvenance` recording source ID, character start/end offsets, matched text, and engine metadata. |
| **Unified Ingestion Contract** | **IMPLEMENTED** | `backend/app/clinical/ingestion.py` enforcing strict text, audio, and document payloads with MIME checking. |
| **Language Identification** | **IMPLEMENTED** | `backend/app/nlp/language_id.py` with Unicode block detection, lexical Indic heuristics, and calibrated confidence. |
| **Deterministic Clinical NLP** | **IMPLEMENTED** | Multilingual concept extraction with contrastive temporal resolution (`"Pehle diabetes tha, ab nahi hai"` -> emits both facts), vitals extraction, experiencer, and suspected assertions. |
| **Local SQLite & Sync Engine** | **IMPLEMENTED** | `backend/app/storage/database.py` with `encounters`, `clinical_facts`, `fact_evidence`, `audit_log`, `sync_queue`, and physician approval gate (`AI_DRAFT` -> `REVIEWING` -> `APPROVED` -> `EXPORTED`). |
| **TypeScript Client Adapter** | **IMPLEMENTED** | `src/services/clinicalAIClient.ts` with graceful fallback cascade. |
| **Provider Abstraction** | **IMPLEMENTED** | `src/services/aiProvider.ts`, `src/speech/asrProvider.ts`, `src/ocr/ocrProvider.ts`. |
| **Local Offline ASR (IndicConformer)** | **PARTIALLY VALIDATED** | Model `models/asr/indic-conformer/model.int8.onnx` (188 MB, SHA-256: `b99a0183...`) runtime verified; human speech benchmark deferred pending real clinical audio corpus. |
| **Local Document OCR (Tesseract)** | **UNAVAILABLE (DECLARED)** | System probes host binary; cleanly returns HTTP 422 `OCR_UNAVAILABLE` when binary is missing; zero synthetic fallbacks. |
| **Evidence & Fabrication Gate** | **IMPLEMENTED** | `backend/app/clinical/evidence_gate.py` rejecting unanchored diagnoses, ungrounded vitals, and unauthorized prescriptions. |

---

## 3. Strict Clinical Safety Invariants

1. **Never Invent Facts:** No diagnosis, prescription, lab value, or vital sign is ever generated or asserted without direct evidence in the source transcript or document.
2. **Missing is Not Negative:** Missing facts remain un-asserted or `NOT_ELICITED`. The engine never defaults missing review-of-systems or medical history to negative findings.
3. **Evidence Grounding:** Every `ClinicalFact` requires a non-empty `evidence` quote and explicit character spans (`start_char`, `end_char`).
4. **Negation Scope Integrity:** Explicitly negated patient statements (e.g. *"diabetes nahi hai"*) produce `assertion: negated` and are never promoted to active conditions.

---

## 4. Running and Testing

### Setup Environment
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### Start the FastAPI Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Execute Tests
```bash
pytest
```
