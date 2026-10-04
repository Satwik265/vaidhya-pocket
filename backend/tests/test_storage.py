"""Tests for sovereign SQLite persistence and physician gate."""

import pytest
import tempfile
from pathlib import Path
try:
    from app.storage.database import (
        init_db,
        get_db_connection,
        EncounterStorage,
        ClinicalFactStorage,
        AuditLogStorage,
        SyncQueueStorage,
    )
except ImportError:
    from backend.app.storage.database import (
        init_db,
        get_db_connection,
        EncounterStorage,
        ClinicalFactStorage,
        AuditLogStorage,
        SyncQueueStorage,
    )


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = Path(f.name)
    init_db(db_path)
    conn = get_db_connection(db_path)
    yield conn
    conn.close()
    if db_path.exists():
        db_path.unlink()


def test_encounter_lifecycle_and_approval_gate(temp_db):
    enc_storage = EncounterStorage(temp_db)

    # 1. Create encounter -> default AI_DRAFT
    enc = enc_storage.create_encounter("enc-101", "patient-001")
    assert enc["state"] == "AI_DRAFT"
    assert enc["sync_status"] == "LOCAL_ONLY"

    # 2. Attempt export before approval -> MUST raise ValueError
    with pytest.raises(ValueError, match="must be APPROVED by a physician before export"):
        enc_storage.export_encounter("enc-101", "actor-exporter")

    # 3. Approve encounter
    approved = enc_storage.approve_encounter("enc-101", "physician-dr-sharma")
    assert approved["state"] == "APPROVED"
    assert approved["approved_by"] == "physician-dr-sharma"
    assert approved["sync_status"] == "PENDING_SYNC"

    # 4. Export encounter after approval -> Succeeds
    exported = enc_storage.export_encounter("enc-101", "physician-dr-sharma")
    assert exported["state"] == "EXPORTED"


def test_clinical_fact_immutability_after_approval(temp_db):
    enc_storage = EncounterStorage(temp_db)
    fact_storage = ClinicalFactStorage(temp_db)

    enc_storage.create_encounter("enc-202", "patient-002")

    # Save fact in draft state
    fact_storage.save_fact(
        fact_id="fact-1",
        encounter_id="enc-202",
        domain="symptom",
        canonical_code="SYM_CHEST_PAIN",
        term="Chest Pain",
        assertion="present",
        elicitation="elicited",
        temporality="current",
        experiencer="patient",
        confidence=0.95,
        evidence_list=[{"verbatim_text": "severe chest pain", "start_char": 0, "end_char": 17}],
    )

    facts = fact_storage.get_facts_for_encounter("enc-202")
    assert len(facts) == 1
    assert len(facts[0]["evidence"]) == 1
    assert facts[0]["evidence"][0]["verbatim_text"] == "severe chest pain"

    # Approve encounter
    enc_storage.approve_encounter("enc-202", "dr-smith")

    # Attempt to modify facts on approved encounter -> MUST fail
    with pytest.raises(ValueError, match="Cannot modify facts on encounter"):
        fact_storage.save_fact(
            fact_id="fact-2",
            encounter_id="enc-202",
            domain="symptom",
            canonical_code="SYM_FEVER",
            term="Fever",
            assertion="present",
            elicitation="elicited",
            temporality="current",
            experiencer="patient",
            confidence=0.9,
            evidence_list=[{"verbatim_text": "fever", "start_char": 0, "end_char": 5}],
        )


def test_sync_queue_operations(temp_db):
    queue = SyncQueueStorage(temp_db)
    queue.enqueue("sync-1", "ENCOUNTER", "enc-303", "CREATE", {"state": "APPROVED"})
    pending = queue.get_pending()
    assert len(pending) == 1
    assert pending[0]["entity_id"] == "enc-303"
    assert pending[0]["status"] == "PENDING"
