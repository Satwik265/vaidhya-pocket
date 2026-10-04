import pytest
from pydantic import ValidationError
from app.clinical.ingestion import (
    IngestionEvent,
    IngestionSourceType,
    TextInput,
    AudioInput,
    DocumentInput,
    IngestionProvenance,
)


def test_valid_text_ingestion():
    prov = IngestionProvenance(client_timestamp="2026-09-09T01:00:00Z")
    event = IngestionEvent(
        id="ingest-patient-text-01",
        encounter_id="enc-001",
        source_type=IngestionSourceType.PATIENT_TEXT,
        source_id="turn-01",
        language="hi",
        payload=TextInput(text="सीने में दर्द है", language_hint="hi"),
        provenance=prov,
    )
    assert event.id == "ingest-patient-text-01"
    assert event.encounter_id == "enc-001"
    assert event.payload.kind == "text"
    assert event.payload.text == "सीने में दर्द है"


def test_valid_audio_ingestion():
    prov = IngestionProvenance(client_timestamp="2026-09-09T01:00:00Z")
    event = IngestionEvent(
        id="ingest-patient-voice-01",
        encounter_id="enc-001",
        source_type=IngestionSourceType.PATIENT_VOICE,
        source_id="mic-01",
        language="hi",
        payload=AudioInput(audio_base64="dGVzdGF1ZGlv", mime_type="audio/webm", duration_ms=2500),
        provenance=prov,
    )
    assert event.payload.kind == "audio"
    assert event.payload.duration_ms == 2500


def test_valid_document_ingestion():
    prov = IngestionProvenance(client_timestamp="2026-09-09T01:00:00Z")
    event = IngestionEvent(
        id="ingest-doc-01",
        encounter_id="enc-001",
        source_type=IngestionSourceType.UPLOADED_DOCUMENT,
        source_id="doc-scan-01",
        payload=DocumentInput(
            file_base64="ZmlsZWRhdGE=",
            file_name="rx_scan.jpg",
            mime_type="image/jpeg",
            document_hint="prescription",
        ),
        provenance=prov,
    )
    assert event.payload.kind == "document"
    assert event.payload.file_name == "rx_scan.jpg"


def test_untracked_ingestion_rejected():
    prov = IngestionProvenance(client_timestamp="2026-09-09T01:00:00Z")
    with pytest.raises(ValidationError):
        IngestionEvent(
            id="ingest-01",
            encounter_id="",  # Empty encounter_id forbidden
            source_type=IngestionSourceType.PATIENT_TEXT,
            source_id="turn-01",
            payload=TextInput(text="test"),
            provenance=prov,
        )
