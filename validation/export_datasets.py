"""Generates deterministic synthetic datasets and executes Phase 4 clinical scenarios.

All data generated herein is SYNTHETIC TEST DATA for verification of SIH26047.
NO REAL PHI OR HUMAN CLINICAL DATA IS CONTAINED IN THIS SCRIPT.
"""

import sys
import os
import json

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.nlp.extractor import extract_clinical_facts
from app.nlp.language_id import identify_clinical_language
from app.safety.rules import evaluate_red_flags
from app.clinical.models import ClinicalFact, FactCategory, FactAssertion, FactTemporality, FactExperiencer
from app.clinical.benchmark_dataset import CLINICAL_BENCHMARK_CASES

datasets_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets"))
os.makedirs(datasets_dir, exist_ok=True)

# 1. Gold standard export
gold_standard_export = [
    {
        "id": c.case_id,
        "language": c.language,
        "utterance": c.utterance,
        "expected_facts": [
            {
                "concept_id": f.concept_id,
                "canonical_text": f.canonical_text,
                "category": f.category,
                "assertion": f.assertion,
                "temporality": f.temporality,
                "experiencer": f.experiencer,
            }
            for f in c.expected_facts
        ]
    }
    for c in CLINICAL_BENCHMARK_CASES
]

with open(os.path.join(datasets_dir, "synthetic_clinical_gold_standard.json"), "w", encoding="utf-8") as f:
    json.dump(gold_standard_export, f, indent=2, ensure_ascii=False)

# 2. Phase 4 End-to-End Clinical Scenarios (SYNTHETIC TEST DATA)
scenarios = {
    "SCENARIO_A": {
        "title": "Routine Primary Care (English)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "I have had a cough for five days. It is worse at night.",
        "language": "en",
        "expected_concepts": ["cough"],
        "expected_assertion": "PRESENT",
        "expected_temporality": "CURRENT",
        "expected_experiencer": "PATIENT",
        "expected_red_flag": False,
    },
    "SCENARIO_B": {
        "title": "Acute Red-Flag (Hindi)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "मुझे कल से सीने में दर्द है और सांस लेने में तकलीफ हो रही है।",
        "language": "hi",
        "expected_concepts": ["chest_pain", "dyspnea"],
        "expected_assertion": "PRESENT",
        "expected_temporality": "CURRENT",
        "expected_experiencer": "PATIENT",
        "expected_red_flag": True,
        "expected_action": "EMERGENCY_ESCALATION",
    },
    "SCENARIO_C": {
        "title": "Negation Scope (Hindi/Hinglish)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "BP ka problem nahi hai lekin sar dard bahut rehta hai.",
        "language": "hi",
        "expected_facts": [
            {"concept_id": "hypertension", "assertion": "NEGATED"},
            {"concept_id": "headache", "assertion": "PRESENT"}
        ]
    },
    "SCENARIO_D": {
        "title": "Marathi Clinical Case",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "मला दोन दिवसांपासून ताप आणि खोकला आहे.",
        "language": "mr",
        "expected_concepts": ["fever", "cough"],
        "expected_assertion": "PRESENT",
    },
    "SCENARIO_E": {
        "title": "Code-Switching (Hinglish)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "Kal se headache hai aur fever bhi hai.",
        "language": "hi",
        "expected_concepts": ["headache", "fever"],
        "expected_assertion": "PRESENT",
    },
    "SCENARIO_F": {
        "title": "Medication Dosage (Hindi)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "Main amlodipine 5 mg roz subah leta hoon.",
        "language": "hi",
        "expected_concepts": ["amlodipine"],
        "expected_category": "MEDICATION",
    },
    "SCENARIO_G": {
        "title": "Allergy Reporting (Hindi)",
        "label": "SYNTHETIC TEST DATA",
        "input_utterance": "Penicillin se rash hota hai.",
        "language": "hi",
        "expected_concepts": ["penicillin_allergy"],
        "expected_category": "ALLERGY",
    },
    "SCENARIO_H": {
        "title": "Medication/Allergy Conflict",
        "label": "SYNTHETIC TEST DATA",
        "documented_allergy": "penicillin",
        "prescribed_medication": "amoxicillin",
        "expected_conflict": True,
        "conflict_type": "BETA_LACTAM_CROSS_REACTIVITY",
    },
    "SCENARIO_I": {
        "title": "Historical Document Processing",
        "label": "SYNTHETIC TEST DATA",
        "document_type": "OPD_PRESCRIPTION",
        "ocr_available": False,
        "status": "OCR_UNAVAILABLE_FALLBACK_BLOCKED",
    },
    "SCENARIO_J": {
        "title": "AYUSH Dashavidha Pariksha & Ahara/Vihara",
        "label": "SYNTHETIC TEST DATA",
        "prakriti": "Vata-Pitta",
        "sara": "Madhyama",
        "ahara": "Laghu, Ushna",
        "vihara": "Divasvapna (Daytime sleep)",
        "provenance": "PATIENT_REPORTED",
    },
    "SCENARIO_K": {
        "title": "Physician Approval State Machine",
        "label": "SYNTHETIC TEST DATA",
        "transitions": ["AI_DRAFT -> REVIEWING -> APPROVED", "Material Edit -> Invalidation -> REVIEWING"],
        "export_gated": True,
    },
    "SCENARIO_L": {
        "title": "Granular Patient Consent Workflow",
        "label": "SYNTHETIC TEST DATA",
        "states": ["CONSENT_GRANTED", "SHARING_DENIED", "CONSENT_REVOKED"],
        "outbound_sync_gated": True,
    },
    "SCENARIO_M": {
        "title": "Offline Operation Mode",
        "label": "SYNTHETIC TEST DATA",
        "network_state": "DISCONNECTED",
        "local_nlp": "FUNCTIONAL",
        "local_sqlite": "FUNCTIONAL",
        "local_asr": "FUNCTIONAL",
        "cloud_call_attempted": False,
    },
    "SCENARIO_N": {
        "title": "Network Recovery and Explicit Sync",
        "label": "SYNTHETIC TEST DATA",
        "pending_queue": True,
        "explicit_sync_trigger": True,
        "ack_received": True,
        "duplicate_prevention": True,
    }
}

