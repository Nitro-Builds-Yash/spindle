"""Automated test suite for Spindle Call API.

Run locally:
    cd backend
    pytest tests/ -v
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    """Verify health endpoint reports online service and stages."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "spindle"
    assert data["stages"] == 8
    assert "storage" in data


def test_content_stages():
    """Verify 8 cold-call stages with purpose and pre-pressed taps."""
    response = client.get("/api/content")
    assert response.status_code == 200
    data = response.json()
    assert "stages" in data
    assert len(data["stages"]) == 8
    assert "outcomes" in data
    assert len(data["outcomes"]) >= 8

    # Verify stage 1 structure
    s1 = data["stages"][0]
    assert s1["number"] == 1
    assert s1["name"] == "Opening"
    assert len(s1["what_they_say"]) == 3
    assert len(s1["taps"]) == 4
    assert s1["default_tap"] == "right_person"


def test_full_call_lifecycle():
    """Test start call -> stage 1 log -> stage 5 quote -> audit -> close -> get."""
    # 1. Start Call
    new_call_res = client.post(
        "/api/calls",
        json={
            "prospect_name": "Ramesh Varma",
            "prospect_role": "Managing Director",
            "company_name": "Sri Balaji Precision",
            "company_kind": "mid-size private manufacturer",
            "call_type": "first call",
        },
    )
    assert new_call_res.status_code == 201
    call_id = new_call_res.json()["call"]["id"]
    assert bool(call_id)

    # 2. Log Stage 1
    s1_res = client.post(
        f"/api/calls/{call_id}/stage-log",
        json={
            "stage_number": 1,
            "what_happened": "right_person",
            "prospect_words": "Haanji Ramesh Varma speaking.",
            "ai_suggestion": "",
        },
    )
    assert s1_res.status_code == 200
    assert len(s1_res.json()["stage_logs"]) >= 1

    # 3. Log Stage 5 with Verbatim Need Quote
    s5_res = client.post(
        f"/api/calls/{call_id}/stage-log",
        json={
            "stage_number": 5,
            "what_happened": "named_need",
            "prospect_words": "Our rework is touching 4.5% on the CNC line.",
            "ai_suggestion": "How much does that scrap rate cost monthly?",
        },
    )
    assert s5_res.status_code == 200
    assert s5_res.json()["call"]["highest_stage_reached"] == 5

    # 4. Preview Consistency Audit
    audit_res = client.post(
        f"/api/calls/{call_id}/audit",
        json={
            "outcome": "next_step_agreed",
            "next_step": "Thursday 4 PM callback",
        },
    )
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert "summary" in audit_data

    # 5. Close Call
    close_res = client.post(
        f"/api/calls/{call_id}/close",
        json={
            "outcome": "next_step_agreed",
            "next_step": "Thursday 4 PM callback",
            "note": "Agreed on 1-page telemetry check",
        },
    )
    assert close_res.status_code == 200
    closed_data = close_res.json()["call"]
    assert closed_data["status"] == "completed"
    assert closed_data["outcome"] == "next_step_agreed"
    assert bool(closed_data["ai_summary"])

    # 6. Fetch Call Details
    fetch_res = client.get(f"/api/calls/{call_id}")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["call"]["id"] == call_id
    assert len(fetch_res.json()["stage_logs"]) >= 2


def test_ai_simulate():
    """Verify simulated prospect persona responds."""
    response = client.post(
        "/api/ai/simulate",
        json={
            "stage_number": 1,
            "caller_message": "Hello Ramesh ji, this is Athota from Spindle.",
            "prospect_name": "Ramesh Varma",
            "company_name": "Sri Balaji Precision",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 5
    assert data["source"] in ("llm", "transcripts")


def test_csv_export():
    """Verify CSV export endpoint returns valid CSV formatted data."""
    response = client.get("/api/calls/export.csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    lines = response.text.splitlines()
    assert len(lines) >= 1
    assert "prospect_name" in lines[0]


def test_not_found_call():
    """Verify 404 behavior for invalid call IDs."""
    response = client.get("/api/calls/non_existent_call_id_12345")
    assert response.status_code == 404


# --------------------------------------------------------------------------- #
# Hardening: auth, CSV injection, LLM deadline / failure reporting
# --------------------------------------------------------------------------- #

def test_access_token_enforced(monkeypatch):
    monkeypatch.setenv("SPINDLE_ACCESS_TOKEN", "s3cret")
    assert client.get("/api/calls").status_code == 401
    assert client.get("/api/calls", headers={"Authorization": "Bearer nope"}).status_code == 401
    ok = client.get("/api/calls", headers={"Authorization": "Bearer s3cret"})
    assert ok.status_code == 200
    # Health and static content stay public so uptime checks keep working.
    assert client.get("/health").status_code == 200
    assert client.get("/api/content").status_code == 200
    assert client.get("/health").json()["auth"] is True


def test_open_when_no_token(monkeypatch):
    monkeypatch.delenv("SPINDLE_ACCESS_TOKEN", raising=False)
    assert client.get("/api/calls").status_code == 200
    assert any("SPINDLE_ACCESS_TOKEN" in w for w in client.get("/health").json()["warnings"])


def test_csv_export_escapes_formulas():
    client.post("/api/calls", json={"prospect_name": '=HYPERLINK("http://x")', "company_name": "@evil"})
    body = client.get("/api/calls/export.csv").text
    assert ",=HYPERLINK" not in body and ',"=HYPERLINK' not in body
    assert "'=HYPERLINK" in body
    assert ",'@evil," in body


def test_cors_not_wildcard_by_default():
    r = client.options(
        "/api/calls",
        headers={"Origin": "https://attacker.example", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") not in ("*", "https://attacker.example")


def test_llm_failure_falls_back_and_is_reported(monkeypatch):
    import httpx
    from app import llm

    def boom(*a, **k):
        raise httpx.ConnectTimeout("simulated timeout")

    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_API_KEY", "fake")
    monkeypatch.setattr(llm.httpx, "post", boom)
    r = client.post("/api/ai/cue", json={"stage_number": 6, "prospect_words": "we have big four"})
    assert r.status_code == 200 and r.json()["source"] == "rules"
    health = client.get("/health").json()
    assert "ConnectTimeout" in health["llm_last_error"]
    assert any("LLM" in w for w in health["warnings"])


def test_llm_respects_deadline(monkeypatch):
    import time
    from app import llm

    calls = []

    def slow(*a, **k):
        calls.append(k["timeout"])
        time.sleep(0.6)
        raise RuntimeError("slow")

    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "0.5")
    monkeypatch.setattr(llm.httpx, "post", slow)
    start = time.monotonic()
    try:
        llm._gemini("m1", "k", "p", time.monotonic() + llm._budget())
    except RuntimeError:
        pass
    # Only one attempt fits in the budget, and its timeout is capped by it.
    assert len(calls) == 1 and calls[0] <= 0.5
    assert time.monotonic() - start < 1.0
