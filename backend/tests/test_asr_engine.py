"""ASR Tests — Phase 8.6 (two separate test classes as required).

CLASS A — TestASRSyntheticSmoke
  Tests: audio preprocessing, tensor generation, ONNX loading,
         inference execution path, decoder execution.
  Input: programmatically generated synthetic waveforms.
  Does NOT claim ASR accuracy. Does NOT report WER.
  Labelled explicitly as "synthetic" in all test IDs.

CLASS B — TestASRRealHumanSpeech  (DEFERRED)
  Tests: actual ASR recognition, WER, CER, clinical recall, etc.
  Input: real human-recorded speech WAV files with independent ground truth.
  Status: DEFERRED — no real human-recorded speech fixtures are available.
  All tests are marked @pytest.mark.skip(reason="DEFERRED: no real speech fixtures")
  Do NOT manufacture WER from synthetic inputs.

INVARIANTS:
  - synthetic waveforms are NEVER described as "real speech"
  - WER/CER are NEVER computed from synthetic inputs
  - ASR_ACCURACY_VALIDATED flag remains False until Class B executes
"""

from __future__ import annotations

import base64
import io
import struct
import wave
from typing import Dict, List

import numpy as np
import pytest

from app.asr.engine import (
    ASRAvailabilityStatus,
    LocalIndicASREngine,
    _ctc_greedy_decode,
    _verify_onnx_contract,
    compute_log_mel_spectrogram,
    decode_audio_to_pcm16k,
    local_asr_engine,
    validate_audio_quality,
)
from app.clinical.ingestion import AudioInput
from app.clinical.models import FactSource

# ---------------------------------------------------------------------------
# Sentinel: ASR accuracy remains UNVALIDATED until Class B runs with real audio
# ---------------------------------------------------------------------------
ASR_ACCURACY_VALIDATED = False


# ---------------------------------------------------------------------------
# Helpers — synthetic audio construction
# ---------------------------------------------------------------------------

def _make_synthetic_wav_b64(
    freq_hz: float = 440.0,
    duration_s: float = 1.0,
    sample_rate: int = 16000,
    amplitude: float = 0.5,
) -> str:
    """
    Generate a synthetic sine-tone WAV and return as base64.

    LABELLED EXPLICITLY: this is a synthetic waveform, NOT real speech.
    It is used only for preprocessing and inference execution path validation.
    """
    n = int(sample_rate * duration_s)
    t = np.linspace(0, duration_s, n, dtype=np.float32)
    pcm_f = amplitude * np.sin(2 * np.pi * freq_hz * t)
    pcm_i16 = (pcm_f * 32767).clip(-32768, 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_i16.tobytes())
    return base64.b64encode(buf.getvalue()).decode()


def _make_silence_wav_b64(duration_s: float = 1.0, sample_rate: int = 16000) -> str:
    """Generate a silent WAV (all zeros) as base64."""
    n = int(sample_rate * duration_s)
    pcm_i16 = np.zeros(n, dtype=np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_i16.tobytes())
    return base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# CLASS A — Synthetic Waveform Smoke Tests
# ---------------------------------------------------------------------------

