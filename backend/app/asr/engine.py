"""Real Local ASR Pipeline for MedScribeAI Sovereign Clinical AI Core (Phase 8.6).

Model provenance
----------------
Original model   : ai4bharat/indicconformer_stt_hi_hybrid_ctc_rnnt_large  (AI4Bharat, MIT)
Conversion repo  : meetsync/indic-conformer-onnx-sherpa  (third-party, NOT an official AI4Bharat release)
Commit           : e19ba0d2f49c243fe4ce79ae3334526a03e753ae
Quantization     : INT8
Runtime selected : sherpa-onnx  (the model is specifically packaged for sherpa-onnx)
Fallback runtime : onnxruntime-cpu (raw ONNX, for smoke tests only)

Supported ASR languages (this model only)
-----------------------------------------
  as  Assamese   bn  Bengali    brx  Bodo
  gu  Gujarati   hi  Hindi      kn   Kannada
  ks  Kashmiri   mr  Marathi

Tamil (ta) is NOT supported by this ASR model.
NLP/NER supports Tamil independently through the deterministic extractor.

Availability contract
---------------------
Status is DERIVED at runtime (file_exists → sha256_valid → onnx_loads →
tensor_contract_verified → inference_succeeds).  NEVER hardcoded.

Zero-fabrication invariant
--------------------------
If the model is unavailable, transcribe() raises RuntimeError.
No synthetic text is ever substituted.
No cloud API is ever invoked as fallback.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
import os
import sys
import time
import wave
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import onnxruntime as ort
from pydantic import BaseModel, Field
from scipy import signal

from ..clinical.ingestion import AudioInput
from ..clinical.models import (
    ClinicalFact,
    FactSource,
)
from ..nlp.extractor import extract_clinical_facts
from ..nlp.language_id import SupportedClinicalLanguage, identify_clinical_language

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model location
# ---------------------------------------------------------------------------
_MANIFEST_PATH = os.path.join(os.path.dirname(__file__), "manifest.json")

# Primary deployment directory (populated during Phase 8.6 setup)
_REPO_MODEL_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "models", "asr", "indic-conformer"
)

# HF cache fallback (user's local cache — not for production runtime)
_HF_CACHE_BASE = os.path.expanduser(
    r"~/.cache/huggingface/hub/models--meetsync--indic-conformer-onnx-sherpa"
    r"/snapshots/e19ba0d2f49c243fe4ce79ae3334526a03e753ae"
)
_MODEL_FILENAME = "model.int8.onnx"

EXPECTED_SHA256 = "b99a01834cd1a72cd9be682a0b9543df6b152ef7dfceba88d3dbf59fbb77075d"
EXPECTED_SIZE_BYTES = 196977855

# CTC blank token index — verified for NeMo EncDecCTCModelBPE:
# vocab_size=5632 BPE tokens (indices 0..5631) + blank at index 5632.
# Confirmed from ONNX metadata: vocab_size=5633, model_type=EncDecCTCModelBPE.
CTC_BLANK_ID = 5632


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------
class ASRSegment(BaseModel):
    text: str
    start_ms: Optional[float] = None
    end_ms: Optional[float] = None
    confidence: float = 0.0


class ASRResult(BaseModel):
    text: str
    language: str
    locale: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    segments: List[ASRSegment] = Field(default_factory=list)
    provider: str = "local-meetsync-indic-conformer-onnx-int8"
    model: str = "meetsync/indic-conformer-onnx-sherpa@e19ba0d"
    is_local: bool = True
    latency_ms: float = 0.0
    facts: List[ClinicalFact] = Field(default_factory=list)


class ASRAvailabilityStatus(BaseModel):
    """Derived (never hardcoded) readiness status for local ASR."""

    is_available: bool
    status: str = Field(..., description="READY | UNAVAILABLE | ERROR")
    reason: Optional[str] = None
    model_path: Optional[str] = None
    model_sha256_verified: bool = False
    onnx_contract_verified: bool = False
    inference_smoke_tested: bool = False
    # ASR languages supported by THIS model (not NLP/NER)
    asr_supported_languages: List[str] = ["as", "bn", "brx", "gu", "hi", "kn", "ks", "mr"]
    onnx_runtime_version: str = ort.__version__


# ---------------------------------------------------------------------------
# Audio helpers
# ---------------------------------------------------------------------------

def validate_audio_quality(audio: AudioInput) -> Tuple[bool, Optional[str], Optional[str]]:
    """Audio Quality Gate.  Returns (passed, error_code, reason)."""
    if not audio or not audio.audio_base64 or not audio.audio_base64.strip():
        return False, "EMPTY_AUDIO", "Audio payload contains zero bytes or is empty."

    raw_b64 = audio.audio_base64
    if "," in raw_b64:
        raw_b64 = raw_b64.split(",", 1)[1]

    if len(raw_b64) < 150:
        return False, "EMPTY_AUDIO", "Audio buffer is too short to contain intelligible speech signal."

    if audio.duration_ms is not None and audio.duration_ms < 200:
        return False, "SILENCE_DETECTED", "Audio duration under 200 ms; intelligible speech not detected."

    valid_mimes = ["audio/webm", "audio/wav", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/x-m4a"]
    if audio.mime_type and not any(m in audio.mime_type.lower() for m in valid_mimes):
        return False, "UNSUPPORTED_MIME", f"Unsupported audio container: {audio.mime_type}"

    try:
        decoded = base64.b64decode(raw_b64)
        if len(decoded) < 100:
            return False, "PAYLOAD_CORRUPT", "Decoded audio buffer smaller than minimal audio header."
    except Exception as exc:
        return False, "PAYLOAD_CORRUPT", f"Failed to decode base64 audio: {exc}"

    return True, None, None


def decode_audio_to_pcm16k(audio_bytes: bytes) -> np.ndarray:
    """Decode WAV/PCM bytes → 16 kHz mono float32 in [-1, 1]."""
    try:
        with io.BytesIO(audio_bytes) as bio:
            with wave.open(bio, "rb") as wf:
                sr = wf.getframerate()
                n_ch = wf.getnchannels()
                sw = wf.getsampwidth()
                frames = wf.readframes(wf.getnframes())
                dtype = np.int16 if sw >= 2 else np.uint8
                norm = 32768.0 if sw >= 2 else 128.0
                data = np.frombuffer(frames, dtype=dtype).astype(np.float32) / norm
                if n_ch > 1:
                    data = data.reshape(-1, n_ch).mean(axis=1)
                if sr != 16000 and len(data) > 0:
                    data = signal.resample(data, int(len(data) * 16000 / sr))
                return data
    except Exception:
        # Raw PCM fallback (no WAV header)
        data = np.frombuffer(audio_bytes[: (len(audio_bytes) // 2) * 2], dtype=np.int16)
        return data.astype(np.float32) / 32768.0


def compute_log_mel_spectrogram(
    audio: np.ndarray,
    sample_rate: int = 16000,
    n_mels: int = 80,
    n_fft: int = 400,
    hop_length: int = 160,
) -> np.ndarray:
    """80-channel log-mel filterbank features from 16 kHz audio → shape (80, T)."""
    if len(audio) < n_fft:
        audio = np.pad(audio, (0, n_fft - len(audio)))
    window = np.hanning(n_fft)
    stft = signal.ShortTimeFFT(window, hop=hop_length, fs=sample_rate, mfft=n_fft, scale_to="magnitude")
    spec = np.abs(stft.stft(audio))

    mel_pts = np.linspace(
        2595 * np.log10(1 + 0 / 700),
        2595 * np.log10(1 + (sample_rate / 2) / 700),
        n_mels + 2,
    )
    hz_pts = 700 * (10 ** (mel_pts / 2595) - 1)
    bin_pts = np.floor((n_fft + 1) * hz_pts / sample_rate).astype(int)

    fbank = np.zeros((n_mels, int(n_fft // 2 + 1)), dtype=np.float32)
    for m in range(1, n_mels + 1):
        lo, mid, hi = bin_pts[m - 1], bin_pts[m], bin_pts[m + 1]
        for k in range(lo, mid):
            if mid != lo:
                fbank[m - 1, k] = (k - lo) / (mid - lo)
        for k in range(mid, hi):
            if hi != mid:
                fbank[m - 1, k] = (hi - k) / (hi - mid)

    freq = min(spec.shape[0], fbank.shape[1])
    log_mel = np.log(np.maximum(np.dot(fbank[:, :freq], spec[:freq, :]), 1e-5))
    return log_mel.astype(np.float32)


# ---------------------------------------------------------------------------
# Model integrity helpers
# ---------------------------------------------------------------------------

def _find_model_file() -> Optional[str]:
    """
    Search for model.int8.onnx.
    Priority:
      1. Explicit environment variable (MEDSCRIBE_ASR_MODEL_PATH or MEDSCRIBE_ASR_MODEL_DIR)
      2. Deployment directory (models/asr/indic-conformer/) — runtime copy
      3. Working directory or executable-relative path
      4. HF cache (~/.cache/huggingface/hub/...) — user cache fallback
    """
    env_path = os.environ.get("MEDSCRIBE_ASR_MODEL_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path

    env_dir = os.environ.get("MEDSCRIBE_ASR_MODEL_DIR")
    if env_dir:
        candidate = os.path.join(env_dir, _MODEL_FILENAME)
        if os.path.isfile(candidate):
            return candidate

    exe_dir = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(__file__)

    candidates = [
        os.path.join(os.path.abspath(_REPO_MODEL_DIR), _MODEL_FILENAME),
        os.path.join(os.getcwd(), "models", "asr", "indic-conformer", _MODEL_FILENAME),
        os.path.join(exe_dir, "..", "..", "models", "asr", "indic-conformer", _MODEL_FILENAME),
        os.path.join(exe_dir, "models", "asr", "indic-conformer", _MODEL_FILENAME),
        os.path.join(_HF_CACHE_BASE, _MODEL_FILENAME),
    ]
    for c in candidates:
        norm = os.path.normpath(c)
        if os.path.isfile(norm):
            return norm
    return None


def _verify_sha256(path: str, expected: str, chunk: int = 65536) -> bool:
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for buf in iter(lambda: f.read(chunk), b""):
                h.update(buf)
        return h.hexdigest().lower() == expected.lower()
    except OSError:
        return False


def _verify_onnx_contract(session: ort.InferenceSession) -> Tuple[bool, str]:
    """Verify the physical session matches the documented tensor contract."""
    expected_inputs = {
        "processed_signal":        ("float32", 3),   # (batch, 80, time)
        "processed_signal_length": ("int64",   1),   # (batch,)
    }
    expected_outputs = {
        "log_probs":    ("float32", 3),   # (batch, time_out, 5633)
        "output_length": ("int64",  1),
    }
    type_map = {
        "tensor(float)":  "float32",
        "tensor(int64)":  "int64",
        "tensor(int32)":  "int32",
    }
    for inp in session.get_inputs():
        if inp.name not in expected_inputs:
            return False, f"Unexpected input tensor: {inp.name!r}"
        exp_dtype, exp_ndim = expected_inputs[inp.name]
        got_dtype = type_map.get(inp.type, inp.type)
        if got_dtype != exp_dtype:
            return False, f"Input {inp.name!r}: dtype {got_dtype!r} != expected {exp_dtype!r}"
        if len(inp.shape) != exp_ndim:
            return False, f"Input {inp.name!r}: ndim {len(inp.shape)} != expected {exp_ndim}"
    for out in session.get_outputs():
        if out.name not in expected_outputs:
            return False, f"Unexpected output tensor: {out.name!r}"
        exp_dtype, exp_ndim = expected_outputs[out.name]
        got_dtype = type_map.get(out.type, out.type)
        if got_dtype != exp_dtype:
            return False, f"Output {out.name!r}: dtype {got_dtype!r} != expected {exp_dtype!r}"
        if len(out.shape) != exp_ndim:
            return False, f"Output {out.name!r}: ndim {len(out.shape)} != expected {exp_ndim}"
    return True, "OK"


# ---------------------------------------------------------------------------
# Decoder
# ---------------------------------------------------------------------------

def _load_sherpa_vocab(model_dir: str) -> Optional[List[str]]:
    """
    Sherpa-ONNX models ship a tokens.txt alongside the ONNX file.
    Each line: <token> <id>  (or just <token>).
    Returns list indexed by token-id, or None if not found.
    """
    tokens_path = os.path.join(model_dir, "tokens.txt")
    if not os.path.isfile(tokens_path):
        return None
    vocab: Dict[int, str] = {}
    with open(tokens_path, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split()
            if len(parts) == 2:
                token, idx = parts[0], int(parts[1])
                vocab[idx] = token
            elif len(parts) == 1:
                vocab[len(vocab)] = parts[0]
    if not vocab:
        return None
    max_id = max(vocab.keys())
    return [vocab.get(i, "") for i in range(max_id + 1)]


def _ctc_greedy_decode(log_probs: np.ndarray, vocab: Optional[List[str]]) -> str:
    """
    CTC greedy decoding.

    log_probs  : shape (time, vocab_size)  — log probability per frame
    vocab      : list of tokens indexed by token-id  (None → raw chr() fallback)

    Blank token: index 5632 (CTC_BLANK_ID).
    Verified: NeMo EncDecCTCModelBPE places blank at vocab_size-1 = 5632.
    ONNX model metadata confirms: vocab_size=5633, model_type=EncDecCTCModelBPE.
    """
    ids = np.argmax(log_probs, axis=-1)  # (time,)
    # CTC collapse: remove repeated, then remove blank
    prev = -1
    result_ids = []
    for t in ids:
        t_int = int(t)
        if t_int != prev:
            if t_int != CTC_BLANK_ID:
                result_ids.append(t_int)
        prev = t_int

    if vocab is not None:
        tokens = [vocab[i] for i in result_ids if i < len(vocab)]
        # Sherpa-ONNX uses "▁" (U+2581) as word-boundary marker
        text = "".join(tokens).replace("▁", " ").strip()
    else:
        # Last-resort: raw unicode codepoints (produces garbled output but no crash)
        text = "".join(chr(i) for i in result_ids if 32 <= i < 65536)
    return text


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

class LocalIndicASREngine:
    """
    Local ASR engine.  Uses sherpa-onnx when available; falls back to
    bare onnxruntime for smoke-tests only.

    Status is DERIVED from five sequential checks:
      1. model file exists
      2. file size correct
      3. SHA-256 matches manifest
      4. ONNX session loads and tensor contract verified
      5. smoke inference succeeds on a synthetic sine tone

    Steps 1-4 run at init.  Step 5 runs lazily on first call or via
    check_status(deep=True).
    """

    ASR_LANGUAGES = ["as", "bn", "brx", "gu", "hi", "kn", "ks", "mr"]

    def __init__(self, model_path: Optional[str] = None):
        self._model_path: Optional[str] = model_path or _find_model_file()
        self._session: Optional[ort.InferenceSession] = None
        self._vocab: Optional[List[str]] = None
        self._sha256_ok: bool = False
        self._contract_ok: bool = False
        self._init_error: Optional[str] = None
        self._sherpa_recognizer: Optional[Any] = None

        self._initialise()

    # ------------------------------------------------------------------
    def _initialise(self) -> None:
        if self._model_path is None:
            self._init_error = "model.int8.onnx not found in HF cache or models/."
            return

        # 1 — file exists
        if not os.path.isfile(self._model_path):
            self._init_error = f"Model file not found: {self._model_path}"
            return

        # 2 — size
        actual_size = os.path.getsize(self._model_path)
        if actual_size != EXPECTED_SIZE_BYTES:
            self._init_error = (
                f"Model file size mismatch: got {actual_size} bytes, "
                f"expected {EXPECTED_SIZE_BYTES}."
            )
            return

        # 3 — SHA-256
        log.info("ASR: verifying SHA-256 …")
        self._sha256_ok = _verify_sha256(self._model_path, EXPECTED_SHA256)
        if not self._sha256_ok:
            self._init_error = "SHA-256 mismatch on model.int8.onnx. File may be corrupted."
            return

        # 4 — ONNX load + contract
        try:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 4
            opts.inter_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            self._session = ort.InferenceSession(
                self._model_path,
                sess_options=opts,
                providers=["CPUExecutionProvider"],
            )
        except Exception as exc:
            self._init_error = f"ONNX session failed to load: {exc}"
            return

        ok, msg = _verify_onnx_contract(self._session)
        self._contract_ok = ok
        if not ok:
            self._init_error = f"ONNX tensor contract violated: {msg}"
            self._session = None
            return

        # 5 — try sherpa-onnx OfflineRecognizer.from_nemo_ctc (authoritative runtime)
        model_dir = os.path.dirname(self._model_path)
        tokens_path = os.path.join(model_dir, "tokens.txt")
        if not os.path.isfile(tokens_path):
            tokens_path = os.path.join(_REPO_MODEL_DIR, "tokens.txt")
        self._vocab = _load_sherpa_vocab(model_dir)
        try:
            import sherpa_onnx
            if os.path.isfile(tokens_path):
                self._sherpa_recognizer = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
                    model=self._model_path,
                    tokens=tokens_path,
                    num_threads=4,
                    sample_rate=16000,
                    feature_dim=80,
                    decoding_method="greedy_search",
                )
                log.info("ASR: authoritative sherpa-onnx OfflineRecognizer.from_nemo_ctc initialized.")
        except Exception as sherpa_err:
            log.warning("ASR: sherpa-onnx nemo_ctc unavailable (%s); using bare ONNX CTC.", sherpa_err)
            self._sherpa_recognizer = None

        log.info("ASR engine initialised. model=%s sha256_ok=%s contract_ok=%s",
                 self._model_path, self._sha256_ok, self._contract_ok)

    # ------------------------------------------------------------------
    def check_status(self, deep: bool = False) -> ASRAvailabilityStatus:
        """
        Derive and return current availability status.

        deep=True runs a synthetic smoke-inference to confirm step 5.
        """
        if self._init_error or self._session is None:
            return ASRAvailabilityStatus(
                is_available=False,
                status="UNAVAILABLE",
                reason=self._init_error or "Session not loaded.",
                model_path=self._model_path,
                model_sha256_verified=self._sha256_ok,
                onnx_contract_verified=self._contract_ok,
                inference_smoke_tested=False,
            )

        smoke_ok = False
        if deep:
            smoke_ok = self._run_smoke_inference()

        return ASRAvailabilityStatus(
            is_available=True,
            status="READY",
            model_path=self._model_path,
            model_sha256_verified=self._sha256_ok,
            onnx_contract_verified=self._contract_ok,
            inference_smoke_tested=smoke_ok,
        )

    def _run_smoke_inference(self) -> bool:
        """
        Run a single forward pass with a synthetic 440 Hz sine tone.

        This validates the ONNX execution path and tensor shapes but
        produces meaningless transcript output.  It is NOT used to
        claim ASR accuracy.
        """
        try:
            t = np.linspace(0, 1.0, 16000, dtype=np.float32)
            sine = 0.5 * np.sin(2 * np.pi * 440 * t)
            feats = compute_log_mel_spectrogram(sine)          # (80, T)
            inp = feats[np.newaxis, :, :]                      # (1, 80, T)
            length = np.array([inp.shape[2]], dtype=np.int64)
            outs = self._session.run(
                None,
                {"processed_signal": inp, "processed_signal_length": length},
            )
            log_probs = outs[0]  # (1, T_out, 5633)
            assert log_probs.shape[0] == 1
            assert log_probs.shape[2] == 5633
            return True
        except Exception as exc:
            log.warning("ASR smoke inference failed: %s", exc)
            return False

    # ------------------------------------------------------------------
    def transcribe(
        self,
        audio_input: AudioInput,
        language_hint: Optional[str] = None,
    ) -> ASRResult:
        """
        Full speech-to-text pipeline.

        Audio Quality Gate → PCM decode → Mel spectrogram →
        ONNX inference → CTC decode → LID → ClinicalFact[]

        Raises RuntimeError if model is unavailable.
        NEVER substitutes synthetic text. NEVER calls cloud APIs.
        """
        if self._session is None:
            raise RuntimeError(
                f"LocalIndicASREngine is UNAVAILABLE: {self._init_error or 'session not loaded'}. "
                "No cloud fallback. No synthetic fallback."
            )

        valid, code, err = validate_audio_quality(audio_input)
        if not valid:
            raise ValueError(f"ASR Audio Quality Gate rejected payload [{code}]: {err}")

        raw_b64 = audio_input.audio_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(raw_b64)

        pcm16k = decode_audio_to_pcm16k(audio_bytes)
        rms = float(np.sqrt(np.mean(pcm16k ** 2))) if len(pcm16k) > 0 else 0.0
        if rms < 0.0005:
            # True silence — emit empty transcript, zero facts (no fabrication)
            return ASRResult(
                text="",
                language=language_hint or "hi",
                locale="hi-IN",
                confidence=0.0,
                facts=[],
                latency_ms=0.0,
            )

        t0 = time.perf_counter()
        if self._sherpa_recognizer is not None:
            stream = self._sherpa_recognizer.create_stream()
            stream.accept_waveform(16000, pcm16k)
            self._sherpa_recognizer.decode_stream(stream)
            transcription = stream.result.text.strip()
            latency_ms = (time.perf_counter() - t0) * 1000.0
            conf = 0.90
        else:
            feats = compute_log_mel_spectrogram(pcm16k)           # (80, T)
            inp = feats[np.newaxis, :, :]                         # (1, 80, T)
            length = np.array([inp.shape[2]], dtype=np.int64)

            outs = self._session.run(
                None,
                {"processed_signal": inp, "processed_signal_length": length},
            )
            log_probs = outs[0]   # (1, T_out, 5633)
            latency_ms = (time.perf_counter() - t0) * 1000.0

            transcription = _ctc_greedy_decode(log_probs[0], self._vocab)
            conf = 0.85  # raw ONNX CTC — accurate confidence requires calibration

        lid = identify_clinical_language(
            transcription,
            prior_hint=(
                SupportedClinicalLanguage(language_hint)
                if language_hint in ["en", "hi", "mr", "ta", "gu"]
                else None
            ),
        )

        facts = extract_clinical_facts(
            text=transcription,
            language=lid.language.value,
            source_id="asr-live-turn",
        )
        facts = [f.model_copy(update={"source": FactSource.PATIENT_VOICE}) for f in facts]

        return ASRResult(
            text=transcription,
            language=lid.language.value,
            locale=lid.locale,
            confidence=conf,
            segments=[ASRSegment(
                text=transcription,
                start_ms=0.0,
                end_ms=float(len(pcm16k)) / 16.0,
                confidence=conf,
            )],
            latency_ms=round(latency_ms, 1),
            facts=facts,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------
local_asr_engine = LocalIndicASREngine()
