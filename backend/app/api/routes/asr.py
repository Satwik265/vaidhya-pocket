"""Sovereign ASR speech-to-text endpoints."""

from fastapi import APIRouter, HTTPException, status
from ...clinical.ingestion import AudioInput
from ...asr.engine import local_asr_engine, ASRResult, ASRAvailabilityStatus, validate_audio_quality

router = APIRouter(prefix="/api/v1/asr", tags=["ASR"])


@router.get("/status", response_model=ASRAvailabilityStatus)
def get_asr_status() -> ASRAvailabilityStatus:
    """Returns derived (never hardcoded) availability and status of the local ASR inference engine."""
    return local_asr_engine.check_status()


@router.post("/transcribe", response_model=ASRResult)
def transcribe_audio(payload: AudioInput) -> ASRResult:
    """Transcribes patient clinical speech and projects ground-truth Canonical ClinicalFacts.

    Pipeline:
    Audio Quality Gate -> Mel Spectrogram -> IndicConformer / ONNX CTC -> LID -> ClinicalFact[]

    Non-Negotiable Invariants:
    - Never fabricates unstated clinical facts.
    - Zero synthetic fallback on silence or ASR failure.
    - Audio <200ms or silence emits empty transcription with zero facts.
    """
    valid, code, err = validate_audio_quality(payload)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": code or "AUDIO_REJECTED",
                "message": err or "Audio quality gate validation failed.",
                "facts": [],
            },
        )

    try:
        result = local_asr_engine.transcribe(
            audio_input=payload,
            language_hint=payload.preferred_language,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "ASR_FAILED",
                "message": f"Local ASR transcription failed: {str(e)}",
                "facts": [],
            },
        )
