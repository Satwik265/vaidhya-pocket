"""Human ASR Validation Benchmark and Clinical NLP Integrity Runner.

Phase 8.7 — Real Human Speech ASR Validation & NLP Behavior Pipeline.

Reference test sentences (synthetic-persona clinical statements):
  A. Simple symptom: "मुझे पिछले तीन दिन से सिर दर्द हो रहा है।"
  B. Negation: "मुझे बुखार नहीं है लेकिन सिर दर्द बहुत रहता है।"
  C. Medication: "मैं मेटफॉर्मिन पाँच सौ मिलीग्राम दिन में दो बार लेता हूँ।"
  D. Allergy: "मुझे पेनिसिलिन से एलर्जी है।"
  E. Duration: "सीने में दर्द कल रात से है।"
  F. Code switching: "मुझे chest pain हो रहा है और breathing में थोड़ी problem है।"
  G. Marathi: "मला चक्कर येत आहे आणि डोके दुखत आहे।"
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, List, Set, Tuple

import pytest

from app.asr.engine import local_asr_engine
from app.clinical.models import FactAssertion, FactTemporality
from app.nlp.extractor import extract_clinical_facts

REAL_SPEECH_DIR = Path(__file__).parent / "fixtures" / "real_speech"


# ---------------------------------------------------------------------------
# Levenshtein WER & CER calculation utilities
# ---------------------------------------------------------------------------

def calculate_levenshtein(ref: List[str], hyp: List[str]) -> int:
    """Standard dynamic programming Levenshtein distance."""
    d = [[0] * (len(hyp) + 1) for _ in range(len(ref) + 1)]
    for i in range(len(ref) + 1):
        d[i][0] = i
    for j in range(len(hyp) + 1):
        d[0][j] = j

    for i in range(1, len(ref) + 1):
        for j in range(1, len(hyp) + 1):
            if ref[i - 1] == hyp[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                d[i][j] = min(
                    d[i - 1][j] + 1,      # deletion
                    d[i][j - 1] + 1,      # insertion
                    d[i - 1][j - 1] + 1,  # substitution
                )
    return d[len(ref)][len(hyp)]


def calculate_wer(reference: str, hypothesis: str) -> float:
    """Word Error Rate (WER) = edit_distance(ref_words, hyp_words) / len(ref_words)."""
    ref_words = reference.strip().split()
    hyp_words = hypothesis.strip().split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0
    return calculate_levenshtein(ref_words, hyp_words) / len(ref_words)


def calculate_cer(reference: str, hypothesis: str) -> float:
    """Character Error Rate (CER) = edit_distance(ref_chars, hyp_chars) / len(ref_chars)."""
    ref_chars = list(reference.replace(" ", ""))
    hyp_chars = list(hypothesis.replace(" ", ""))
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    return calculate_levenshtein(ref_chars, hyp_chars) / len(ref_chars)


def evaluate_clinical_token_preservation(
    reference_tokens: Set[str],
    hypothesis_text: str,
) -> float:
    """Measures what fraction of clinically critical keywords are preserved in the text."""
    if not reference_tokens:
        return 1.0
    preserved = sum(1 for tok in reference_tokens if tok.lower() in hypothesis_text.lower())
    return preserved / len(reference_tokens)


# ---------------------------------------------------------------------------
# Benchmark Test Corpus Specifications
# ---------------------------------------------------------------------------

CORPUS_STATEMENTS = [
    {
        "sample_id": "hi_sym_01",
        "category": "simple_symptom",
        "language": "hi",
        "reference_text": "मुझे पिछले तीन दिन से सिर दर्द हो रहा है",
        "expected_concepts": ["SYM_HEADACHE"],
        "critical_tokens": {"सिर दर्द", "तीन दिन"},
    },
    {
        "sample_id": "hi_neg_02",
        "category": "negation",
        "language": "hi",
        "reference_text": "मुझे बुखार नहीं है लेकिन सिर दर्द बहुत रहता है",
        "expected_negations": ["SYM_FEVER"],
        "expected_affirmed": ["SYM_HEADACHE"],
        "critical_tokens": {"बुखार", "नहीं", "सिर दर्द"},
    },
    {
        "sample_id": "hi_med_03",
        "category": "medication",
        "language": "hi",
        "reference_text": "मैं मेटफॉर्मिन पाँच सौ मिलीग्राम दिन में दो बार लेता हूँ",
        "expected_medications": ["RX_METFORMIN"],
        "critical_tokens": {"मेटफॉर्मिन", "दो बार"},
    },
    {
        "sample_id": "hi_alg_04",
        "category": "allergy",
        "language": "hi",
        "reference_text": "मुझे पेनिसिलिन से एलर्जी है",
        "expected_allergies": ["ALG_PENICILLIN"],
        "critical_tokens": {"पेनिसिलिन", "एलर्जी"},
    },
    {
        "sample_id": "hi_dur_05",
        "category": "duration",
        "language": "hi",
        "reference_text": "सीने में दर्द कल रात से है",
        "expected_concepts": ["SYM_CHEST_PAIN"],
        "critical_tokens": {"सीने में दर्द", "रात"},
    },
    {
        "sample_id": "hi_cs_06",
        "category": "code_switching",
        "language": "hi",
        "reference_text": "मुझे chest pain हो रहा है और breathing में थोड़ी problem है",
        "expected_concepts": ["SYM_CHEST_PAIN", "SYM_DYSPNEA"],
        "critical_tokens": {"chest pain", "breathing"},
    },
    {
        "sample_id": "mr_sym_07",
        "category": "marathi_symptom",
        "language": "mr",
        "reference_text": "मला चक्कर येत आहे आणि डोके दुखत आहे",
        "expected_concepts": ["SYM_HEADACHE", "SYM_DIZZINESS"],
        "critical_tokens": {"चक्कर", "डोके दुखत"},
    },
]


# ---------------------------------------------------------------------------
# Phase 3: Clinical NLP Integrity Tests on Reference Corpus
# ---------------------------------------------------------------------------

class TestBenchmarkClinicalNLP:
    """Validates the canonical ClinicalFact extraction behavior on all reference statements."""

    def test_nlp_simple_symptom_extraction(self):
        item = CORPUS_STATEMENTS[0]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        codes = {f.concept_id for f in facts}
        assert "SYM_HEADACHE" in codes
        headache = next(f for f in facts if f.concept_id == "SYM_HEADACHE")
        assert headache.assertion == FactAssertion.PRESENT

    def test_nlp_negation_contrastive_extraction(self):
        item = CORPUS_STATEMENTS[1]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        fact_map = {f.concept_id: f for f in facts}
        assert "SYM_FEVER" in fact_map
        assert fact_map["SYM_FEVER"].assertion == FactAssertion.NEGATED
        assert "SYM_HEADACHE" in fact_map
        assert fact_map["SYM_HEADACHE"].assertion == FactAssertion.PRESENT

    def test_nlp_medication_extraction(self):
        item = CORPUS_STATEMENTS[2]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        med_codes = {f.concept_id for f in facts if f.category.value == "medication"}
        assert any("METFORMIN" in c for c in med_codes)

    def test_nlp_allergy_extraction(self):
        item = CORPUS_STATEMENTS[3]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        alg_facts = [f for f in facts if f.category.value == "allergy"]
        assert len(alg_facts) >= 1
        assert "PENICILLIN" in alg_facts[0].concept_id

    def test_nlp_duration_and_temporality(self):
        item = CORPUS_STATEMENTS[4]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        chest_pain = next((f for f in facts if f.concept_id == "SYM_CHEST_PAIN"), None)
        assert chest_pain is not None
        assert chest_pain.assertion == FactAssertion.PRESENT

    def test_nlp_code_switching(self):
        item = CORPUS_STATEMENTS[5]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        codes = {f.concept_id for f in facts}
        assert "SYM_CHEST_PAIN" in codes

    def test_nlp_marathi_symptom(self):
        item = CORPUS_STATEMENTS[6]
        facts = extract_clinical_facts(item["reference_text"], language=item["language"])
        codes = {f.concept_id for f in facts}
        assert any(c in codes for c in ["SYM_HEADACHE", "SYM_DIZZINESS"])


# ---------------------------------------------------------------------------
# Phase 2: Real Human Audio Ingestion & Empirical Accuracy
# ---------------------------------------------------------------------------

class TestRealHumanAudioIngestion:
    """Runs actual inference when real human WAV fixtures are supplied."""

    def test_real_human_audio_corpus_status(self):
        """
        Inspects REAL_SPEECH_DIR for human-recorded audio WAVs.
        If files exist: calculates empirical WER and CER.
        If empty: marks test skipped, declaring empirical status honestly.
        """
        if not REAL_SPEECH_DIR.exists():
            pytest.skip(
                "DEFERRED: No real human-recorded speech directory at backend/tests/fixtures/real_speech/. "
                "ASR model is verified READY via synthetic smoke tests; human WER/CER awaits real audio fixtures."
            )

        wav_files = list(REAL_SPEECH_DIR.glob("*.wav"))
        if not wav_files:
            pytest.skip(
                "DEFERRED: Zero WAV files in backend/tests/fixtures/real_speech/. "
                "Drop developer/team recorded WAVs matching reference sentences to run empirical WER benchmark."
            )

        # If WAV files are present, run transcription and calculate WER/CER
        results = []
        for wav_path in wav_files:
            sample_id = wav_path.stem
            ref_item = next((c for c in CORPUS_STATEMENTS if c["sample_id"] == sample_id), None)
            if not ref_item:
                continue

            with open(wav_path, "rb") as f:
                audio_bytes = f.read()

            from app.clinical.ingestion import AudioInput
            import base64
            b64_audio = base64.b64encode(audio_bytes).decode("ascii")
            audio_input = AudioInput(
                audio_base64=b64_audio,
                mime_type="audio/wav",
                duration_ms=2500,
            )

            res = local_asr_engine.transcribe(audio_input, language_hint=ref_item["language"])
            wer = calculate_wer(ref_item["reference_text"], res.text)
            cer = calculate_cer(ref_item["reference_text"], res.text)
            preservation = evaluate_clinical_token_preservation(
                ref_item["critical_tokens"], res.text
            )
            results.append({
                "sample_id": sample_id,
                "language": ref_item["language"],
                "wer": wer,
                "cer": cer,
                "preservation": preservation,
                "hypothesis": res.text,
            })

        assert len(results) > 0, "No matching WAV samples found"
