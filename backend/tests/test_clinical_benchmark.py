"""Phase 8.5-G: 150-Case Clinical Evaluation Benchmark Test.

Runs sovereign extraction on 150 clinical evaluation cases across 6 languages
(EN, HI, Hinglish, MR, TA, GU) and 12 clinical domains, evaluating:
1. Precision, Recall, F1
2. Assertion Accuracy (Affirmed vs Negated vs Suspected vs Conditional)
3. Temporality Accuracy (Current vs Historical)
4. Experiencer Accuracy (Patient vs Family Member)
5. Zero Fabrication Invariant (Every fact grounded in verbatim evidence)
"""

import pytest
from app.clinical.benchmark_dataset import CLINICAL_BENCHMARK_CASES
from app.nlp.extractor import extract_clinical_facts
from app.clinical.models import ClinicalFact


def test_benchmark_dataset_integrity():
    """Validates the benchmark dataset structure, counts, and distribution."""
    assert len(CLINICAL_BENCHMARK_CASES) == 150

    languages = {}
    for case in CLINICAL_BENCHMARK_CASES:
        languages[case.language] = languages.get(case.language, 0) + 1

    # EN: 25, HI: 65 (35 Hindi + 30 Hinglish), MR: 20, TA: 20, GU: 20
    assert languages["en"] == 25
    assert languages["hi"] == 65
    assert languages["mr"] == 20
    assert languages["ta"] == 20
    assert languages["gu"] == 20

    # Ensure all expected facts have valid fields
    for case in CLINICAL_BENCHMARK_CASES:
        assert len(case.expected_facts) >= 1
        for ef in case.expected_facts:
            assert ef.concept_id.startswith(("SYM_", "COND_", "MED_", "VITAL_"))
            assert ef.assertion in ("present", "negated", "suspected", "conditional")


def test_clinical_benchmark_evaluation():
    """Runs extraction across all 150 cases and validates metrics against targets."""
    total_expected = 0
    true_positives = 0
    false_positives = 0
    false_negatives = 0

    assertion_matches = 0
    assertion_total = 0

    temporality_matches = 0
    temporality_total = 0

    experiencer_matches = 0
    experiencer_total = 0

    unanchored_hallucinations = 0
    total_emitted_facts = 0

    for case in CLINICAL_BENCHMARK_CASES:
        extracted = extract_clinical_facts(case.utterance, language=case.language)
        total_emitted_facts += len(extracted)

        # Invariant check: Evidence Span Grounding
        for f in extracted:
            assert f.evidence is not None and len(f.evidence.strip()) > 0
            # Evidence must be grounded in the original utterance (case-insensitive substring)
            if f.evidence.lower() not in case.utterance.lower():
                unanchored_hallucinations += 1

        extracted_concepts = {f.concept_id: f for f in extracted}
        expected_concepts = {ef.concept_id: ef for ef in case.expected_facts}

        total_expected += len(expected_concepts)

        for cid, ef in expected_concepts.items():
            if cid in extracted_concepts:
                true_positives += 1
                matched_fact = extracted_concepts[cid]

                # Check assertion accuracy
                assertion_total += 1
                if matched_fact.assertion.value == ef.assertion:
                    assertion_matches += 1

                # Check temporality accuracy
                temporality_total += 1
                if matched_fact.temporality.value == ef.temporality:
                    temporality_matches += 1

                # Check experiencer accuracy
                experiencer_total += 1
                if matched_fact.experiencer.value == ef.experiencer:
                    experiencer_matches += 1
            else:
                false_negatives += 1

        for cid in extracted_concepts:
            if cid not in expected_concepts:
                false_positives += 1

    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

    assertion_acc = assertion_matches / assertion_total if assertion_total > 0 else 0
    temporality_acc = temporality_matches / temporality_total if temporality_total > 0 else 0
    experiencer_acc = experiencer_matches / experiencer_total if experiencer_total > 0 else 0

    print("\n" + "=" * 60)
    print("CLINICAL EVALUATION BENCHMARK RESULTS (150 CASES)")
    print("=" * 60)
    print(f"Total Cases:            150")
    print(f"Total Expected Facts:   {total_expected}")
    print(f"True Positives:         {true_positives}")
    print(f"False Positives:        {false_positives}")
    print(f"False Negatives:        {false_negatives}")
    print(f"Precision:              {precision:.4f} (target >= 0.90)")
    print(f"Recall:                 {recall:.4f} (target >= 0.90)")
    print(f"F1 Score:               {f1:.4f} (target >= 0.90)")
    print(f"Assertion Accuracy:     {assertion_acc:.4f} (target >= 0.92)")
    print(f"Temporality Accuracy:   {temporality_acc:.4f} (target >= 0.90)")
    print(f"Experiencer Accuracy:   {experiencer_acc:.4f} (target >= 0.95)")
    print(f"Unanchored Hallucinations: {unanchored_hallucinations} (target == 0)")
    print("=" * 60)

    # Assert non-negotiable thresholds
    assert recall >= 0.90, f"Recall {recall:.4f} below target 0.90"
    assert precision >= 0.90, f"Precision {precision:.4f} below target 0.90"
    assert f1 >= 0.90, f"F1 Score {f1:.4f} below target 0.90"
    assert assertion_acc >= 0.92, f"Assertion Accuracy {assertion_acc:.4f} below target 0.92"
    assert temporality_acc >= 0.90, f"Temporality Accuracy {temporality_acc:.4f} below target 0.90"
    assert experiencer_acc >= 0.95, f"Experiencer Accuracy {experiencer_acc:.4f} below target 0.95"
    assert unanchored_hallucinations == 0, f"Detected {unanchored_hallucinations} unanchored facts!"
