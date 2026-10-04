"""Sovereign OCR extraction endpoints."""

from fastapi import APIRouter, HTTPException, status
from ...clinical.ingestion import DocumentInput
from ...ocr.pipeline import run_local_ocr_pipeline, OCRResult, validate_document_payload

router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


@router.post("/extract", response_model=OCRResult)
def extract_document_ocr(payload: DocumentInput) -> OCRResult:
    """Extracts ground-truth text and canonical ClinicalFacts from uploaded medical documents.

    Pipeline:
    Validation -> OpenCV Preprocessing -> Tesseract OCR -> Layout Analysis -> ClinicalFact[]

    Non-Negotiable Invariants:
    - Never fabricates unstated clinical facts.
    - Zero synthetic fallback on OCR failure.
    - Preserves exact source evidence and provenance.
    """
    valid, err_msg = validate_document_payload(payload)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "OCR_FAILED",
                "message": err_msg or "Document validation failed.",
                "status": "failed",
                "facts": [],
            },
        )

    try:
        result = run_local_ocr_pipeline(payload)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "OCR_FAILED",
                "message": f"Physical document OCR extraction failed: {str(e)}",
                "status": "failed",
                "facts": [],
            },
        )
