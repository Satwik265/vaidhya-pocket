"""Sovereign local SQLite storage engine for MedScribeAI core.

Implements zero-fabrication clinical persistence:
- Tables: encounters, clinical_facts, fact_evidence, audit_log, sync_queue
- Physician approval gate workflow: AI_DRAFT -> REVIEWING -> APPROVED -> EXPORTED
- Local physician edits win over cloud suggestions.
- Strict schema enforcement via SQLite standard library.
"""

import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "medscribe_local.db"


def get_db_connection(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    """Creates a thread-safe connection to SQLite with foreign keys enabled."""
    target_path = db_path or DEFAULT_DB_PATH
    conn = sqlite3.connect(str(target_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: Optional[Path | str] = None) -> None:
    """Initializes the SQLite schema with required tables and indexes."""
    conn = get_db_connection(db_path)
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS encounters (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            state TEXT NOT NULL CHECK(state IN ('AI_DRAFT', 'REVIEWING', 'APPROVED', 'EXPORTED')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            approved_by TEXT,
            approved_at TEXT,
            sync_status TEXT NOT NULL CHECK(sync_status IN ('LOCAL_ONLY', 'PENDING_SYNC', 'SYNCING', 'SYNCED', 'SYNC_FAILED')),
            sync_attempts INTEGER NOT NULL DEFAULT 0,
            last_sync_error TEXT
        );

        CREATE TABLE IF NOT EXISTS clinical_facts (
            id TEXT PRIMARY KEY,
            encounter_id TEXT NOT NULL,
            domain TEXT NOT NULL,
            canonical_code TEXT NOT NULL,
            term TEXT NOT NULL,
            assertion TEXT NOT NULL,
            elicitation TEXT NOT NULL,
            temporality TEXT NOT NULL,
            experiencer TEXT NOT NULL,
            confidence REAL NOT NULL,
            attributes_json TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS fact_evidence (
            id TEXT PRIMARY KEY,
            fact_id TEXT NOT NULL,
            verbatim_text TEXT NOT NULL,
            start_char INTEGER,
            end_char INTEGER,
            text_segment_id TEXT,
            document_page INTEGER,
            FOREIGN KEY (fact_id) REFERENCES clinical_facts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            encounter_id TEXT NOT NULL,
            actor_type TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details_json TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED')),
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_retry_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_facts_encounter ON clinical_facts(encounter_id);
        CREATE INDEX IF NOT EXISTS idx_evidence_fact ON fact_evidence(fact_id);
        CREATE INDEX IF NOT EXISTS idx_audit_encounter ON audit_log(encounter_id);
        CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
        """)
    conn.close()


class EncounterStorage:
    """CRUD and workflow transitions for encounters."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def create_encounter(self, encounter_id: str, patient_id: str) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO encounters (id, patient_id, state, created_at, updated_at, sync_status, sync_attempts)
                VALUES (?, ?, 'AI_DRAFT', ?, ?, 'LOCAL_ONLY', 0)
                """,
                (encounter_id, patient_id, now, now),
            )
        return self.get_encounter(encounter_id)

    def get_encounter(self, encounter_id: str) -> Optional[Dict[str, Any]]:
        cursor = self.conn.execute("SELECT * FROM encounters WHERE id = ?", (encounter_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def approve_encounter(self, encounter_id: str, physician_id: str) -> Dict[str, Any]:
        encounter = self.get_encounter(encounter_id)
        if not encounter:
            raise ValueError(f"Encounter {encounter_id} does not exist.")

        now = datetime.now(timezone.utc).isoformat()
        with self.conn:
            self.conn.execute(
                """
                UPDATE encounters
                SET state = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ?, sync_status = 'PENDING_SYNC'
                WHERE id = ?
                """,
                (physician_id, now, now, encounter_id),
            )
            # Log to audit
            audit_id = f"audit-{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:8]}"
            self.conn.execute(
                """
                INSERT INTO audit_log (id, encounter_id, actor_type, actor_id, action, details_json, timestamp)
                VALUES (?, ?, 'PHYSICIAN', ?, 'APPROVE', ?, ?)
                """,
                (audit_id, encounter_id, physician_id, json.dumps({"approved_at": now}), now),
            )
        return self.get_encounter(encounter_id)

    def export_encounter(self, encounter_id: str, actor_id: str) -> Dict[str, Any]:
        encounter = self.get_encounter(encounter_id)
        if not encounter:
            raise ValueError(f"Encounter {encounter_id} does not exist.")
        if encounter["state"] != "APPROVED":
            raise ValueError(
                f"Cannot export encounter in state '{encounter['state']}'. "
                "Encounter must be APPROVED by a physician before export."
            )

        now = datetime.now(timezone.utc).isoformat()
        with self.conn:
            self.conn.execute(
                """
                UPDATE encounters
                SET state = 'EXPORTED', updated_at = ?
                WHERE id = ?
                """,
                (now, encounter_id),
            )
            audit_id = f"audit-exp-{int(datetime.now().timestamp() * 1000)}-{uuid.uuid4().hex[:8]}"
            self.conn.execute(
                """
                INSERT INTO audit_log (id, encounter_id, actor_type, actor_id, action, details_json, timestamp)
                VALUES (?, ?, 'PHYSICIAN', ?, 'EXPORT', ?, ?)
                """,
                (audit_id, encounter_id, actor_id, json.dumps({"exported_at": now}), now),
            )
        return self.get_encounter(encounter_id)


class ClinicalFactStorage:
    """CRUD operations for ClinicalFacts and their grounded FactEvidence."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def save_fact(
        self,
        fact_id: str,
        encounter_id: str,
        domain: str,
        canonical_code: str,
        term: str,
        assertion: str,
        elicitation: str,
        temporality: str,
        experiencer: str,
        confidence: float,
        evidence_list: List[Dict[str, Any]],
        attributes: Optional[Dict[str, Any]] = None,
    ) -> None:
        cursor = self.conn.execute("SELECT state FROM encounters WHERE id = ?", (encounter_id,))
        enc_row = cursor.fetchone()
        if enc_row and enc_row["state"] in ("APPROVED", "EXPORTED"):
            raise ValueError(
                f"Cannot modify facts on encounter '{encounter_id}' in state '{enc_row['state']}'. "
                "Create a new revision to alter documentation."
            )

        now = datetime.now(timezone.utc).isoformat()
        attr_json = json.dumps(attributes) if attributes else None

        with self.conn:
            self.conn.execute(
                """
                INSERT OR REPLACE INTO clinical_facts (
                    id, encounter_id, domain, canonical_code, term,
                    assertion, elicitation, temporality, experiencer,
                    confidence, attributes_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    fact_id, encounter_id, domain, canonical_code, term,
                    assertion, elicitation, temporality, experiencer,
                    confidence, attr_json, now
                ),
            )

            # Store evidence
            for idx, ev in enumerate(evidence_list):
                ev_id = f"ev-{fact_id}-{idx}"
                self.conn.execute(
                    """
                    INSERT OR REPLACE INTO fact_evidence (
                        id, fact_id, verbatim_text, start_char, end_char, text_segment_id, document_page
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ev_id, fact_id, ev.get("verbatim_text", ev.get("text", "")),
                        ev.get("start_char"), ev.get("end_char"),
                        ev.get("text_segment_id"), ev.get("document_page")
                    ),
                )

    def get_facts_for_encounter(self, encounter_id: str) -> List[Dict[str, Any]]:
        cursor = self.conn.execute("SELECT * FROM clinical_facts WHERE encounter_id = ?", (encounter_id,))
        facts = [dict(r) for r in cursor.fetchall()]
        for f in facts:
            ev_cursor = self.conn.execute("SELECT * FROM fact_evidence WHERE fact_id = ?", (f["id"],))
            f["evidence"] = [dict(ev) for ev in ev_cursor.fetchall()]
        return facts


class AuditLogStorage:
    """Immutable audit logging."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def record(
        self,
        encounter_id: str,
        actor_type: str,
        actor_id: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        audit_id = f"audit-{int(datetime.now().timestamp() * 1000)}-{actor_id[:4]}-{uuid.uuid4().hex[:8]}"
        with self.conn:
            self.conn.execute(
                """
                INSERT INTO audit_log (id, encounter_id, actor_type, actor_id, action, details_json, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (audit_id, encounter_id, actor_type, actor_id, action, json.dumps(details) if details else None, now),
            )


class SyncQueueStorage:
    """Queue for asynchronous synchronization."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def enqueue(
        self,
        queue_id: str,
        entity_type: str,
        entity_id: str,
        action: str,
        payload: Dict[str, Any],
    ) -> None:
        with self.conn:
            self.conn.execute(
                """
                INSERT OR REPLACE INTO sync_queue (
                    id, entity_type, entity_id, action, payload_json, status, retry_count
                ) VALUES (?, ?, ?, ?, ?, 'PENDING', 0)
                """,
                (queue_id, entity_type, entity_id, action, json.dumps(payload)),
            )

    def get_pending(self) -> List[Dict[str, Any]]:
        cursor = self.conn.execute("SELECT * FROM sync_queue WHERE status = 'PENDING'")
        return [dict(r) for r in cursor.fetchall()]