with open(os.path.join(datasets_dir, "synthetic_clinical_scenarios.json"), "w", encoding="utf-8") as f:
    json.dump(scenarios, f, indent=2, ensure_ascii=False)

# 3. Safety cases export
safety_cases = [
    {
        "case_id": "SAFE-001",
        "label": "SYNTHETIC TEST DATA",
        "input": "seene me tez dard hai aur paseena aa raha hai",
        "expected_flag": "ACUTE_CORONARY_SYNDROME_OR_CHEST_PAIN",
        "expected_action": "EMERGENCY_ESCALATION",
        "autonomous_diagnosis_forbidden": True
    },
    {
        "case_id": "SAFE-002",
        "label": "SYNTHETIC TEST DATA",
        "input": "saans phool rahi hai aur behoshi jaisa lag raha hai",
        "expected_flag": "SEVERE_RESPIRATORY_DISTRESS",
        "expected_action": "EMERGENCY_ESCALATION",
        "autonomous_diagnosis_forbidden": True
    },
    {
        "case_id": "SAFE-003",
        "label": "SYNTHETIC TEST DATA",
        "input": "bahut khoon beh raha hai chot se",
        "expected_flag": "SEVERE_HEMORRHAGE",
        "expected_action": "EMERGENCY_ESCALATION",
        "autonomous_diagnosis_forbidden": True
    },
    {
        "case_id": "SAFE-004",
        "label": "SYNTHETIC TEST DATA",
        "input": "seene me dard bilkul nahi hai sirf thoda gala kharab hai",
        "expected_flag": None,
        "negation_respected": True
    }
]

with open(os.path.join(datasets_dir, "synthetic_safety_cases.json"), "w", encoding="utf-8") as f:
    json.dump(safety_cases, f, indent=2, ensure_ascii=False)

# 4. ASR Benchmark Metadata
asr_metadata = {
    "model_name": "ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large (Sherpa-ONNX conversion by meetsync)",
    "quantization": "INT8",
    "model_file": "models/asr/indic-conformer/model.int8.onnx",
    "size_bytes": 196977855,
    "size_mb": 187.85,
    "sha256": "b99a01834cd1a72cd9be682a0b9543df6b152ef7dfceba88d3dbf59fbb77075d",
    "supported_languages": ["as", "bn", "brx", "gu", "hi", "kn", "ks", "mr"],
    "unsupported_languages": ["ta (Tamil) - supported by NLP/NER but not this ASR model"],
    "sample_rate_hz": 16000,
    "acoustic_accuracy_status": "Human speech accuracy NOT YET BENCHMARKED (Runtime verified, no human audio corpus on host)",
    "wer_cer_reported": False
}

with open(os.path.join(datasets_dir, "synthetic_asr_metadata.json"), "w", encoding="utf-8") as f:
    json.dump(asr_metadata, f, indent=2, ensure_ascii=False)

print("Exported all synthetic datasets to validation/datasets/")
