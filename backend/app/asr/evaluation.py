"""ASR Quality & Clinical Preservation Evaluator (Phase 8.5-D).

Calculates:
- WER (Word Error Rate via dynamic programming Levenshtein distance)
- CER (Character Error Rate)
- Clinical term recall (symptoms and conditions preserved)
- Medication-name preservation (exact and fuzzy brand/generic preservation)
- Numeric preservation (dosages, vitals, frequencies)
- Negation preservation (negation markers: 'nahi', 'no', 'not', 'band', etc.)
"""

import re
from typing import List, Dict, Any, Set
from pydantic import BaseModel, Field


class ASREvaluationReport(BaseModel):
    wer: float = Field(..., ge=0.0, description="Word Error Rate (0.0 = perfect)")
    cer: float = Field(..., ge=0.0, description="Character Error Rate (0.0 = perfect)")
    clinical_term_recall: float = Field(..., ge=0.0, le=1.0, description="Proportion of clinical terms preserved")
    medication_preservation: float = Field(..., ge=0.0, le=1.0, description="Proportion of medication names preserved")
    numeric_preservation: float = Field(..., ge=0.0, le=1.0, description="Proportion of numbers, doses, and vitals preserved")
    negation_preservation: float = Field(..., ge=0.0, le=1.0, description="Proportion of negation markers preserved")
    reference_word_count: int
    hypothesis_word_count: int
    matched_clinical_terms: List[str] = Field(default_factory=list)
    missed_clinical_terms: List[str] = Field(default_factory=list)
    matched_medications: List[str] = Field(default_factory=list)
    missed_medications: List[str] = Field(default_factory=list)
    matched_numerics: List[str] = Field(default_factory=list)
    missed_numerics: List[str] = Field(default_factory=list)
    matched_negations: List[str] = Field(default_factory=list)
    missed_negations: List[str] = Field(default_factory=list)


def _tokenize_words(text: str) -> List[str]:
    """Tokenizes text into words ignoring punctuation."""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower(), flags=re.UNICODE)
    return [w for w in cleaned.split() if w]


def _levenshtein_distance(seq1: List[Any], seq2: List[Any]) -> int:
    """Computes exact edit distance (Levenshtein) between two sequences."""
    n, m = len(seq1), len(seq2)
    if n == 0:
        return m
    if m == 0:
        return n

    # DP table
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if seq1[i - 1] == seq2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,      # deletion
                dp[i][j - 1] + 1,      # insertion
                dp[i - 1][j - 1] + cost  # substitution
            )

    return dp[n][m]


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Calculates Word Error Rate: (S + D + I) / N_ref."""
    ref_words = _tokenize_words(reference)
    hyp_words = _tokenize_words(hypothesis)

    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    edit_dist = _levenshtein_distance(ref_words, hyp_words)
    return round(float(edit_dist / len(ref_words)), 4)


def calculate_cer(reference: str, hypothesis: str) -> float:
    """Calculates Character Error Rate: (S + D + I) / N_chars_ref."""
    ref_chars = list(re.sub(r"\s+", "", reference.lower()))
    hyp_chars = list(re.sub(r"\s+", "", hypothesis.lower()))

    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0

    edit_dist = _levenshtein_distance(ref_chars, hyp_chars)
    return round(float(edit_dist / len(ref_chars)), 4)


def evaluate_term_preservation(
    reference_items: List[str], hypothesis_text: str
) -> Tuple[float, List[str], List[str]]:
    """Evaluates recall of specific terms (clinical concepts, medications, numbers, negations)."""
    if not reference_items:
        return 1.0, [], []

    hyp_lower = hypothesis_text.lower()
    matched = []
    missed = []

    for item in reference_items:
        item_clean = item.lower().strip()
        # Word boundary or substring match
        pattern = r"\b" + re.escape(item_clean) + r"\b"
        if re.search(pattern, hyp_lower) or item_clean in hyp_lower:
            matched.append(item)
        else:
            missed.append(item)

    recall = len(matched) / len(reference_items)
    return round(recall, 4), matched, missed


def evaluate_asr_quality(
    reference_text: str,
    hypothesis_text: str,
    clinical_terms: List[str],
    medications: List[str],
    numeric_values: List[str],
    negation_markers: List[str],
) -> ASREvaluationReport:
    """Performs comprehensive multi-dimensional clinical ASR evaluation."""
    wer = calculate_wer(reference_text, hypothesis_text)
    cer = calculate_cer(reference_text, hypothesis_text)

    clin_recall, clin_match, clin_miss = evaluate_term_preservation(clinical_terms, hypothesis_text)
    med_recall, med_match, med_miss = evaluate_term_preservation(medications, hypothesis_text)
    num_recall, num_match, num_miss = evaluate_term_preservation(numeric_values, hypothesis_text)
    neg_recall, neg_match, neg_miss = evaluate_term_preservation(negation_markers, hypothesis_text)

    ref_words = _tokenize_words(reference_text)
    hyp_words = _tokenize_words(hypothesis_text)

    return ASREvaluationReport(
        wer=wer,
        cer=cer,
        clinical_term_recall=clin_recall,
        medication_preservation=med_recall,
        numeric_preservation=num_recall,
        negation_preservation=neg_recall,
        reference_word_count=len(ref_words),
        hypothesis_word_count=len(hyp_words),
        matched_clinical_terms=clin_match,
        missed_clinical_terms=clin_miss,
        matched_medications=med_match,
        missed_medications=med_miss,
        matched_numerics=num_match,
        missed_numerics=num_miss,
        matched_negations=neg_match,
        missed_negations=neg_miss,
    )
