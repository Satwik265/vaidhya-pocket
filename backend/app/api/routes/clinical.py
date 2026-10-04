"""Clinical extraction endpoints."""

from fastapi import APIRouter
from ...clinical.models import ClinicalExtractionRequest, ClinicalExtractionResponse
from ...nlp.extractor import extract_clinical_facts

router = APIRouter(prefix="/api/v1/clinical", tags=["Clinical"])


@router.post("/extract", response_model=ClinicalExtractionResponse)
def extract_facts(payload: ClinicalExtractionRequest) -> ClinicalExtractionResponse:
    """Extracts ground-truth clinical facts with evidence grounding and negation detection.
    
    Adheres strictly to clinical invariants:
    - Never fabricates unstated clinical facts.
    - Preserves exact source evidence and character spans.
    - Explicitly distinguishes present from negated findings.
    """
    facts = extract_clinical_facts(
        text=payload.text,
        language=payload.language or "hi",
        source_id=payload.source_id or "encounter-live",
    )
    return ClinicalExtractionResponse(
        facts=facts,
        language_detected=payload.language,
    )
