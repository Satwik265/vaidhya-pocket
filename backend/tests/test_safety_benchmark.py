"""Phase 8.5-I: Safety Triage Benchmark.

Validates:
1. Negative assertion safety:
   - "Chest pain nahi hai." -> negated chest pain -> 0 red flags.
2. Red flag combination detection:
   - "Chest pain hai aur saans lene mein dikkat hai." -> RED_FLAG_ACS_DYSPNEA, priority triage required, 0 treatment directives.
3. Contrastive negation safety:
   - "Chest pain nahi hai lekin saans lene mein bahut dikkat hai." -> RED_FLAG_SEVERE_DYSPNEA, priority triage required, 0 treatment directives.
4. Strict Triage-Only Invariant:
   - No alert provides treatment directives, medication prescriptions, or dosage orders.
"""

import pytest
from app.nlp.extractor import extract_clinical_facts
from app.safety.rules import evaluate_red_flags
from app.clinical.models import FactAssertion


FORBIDDEN_TREATMENT_WORDS = [
    "prescribe", "give", "administer", "dispense", "tablet", "injection",
    "aspirin", "nitroglycerin", "sorbitrate", "morphine", "heparin",
    "clopidogrel", "mg", "dose"
]


def test_negated_chest_pain_emits_zero_red_flags():
    """'Chest pain nahi hai.' -> negated -> 0 red flags."""
    text = "Chest pain nahi hai."
    facts = extract_clinical_facts(text, language="hi")
    assert len(facts) >= 1

    chest_fact = next((f for f in facts if f.concept_id == "SYM_CHEST_PAIN"), None)
    assert chest_fact is not None
    assert chest_fact.assertion == FactAssertion.NEGATED

    alerts = evaluate_red_flags(facts)
    assert len(alerts) == 0, f"Expected 0 red flags for negated chest pain, got: {[a.rule_id for a in alerts]}"


def test_affirmed_chest_pain_and_dyspnea_triggers_acs_triage():
    """'Chest pain hai aur saans lene mein dikkat hai.' -> RED_FLAG_ACS_DYSPNEA."""
    text = "Chest pain hai aur saans lene mein dikkat hai."
    facts = extract_clinical_facts(text, language="hi")

    chest_fact = next((f for f in facts if f.concept_id == "SYM_CHEST_PAIN"), None)
    dyspnea_fact = next((f for f in facts if f.concept_id == "SYM_BREATHLESSNESS"), None)

    assert chest_fact is not None and chest_fact.assertion == FactAssertion.PRESENT
    assert dyspnea_fact is not None and dyspnea_fact.assertion == FactAssertion.PRESENT

    alerts = evaluate_red_flags(facts)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.rule_id == "RED_FLAG_ACS_DYSPNEA"
    assert alert.severity == "CRITICAL"
    assert "Priority triage required" in alert.recommended_immediate_action
    assert alert.is_triage_only is True

    # Invariant: 0 treatment directives
    for word in FORBIDDEN_TREATMENT_WORDS:
        assert word not in alert.recommended_immediate_action.lower()
        assert word not in alert.clinical_summary.lower()


def test_contrastive_negated_chest_pain_with_affirmed_dyspnea():
    """'Chest pain nahi hai lekin saans lene mein bahut dikkat hai.' -> RED_FLAG_SEVERE_DYSPNEA."""
    text = "Chest pain nahi hai lekin saans lene mein bahut dikkat hai."
    facts = extract_clinical_facts(text, language="hi")

    chest_fact = next((f for f in facts if f.concept_id == "SYM_CHEST_PAIN"), None)
    dyspnea_fact = next((f for f in facts if f.concept_id == "SYM_BREATHLESSNESS"), None)

    assert chest_fact is not None and chest_fact.assertion == FactAssertion.NEGATED
    assert dyspnea_fact is not None and dyspnea_fact.assertion == FactAssertion.PRESENT

    alerts = evaluate_red_flags(facts)
    assert len(alerts) == 1
    alert = alerts[0]
    # Must NOT be ACS because chest pain is negated!
    assert alert.rule_id == "RED_FLAG_SEVERE_DYSPNEA"
    assert alert.severity == "HIGH"
    assert "Priority triage required" in alert.recommended_immediate_action
    assert alert.is_triage_only is True

    # Invariant: 0 treatment directives
    for word in FORBIDDEN_TREATMENT_WORDS:
        assert word not in alert.recommended_immediate_action.lower()
        assert word not in alert.clinical_summary.lower()
