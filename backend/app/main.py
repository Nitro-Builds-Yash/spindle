"""API for the Spindle call guide.

Run locally:  uvicorn app.main:app --reload --port 8000
Health:       GET /health
"""

from __future__ import annotations

import csv
import io
import hmac
import os
import time
from collections import defaultdict, deque
from datetime import timedelta
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
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

# Optional error tracking: set SENTRY_DSN to turn it on.
if os.getenv("SENTRY_DSN", "").strip():
    import sentry_sdk

    sentry_sdk.init(
        dsn=os.environ["SENTRY_DSN"].strip(),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0") or 0),
        send_default_pii=False,
    )

store, store_kind = build_store()

# A call left open this long with no taps is closed automatically as abandoned.
ABANDON_MINUTES = int(os.getenv("ABANDON_AFTER_MINUTES", "30") or 30)
ABANDONED_NOTE = "Abandoned: left open with no activity, closed automatically."

app = FastAPI(title="Spindle Call API", version="2.0.0")

# CORS: never default to "*". Locally the Vite dev server is allowed; in
# production ALLOWED_ORIGINS must name the deployed frontend.
DEV_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173"
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEV_ORIGINS).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def require_token(authorization: str = Header("")) -> None:
    """Shared access token. Off when SPINDLE_ACCESS_TOKEN is unset (local dev).

    The token is typed in by the caller and kept in the browser, never built into
    the frontend bundle, so a public Vercel URL does not leak it.
    """
    expected = os.getenv("SPINDLE_ACCESS_TOKEN", "").strip()
    if not expected:
        return
    given = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="access token required")


protected = [Depends(require_token)]

# AI routes cost money per request: cap each client at AI_RATE_PER_MINUTE.
_ai_hits: dict[str, deque] = defaultdict(deque)


def ai_rate_limit(request: Request) -> None:
    limit = int(os.getenv("AI_RATE_PER_MINUTE", "30") or 30)
    who = request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )
    now = time.monotonic()
    hits = _ai_hits[who]
    while hits and now - hits[0] > 60:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(429, "Too many AI requests. Wait a minute and try again.")
    hits.append(now)


ai_protected = [Depends(require_token), Depends(ai_rate_limit)]


