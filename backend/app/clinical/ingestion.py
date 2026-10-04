"""Canonical Ingestion Contract for Python Clinical AI Core."""

from enum import Enum
from typing import Optional, Union, Literal
from pydantic import BaseModel, Field, field_validator
from datetime import datetime, timezone


class IngestionSourceType(str, Enum):
    PATIENT_VOICE = "patient_voice"
    PATIENT_TEXT = "patient_text"
    CLINICIAN_TEXT = "clinician_text"
    UPLOADED_DOCUMENT = "uploaded_document"
    SYSTEM = "system"


class TextInput(BaseModel):
    kind: Literal["text"] = "text"
    text: str = Field(..., min_length=1, description="Raw input text")
    language_hint: Optional[str] = Field(default=None, description="ISO language hint")
    input_method: Optional[str] = Field(default="keyboard", description="Input method")


class AudioInput(BaseModel):
    kind: Literal["audio"] = "audio"
    audio_base64: str = Field(..., min_length=1, description="Base64 encoded audio payload")
    mime_type: str = Field(default="audio/webm", description="MIME type")
    duration_ms: Optional[int] = Field(default=None, ge=0, description="Duration in milliseconds")
    sample_rate: Optional[int] = Field(default=None, ge=0, description="Audio sample rate")
    channels: Optional[int] = Field(default=1, ge=1, description="Channel count")
    preferred_language: Optional[str] = Field(default=None, description="Expected language")


class DocumentInput(BaseModel):
    kind: Literal["document"] = "document"
    file_base64: str = Field(..., min_length=1, description="Base64 encoded document image or PDF")
    file_name: str = Field(..., min_length=1, description="Original filename")
    mime_type: str = Field(default="image/jpeg", description="MIME type")
    file_size_bytes: Optional[int] = Field(default=None, ge=0, description="File size")
    document_hint: Optional[str] = Field(default="unspecified", description="Prescription, lab, etc.")


class IngestionProvenance(BaseModel):
    client_timestamp: str = Field(..., description="ISO timestamp from client")
    device_type: Optional[str] = Field(default=None)
    station_id: Optional[str] = Field(default="MediKiosk-Terminal-01")
    operator_id: Optional[str] = Field(default=None)


class IngestionEvent(BaseModel):
    id: str = Field(..., min_length=1, description="Unique ingestion event identifier")
    encounter_id: str = Field(..., min_length=1, description="Associated encounter ID")
    source_type: IngestionSourceType = Field(..., description="Source channel")
    source_id: str = Field(..., min_length=1, description="Source component/turn ID")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    language: Optional[str] = Field(default=None)
    payload: Union[TextInput, AudioInput, DocumentInput] = Field(..., description="Typed input payload")
    provenance: IngestionProvenance = Field(..., description="Client tracking metadata")

    @field_validator("encounter_id")
    @classmethod
    def validate_encounter_not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Untracked clinical ingestion is strictly forbidden: encounter_id required.")
        return v.strip()
