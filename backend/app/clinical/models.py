"""Canonical ClinicalFact domain model and invariants."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from .provenance import FactProvenance


class FactCategory(str, Enum):
    SYMPTOM = "symptom"
    CONDITION = "condition"
    MEDICATION = "medication"
    ALLERGY = "allergy"
    INVESTIGATION = "investigation"
    ANATOMY = "anatomy"
    AYUSH = "ayush"
    VITAL = "vital"


class FactAssertion(str, Enum):
    PRESENT = "present"
    NEGATED = "negated"
    UNCERTAIN = "uncertain"
    SUSPECTED = "suspected"
    CONDITIONAL = "conditional"
    NOT_ELICITED = "not_elicited"


class FactTemporality(str, Enum):
    CURRENT = "current"
    HISTORICAL = "historical"
    ACUTE = "acute"
    CHRONIC = "chronic"
    UNKNOWN = "unknown"


class FactExperiencer(str, Enum):
    PATIENT = "patient"
    FAMILY_MEMBER = "family_member"
    CLINICIAN = "clinician"
    OTHER = "other"


class FactSource(str, Enum):
    PATIENT_TRANSCRIPT = "patient_transcript"
    PATIENT_VOICE = "patient_voice"
    PATIENT_TAP = "patient_tap"
    UPLOADED_DOCUMENT = "uploaded_document"
    CLINICIAN_ENTERED = "clinician_entered"
    SYSTEM_DERIVED = "system_derived"


class ClinicalFact(BaseModel):
    """Canonical representation of a discrete clinical observation or statement.
    
    Invariants:
    1. Every clinical fact MUST be grounded in verbatim evidence and provenance.
    2. Missing facts remain un-asserted or NOT_ELICITED; they are never converted to negative findings.
    3. No diagnosis, prescription, or treatment plan is ever fabricated in this layer.
    """

    concept_id: str = Field(..., min_length=1, description="Standardized concept ID, e.g. SYM_HEADACHE")
    canonical_text: str = Field(..., min_length=1, description="Canonical English name, e.g. 'headache'")
    category: FactCategory = Field(..., description="Clinical domain category")
    assertion: FactAssertion = Field(default=FactAssertion.PRESENT, description="Clinical assertion state")
    temporality: FactTemporality = Field(default=FactTemporality.CURRENT, description="Temporal classification")
    experiencer: FactExperiencer = Field(default=FactExperiencer.PATIENT, description="Subject experiencing the finding")
    evidence: str = Field(..., min_length=1, description="Verbatim text quote from transcript or document")
    source: FactSource = Field(default=FactSource.PATIENT_TRANSCRIPT, description="Input modality/channel")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence score (0.0 to 1.0)")
    language: str = Field(default="hi", description="Language of the evidence string (e.g. 'hi', 'en')")
    provenance: FactProvenance = Field(..., description="Character span and source tracking")

    @field_validator("evidence")
    @classmethod
    def validate_evidence_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ClinicalFact evidence cannot be empty or whitespace.")
        return v.strip()

    @field_validator("provenance")
    @classmethod
    def validate_provenance_span(cls, v: FactProvenance) -> FactProvenance:
        if v.end_char < v.start_char:
            raise ValueError(f"Provenance end_char ({v.end_char}) cannot be less than start_char ({v.start_char}).")
        return v


class ClinicalExtractionRequest(BaseModel):
    """Payload for clinical extraction requests."""
    text: str = Field(..., min_length=1, description="Transcript or clinical text to extract facts from")
    language: str = Field(default="hi", description="ISO language hint ('hi', 'en', 'mr', 'ta', 'gu')")
    source_id: Optional[str] = Field(default="encounter-live", description="Encounter or turn identifier")


class ClinicalExtractionResponse(BaseModel):
    """Standardized response from clinical extraction service."""
    facts: list[ClinicalFact] = Field(default_factory=list, description="List of validated clinical facts")
    language_detected: Optional[str] = Field(None, description="Resolved language code")
