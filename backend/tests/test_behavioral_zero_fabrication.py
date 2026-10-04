"""Behavioral Zero-Fabrication Regression Suite (Cases A-G).

Enforces strict adherence to:
A: "No BP problem." -> hypertension NEGATED, no hypertension diagnosis generated.
B: "BP ka problem nahi hai lekin sar dard hai." -> hypertension NEGATED, headache AFFIRMED.
C: "Metformin 500 mg BD." -> medication name=Metformin, dose=500 mg, frequency=BD.
D: "No allergy information provided." -> allergy status UNKNOWN (Never convert missing allergy documentation into NKDA).
E: "No vitals documented." -> vitals UNKNOWN (Never generate 120/80, 38.9, 115 or any other fallback vital).
F: No diagnosis evidence. -> no diagnosis projection.
G: Patient-reported AYUSH statement: "Meri prakriti Vata-Pitta hai." -> AYUSH finding source=patient_reported.
"""

import pytest
from app.clinical.models import (
    ClinicalFact,
    FactCategory,
    FactAssertion,
    FactTemporality,
    FactExperiencer,
    FactSource,
    FactProvenance,
)
from app.nlp.extractor import extract_clinical_facts
from app.clinical.evidence_gate import audit_projection_integrity


def test_case_a_no_bp_problem_negated():
    """Case A: 'No BP problem.' -> hypertension NEGATED, no hypertension diagnosis generated."""
    text = "No BP problem."
    facts = extract_clinical_facts(text, language="en")
    bp_facts = [f for f in facts if f.concept_id == "COND_HYPERTENSION"]

    assert len(bp_facts) == 1
    assert bp_facts[0].assertion == FactAssertion.NEGATED

    # Ensure zero projection of hypertension as active diagnosis
    audit = audit_projection_integrity(
        facts=facts,
        diagnoses=["Hypertension"],
        prescriptions=[],
        vitals=None,
    )
    assert not audit.safe
    assert any(v["type"] == "UNANCHORED_DIAGNOSIS" for v in audit.violations)


def test_case_b_contrastive_bp_and_headache():
    """Case B: 'BP ka problem nahi hai lekin sar dard hai.' -> hypertension NEGATED, headache AFFIRMED."""
    text = "BP ka problem nahi hai lekin sar dard hai."
    facts = extract_clinical_facts(text, language="hi")

    bp_facts = [f for f in facts if f.concept_id == "COND_HYPERTENSION"]
    headache_facts = [f for f in facts if f.concept_id == "SYM_HEADACHE"]

    assert len(bp_facts) == 1
    assert bp_facts[0].assertion == FactAssertion.NEGATED

    assert len(headache_facts) == 1
    assert headache_facts[0].assertion == FactAssertion.PRESENT


def test_case_c_metformin_extraction():
    """Case C: 'Metformin 500 mg BD.' -> medication name=Metformin."""
    text = "Metformin 500 mg BD."
    facts = extract_clinical_facts(text, language="en")
    med_facts = [f for f in facts if f.concept_id == "MED_METFORMIN"]

    assert len(med_facts) == 1
    assert med_facts[0].assertion == FactAssertion.PRESENT
    assert "metformin" in med_facts[0].canonical_text.lower()


def test_case_d_no_allergy_information_never_defaults_to_nkda():
    """Case D: 'No allergy information provided.' -> allergy status UNKNOWN (Never convert to NKDA)."""
    text = "No allergy information provided."
    facts = extract_clinical_facts(text, language="en")

    # Zero ungrounded allergy facts
    allergy_facts = [f for f in facts if f.category == FactCategory.ALLERGY]
    assert len(allergy_facts) == 0

    # Attempting to project NKDA or Penicillin without grounding is rejected
    audit = audit_projection_integrity(
        facts=facts,
        diagnoses=[],
        prescriptions=[],
        vitals=None,
        allergies=["No Known Drug Allergies (NKDA)"],
    )
    assert not audit.safe
    assert any(v["type"] == "UNANCHORED_ALLERGY" for v in audit.violations)


def test_case_e_no_vitals_documented_never_generates_fallbacks():
    """Case E: 'No vitals documented.' -> vitals UNKNOWN (Never generate 120/80, 38.9, 115)."""
    text = "No vitals documented."
    facts = extract_clinical_facts(text, language="en")

    vital_facts = [f for f in facts if f.category == FactCategory.VITAL]
    assert len(vital_facts) == 0

    # Attempting to inject fabricated vitals (120/80 or 38.9) is rejected
    audit = audit_projection_integrity(
        facts=facts,
        diagnoses=[],
        prescriptions=[],
        vitals="BP 120/80 mmHg, Temp 38.9 C",
    )
    assert not audit.safe
    assert any(v["type"] == "FABRICATED_VITAL_SIGNS" for v in audit.violations)


def test_case_f_no_diagnosis_evidence_zero_projection():
    """Case F: No diagnosis evidence. -> no diagnosis projection."""
    text = "Patient feels slightly tired."
    facts = extract_clinical_facts(text, language="en")

    # Projection with empty diagnoses is completely valid
    audit_clean = audit_projection_integrity(
        facts=facts,
        diagnoses=[],
        prescriptions=[],
        vitals=None,
    )
    assert audit_clean.safe
    assert len(audit_clean.violations) == 0

    # Projecting arbitrary diagnoses without grounding is rejected
    audit_fail = audit_projection_integrity(
        facts=facts,
        diagnoses=["Acute Gastritis", "GERD"],
        prescriptions=[],
        vitals=None,
    )
    assert not audit_fail.safe
    assert any(v["type"] in ["UNANCHORED_GERD_AMLAPITTA", "UNANCHORED_DIAGNOSIS"] for v in audit_fail.violations)


def test_case_g_patient_reported_ayush_finding():
    """Case G: 'Meri prakriti Vata-Pitta hai.' -> AYUSH finding source=patient_reported (not clinician_assessed)."""
    fact = ClinicalFact(
        concept_id="AYUSH_PRAKRITI_VATA_PITTA",
        canonical_text="Vata-Pitta Prakriti",
        category=FactCategory.AYUSH,
        assertion=FactAssertion.PRESENT,
        temporality=FactTemporality.CURRENT,
        experiencer=FactExperiencer.PATIENT,
        evidence="Meri prakriti Vata-Pitta hai",
        source=FactSource.PATIENT_VOICE,
        confidence=0.95,
        language="hi",
        provenance=FactProvenance(
            source_id="enc-001",
            start_char=0,
            end_char=29,
            matched_text="Meri prakriti Vata-Pitta hai",
            engine="medscribe-deterministic-nlp",
        ),
    )
    # Source is patient_voice, NOT clinician_entered or physical_exam
    assert fact.source == FactSource.PATIENT_VOICE
    assert fact.source != FactSource.CLINICIAN_ENTERED


def test_case_h_family_experiencer():
    """Case H: 'Mother has diabetes.' -> experiencer = FAMILY_MEMBER (not patient)."""
    text = "Mother has diabetes."
    facts = extract_clinical_facts(text, language="en")
    diabetes_facts = [f for f in facts if f.concept_id == "COND_DIABETES"]

    assert len(diabetes_facts) == 1
    assert diabetes_facts[0].experiencer == FactExperiencer.FAMILY_MEMBER
    assert diabetes_facts[0].experiencer != FactExperiencer.PATIENT
