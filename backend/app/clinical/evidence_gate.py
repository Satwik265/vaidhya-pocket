"""Clinical Evidence & Fabrication Gatekeeper for Sovereign Python AI Core.

Enforces zero clinical fabrication invariants across fact extraction,
downstream projection, summary generation, and clinical safety.
"""

import re
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from .models import ClinicalFact, FactAssertion, FactCategory


class FactValidationResult(BaseModel):
    valid: bool
    violations: List[str]


class ProjectionAuditResult(BaseModel):
    safe: bool
    violations: List[Dict[str, str]]
    ungrounded_elements: List[str]


FORBIDDEN_SYNTHETIC_DIAGNOSES = [
    "gastroesophageal reflux disease",
    "gerd",
    "amlapitta",
    "functional dyspepsia",
    "peptic ulcer disease",
    "plasmodium falciparum malaria",
    "acute suppurative otitis media",
]


def validate_clinical_fact(fact: ClinicalFact) -> FactValidationResult:
    """Validates that a ClinicalFact model strictly obeys evidence grounding rules."""
    violations: List[str] = []

    # 1. Mandatory identifiers
    if not fact.concept_id or not fact.concept_id.strip():
        violations.append("Missing concept_id")
    if not fact.canonical_text or not fact.canonical_text.strip():
        violations.append("Missing canonical_text")

    # 2. Evidence Grounding Invariant
    if not fact.evidence or not fact.evidence.strip():
        violations.append(f"Fact ({fact.concept_id}) requires verbatim evidence span.")

    # 3. Provenance Span Integrity
    if fact.provenance is None:
        violations.append(f"Fact ({fact.concept_id}) missing provenance metadata.")
    else:
        if fact.provenance.end_char < fact.provenance.start_char:
            violations.append(
                f"Invalid provenance span [{fact.provenance.start_char}:{fact.provenance.end_char}]"
            )
        if not fact.provenance.source_id or not fact.provenance.source_id.strip():
            violations.append("Provenance source_id cannot be blank.")

    # 4. Confidence Score Bounds
    if not (0.0 <= fact.confidence <= 1.0):
        violations.append(f"Confidence score {fact.confidence} out of range [0.0, 1.0].")

    return FactValidationResult(valid=len(violations) == 0, violations=violations)


