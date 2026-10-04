"""Clearly labelled medical document fixtures for OCR pipeline evaluation.

ALL FIXTURES IN THIS MODULE ARE SYNTHETIC BENCHMARK FIXTURES.
CONTAINS ZERO PROTECTED HEALTH INFORMATION (PHI).
DESIGNED TO EXCLUSIVELY VALIDATE REAL LOCAL OCR EXTRACTION AND CLINICAL FACT PIPELINE.
"""

import base64
import io
from typing import Dict, Any
from PIL import Image, ImageDraw, ImageFont


def create_document_image(title: str, lines: list[str], width: int = 800, height: int = 1000) -> str:
    """Generates a synthetic medical document image rendered as base64 JPEG."""
    img = Image.new("RGB", (width, height), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Header banner
    draw.rectangle([(20, 20), (width - 20, 90)], fill=(240, 244, 248), outline=(200, 210, 225))
    draw.text((35, 30), "MEDSCRIBE CLINICAL BENCHMARK FIXTURE (SYNTHETIC / NON-PHI)", fill=(100, 116, 139))
    draw.text((35, 55), title, fill=(15, 23, 42))

    # Document body
    y = 120
    for line in lines:
        if line.startswith("---"):
            draw.line([(35, y), (width - 35, y)], fill=(203, 213, 225), width=2)
            y += 20
        elif line.startswith("Rx:") or line.startswith("DIAGNOSIS:") or line.startswith("INVESTIGATION:") or line.startswith("DISCHARGE:"):
            draw.text((35, y), line, fill=(30, 41, 59))
            y += 35
        else:
            draw.text((35, y), line, fill=(51, 65, 85))
            y += 28

    # Footer
    draw.line([(35, height - 60), (width - 35, height - 60)], fill=(226, 232, 240), width=1)
    draw.text((35, height - 45), "Digitally generated fixture for automated local OCR validation. Zero clinical fabrication.", fill=(148, 163, 184))

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=90)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# 1. Printed Prescription (Telmisartan & Metformin)
PRINTED_PRESCRIPTION_TEXT = """OPD CONSULTATION PRESCRIPTION
Patient: Rajesh Kumar | Age: 48Y | Gender: Male
Date: 2026-09-10 | Clinic ID: DEL-OPD-109
---
DIAGNOSIS: Essential Hypertension, Type 2 Diabetes Mellitus
Vitals: BP 148/92 mmHg, Pulse 76 bpm
---
Rx:
1. Tab. Telmisartan 40mg - 1 tab OD morning after food x 30 days
2. Tab. Metformin 500mg - 1 tab BD after meals x 30 days
3. Tab. Paracetamol 650mg - 1 tab SOS for headache
---
Advice: Low sodium diet, 30 min daily walking, review blood sugar in 1 month."""

# 2. Handwritten Style Prescription (Amoxicillin)
HANDWRITTEN_PRESCRIPTION_TEXT = """PRIMARY HEALTH CARE PRESCRIPTION
Patient: Sunita Devi | Age: 34Y | Gender: Female
Date: 2026-09-08
---
DIAGNOSIS: Acute Bronchitis, Fever and Productive Cough
Vitals: Temp 101.2 F, SpO2 97%
---
Rx:
1. Cap. Amoxicillin 500mg - 1 cap TDS x 5 days
2. Syp. Ambroxol 30mg/5ml - 10ml TDS x 5 days
3. Tab. Paracetamol 500mg - 1 tab SOS for fever
---
Advice: Warm saline gargles, adequate hydration."""

# 3. Lab Report (Metabolic & Lipid Panel)
LAB_REPORT_TEXT = """PATHOLOGY & BIOCHEMISTRY LABORATORY REPORT
Patient: Ramesh Patel | Age: 55Y | Gender: Male
Referred by: Dr. A. K. Sharma | Sample: Fasting Venous Blood
---
TEST NAME                   RESULT       UNIT       REFERENCE RANGE
HbA1c (Glycated Hb)         8.4 HIGH     %          < 5.7 (Normal)
Fasting Blood Sugar         162 HIGH     mg/dL      70 - 99 mg/dL
Total Cholesterol           228 HIGH     mg/dL      < 200 mg/dL
Serum Triglycerides         194 HIGH     mg/dL      < 150 mg/dL
Serum Creatinine            0.9 NORMAL   mg/dL      0.7 - 1.3 mg/dL
Hemoglobin (Hb)             13.8 NORMAL  g/dL       13.0 - 17.0 g/dL
---
Pathologist Interpretation: Significant glycemic dysregulation and moderate hypertriglyceridemia."""

# 4. Discharge Summary (Atisara / Acute Gastroenteritis)
DISCHARGE_SUMMARY_TEXT = """AYUSH INPATIENT CLINICAL DISCHARGE SUMMARY
Hospital: All India Institute of Ayurveda (AIIA)
Patient: Mohan Lal | Age: 42Y | IPD Reg: AIIA-2026-8812
Admission: 2026-09-01 | Discharge: 2026-09-06
---
FINAL CLINICAL DIAGNOSIS:
Atisara (Acute Gastroenteritis) with Pitta-Vata vitiation and moderate dehydration.
---
HOSPITAL COURSE & TREATMENT:
Patient admitted with acute loose watery stools (dast), abdominal cramps, and weakness.
Managed with Deepana-Pachana therapy, Shadanga Paniya, and Kutaja formulations.
Discharged in fully hemodynamically stable condition with normal bowel habit.
---
DISCHARGE MEDICATIONS:
1. Kutajaghan Vati - 2 tablets TDS with warm water x 7 days
2. Bilvadi Leha - 1 teaspoon BD before food x 14 days
3. Takra (Buttermilk processed with Shunthi and Jeeraka) - twice daily with lunch."""

