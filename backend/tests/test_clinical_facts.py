"""Unit tests for ClinicalFact domain model, evidence invariants, and NLP extraction."""

import pytest
from pydantic import ValidationError
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


def test_clinical_fact_validation_valid():
    """Validates that a correctly structured ClinicalFact succeeds."""
    prov = FactProvenance(
        source_id="enc-001",
        start_char=10,
        end_char=22,
        matched_text="sar mein dard",
    )
    fact = ClinicalFact(
        concept_id="SYM_HEADACHE",
        canonical_text="headache",
        category=FactCategory.SYMPTOM,
        assertion=FactAssertion.PRESENT,
        temporality=FactTemporality.CURRENT,
        experiencer=FactExperiencer.PATIENT,
        evidence="sar mein dard hai",
        source=FactSource.PATIENT_TRANSCRIPT,
        confidence=0.95,
        language="hi",
        provenance=prov,
    )
    assert fact.concept_id == "SYM_HEADACHE"
    assert fact.assertion == FactAssertion.PRESENT
    assert fact.confidence == 0.95


def test_clinical_fact_empty_evidence_raises():
    """Validates that empty evidence is rejected."""
    prov = FactProvenance(source_id="enc-001", start_char=0, end_char=5)
    with pytest.raises(ValidationError):
        ClinicalFact(
            concept_id="SYM_HEADACHE",
            canonical_text="headache",
            category=FactCategory.SYMPTOM,
            evidence="   ",  # Invalid empty evidence
            confidence=0.95,
            provenance=prov,
        )


def test_clinical_fact_invalid_provenance_offsets():
    """Validates that end_char < start_char is rejected."""
    with pytest.raises(ValidationError):
        prov = FactProvenance(source_id="enc-001", start_char=20, end_char=10)
        ClinicalFact(
            concept_id="SYM_HEADACHE",
            canonical_text="headache",
            category=FactCategory.SYMPTOM,
            evidence="headache",
            confidence=0.90,
            provenance=prov,
        )


def test_clinical_fact_not_elicited_distinction():
    """Validates that NOT_ELICITED is structurally distinct from NEGATED."""
    prov = FactProvenance(source_id="enc-001", start_char=0, end_char=0)
    fact_not_elicited = ClinicalFact(
        concept_id="SYM_COUGH",
        canonical_text="cough",
        category=FactCategory.SYMPTOM,
        assertion=FactAssertion.NOT_ELICITED,
        evidence="Not asked during interview",
        confidence=1.0,
        provenance=prov,
    )
    fact_negated = ClinicalFact(
        concept_id="SYM_COUGH",
        canonical_text="cough",
        category=FactCategory.SYMPTOM,
        assertion=FactAssertion.NEGATED,
        evidence="khasi bilkul nahi hai",
        confidence=0.95,
        provenance=prov,
    )
    assert fact_not_elicited.assertion != fact_negated.assertion
    assert fact_not_elicited.assertion == FactAssertion.NOT_ELICITED
    assert fact_negated.assertion == FactAssertion.NEGATED


def test_clinical_fact_experiencer_integrity():
    """Validates that patient-reported vs family-reported experiencer is explicitly tracked."""
    prov = FactProvenance(source_id="enc-001", start_char=0, end_char=15)
    patient_fact = ClinicalFact(
        concept_id="SYM_FEVER",
        canonical_text="fever",
        category=FactCategory.SYMPTOM,
        experiencer=FactExperiencer.PATIENT,
        evidence="mujhe bukhar hai",
        confidence=0.95,
        provenance=prov,
    )
    family_fact = ClinicalFact(
        concept_id="COND_DIABETES",
        canonical_text="diabetes mellitus",
        category=FactCategory.CONDITION,
        experiencer=FactExperiencer.FAMILY_MEMBER,
        evidence="pitaji ko diabetes thi",
        confidence=0.90,
        provenance=prov,
    )
    assert patient_fact.experiencer == FactExperiencer.PATIENT
    assert family_fact.experiencer == FactExperiencer.FAMILY_MEMBER


def test_extraction_hindi_negation_and_present_contrast():
    """Validates: 'BP ka problem nahi hai lekin sar dard hai'
    Expected result:
    - COND_HYPERTENSION -> negated
    - SYM_HEADACHE -> present
    - No other facts fabricated!
    """
    transcript = "BP ka problem nahi hai lekin sar dard hai"
    facts = extract_clinical_facts(transcript, language="hi", source_id="enc-test-01")

    assert len(facts) == 2, f"Expected exactly 2 facts, got {len(facts)}"

    fact_map = {f.concept_id: f for f in facts}

    # 1. COND_HYPERTENSION must be negated
    assert "COND_HYPERTENSION" in fact_map
    bp_fact = fact_map["COND_HYPERTENSION"]
    assert bp_fact.assertion == FactAssertion.NEGATED
    assert "problem nahi hai" in bp_fact.evidence.lower() or "nahi hai" in bp_fact.evidence.lower()
    assert bp_fact.provenance.start_char >= 0
    assert bp_fact.provenance.end_char > bp_fact.provenance.start_char

    # 2. SYM_HEADACHE must be present
    assert "SYM_HEADACHE" in fact_map
    headache_fact = fact_map["SYM_HEADACHE"]
    assert headache_fact.assertion == FactAssertion.PRESENT
    assert "sar dard" in headache_fact.evidence.lower()
    assert headache_fact.provenance.start_char >= 0
    assert headache_fact.provenance.end_char > headache_fact.provenance.start_char


def test_extraction_empty_text_produces_zero_facts():
    """Validates that empty text produces an empty list and never fabricates facts."""
    facts = extract_clinical_facts("", language="hi")
    assert facts == []
    facts_whitespace = extract_clinical_facts("   \n\t  ", language="hi")
    assert facts_whitespace == []