def _csv_safe(value: Any) -> Any:
    """Stop spreadsheet apps executing cell text as a formula (CSV injection)."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


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
    # When to call back, ISO 8601 with timezone (e.g. 2026-11-27T15:00:00+05:30).
    follow_up_at: Optional[datetime] = None


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
        "service": "Spindle Call API",
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
        "service": "spindle",
        "storage": store_kind,
        "llm": f"{provider}:{model or 'default'}" if provider else "rules-fallback",
        "llm_last_error": llm.last_error,
        "auth": bool(os.getenv("SPINDLE_ACCESS_TOKEN", "").strip()),
        "warnings": _health_warnings(),
        "stages": len(STAGES),
        "time": now_iso(),
    }


def _health_warnings() -> list[str]:
    w = []
    if store_kind == "sqlite" and os.getenv("RENDER"):
        w.append("SQLite on Render is wiped on every restart; set SUPABASE_URL and SUPABASE_KEY.")
    if not os.getenv("SPINDLE_ACCESS_TOKEN", "").strip():
        w.append("SPINDLE_ACCESS_TOKEN is not set; the API is open to anyone with the URL.")
    if llm.last_error:
        w.append("Last LLM call failed; cues are coming from the rules fallback.")
    if not store.has_follow_ups:
        w.append("Follow-ups are off: run migrations/002_follow_ups.sql in Supabase.")
    return w


@app.get("/api/content")
def content() -> dict[str, Any]:
    return {"stages": STAGES, "outcomes": OUTCOMES}


@app.post("/api/calls", status_code=201, dependencies=protected)
def start_call(body: NewCall) -> dict[str, Any]:
    call = store.create_call(body.model_dump())
    return {"call": _shape(call), "stage_logs": []}


@app.get("/api/calls", dependencies=protected)
def list_calls(limit: int = 100, offset: int = 0) -> dict[str, Any]:
    sweep_abandoned()
    calls = store.list_calls(max(1, min(limit, 500)), max(0, offset))
    for c in calls:
        c.setdefault("stage_logs", [])
    return {"calls": calls}


@app.get("/api/calls/export.csv", dependencies=protected)
def export_calls_csv() -> Response:
    """Enterprise CSV export for CRM synchronization."""
    calls = _every_call()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "started_at", "prospect_name", "company_name", "prospect_role",
        "company_kind", "call_type", "status", "highest_stage_reached",
        "highest_stage_name", "duration_seconds", "outcome", "next_step",
        "stage5_need_quote", "ai_summary", "audit_warning", "follow_up_at"
    ])
    for c in calls:
        writer.writerow([_csv_safe(v) for v in [
            c.get("id"), c.get("started_at"), c.get("prospect_name"),
            c.get("company_name"), c.get("prospect_role"), c.get("company_kind"),
            c.get("call_type"), c.get("status"), c.get("highest_stage_reached"),
            c.get("highest_stage_name"), c.get("duration_seconds"), c.get("outcome"),
            c.get("next_step"), c.get("stage5_need_quote"), c.get("ai_summary"),
            c.get("audit_warning"), c.get("follow_up_at")
        ]])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=spindle-calls.csv"}
    )


@app.get("/api/calls/{call_id}", dependencies=protected)
def get_call(call_id: str) -> dict[str, Any]:
    call = _require(call_id)
    return {"call": call, "stage_logs": store.logs_for(call_id)}


@app.post("/api/calls/{call_id}/stage-log", dependencies=protected)
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


@app.post("/api/calls/{call_id}/audit", dependencies=ai_protected)
def audit_before_close(call_id: str, body: AuditBody) -> dict[str, Any]:
    """Run the consistency check without closing. The modal calls this first."""
    call = _require(call_id)
    _check_outcome(body.outcome)
    preview = dict(call)
    preview["next_step"] = body.next_step
    # The call is still open, so its stored duration is 0: use time so far.
    started = _parse_dt(call.get("started_at"))
    if started:
        preview["duration_seconds"] = max(0, int((datetime.now(timezone.utc) - started).total_seconds()))
    logs = store.logs_for(call_id)
    result = llm.audit(preview, logs, body.outcome)
    return result


@app.post("/api/calls/{call_id}/close", dependencies=protected)
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
    if body.follow_up_at:
        when = body.follow_up_at
        if when.tzinfo is None:
            raise HTTPException(422, "follow_up_at needs a timezone, e.g. +05:30")
        patch["follow_up_at"] = when.isoformat()
        patch["follow_up_done"] = False
    store.update_call(call_id, patch)

    return {
        "call": store.get_call(call_id),
        "stage_logs": logs,
        "audit": result,
    }


@app.post("/api/ai/cue", dependencies=ai_protected)
def ai_cue(body: CueBody) -> dict[str, Any]:
    context = ""
    if body.call_id:
        logs = store.logs_for(body.call_id)
        context = "; ".join(
            f'stage {l["stage_number"]}: {l["what_happened"]}' for l in logs[-4:]
        )
    return llm.cue(body.stage_number, body.prospect_words, context)


@app.post("/api/ai/simulate", dependencies=ai_protected)
def simulate_reply(body: SimulateBody) -> dict[str, Any]:
    return llm.simulate_prospect_reply(
        stage_number=body.stage_number,
        caller_message=body.caller_message,
        prospect_name=body.prospect_name,
        company_name=body.company_name,
    )


@app.get("/api/stats", dependencies=protected)
def stats() -> dict[str, Any]:
    """Aggregates over every call (light columns only), not just the latest page.

    Abandoned calls are counted but kept out of the drop-off chart and the
    connect rate: nobody decided how they ended.
    """
    sweep_abandoned()
    calls = store.all_calls_light()
    counted = [c for c in calls if c.get("audit_warning") != ABANDONED_NOTE]
    closed = [c for c in counted if c["status"] != "in_progress"]
    taps = store.stage1_taps()
    by_stage = {n: 0 for n in range(1, 9)}
    outcomes: dict[str, int] = {}
    for c in closed:
        n = int(c["highest_stage_reached"] or 1)
        by_stage[n] = by_stage.get(n, 0) + 1
        if c.get("outcome"):
            outcomes[c["outcome"]] = outcomes.get(c["outcome"], 0) + 1
    reached = sum(1 for c in counted if taps.get(c["id"]) == "right_person")
    return {
        "calls": len(calls),
        "closed": len(closed),
        "abandoned": len(calls) - len(counted),
        "ended_by_stage": by_stage,
        "outcomes": outcomes,
        "connect_rate": round(reached / len(counted), 2) if counted else 0,
        "audit_warnings": sum(1 for c in closed if c.get("audit_warning")),
    }


@app.get("/api/follow-ups", dependencies=protected)
def follow_ups() -> dict[str, Any]:
    """Open callbacks, soonest first, flagged overdue / today / later (IST)."""
    ist = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist).date()
    now = datetime.now(timezone.utc)
    out = []
    for c in store.follow_ups():
        when = _parse_dt(c["follow_up_at"])
        if not when:
            continue
        due = "overdue" if when < now else "today" if when.astimezone(ist).date() == today else "later"
        out.append({**_shape(c), "due": due})
    return {"follow_ups": out, "enabled": store.has_follow_ups}


@app.post("/api/calls/{call_id}/follow-up/done", dependencies=protected)
def follow_up_done(call_id: str) -> dict[str, Any]:
    _require(call_id)
    return {"call": _shape(store.update_call(call_id, {"follow_up_done": True}))}


@app.get("/api/calls/{call_id}/follow-up.ics", dependencies=protected)
def follow_up_ics(call_id: str) -> Response:
    """Calendar file for the callback, so it lands in Google / Outlook / iOS."""
    call = _require(call_id)
    when = _parse_dt(call.get("follow_up_at"))
    if not when:
        raise HTTPException(404, "this call has no follow-up time")

    def esc(t: str) -> str:
        return (t or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    stamp = lambda d: d.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    who = ", ".join(x for x in [call.get("prospect_name"), call.get("company_name")] if x)
    body = "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Spindle//Call follow-up//EN",
        "BEGIN:VEVENT",
        f"UID:{call_id}@spindle",
        f"DTSTAMP:{stamp(datetime.now(timezone.utc))}",
        f"DTSTART:{stamp(when)}",
        f"DTEND:{stamp(when + timedelta(minutes=15))}",
        f"SUMMARY:{esc('Call back ' + who)}",
        f"DESCRIPTION:{esc(call.get('next_step') or call.get('ai_summary') or '')}",
        "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", "DESCRIPTION:Call back", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR", "",
    ])
    return Response(
        content=body,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=spindle-follow-up-{call_id[:8]}.ics"},
    )


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        d = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


_last_sweep = 0.0


def sweep_abandoned(force: bool = False) -> int:
    """Close calls left open with no activity for ABANDON_MINUTES.

    Stored as status "dropped" + outcome "not_logged" (both allowed by the live
    schema) with ABANDONED_NOTE in audit_warning, so stats can tell them apart.
    Runs at most once a minute.
    """
    global _last_sweep
    if not force and time.monotonic() - _last_sweep < 60:
        return 0
    _last_sweep = time.monotonic()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ABANDON_MINUTES)
    closed = 0
    for c in store.open_calls():
        last = _parse_dt(c.get("last_activity")) or _parse_dt(c.get("started_at"))
        if not last or last > cutoff:
            continue
        started = _parse_dt(c.get("started_at")) or last
        store.update_call(c["id"], {
            "status": "dropped",
            "outcome": "not_logged",
            "ended_at": last.isoformat(timespec="seconds"),
            "duration_seconds": max(0, int((last - started).total_seconds())),
            "audit_warning": ABANDONED_NOTE,
            "ai_summary": ABANDONED_NOTE,
        })
        closed += 1
    return closed


def _every_call() -> list[dict[str, Any]]:
    out, offset = [], 0
    while True:
        page = store.list_calls(500, offset)
        out += page
        if len(page) < 500:
            return out
        offset += 500


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
    if "follow_up_done" in out:
        out["follow_up_done"] = bool(out["follow_up_done"])
    for k in ("status", "highest_stage_reached", "highest_stage_name", "duration_seconds"):
        if out.get(k) is None:
            out[k] = {"status": "in_progress", "highest_stage_reached": 1,
                      "highest_stage_name": "Opening", "duration_seconds": 0}[k]
    return out
