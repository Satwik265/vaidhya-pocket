"""Phase 8.5-H: Assertion, Temporality, and Experiencer Benchmark.

Tests the exact canonical evaluation sentences:
1. "I have diabetes" -> PRESENT, CURRENT, PATIENT
2. "I don't have diabetes" -> NEGATED, CURRENT, PATIENT
3. "I had diabetes previously" -> PRESENT, HISTORICAL, PATIENT
4. "Maybe I have diabetes" -> SUSPECTED/UNCERTAIN, CURRENT, PATIENT
5. "If my sugar increases, I take insulin" -> CONDITIONAL, CURRENT, PATIENT
6. "My mother has diabetes" -> PRESENT, CURRENT, FAMILY_MEMBER
7. "I don't have diabetes now, but I had it five years ago" -> Contrastive (both CURRENT NEGATED and HISTORICAL PRESENT)
"""

import pytest
from app.nlp.extractor import extract_clinical_facts
from app.clinical.models import FactAssertion, FactTemporality, FactExperiencer


def test_sentence_1_present_current_patient():
    """Sentence 1: 'I have diabetes' -> PRESENT, CURRENT, PATIENT."""
    text = "I have diabetes"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion == FactAssertion.PRESENT
    assert f.temporality == FactTemporality.CURRENT
    assert f.experiencer == FactExperiencer.PATIENT
    assert "diabetes" in f.evidence.lower()


def test_sentence_2_negated_current_patient():
    """Sentence 2: 'I don't have diabetes' -> NEGATED, CURRENT, PATIENT."""
    text = "I don't have diabetes"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion == FactAssertion.NEGATED
    assert f.temporality == FactTemporality.CURRENT
    assert f.experiencer == FactExperiencer.PATIENT
    assert f.evidence is not None


def test_sentence_3_present_historical_patient():
    """Sentence 3: 'I had diabetes previously' -> PRESENT, HISTORICAL, PATIENT."""
    text = "I had diabetes previously"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion == FactAssertion.PRESENT
    assert f.temporality == FactTemporality.HISTORICAL
    assert f.experiencer == FactExperiencer.PATIENT


def test_sentence_4_suspected_current_patient():
    """Sentence 4: 'Maybe I have diabetes' -> SUSPECTED/UNCERTAIN, CURRENT, PATIENT."""
    text = "Maybe I have diabetes"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion in (FactAssertion.SUSPECTED, FactAssertion.UNCERTAIN)
    assert f.temporality == FactTemporality.CURRENT
    assert f.experiencer == FactExperiencer.PATIENT


def test_sentence_5_conditional_current_patient():
    """Sentence 5: 'If my sugar increases, I take insulin' -> CONDITIONAL, CURRENT, PATIENT."""
    text = "If my sugar increases, I take insulin"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion == FactAssertion.CONDITIONAL
    assert f.temporality == FactTemporality.CURRENT
    assert f.experiencer == FactExperiencer.PATIENT


def test_sentence_6_present_current_family():
    """Sentence 6: 'My mother has diabetes' -> PRESENT, CURRENT, FAMILY_MEMBER."""
    text = "My mother has diabetes"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 1
    f = next(fact for fact in facts if fact.concept_id == "COND_DIABETES")
    assert f.assertion == FactAssertion.PRESENT
    assert f.temporality == FactTemporality.CURRENT
    assert f.experiencer == FactExperiencer.FAMILY_MEMBER


def test_sentence_7_contrastive_dual_assertion():
    """Sentence 7: 'I don't have diabetes now, but I had it five years ago' -> Dual facts."""
    text = "I don't have diabetes now, but I had it five years ago"
    facts = extract_clinical_facts(text, language="en")
    assert len(facts) >= 2

    diabetes_facts = [f for f in facts if f.concept_id == "COND_DIABETES"]
    assert len(diabetes_facts) == 2

    # Check that one is historical affirmed and one is current negated
    hist_fact = next(f for f in diabetes_facts if f.temporality == FactTemporality.HISTORICAL)
    curr_fact = next(f for f in diabetes_facts if f.temporality == FactTemporality.CURRENT)

    assert hist_fact.assertion == FactAssertion.PRESENT
    assert hist_fact.experiencer == FactExperiencer.PATIENT

    assert curr_fact.assertion == FactAssertion.NEGATED
    assert curr_fact.experiencer == FactExperiencer.PATIENT