def audit_projection_integrity(
    facts: List[ClinicalFact],
    diagnoses: Optional[List[str]] = None,
    vitals: Optional[str] = None,
    prescriptions: Optional[List[Dict[str, Any]]] = None,
    allergies: Optional[List[str]] = None,
    is_pre_consult: bool = True,
) -> ProjectionAuditResult:
    """Audits clinical claims against grounded facts before serialization."""
    violations: List[Dict[str, str]] = []
    ungrounded: List[str] = []

    affirmed_facts = [f for f in facts if f.assertion in [FactAssertion.PRESENT, FactAssertion.SUSPECTED, FactAssertion.CONDITIONAL]]
    fact_terms = [f.canonical_text.lower() for f in affirmed_facts]
    fact_codes = [f.concept_id.lower() for f in affirmed_facts]
    fact_evidences = [f.evidence.lower() for f in affirmed_facts]

    negated_facts = [f for f in facts if f.assertion == FactAssertion.NEGATED]
    negated_terms = [f.canonical_text.lower() for f in negated_facts]
    negated_codes = [f.concept_id.lower() for f in negated_facts]

    def is_grounded(query: str) -> bool:
        q = query.lower().strip()
        words = [w for w in re.split(r"[\s,()/-]+", q) if len(w) > 3]
        if not words:
            return False

        if any(q in c or c in q for c in fact_codes):
            return True
        if any(q in t or t in q for t in fact_terms):
            return True
        if any(any(w in ev for w in words) for ev in fact_evidences):
            return True
        return False

    def is_explicitly_negated(query: str) -> bool:
        q = query.lower().strip()
        words = [w for w in re.split(r"[\s,()/-]+", q) if len(w) > 3]
        if any(q in c or c in q for c in negated_codes):
            return True
        if any(q in t or t in q for t in negated_terms):
            return True
        if any(any(w in t for w in words) for t in negated_terms):
            return True
        return False

    # 1. Audit Diagnoses
    placeholder_diagnoses = [
        "not documented",
        "pending physician",
        "pending consultation",
        "unconfirmed",
        "symptom evaluation",
        "none documented",
        "primary care consultation",
    ]

    if diagnoses:
        for diag in diagnoses:
            d_lower = diag.lower().strip()
            if any(p in d_lower for p in placeholder_diagnoses):
                continue

            is_synthetic_forbidden = any(syn in d_lower for syn in FORBIDDEN_SYNTHETIC_DIAGNOSES)
            anchored = is_grounded(diag)
            negated = is_explicitly_negated(diag)

            if is_synthetic_forbidden and not anchored:
                msg = f"Fabricated diagnosis detected without anchored fact: '{diag}'"
                violations.append({"type": "UNANCHORED_GERD_AMLAPITTA", "message": msg})
                ungrounded.append(msg)
            elif negated:
                msg = f"Negated condition cannot be projected as active diagnosis: '{diag}'"
                violations.append({"type": "UNANCHORED_DIAGNOSIS", "message": msg})
                ungrounded.append(msg)
            elif not anchored:
                msg = f"Unanchored diagnosis detected without grounded ClinicalFact: '{diag}'"
                violations.append({"type": "UNANCHORED_DIAGNOSIS", "message": msg})
                ungrounded.append(msg)

    # 2. Audit Prescriptions
    if prescriptions:
        for rx in prescriptions:
            med_name = rx.get("name") or rx.get("medication") or "unspecified"
            has_clinician_approval = rx.get("is_clinician_approved") is True or rx.get("authored_by_clinician") is True
            if is_pre_consult or not has_clinician_approval:
                msg = f"Unanchored/Unauthorized prescription generated without clinician order: '{med_name}'"
                violations.append({"type": "FABRICATED_PRESCRIPTION", "message": msg})
                ungrounded.append(msg)

    # 3. Audit Vitals
    if vitals:
        v_lower = vitals.lower().strip()
        is_placeholder = any(p in v_lower for p in ["not documented", "not measured", "pending"])

        if not is_placeholder:
            has_num_bp = bool(re.search(r"\b\d{2,3}/\d{2,3}\b", v_lower))
            has_num_temp = bool(re.search(r"\b\d{2,3}(?:\.\d+)?\s*°?[cf]\b", v_lower))
            has_num_hr = bool(re.search(r"\b\d{2,3}\s*(?:bpm|beats)\b", v_lower))

            if has_num_bp or has_num_temp or has_num_hr:
                has_vital_fact = any(
                    f.category == FactCategory.VITAL and f.assertion == FactAssertion.PRESENT
                    for f in facts
                )
                has_evidence = any(
                    (has_num_bp and bool(re.search(r"\b\d{2,3}/\d{2,3}\b", ev)))
                    or (has_num_temp and bool(re.search(r"\b\d{2,3}(?:\.\d+)?\s*°?[cf]\b", ev)))
                    or (has_num_hr and bool(re.search(r"\b\d{2,3}\s*(?:bpm|beats)\b", ev)))
                    for ev in fact_evidences
                )

                if not has_vital_fact and not has_evidence:
                    msg = f"Fabricated vital signs string detected without grounded measurement evidence: '{vitals}'"
                    violations.append({"type": "FABRICATED_VITAL_SIGNS", "message": msg})
                    ungrounded.append(msg)

    # 4. Audit Allergies
    if allergies:
        has_grounded_allergy = any(f.category == FactCategory.ALLERGY for f in facts)
        has_allergy_evidence = any("allergy" in f.evidence.lower() or "allergic" in f.evidence.lower() for f in facts)
        for alg in allergies:
            a_lower = alg.lower().strip()
            if any(p in a_lower for p in ["not documented", "not elicited", "none reported"]):
                continue
            if ("nkda" in a_lower or "no known" in a_lower) and not (has_grounded_allergy or has_allergy_evidence):
                msg = f"Defaulting missing allergy documentation to NKDA is forbidden: '{alg}'"
                violations.append({"type": "UNANCHORED_ALLERGY", "message": msg})
                ungrounded.append(msg)
            elif not is_grounded(alg) and ("nkda" not in a_lower and "no known" not in a_lower):
                msg = f"Unanchored allergy detected without grounded clinical evidence: '{alg}'"
                violations.append({"type": "UNANCHORED_ALLERGY", "message": msg})
                ungrounded.append(msg)

    return ProjectionAuditResult(
        safe=len(violations) == 0,
        violations=violations,
        ungrounded_elements=ungrounded,
    )
