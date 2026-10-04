# Vaidhya Pocket

> **An evidence-gated, offline clinical documentation assistant for low-connectivity care.**

**iQOO Hackathon 2026 · Open Innovation**  
**Team:** InSaneMitra

[![Offline First](https://img.shields.io/badge/Offline--first-Yes-111827)](#offline-first)
[![Safety](https://img.shields.io/badge/Safety-Evidence--gated-111827)](#the-evidence-gate)
[![Tests](https://img.shields.io/badge/Automated%20tests-379%20passing-111827)](#testing)
[![FHIR](https://img.shields.io/badge/FHIR-R4-111827)](#output)
[![License](https://img.shields.io/badge/License-TBD-6b7280)](#license)

---

## The one-line idea

**Vaidhya Pocket turns a consultation or prescription photo into a reviewable SOAP draft and FHIR R4 record — while refusing to retain clinical facts that cannot be traced back to the source text.**

The key design principle is simple:

> **The model may propose a fact. The evidence gate decides whether that fact survives. The doctor decides whether it is exported.**

---

## Why this matters

Busy and rural health centres can have limited time, limited connectivity, and sensitive patient information.

Cloud-based clinical scribes create an additional privacy and connectivity dependency. More importantly, an LLM can produce a clinically plausible statement that was never actually said.

A fabricated allergy, symptom, medication, or diagnosis inside a medical record is not a harmless hallucination — it can become a patient-safety problem.

Vaidhya Pocket is designed around the opposite principle:

**If a proposed fact cannot be traced to the source conversation, it is dropped rather than silently accepted.**

---

## What Vaidhya Pocket does

### Input

- Hindi, Hinglish, or English consultation text
- Prescription photographs
- Pasted text from a clinic workflow

### Processing

1. Extract candidate clinical facts using rules + a local model.
2. Match every candidate against evidence in the source text.
3. Remove candidates without matching evidence.
4. Run deterministic red-flag checks.
5. Present the resulting draft to the doctor.

### Output

- **SOAP draft**
  - Subjective
  - Objective
  - Assessment
  - Plan
- **FHIR R4 record**
- Red-flag alerts
- Evidence associated with extracted facts

The application is a **documentation assistant**, not a diagnostic or prescribing system.

---

# The Evidence Gate

This is the core safety mechanism.

A local language model may propose:

```text
Fact: diabetes
```

The gate then asks:

```text
Does the source text contain an exact, whole-word
piece of evidence supporting this fact?
```

If the answer is **no**, the fact is removed.

### Example

Source:

```text
Patient reports fever and vomiting for two days.
```

Model proposes:

```text
fever
vomiting
diabetes
```

After gating:

```text
✓ fever
✓ vomiting
✗ diabetes
```

The important distinction is that the model's output is **not treated as truth**.

### Whole-word matching

The gate also rejects accidental partial matches.

For example, a substring such as:

```text
oolti
```

inside:

```text
phoolti
```

must not create a false `vomiting`-type fact.

### Raw vs gated

The UI exposes the difference between raw model suggestions and gated output so that the safety mechanism is visible rather than hidden.

### What the gate does NOT prove

The gate proves that supporting text exists; it does **not** prove that the clinical meaning is correct.

Therefore:

> **Every record still requires doctor review and approval before export.**

---

# Safety Architecture

```text
┌───────────────────────┐
│ Consultation / Photo  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Fact extraction       │
│ Rules + local model   │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│     EVIDENCE GATE     │
│                       │
│ Is every fact backed  │
│ by source evidence?   │
└───────┬─────────┬─────┘
        │ Yes     │ No
        ▼         ▼
   Keep fact    Drop fact
        │
        ▼
┌───────────────────────┐
│ Deterministic         │
│ red-flag rules        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ SOAP + FHIR R4 draft  │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Doctor review +       │
│ explicit approval     │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ FHIR / SOAP export    │
└───────────────────────┘
```

---

# Offline First

Vaidhya Pocket is designed for environments where connectivity cannot be assumed.

The current build includes:

- Offline PWA workflow
- Airplane-mode operation
- Network guard
- Outside-request blocking
- Uploaded-byte counter
- On-device prescription OCR for English + Hindi
- Office Kit for moving approved records to a clinic laptop
- Cloud/Gemini calls removed from the current build

The UI can expose the **bytes uploaded** count, making the privacy claim observable instead of merely descriptive.

In airplane mode, the target behavior is:

```text
Bytes uploaded: 0
```

---

# Office Kit

The project includes an offline clinic workflow for moving information between a phone and clinic laptop.

```text
Phone
  │
  │ approved SOAP / FHIR
  ▼
Office Kit
  │
  ▼
Clinic laptop
```

Export is intentionally blocked until the doctor approves the record.

---

# Red-Flag Safety

Emergency warning logic is implemented as **fixed rules**, not model-generated guesses.

The prototype includes examples such as:

```text
Chest pain + breathlessness
          ↓
       RED FLAG
```

The purpose is to surface potentially urgent combinations without turning the language model into the authority for emergency detection.

---

# Current Build

According to the Phase 1 build:

- 6-step phone-first flow optimized for a 390px screen
- Offline PWA
- Network guard
- Live uploaded-byte meter
- Cloud/Gemini calls removed
- English + Hindi prescription OCR
- Office Kit
- FHIR/SOAP export after approval
- **379 automated tests passing**

---

# Finale Roadmap

The following items are planned for the finale build and should not be represented as already benchmarked:

### On-device speech

**IndicConformer INT8 via sherpa-onnx**

### Qualcomm acceleration

Local LLM execution on the phone NPU through:

- Qualcomm Genie / QNN
- CPU fallback

### Browser-local inference

Run a real in-browser local LLM using:

- WebLLM

### Real-device validation

- Real phone prescription photos
- Phone-measured latency
- Tokens/second
- NPU vs CPU comparison
- Battery
- Temperature
- Uploaded bytes
- Field testing

---

# Benchmark Honesty

We deliberately do **not** invent performance numbers.

The following values are currently marked as **not measured**:

| Metric | Status |
|---|---|
| Hindi/Hinglish speech recognition WER | Not measured yet |
| Fact extraction F1 on held-out data | Not measured yet |
| Raw vs gated fabrication rate | Not measured yet |
| NPU vs CPU latency / tokens per second | Not measured yet |
| Battery / temperature / uploaded bytes on phone | Not measured yet |

See [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md).

This is intentional.

**A hackathon demo should not turn an unmeasured number into a fake benchmark.**

---

# Privacy & Data Handling

Vaidhya Pocket is designed around local processing and explicit approval.

### Design goals

- Minimize transmission of patient information.
- Support offline operation.
- Make network activity observable.
- Use synthetic data for demonstrations.
- Require doctor approval before export.
- Avoid presenting the assistant as an autonomous diagnostic system.

The project is designed with the privacy context of the **DPDP Act 2023** and **ABDM** in mind. This README does not claim legal compliance or certification.

---

# Clinical Safety Boundary

Vaidhya Pocket:

**DOES**

- assist documentation
- structure source information
- surface evidence
- create SOAP drafts
- create FHIR R4 records
- show red-flag alerts
- require clinician approval

**DOES NOT**

- diagnose patients
- prescribe treatment
- autonomously approve records
- treat model output as ground truth
- claim that an evidence match proves clinical correctness

---

# Demo Flow

A recommended demo sequence:

```text
1. Start with airplane mode
        ↓
2. Enter a Hindi / Hinglish / English consultation
        ↓
3. Show extracted facts
        ↓
4. Toggle RAW vs GATED
        ↓
5. Demonstrate a fabricated fact being removed
        ↓
6. Show evidence attached to retained facts
        ↓
7. Trigger a deterministic red flag
        ↓
8. Review the SOAP draft
        ↓
9. Approve the record
        ↓
10. Export FHIR / SOAP through Office Kit
        ↓
11. Show uploaded bytes = 0
```

The strongest moment in the demo is not "look, an LLM generated a note."

It is:

> **"Here is what the model proposed. Here is what the evidence gate allowed to survive. Here is the evidence. And nothing leaves the workflow until the doctor approves it."**

---

# Repository Structure

The exact structure may evolve during the hackathon. The important architectural areas are:

```text
.
├── src/
│   ├── components/
│   ├── clinical/
│   ├── llm/
│   ├── services/
│   └── __tests__/
├── backend/
├── models/
├── validation/
├── docs/
│   └── BENCHMARKS.md
├── package.json
├── README.md
├── server.ts
└── vite.config.ts
```

---

# Testing

The current Phase 1 deck reports:

**379 automated tests passing.**

Testing should focus especially on:

- Evidence-gate false positives
- Partial-word matching
- Unsupported fact removal
- Red-flag rule behavior
- Export approval requirements
- Network request blocking
- FHIR structure
- SOAP generation
- OCR handling

---

# Originality & Disclosure

The base application, **MedScribeAI**, is prior work and is explicitly disclosed.

New Phase 1 work is tagged in the repository.

This README intentionally separates:

- existing/base functionality
- new Phase 1 functionality
- finale-plan functionality
- measured results
- unmeasured targets

This makes the project easier to evaluate and prevents the repository from overstating what has actually been built.

---

# Team

### InSaneMitra

Built for:

**iQOO Hackathon 2026 — Open Innovation**

---

# License

License: **TBD**

Add the appropriate license before public release if required by the team or hackathon.

---

## The principle

> **AI proposes. Evidence gates. Doctor approves.**

Vaidhya Pocket is built around that boundary.