# 5. Hindi Document (मधुमेह एवं उच्च रक्तचाप पर्चा)
HINDI_DOCUMENT_TEXT = """आयुष्मान प्राथमिक स्वास्थ्य केंद्र - बाह्य रोगी विभाग पर्चा
रोगी: रामनरेश यादव | आयु: 52 वर्ष | लिंग: पुरुष
दिनांक: 2026-09-11
---
मुख्य शिकायत एवं निदान:
मधुमेह (शुगर की बीमारी) और उच्च रक्तचाप (बीपी की समस्या)
रोगी को पिछले दो सप्ताह से सिरदर्द और थकान की शिकायत है।
---
दवाइयां (Rx):
1. मेटफॉर्मिन 500 मिलीग्राम - दिन में दो बार (सुबह और रात खाने के बाद)
2. टेल्मिसार्टन 40 मिलीग्राम - दिन में एक बार (सुबह खाली पेट)
3. पेरासिटामोल 650 मिलीग्राम - आवश्यकतानुसार (सिरदर्द होने पर)
---
परामर्श: नमक और चीनी का परहेज करें। नियमित टहलें।"""

# 6. English Medical Note
ENGLISH_DOCUMENT_TEXT = """OUTPATIENT CLINICAL PROGRESS NOTE
Patient: Anita Verma | Age: 29Y | Gender: Female | Date: 2026-09-09
---
CHIEF COMPLAINT:
Severe throbbing right-sided headache accompanied by nausea and photophobia since 2 days.
No chest pain. No shortness of breath. No visual aura reported.
---
ASSESSMENT & DIAGNOSIS:
Acute Migraine without aura. Hypertension evaluated and absent (BP 118/74 mmHg).
---
PLAN & MEDICATIONS:
1. Tab. Naproxen 500mg - 1 tab PRN at onset of headache
2. Tab. Domperidone 10mg - 1 tab PRN 15 mins before analgesics
Advice: Rest in a dark quiet room, maintain headache trigger diary."""


MEDICAL_DOCUMENT_FIXTURES: Dict[str, Dict[str, Any]] = {
    "printed_prescription": {
        "title": "OUTPATIENT PRESCRIPTION - CARDIO-METABOLIC CLINIC",
        "raw_text": PRINTED_PRESCRIPTION_TEXT,
        "doc_hint": "prescription",
        "file_name": "rx_printed_hypertension_diabetes.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("OUTPATIENT PRESCRIPTION - CARDIO-METABOLIC CLINIC", PRINTED_PRESCRIPTION_TEXT.split("\n")),
        "expected_concepts": ["COND_HYPERTENSION", "COND_DIABETES", "SYM_HEADACHE"],
    },
    "handwritten_prescription": {
        "title": "PRIMARY HEALTH CARE - ACUTE BRONCHITIS",
        "raw_text": HANDWRITTEN_PRESCRIPTION_TEXT,
        "doc_hint": "prescription",
        "file_name": "rx_handwritten_bronchitis.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("PRIMARY HEALTH CARE - ACUTE BRONCHITIS", HANDWRITTEN_PRESCRIPTION_TEXT.split("\n")),
        "expected_concepts": ["SYM_COUGH", "SYM_FEVER"],
    },
    "lab_report": {
        "title": "PATHOLOGY INVESTIGATION - METABOLIC PROFILE",
        "raw_text": LAB_REPORT_TEXT,
        "doc_hint": "lab_report",
        "file_name": "lab_metabolic_lipid_panel.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("PATHOLOGY INVESTIGATION - METABOLIC PROFILE", LAB_REPORT_TEXT.split("\n")),
        "expected_concepts": ["COND_DIABETES"],
    },
    "discharge_summary": {
        "title": "INPATIENT CLINICAL DISCHARGE SUMMARY",
        "raw_text": DISCHARGE_SUMMARY_TEXT,
        "doc_hint": "discharge_summary",
        "file_name": "discharge_ayush_gastroenteritis.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("INPATIENT CLINICAL DISCHARGE SUMMARY", DISCHARGE_SUMMARY_TEXT.split("\n")),
        "expected_concepts": ["SYM_DIARRHEA"],
    },
    "hindi_document": {
        "title": "प्राथमिक स्वास्थ्य पर्चा (हिंदी)",
        "raw_text": HINDI_DOCUMENT_TEXT,
        "doc_hint": "prescription",
        "file_name": "rx_hindi_diabetes_hypertension.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("प्राथमिक स्वास्थ्य पर्चा (हिंदी)", HINDI_DOCUMENT_TEXT.split("\n")),
        "expected_concepts": ["COND_DIABETES", "COND_HYPERTENSION", "SYM_HEADACHE"],
    },
    "english_document": {
        "title": "OUTPATIENT PROGRESS NOTE",
        "raw_text": ENGLISH_DOCUMENT_TEXT,
        "doc_hint": "medical_report",
        "file_name": "clinic_progress_note_migraine.jpg",
        "mime_type": "image/jpeg",
        "image_base64": create_document_image("OUTPATIENT PROGRESS NOTE", ENGLISH_DOCUMENT_TEXT.split("\n")),
        "expected_concepts": ["SYM_HEADACHE", "SYM_CHEST_PAIN", "SYM_BREATHLESSNESS"],
    },
}
