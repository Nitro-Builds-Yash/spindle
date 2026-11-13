"""Storage.

Two backends behind one interface:

* SQLite, used when SUPABASE_URL / SUPABASE_KEY are absent. This is what makes
  the repo runnable the moment it is cloned, and what the local test run uses.
* Supabase (PostgREST), used on Render where the env vars are set.

Both speak the same operations, so the API layer never branches on storage.
"""

from __future__ import annotations

import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import httpx


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id() -> str:
    return uuid.uuid4().hex


SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    prospect_name TEXT NOT NULL DEFAULT '',
    prospect_role TEXT DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    company_kind TEXT DEFAULT 'mid-size private company',
    call_type TEXT DEFAULT 'first call',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    highest_stage_reached INTEGER NOT NULL DEFAULT 1,
    highest_stage_name TEXT NOT NULL DEFAULT 'Opening',
    status TEXT NOT NULL DEFAULT 'in_progress',
    outcome TEXT,
    next_step TEXT,
    stage5_need_quote TEXT,
    ai_summary TEXT,
    audit_warning TEXT
);
CREATE TABLE IF NOT EXISTS call_stage_logs (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    stage_number INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    what_happened TEXT NOT NULL,
    prospect_words TEXT DEFAULT '',
    ai_suggestion TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE (call_id, stage_number)
);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);
"""

CALL_FIELDS = (
    "prospect_name",
    "prospect_role",
    "company_name",
    "company_kind",
    "call_type",
)


class SQLiteStore:
    def __init__(self, path: str) -> None:
        self.path = path
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with self._conn() as conn:
            conn.executescript(SCHEMA_SQLITE)
        self._lock = threading.Lock()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def create_call(self, data: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": new_id(),
            "prospect_name": data.get("prospect_name", ""),
            "prospect_role": data.get("prospect_role", ""),
            "company_name": data.get("company_name", ""),
            "company_kind": data.get("company_kind", "mid-size private company"),
            "call_type": data.get("call_type", "first call"),
            "started_at": data.get("started_at") or now_iso(),
            "ended_at": None,
            "duration_seconds": 0,
            "highest_stage_reached": 1,
            "highest_stage_name": "Opening",
            "status": "in_progress",
            "outcome": None,
            "next_step": None,
            "stage5_need_quote": None,
            "ai_summary": None,
            "audit_warning": None,
        }
        with self._lock, self._conn() as conn:
            conn.execute(
                f"""INSERT INTO calls ({", ".join(row)})
                    VALUES ({", ".join(":" + k for k in row)})""",
                row,
            )
        return row

    def get_call(self, call_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            r = conn.execute("SELECT * FROM calls WHERE id = ?", (call_id,)).fetchone()
        return dict(r) if r else None

    def list_calls(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._conn() as conn:
            calls = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM calls ORDER BY started_at DESC LIMIT ?", (limit,)
                ).fetchall()
            ]
            for c in calls:
                c["stage_logs"] = [
                    dict(r)
                    for r in conn.execute(
                        "SELECT * FROM call_stage_logs WHERE call_id = ? ORDER BY stage_number",
                        (c["id"],),
                    ).fetchall()
                ]
        return calls

    def update_call(self, call_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
        if not patch:
            return self.get_call(call_id)
        cols = ", ".join(f"{k} = :{k}" for k in patch)
        with self._lock, self._conn() as conn:
            conn.execute(
                f"UPDATE calls SET {cols} WHERE id = :id", dict(patch, id=call_id)
            )
        return self.get_call(call_id)

    def upsert_stage_log(self, call_id: str, data: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": new_id(),
            "call_id": call_id,
            "stage_number": int(data["stage_number"]),
            "stage_name": data.get("stage_name", ""),
            "what_happened": data.get("what_happened", ""),
            "prospect_words": data.get("prospect_words", ""),
            "ai_suggestion": data.get("ai_suggestion", ""),
            "created_at": now_iso(),
        }
        with self._lock, self._conn() as conn:
            conn.execute(
                """INSERT INTO call_stage_logs
                   (id, call_id, stage_number, stage_name, what_happened, prospect_words, ai_suggestion, created_at)
                   VALUES (:id, :call_id, :stage_number, :stage_name, :what_happened, :prospect_words, :ai_suggestion, :created_at)
                   ON CONFLICT(call_id, stage_number) DO UPDATE SET
                     stage_name = excluded.stage_name,
                     what_happened = excluded.what_happened,
                     prospect_words = excluded.prospect_words,
                     ai_suggestion = excluded.ai_suggestion""",
                row,
            )
            r = conn.execute(
                "SELECT * FROM call_stage_logs WHERE call_id = ? AND stage_number = ?",
                (call_id, row["stage_number"]),
            ).fetchone()
        return dict(r)

    def logs_for(self, call_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            return [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM call_stage_logs WHERE call_id = ? ORDER BY stage_number",
                    (call_id,),
                ).fetchall()
            ]


class SupabaseStore:
    """PostgREST through httpx. Two tables, no SDK to break on a free tier."""

    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.client = httpx.Client(
            base_url=f"{self.url}/rest/v1",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            timeout=20.0,
        )

    def _rows(self, r: httpx.Response) -> list[dict[str, Any]]:
        r.raise_for_status()
        return r.json()

    def create_call(self, data: dict[str, Any]) -> dict[str, Any]:
        row = {f: data.get(f) for f in CALL_FIELDS}
        row["prospect_name"] = row["prospect_name"] or ""
        row["company_name"] = row["company_name"] or ""
        row["started_at"] = now_iso()
        row["status"] = "in_progress"
        rows = self._rows(self.client.post("/calls", json=row))
        return rows[0]

    def get_call(self, call_id: str) -> Optional[dict[str, Any]]:
        r = self.client.get("/calls", params={"id": f"eq.{call_id}", "select": "*"})
        if r.status_code in (400, 404):  # Invalid UUID syntax or not found
            return None
        r.raise_for_status()
        rows = r.json()
        return rows[0] if rows else None

    def list_calls(self, limit: int = 100) -> list[dict[str, Any]]:
        calls = self._rows(
            self.client.get(
                "/calls",
                params={"select": "*", "order": "started_at.desc", "limit": limit},
            )
        )
        if not calls:
            return calls
        ids = ",".join(c["id"] for c in calls)
        logs = self._rows(
            self.client.get(
                "/call_stage_logs",
                params={
                    "call_id": f"in.({ids})",
                    "select": "*",
                    "order": "stage_number.asc",
                },
            )
        )
        by_call: dict[str, list] = {}
        for log in logs:
            by_call.setdefault(log["call_id"], []).append(log)
        for c in calls:
            c["stage_logs"] = by_call.get(c["id"], [])
        return calls

    def update_call(self, call_id: str, patch: dict[str, Any]) -> Optional[dict[str, Any]]:
        if patch:
            self._rows(
                self.client.patch("/calls", params={"id": f"eq.{call_id}"}, json=patch)
            )
        return self.get_call(call_id)

    def upsert_stage_log(self, call_id: str, data: dict[str, Any]) -> dict[str, Any]:
        row = {
            "call_id": call_id,
            "stage_number": int(data["stage_number"]),
            "stage_name": data.get("stage_name", ""),
            "what_happened": data.get("what_happened", ""),
            "prospect_words": data.get("prospect_words", "") or None,
            "ai_suggestion": data.get("ai_suggestion", "") or None,
        }
        rows = self._rows(
            self.client.post(
                "/call_stage_logs",
                params={"on_conflict": "call_id,stage_number"},
                headers={"Prefer": "resolution=merge-duplicates,return=representation"},
                json=row,
            )
        )
        return rows[0]

    def logs_for(self, call_id: str) -> list[dict[str, Any]]:
        r = self.client.get(
            "/call_stage_logs",
            params={
                "call_id": f"eq.{call_id}",
                "select": "*",
                "order": "stage_number.asc",
            },
        )
        if r.status_code in (400, 404):
            return []
        r.raise_for_status()
        return r.json()


def build_store():
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if url and key:
        return SupabaseStore(url, key), "supabase"
    return SQLiteStore(os.getenv("SQLITE_PATH", "./data/calls.db")), "sqlite"
