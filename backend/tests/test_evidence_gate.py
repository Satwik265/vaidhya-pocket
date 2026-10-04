"""Phase 8.5-J: Evidence Gate Verification Test Suite.

Enforces zero clinical fabrication invariants:
1. Rejection of unanchored / fabricated diagnoses (GERD, Amlapitta, Peptic Ulcer).
2. Rejection of fabricated vital signs (120/80 mmHg, 72 bpm) without source evidence.
3. Rejection of unauthorized prescription orders in pre-consult intake.
4. Traceability from ClinicalFact -> evidence span -> provenance metadata.
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
from app.clinical.evidence_gate import (
    validate_clinical_fact,
    audit_projection_integrity,
)


def test_rejects_unanchored_gerd_and_amlapitta_diagnoses():
    """Unsupported diagnoses without grounded facts are strictly rejected."""
    facts = [
        ClinicalFact(
            concept_id="SYM_HEADACHE",
            canonical_text="headache",
            category=FactCategory.SYMPTOM,
            assertion=FactAssertion.PRESENT,
            temporality=FactTemporality.CURRENT,
            experiencer=FactExperiencer.PATIENT,
            evidence="sir dard",
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.95,
            provenance=FactProvenance(source_id="t-1", start_char=0, end_char=8, matched_text="sir dard", engine="nlp"),
        )
    ]

    # Attempting to project GERD / Amlapitta
    audit = audit_projection_integrity(
        facts=facts,
        diagnoses=["Gastroesophageal Reflux Disease (GERD)", "Amlapitta"],
    )

    assert not audit.safe
    assert len(audit.violations) == 2
    types = [v["type"] for v in audit.violations]
    assert "UNANCHORED_GERD_AMLAPITTA" in types


def test_rejects_fabricated_vital_signs():
    """Fabricated vital signs (120/80 mmHg) without measurement evidence are rejected."""
    facts = [
        ClinicalFact(
            concept_id="SYM_FEVER",
            canonical_text="fever",
            category=FactCategory.SYMPTOM,
            assertion=FactAssertion.PRESENT,
            temporality=FactTemporality.CURRENT,
            experiencer=FactExperiencer.PATIENT,
            evidence="bukhar",
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.95,
            provenance=FactProvenance(source_id="t-1", start_char=0, end_char=6, matched_text="bukhar", engine="nlp"),
        )
    ]

    # Attempting to claim 120/80 mmHg without vital facts or evidence
    audit = audit_projection_integrity(
        facts=facts,
        vitals="Blood Pressure: 120/80 mmHg, Pulse 72 bpm",
    )

    assert not audit.safe
    assert len(audit.violations) >= 1
    assert any(v["type"] == "FABRICATED_VITAL_SIGNS" for v in audit.violations)


def test_accepts_grounded_vital_signs():
    """Grounded vital signs with matching measurement evidence pass cleanly."""
    facts = [
        ClinicalFact(
            concept_id="VITAL_BP_SYSTOLIC",
            canonical_text="systolic blood pressure",
            category=FactCategory.VITAL,
            assertion=FactAssertion.PRESENT,
            temporality=FactTemporality.CURRENT,
            experiencer=FactExperiencer.PATIENT,
            evidence="148/92 mmHg",
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.98,
            provenance=FactProvenance(source_id="t-1", start_char=0, end_char=11, matched_text="148/92 mmHg", engine="nlp"),
        )
    ]

    audit = audit_projection_integrity(
        facts=facts,
        vitals="148/92 mmHg",
    )

    assert audit.safe
    assert len(audit.violations) == 0


def test_rejects_unauthorized_prescriptions():
    """Pre-consult intake generating prescription orders is blocked."""
    facts = [
        ClinicalFact(
            concept_id="COND_DIABETES",
            canonical_text="diabetes mellitus",
            category=FactCategory.CONDITION,
            assertion=FactAssertion.PRESENT,
            temporality=FactTemporality.CURRENT,
            experiencer=FactExperiencer.PATIENT,
            evidence="sugar",
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.95,
            provenance=FactProvenance(source_id="t-1", start_char=0, end_char=5, matched_text="sugar", engine="nlp"),
        )
    ]

    # System attempts to order Metformin without clinician author
    audit = audit_projection_integrity(
        facts=facts,
        prescriptions=[{"name": "Metformin 500mg BD", "is_clinician_approved": False}],
        is_pre_consult=True,
    )

    assert not audit.safe
    assert any(v["type"] == "FABRICATED_PRESCRIPTION" for v in audit.violations)


def test_clinical_fact_provenance_validation():
    """Validates that ClinicalFact enforces non-blank source and valid offsets."""
    valid_fact = ClinicalFact(
        concept_id="SYM_COUGH",
        canonical_text="cough",
        category=FactCategory.SYMPTOM,
        assertion=FactAssertion.PRESENT,
        temporality=FactTemporality.CURRENT,
        experiencer=FactExperiencer.PATIENT,
        evidence="khasi",
        source=FactSource.PATIENT_TRANSCRIPT,
        confidence=0.95,
        provenance=FactProvenance(source_id="turn-1", start_char=5, end_char=10, matched_text="khasi", engine="nlp"),
    )

    result = validate_clinical_fact(valid_fact)
    assert result.valid
    assert len(result.violations) == 0

    # Test invalid provenance: blank source_id
    invalid_fact = valid_fact.model_copy(
        update={"provenance": FactProvenance(source_id="", start_char=0, end_char=5, matched_text="khasi", engine="nlp")}
    )
    res_inv = validate_clinical_fact(invalid_fact)
    assert not res_inv.valid
    assert any("source_id" in v for v in res_inv.violations)

    # Test invalid provenance: end_char < start_char
    with pytest.raises(Exception):
        FactProvenance(source_id="t-1", start_char=10, end_char=5, matched_text="khasi", engine="nlp")


def test_rejects_unanchored_allergies():
    """Unsupported allergies without clinical evidence are blocked."""
    facts = [
        ClinicalFact(
            concept_id="SYM_FEVER",
            canonical_text="fever",
            category=FactCategory.SYMPTOM,
            assertion=FactAssertion.PRESENT,
            temporality=FactTemporality.CURRENT,
            experiencer=FactExperiencer.PATIENT,
            evidence="bukhar",
            source=FactSource.PATIENT_TRANSCRIPT,
            confidence=0.95,
            provenance=FactProvenance(source_id="t-1", start_char=0, end_char=6, matched_text="bukhar", engine="nlp"),
        )
    ]

    # Attempting to project unmentioned penicillin allergy
    audit = audit_projection_integrity(
        facts=facts,
        allergies=["Severe Penicillin Allergy (Anaphylaxis)"],
    )

    assert not audit.safe
    assert any(v["type"] == "UNANCHORED_ALLERGY" for v in audit.violations)
