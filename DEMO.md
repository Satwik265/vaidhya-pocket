# MedScribeAI — Evaluator & Demo Guide

**Target Audience:** Smart India Hackathon (SIH 2026) Judges, Technical Reviewers, Clinical Stakeholders  
**Problem Statement:** SIH26047 (Patient Case-Taking Software)  
**Team:** AstraX  
**Platform Mode:** Sovereign Local Workstation (Desktop App or Localhost Web)  

---

## 1. Demo Boundaries & Honest Status Declaration

Before beginning the demonstration, please note the declared technical boundaries of this release:

| Capability | Demo Status | Evaluator Expectation |
|---|---|---|
| **Core Case-Taking & NLP** | Fully Operational | Extracts symptoms, conditions, medications, allergies, and durations with 100% evidence grounding. |
| **Offline Operation** | Fully Operational | All core features run with zero internet connection (airplane mode supported). |
| **Red-Flag Safety Engine** | Fully Operational | Deterministic alerts trigger on acute symptoms without autonomous AI diagnosis. |
| **Physician Approval Gate** | Fully Operational | Strict human-in-the-loop state machine gates prescription printing and FHIR export. |
| **Speech Recognition (ASR)** | Runtime Verified | Model loads and runs locally in sub-100ms; acoustic accuracy across diverse dialects is pending real-world field benchmarks. |
| **Document OCR Parsing** | Declared Unavailable | Tesseract binary is not pre-installed on this machine. Upload pipeline cleanly displays an unavailable notice; zero synthetic text is fabricated. |
| **Live ABDM Network Sync** | Simulated Sandbox | ABHA format and checksums validate locally; live OTP transmission simulates sandbox response. |

---

## 2. Launching the Demonstration

### Option A: Local Web Kiosk Mode (Fastest)

1. Open a terminal in the project directory:
   ```bash
   npm run dev
   ```
2. Open your browser to `http://localhost:3000`.

### Option B: Sovereign Desktop Application (Native Tauri)

1. Ensure the backend sidecar dependencies are installed in `backend/`.
2. Launch the desktop binary:
   ```bash
   npm run tauri dev
   ```

---

## 3. Step-by-Step Clinical Demo Walkthrough

### Step 1: Patient Registration & Granular Consent
1. On the initial screen, click **"Start Patient Intake"** or choose the **Kiosk Mode**.
2. Enter a patient demographic profile:
   - **Name:** SYNTHETIC DEMO PATIENT
   - **Age:** 48 | **Sex:** Male
   - **ABHA ID:** `91-2345-6789-0123 (DEMO)` (Notice the automated 14-digit format validation).
3. **Inspect the Consent Gate:**
   - Observe the distinct consent toggles: Consultation Case-Taking, Document Processing, and Hospital Data Sharing.
   - *Verification:* If you toggle **Hospital Data Sharing** OFF, note that downstream outbound synchronization will be hard-blocked even after physician approval.
4. Click **"Confirm & Proceed"**.

### Step 2: Multilingual Speech / Text Case-Taking
1. Select language (e.g., **Hindi** or **English**).
2. To test multilingual extraction, enter or dictate the following acute clinical utterance:
   > *"Mujhe kal se seene me dard hai aur saans lene me takleef ho rahi hai."*  
   > *(English: "I have had chest pain and difficulty breathing since yesterday.")*
3. Click **"Analyze Clinical Information"**.
4. **Observe Extraction Results:**
   - **Concept 1:** `chest_pain` (Symptom) -> Assertion: `PRESENT` -> Temporality: `CURRENT`
   - **Concept 2:** `dyspnea` (Symptom) -> Assertion: `PRESENT` -> Temporality: `CURRENT`
   - **Evidence Hover:** Hover over each extracted chip to see the exact verbatim evidence anchor (`"seene me dard"`, `"saans lene me takleef"`).

### Step 3: Negation Scope Verification
1. Enter a second test utterance:
   > *"BP ka problem nahi hai lekin sar dard bahut rehta hai."*  
   > *(English: "No problem with blood pressure, but I have frequent headaches.")*
2. **Observe Assertion Handling:**
   - `hypertension` is classified as **`NEGATED`** (Assertion: `negated`, Evidence: `"bp ka problem nahi hai"`).
   - `headache` is classified as **`PRESENT`** (Assertion: `present`, Evidence: `"sar dard"`).
   - *Clinical Invariant:* The negation trigger does not erroneously leak into the headache finding.

### Step 4: Deterministic Red-Flag Emergency Triage Alert
1. Look at the top of the consultation screen.
2. **Observe Red-Flag Banner:**
   - A prominent emergency alert appears: **"Potential Acute Coronary Syndrome / Chest Pain Emergency"**.
   - *Critical Inspection:* Notice the action recommendation reads: *"Notify attending clinical staff immediately for emergency evaluation."*
   - *Verification:* MedScribeAI **does NOT diagnose** myocardial infarction. It surfaces the emergency finding for human clinical action.

### Step 5: Medication & Allergy Conflict Detection
1. In the Patient History tab, document an allergy: **Penicillin**.
2. In the Medication section, enter or select: **Amoxicillin 500mg**.
3. **Observe Safety Conflict Alert:**
   - The safety engine immediately flags a **High-Severity Allergy Contraindication**: Beta-lactam cross-reactivity between Penicillin and Amoxicillin.

### Step 6: AYUSH Case-Taking Module
1. Navigate to the **AYUSH Intake** section.
2. Complete the **Dashavidha Pariksha** questionnaire:
   - **Prakriti:** Vata-Pitta
   - **Sara (Tissue Quality):** Madhyama
   - **Ahara (Dietary Habits):** Ushna, Laghu
   - **Vihara (Lifestyle):** Divasvapna (Daytime sleep)
3. *Verification:* Notice all AYUSH findings are tagged with `elicitation: PATIENT_REPORTED` and preserved in standard structured slots.

### Step 7: Physician Review & Approval State Machine
1. Switch to the **Physician Review Panel**.
2. Notice the encounter status is **`AI_DRAFT`**.
3. Try clicking **"Print Prescription Slip"** or **"Export FHIR Bundle"**:
   - Both buttons are disabled with warning tooltips: *"Physician Approval Required (AI Draft)"*.
4. Review the note, make an in-place correction to the notes text, and click **"Approve Documentation"**.
5. The status transitions to **`APPROVED`** and logs an immutable audit trail entry with the physician ID.
6. Now modify the approved note text:
   - Notice the status immediately **reverts to `REVIEWING`**, invalidating the prior approval until re-signed.

### Step 8: Standard FHIR R4 Bundle Export
1. With the note re-approved, click **"Export FHIR R4 Bundle"**.
2. Inspect the generated JSON:
   - Standard FHIR R4 `Bundle` (type: `document`).
   - Entries: `Patient`, `Encounter`, `Condition` (with ICD-10), `Observation`, `MedicationStatement`.

### Step 9: Offline Airplane-Mode Verification
1. Physically disconnect your computer from Wi-Fi or enable Airplane Mode.
2. Create a new patient consultation and enter clinical text.
3. Observe that fact extraction, evidence anchoring, red-flag detection, local SQLite persistence, and FHIR export execute completely without network errors.
