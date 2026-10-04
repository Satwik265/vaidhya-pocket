"""Integration tests for FastAPI endpoints."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Tests GET /health returns status ok and service identifier."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "medscribe-ai-core"


def test_version_endpoint():
    """Tests GET /version returns service and version string."""
    response = client.get("/version")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "medscribe-ai-core"
    assert "version" in data


def test_clinical_extract_endpoint_success():
    """Tests POST /api/v1/clinical/extract with contrastive Hindi utterance."""
    payload = {
        "text": "BP ka problem nahi hai lekin sar dard hai",
        "language": "hi",
        "source_id": "test-enc-001",
    }
    response = client.post("/api/v1/clinical/extract", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "facts" in data
    facts = data["facts"]
    assert len(facts) == 2

    concept_assertions = {f["concept_id"]: f["assertion"] for f in facts}
    assert concept_assertions["COND_HYPERTENSION"] == "negated"
    assert concept_assertions["SYM_HEADACHE"] == "present"


def test_clinical_extract_endpoint_empty_text():
    """Tests POST /api/v1/clinical/extract rejects empty string with 422."""
    payload = {
        "text": "",
        "language": "hi",
    }
    response = client.post("/api/v1/clinical/extract", json=payload)
    assert response.status_code == 422
