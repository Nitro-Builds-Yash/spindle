"""API for the Spindle call guide.

Run locally:  uvicorn app.main:app --reload --port 8000
Health:       GET /health
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import llm
from .content import (
    OUTCOMES,
    POSITIVE_OUTCOMES,
    STAGES,
    STAGES_BY_NUMBER,
    WRONG_PERSON_OUTCOMES,
)
from .db import build_store, now_iso

load_dotenv()

store, store_kind = build_store()

app = FastAPI(title="Spindle Call Copilot API", version="2.0.0")

_origins = os.getenv("ALLOWED_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")] if _origins else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Bodies
# --------------------------------------------------------------------------- #

class NewCall(BaseModel):
    prospect_name: str = Field(..., min_length=1, max_length=120)
    prospect_role: str = Field("", max_length=120)
    company_name: str = Field(..., min_length=1, max_length=160)
    company_kind: str = Field("mid-size private company", max_length=80)
    call_type: str = Field("first call", max_length=40)


class StageLog(BaseModel):
    stage_number: int = Field(..., ge=1, le=8)
    what_happened: str = Field(..., min_length=1, max_length=80)
    prospect_words: str = Field("", max_length=4000)
    ai_suggestion: str = Field("", max_length=300)


class CloseBody(BaseModel):
    outcome: str = Field(..., max_length=60)
    next_step: str = Field("", max_length=300)
    note: str = Field("", max_length=2000)


class AuditBody(BaseModel):
    outcome: str = Field(..., max_length=60)
    next_step: str = Field("", max_length=300)


class CueBody(BaseModel):
    stage_number: int = Field(1, ge=1, le=8)
    prospect_words: str = Field("", max_length=4000)
    call_id: Optional[str] = None


class SimulateBody(BaseModel):
    stage_number: int = Field(1, ge=1, le=8)
    caller_message: str = Field(..., max_length=2000)
    prospect_name: str = Field("Ramesh Varma", max_length=120)
    company_name: str = Field("Sri Balaji Precision", max_length=160)
    call_id: Optional[str] = None


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #

@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "Spindle Cold Call Copilot API",
        "status": "online",
        "health_check": "/health",
        "docs": "/docs",
        "stages": 8
    }

@app.get("/health")
def health() -> dict[str, Any]:
    provider, _, model = llm._provider()
    return {
        "status": "ok",
        "service": "spindle-call-copilot",
        "storage": store_kind,
        "llm": f"{provider}:{model or 'default'}" if provider else "rules-fallback",
        "stages": len(STAGES),
        "time": now_iso(),
    }


@app.get("/api/content")
def content() -> dict[str, Any]:
    return {"stages": STAGES, "outcomes": OUTCOMES}


@app.post("/api/calls", status_code=201)
def start_call(body: NewCall) -> dict[str, Any]:
    call = store.create_call(body.model_dump())
    return {"call": _shape(call), "stage_logs": []}


@app.get("/api/calls")
def list_calls(limit: int = 100) -> dict[str, Any]:
    calls = store.list_calls(max(1, min(limit, 500)))
    for c in calls:
        c.setdefault("stage_logs", [])
    return {"calls": calls}


@app.get("/api/calls/{call_id}")
def get_call(call_id: str) -> dict[str, Any]:
    call = _require(call_id)
    return {"call": call, "stage_logs": store.logs_for(call_id)}


@app.post("/api/calls/{call_id}/stage-log")
def save_stage(call_id: str, body: StageLog) -> dict[str, Any]:
    call = _require(call_id)
    if call["status"] != "in_progress":
        raise HTTPException(409, "call already closed")

    stage = STAGES_BY_NUMBER[body.stage_number]
    log = store.upsert_stage_log(
        call_id,
        {
            "stage_number": body.stage_number,
            "stage_name": stage["name"],
            "what_happened": body.what_happened,
            "prospect_words": body.prospect_words,
            "ai_suggestion": body.ai_suggestion,
        },
    )

    patch: dict[str, Any] = {}
    if body.stage_number > int(call["highest_stage_reached"]):
        patch["highest_stage_reached"] = body.stage_number
        patch["highest_stage_name"] = stage["name"]
    if body.stage_number == 5 and body.prospect_words.strip():
        patch["stage5_need_quote"] = body.prospect_words.strip()
    if patch:
        store.update_call(call_id, patch)

    return {
        "log": log,
        "call": _require(call_id),
        "stage_logs": store.logs_for(call_id),
    }


@app.post("/api/calls/{call_id}/audit")
def audit_before_close(call_id: str, body: AuditBody) -> dict[str, Any]:
    """Run the consistency check without closing. The modal calls this first."""
    call = _require(call_id)
    _check_outcome(body.outcome)
    preview = dict(call)
    preview["next_step"] = body.next_step
    logs = store.logs_for(call_id)
    result = llm.audit(preview, logs, body.outcome)
    return result


@app.post("/api/calls/{call_id}/close")
def close_call(call_id: str, body: CloseBody) -> dict[str, Any]:
    call = _require(call_id)
    if call["status"] != "in_progress":
        raise HTTPException(409, "call already closed")
    _check_outcome(body.outcome)

    duration = _duration(call)
    logs = store.logs_for(call_id)
    stage5 = call.get("stage5_need_quote") or ""
    if not stage5:
        five = next((l for l in logs if int(l["stage_number"]) == 5), None)
        stage5 = (five or {}).get("prospect_words") or ""

    shaped = dict(call)
    shaped["duration_seconds"] = duration
    shaped["next_step"] = body.next_step
    shaped["stage5_need_quote"] = stage5

    result = llm.audit(shaped, logs, body.outcome)

    status = "completed"
    if int(call["highest_stage_reached"]) <= 1 and (
        body.outcome in WRONG_PERSON_OUTCOMES or body.outcome == "not_logged"
    ):
        status = "dropped"

    patch = {
        "status": status,
        "ended_at": now_iso(),
        "duration_seconds": duration,
        "outcome": body.outcome,
        "next_step": body.next_step or None,
        "stage5_need_quote": stage5 or None,
        "ai_summary": result["summary"],
        "audit_warning": result["warning"],
    }
    if body.note.strip():
        patch["next_step"] = (body.next_step + " | " + body.note.strip())[:300]
    store.update_call(call_id, patch)

    return {
        "call": store.get_call(call_id),
        "stage_logs": logs,
        "audit": result,
    }


@app.post("/api/ai/cue")
def ai_cue(body: CueBody) -> dict[str, Any]:
    context = ""
    if body.call_id:
        logs = store.logs_for(body.call_id)
        context = "; ".join(
            f'stage {l["stage_number"]}: {l["what_happened"]}' for l in logs[-4:]
        )
    return llm.cue(body.stage_number, body.prospect_words, context)


@app.post("/api/ai/simulate")
def simulate_reply(body: SimulateBody) -> dict[str, Any]:
    return llm.simulate_prospect_reply(
        stage_number=body.stage_number,
        caller_message=body.caller_message,
        prospect_name=body.prospect_name,
        company_name=body.company_name,
    )


@app.get("/api/stats")
def stats() -> dict[str, Any]:
    calls = store.list_calls(500)
    closed = [c for c in calls if c["status"] != "in_progress"]
    by_stage = {n: 0 for n in range(1, 9)}
    outcomes: dict[str, int] = {}
    reached = 0
    for c in calls:
        first = next(
            (l for l in c.get("stage_logs", []) if int(l["stage_number"]) == 1), None
        )
        if first and first["what_happened"] == "right_person":
            reached += 1
    for c in closed:
        n = int(c["highest_stage_reached"] or 1)
        by_stage[n] = by_stage.get(n, 0) + 1
        if c.get("outcome"):
            outcomes[c["outcome"]] = outcomes.get(c["outcome"], 0) + 1
    return {
        "calls": len(calls),
        "closed": len(closed),
        "ended_by_stage": by_stage,
        "outcomes": outcomes,
        "connect_rate": round(reached / len(calls), 2) if calls else 0,
        "audit_warnings": sum(1 for c in closed if c.get("audit_warning")),
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _require(call_id: str) -> dict[str, Any]:
    call = store.get_call(call_id)
    if not call:
        raise HTTPException(404, "call not found")
    return call


def _check_outcome(outcome: str) -> None:
    if not any(o["key"] == outcome for o in OUTCOMES):
        raise HTTPException(400, "unknown outcome")


def _duration(call: dict[str, Any]) -> int:
    try:
        started = datetime.fromisoformat(str(call["started_at"]).replace("Z", "+00:00"))
    except Exception:
        return 0
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    return max(0, int((datetime.now(timezone.utc) - started).total_seconds()))


def _shape(call: dict[str, Any]) -> dict[str, Any]:
    """Created rows come back with NULLs on some Supabase defaults."""
    out = dict(call)
    for k in ("status", "highest_stage_reached", "highest_stage_name", "duration_seconds"):
        if out.get(k) is None:
            out[k] = {"status": "in_progress", "highest_stage_reached": 1,
                      "highest_stage_name": "Opening", "duration_seconds": 0}[k]
    return out