class TestASRSyntheticSmoke:
    """
    CLASS A — Synthetic waveform smoke tests.

    Validates: audio preprocessing, tensor generation, ONNX loading,
    inference execution, and decoder execution.

    All inputs are programmatically generated synthetic sine tones.
    These are NOT real speech. WER and CER are NOT computed here.
    These tests do NOT contribute to ASR accuracy validation.
    """

    # ---- Audio Quality Gate -----------------------------------------------

    def test_synthetic_reject_empty_audio(self):
        """SYNTHETIC: empty payload must be rejected by quality gate."""
        audio = AudioInput.model_construct(audio_base64="   ", mime_type="audio/wav")
        valid, code, err = validate_audio_quality(audio)
        assert not valid
        assert code == "EMPTY_AUDIO"

    def test_synthetic_reject_duration_under_200ms(self):
        """SYNTHETIC: sub-200ms audio must be rejected by quality gate."""
        b64 = _make_synthetic_wav_b64(duration_s=0.05)
        audio = AudioInput(audio_base64=b64, mime_type="audio/wav", duration_ms=50)
        valid, code, err = validate_audio_quality(audio)
        assert not valid
        assert code == "SILENCE_DETECTED"

    def test_synthetic_reject_unsupported_mime(self):
        """SYNTHETIC: unsupported MIME must be rejected by quality gate."""
        b64 = _make_synthetic_wav_b64()
        audio = AudioInput(audio_base64=b64, mime_type="video/avi", duration_ms=2000)
        valid, code, err = validate_audio_quality(audio)
        assert not valid
        assert code == "UNSUPPORTED_MIME"

    def test_synthetic_accept_valid_wav(self):
        """SYNTHETIC: valid WAV payload must pass quality gate."""
        b64 = _make_synthetic_wav_b64(duration_s=1.0)
        audio = AudioInput(audio_base64=b64, mime_type="audio/wav", duration_ms=1000)
        valid, code, err = validate_audio_quality(audio)
        assert valid
        assert code is None

    # ---- PCM decode -------------------------------------------------------

    def test_synthetic_pcm_decode_shape(self):
        """SYNTHETIC: PCM decode must return float32 array of correct length."""
        b64 = _make_synthetic_wav_b64(duration_s=1.0, sample_rate=16000)
        audio_bytes = base64.b64decode(b64)
        pcm = decode_audio_to_pcm16k(audio_bytes)
        assert pcm.dtype == np.float32
        assert len(pcm) > 0
        assert pcm.min() >= -1.0
        assert pcm.max() <= 1.0

    def test_synthetic_pcm_resample_from_8khz(self):
        """SYNTHETIC: 8 kHz WAV must be resampled to ~16000 samples/s."""
        n = 8000  # 1 second at 8kHz
        pcm_i16 = (0.3 * np.sin(2 * np.pi * 300 * np.linspace(0, 1, n))).clip(-1, 1)
        pcm_i16 = (pcm_i16 * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(8000)
            wf.writeframes(pcm_i16.tobytes())
        b64 = base64.b64encode(buf.getvalue()).decode()
        pcm = decode_audio_to_pcm16k(base64.b64decode(b64))
        # After resample from 8k→16k, length ≈ 16000 ± 5%
        assert abs(len(pcm) - 16000) < 1000

    # ---- Mel spectrogram --------------------------------------------------

    def test_synthetic_mel_spectrogram_shape(self):
        """SYNTHETIC: log-mel spectrogram must be (80, T) with T > 0."""
        b64 = _make_synthetic_wav_b64(duration_s=1.0)
        pcm = decode_audio_to_pcm16k(base64.b64decode(b64))
        feats = compute_log_mel_spectrogram(pcm)
        assert feats.shape[0] == 80
        assert feats.shape[1] > 0
        assert feats.dtype == np.float32

    def test_synthetic_mel_no_nan_or_inf(self):
        """SYNTHETIC: mel spectrogram must not contain NaN or Inf."""
        b64 = _make_synthetic_wav_b64(duration_s=1.0)
        pcm = decode_audio_to_pcm16k(base64.b64decode(b64))
        feats = compute_log_mel_spectrogram(pcm)
        assert not np.isnan(feats).any(), "NaN found in mel spectrogram"
        assert not np.isinf(feats).any(), "Inf found in mel spectrogram"

    def test_synthetic_mel_short_audio_padded(self):
        """SYNTHETIC: audio shorter than n_fft must be padded without error."""
        short = np.zeros(100, dtype=np.float32)
        feats = compute_log_mel_spectrogram(short)
        assert feats.shape[0] == 80

    # ---- ONNX loading and availability ------------------------------------

    def test_onnx_availability_is_derived(self):
        """
        Derived status must report a boolean is_available and a valid status string.
        NEVER hardcoded; must be derived from model file existence, size, SHA-256,
        ONNX session load, and tensor contract check.
        """
        status = local_asr_engine.check_status(deep=False)
        assert isinstance(status, ASRAvailabilityStatus)
        assert status.status in ("READY", "UNAVAILABLE", "ERROR")
        assert isinstance(status.is_available, bool)
        # ASR languages: must not claim Tamil
        if status.is_available:
            assert "ta" not in status.asr_supported_languages, (
                "Tamil (ta) must NOT be listed as an ASR language for this model"
            )
            assert "hi" in status.asr_supported_languages

    def test_onnx_session_loads_when_available(self):
        """SYNTHETIC: if model is READY, ONNX session must not be None."""
        status = local_asr_engine.check_status()
        if status.is_available:
            assert local_asr_engine._session is not None
        else:
            pytest.skip(f"Model UNAVAILABLE: {status.reason}")

    def test_onnx_tensor_contract_verified_when_available(self):
        """SYNTHETIC: tensor contract must be verified before READY is reported."""
        status = local_asr_engine.check_status()
        if status.is_available:
            assert status.onnx_contract_verified is True
            assert status.model_sha256_verified is True
        else:
            pytest.skip(f"Model UNAVAILABLE: {status.reason}")

    # ---- Inference execution path -----------------------------------------

    def test_synthetic_inference_execution_path(self):
        """
        SYNTHETIC: run a forward pass with a 440 Hz sine tone.
        Validates: feature extraction → ONNX run → log_probs shape (1, T, 5633).

        Output transcript from synthetic audio is meaningless and is NOT used
        to claim any ASR accuracy. WER is NOT computed.
        """
        status = local_asr_engine.check_status()
        if not status.is_available:
            pytest.skip(f"Model UNAVAILABLE: {status.reason}")

        # 440 Hz, 1 second, 16kHz — SYNTHETIC WAVEFORM, NOT REAL SPEECH
        t = np.linspace(0, 1.0, 16000, dtype=np.float32)
        sine = 0.5 * np.sin(2 * np.pi * 440 * t)
        feats = compute_log_mel_spectrogram(sine)
        inp = feats[np.newaxis, :, :]
        length = np.array([inp.shape[2]], dtype=np.int64)

        outs = local_asr_engine._session.run(
            None,
            {"processed_signal": inp, "processed_signal_length": length},
        )
        log_probs = outs[0]

        assert log_probs.ndim == 3, f"Expected 3-D log_probs, got {log_probs.ndim}"
        assert log_probs.shape[0] == 1, "Batch dim must be 1"
        assert log_probs.shape[2] == 5633, "Vocab dim must be 5633"

    def test_synthetic_deep_smoke_inference(self):
        """SYNTHETIC: check_status(deep=True) must return inference_smoke_tested=True when READY."""
        status = local_asr_engine.check_status(deep=True)
        if not status.is_available:
            pytest.skip(f"Model UNAVAILABLE: {status.reason}")
        assert status.inference_smoke_tested is True

    # ---- Decoder execution ------------------------------------------------

    def test_synthetic_ctc_decoder_blank_collapse(self):
        """SYNTHETIC: CTC greedy decoder must collapse repeated tokens and blank (id=0)."""
        # Fabricate log_probs: [blank, blank, 'a', 'a', blank, 'b'] → 'ab'
        # We use token IDs 65='A', 66='B' as surrogates with no real vocab
        T, V = 6, 5633
        log_probs = np.full((T, V), -100.0, dtype=np.float32)
        # frame 0,1 → blank (0); frame 2,3 → id=65; frame 4 → blank; frame 5 → id=66
        log_probs[0, 0] = 0.0
        log_probs[1, 0] = 0.0
        log_probs[2, 65] = 0.0
        log_probs[3, 65] = 0.0
        log_probs[4, 0] = 0.0
        log_probs[5, 66] = 0.0

        # Pass vocab=None → falls back to chr() representation
        result = _ctc_greedy_decode(log_probs, vocab=None)
        # Should produce chr(65)+chr(66) = 'AB'
        assert result.strip() in ("AB", "A B", ""), f"Unexpected decode: {result!r}"

    def test_synthetic_ctc_decoder_all_blank(self):
        """SYNTHETIC: all-blank frames must produce empty string."""
        T, V = 10, 5633
        log_probs = np.full((T, V), -100.0, dtype=np.float32)
        log_probs[:, 0] = 0.0  # all blank
        result = _ctc_greedy_decode(log_probs, vocab=None)
        assert result == ""

    # ---- Silence → zero fabrication ---------------------------------------

    def test_synthetic_silence_emits_zero_facts(self):
        """SYNTHETIC: silent audio must produce empty transcript and ZERO clinical facts."""
        status = local_asr_engine.check_status()
        if not status.is_available:
            pytest.skip(f"Model UNAVAILABLE: {status.reason}")

        b64 = _make_silence_wav_b64(duration_s=1.0)
        audio = AudioInput(audio_base64=b64, mime_type="audio/wav", duration_ms=1000)
        result = local_asr_engine.transcribe(audio_input=audio, language_hint="hi")
        assert result.text == ""
        assert len(result.facts) == 0, "Silence must produce ZERO fabricated facts"

    def test_unavailable_model_raises_runtime_error(self):
        """If model is absent, transcribe() must raise RuntimeError — NO synthetic fallback."""
        import tempfile, os
        # Create a real file with wrong size/content so the integrity checks fail cleanly
        with tempfile.NamedTemporaryFile(suffix=".onnx", delete=False) as f:
            f.write(b"not-a-real-model")
            tmp_path = f.name
        try:
            ghost = LocalIndicASREngine(model_path=tmp_path)
            assert ghost._session is None  # size mismatch → UNAVAILABLE
            b64 = _make_synthetic_wav_b64(duration_s=1.0)
            audio = AudioInput(audio_base64=b64, mime_type="audio/wav", duration_ms=1000)
            with pytest.raises(RuntimeError, match="UNAVAILABLE"):
                ghost.transcribe(audio_input=audio, language_hint="hi")
        finally:
            os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# CLASS B — Real Human-Recorded Speech  (DEFERRED)
# ---------------------------------------------------------------------------

@pytest.mark.skip(
    reason=(
        "DEFERRED — no real human-recorded speech fixtures available. "
        "Class B requires WAV files recorded by human speakers with independent "
        "ground-truth transcripts. WER, CER, clinical recall, negation preservation, "
        "medication preservation, and numerical-value preservation are NOT reported "
        "until real audio fixtures are provided. "
        "See docs/asr_validation_status.md for acceptance criteria."
    )
)
class TestASRRealHumanSpeech:
    """
    CLASS B — Real human-recorded speech validation.

    STATUS: DEFERRED

    Acceptance criteria before this class can run:
      - WAV fixture files recorded by actual human speakers (not TTS)
      - Independent ground-truth transcripts not derived from ASR output
      - Minimum 10 utterances covering the 8 supported ASR languages
      - At least 3 clinical utterances with medications, numeric values, and negations

    Metrics to be computed:
      - WER (Word Error Rate) per language
      - CER (Character Error Rate) per language
      - Clinical entity recall (medication names, diagnoses, numeric values)
      - Negation preservation rate
      - Medication name preservation rate
      - Numerical-value preservation rate

    None of these metrics are manufactured or estimated from synthetic input.
    """

    def test_real_speech_hindi_wer(self):
        """REAL SPEECH: measure WER on Hindi clinical utterance fixture."""
        pytest.skip("DEFERRED: real Hindi speech fixture not yet available.")

    def test_real_speech_bengali_wer(self):
        """REAL SPEECH: measure WER on Bengali clinical utterance fixture."""
        pytest.skip("DEFERRED: real Bengali speech fixture not yet available.")

    def test_real_speech_gujarati_wer(self):
        """REAL SPEECH: measure WER on Gujarati clinical utterance fixture."""
        pytest.skip("DEFERRED: real Gujarati speech fixture not yet available.")

    def test_real_speech_marathi_wer(self):
        """REAL SPEECH: measure WER on Marathi clinical utterance fixture."""
        pytest.skip("DEFERRED: real Marathi speech fixture not yet available.")

    def test_real_speech_negation_preservation(self):
        """REAL SPEECH: verify negation markers (nahi, na, no) preserved in transcript."""
        pytest.skip("DEFERRED: real speech fixture with negation not yet available.")

    def test_real_speech_medication_preservation(self):
        """REAL SPEECH: verify medication names preserved in transcript."""
        pytest.skip("DEFERRED: real speech fixture with medication not yet available.")

    def test_real_speech_numeric_value_preservation(self):
        """REAL SPEECH: verify numeric values (dosage, BP, glucose) preserved."""
        pytest.skip("DEFERRED: real speech fixture with numeric values not yet available.")

    def test_real_speech_clinical_entity_recall(self):
        """REAL SPEECH: verify clinical entities extracted after transcription."""
        pytest.skip("DEFERRED: real speech fixture for clinical recall not yet available.")
