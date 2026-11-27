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
    monkeypatch.setattr(llm._http, "post", boom)
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
    monkeypatch.setattr(llm._http, "post", slow)
    start = time.monotonic()
    try:
        llm._gemini("m1", "k", "p", time.monotonic() + llm._budget())
    except RuntimeError:
        pass
    # Only one attempt fits in the budget, and its timeout is capped by it.
    assert len(calls) == 1 and calls[0] <= 0.5
    assert time.monotonic() - start < 1.0


# --------------------------------------------------------------------------- #
# Abandoned calls, stats, follow-ups, rate limit, paging
# --------------------------------------------------------------------------- #

from app import main as main_mod  # noqa: E402


def _new_call(name="Test Prospect"):
    r = client.post("/api/calls", json={"prospect_name": name, "company_name": "Co"})
    return r.json()["call"]["id"]


def test_stale_call_is_abandoned_and_kept_out_of_funnel():
    cid = _new_call("Stale Sam")
    main_mod.store.update_call(cid, {"started_at": "2020-01-01T00:00:00+00:00"})
    before = client.get("/api/stats").json()
    main_mod.sweep_abandoned(force=True)
    call = client.get(f"/api/calls/{cid}").json()["call"]
    assert call["status"] == "dropped" and call["outcome"] == "not_logged"
    assert call["audit_warning"] == main_mod.ABANDONED_NOTE
    after = client.get("/api/stats").json()
    assert after["abandoned"] >= 1
    assert sum(after["ended_by_stage"].values()) == sum(before["ended_by_stage"].values())


def test_recent_call_is_not_abandoned():
    cid = _new_call()
    main_mod.sweep_abandoned(force=True)
    assert client.get(f"/api/calls/{cid}").json()["call"]["status"] == "in_progress"


def test_follow_up_flow_and_calendar_file():
    cid = _new_call("Follow Fiona")
    r = client.post(f"/api/calls/{cid}/close", json={
        "outcome": "next_step_agreed", "next_step": "Call Wed",
        "follow_up_at": "2030-01-15T15:00:00+05:30",
    })
    assert r.status_code == 200
    due = client.get("/api/follow-ups").json()["follow_ups"]
    mine = [f for f in due if f["id"] == cid]
    assert mine and mine[0]["due"] == "later"
    ics = client.get(f"/api/calls/{cid}/follow-up.ics")
    assert ics.status_code == 200 and "text/calendar" in ics.headers["content-type"]
    assert "DTSTART:20300115T093000Z" in ics.text and "Call back Follow Fiona\\, Co" in ics.text
    client.post(f"/api/calls/{cid}/follow-up/done")
    assert not [f for f in client.get("/api/follow-ups").json()["follow_ups"] if f["id"] == cid]


def test_follow_up_requires_timezone():
    cid = _new_call()
    r = client.post(f"/api/calls/{cid}/close", json={
        "outcome": "follow_up", "follow_up_at": "2030-01-15T15:00:00"})
    assert r.status_code == 422


def test_ai_rate_limit(monkeypatch):
    monkeypatch.setenv("AI_RATE_PER_MINUTE", "3")
    main_mod._ai_hits.clear()
    codes = [client.post("/api/ai/cue", json={"stage_number": 1}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    main_mod._ai_hits.clear()


def test_list_calls_offset_pages():
    for i in range(3):
        _new_call(f"Page {i}")
    first = client.get("/api/calls?limit=2").json()["calls"]
    second = client.get("/api/calls?limit=2&offset=2").json()["calls"]
    assert len(first) == 2 and first[0]["id"] != second[0]["id"]


def test_supabase_store_chunks_and_pages():
    """Fake PostgREST: 2,300 calls, logs fetched in chunks, pages of 1000."""
    import httpx
    from urllib.parse import parse_qs, urlparse
    from app.db import SupabaseStore

    calls = [{"id": f"c{i:04d}", "status": "completed", "highest_stage_reached": 2,
              "outcome": None, "audit_warning": None, "started_at": "2026-01-01"} for i in range(2300)]
    seen_log_queries = []

    def handler(req: httpx.Request):
        q = {k: v[0] for k, v in parse_qs(urlparse(str(req.url)).query).items()}
        path = req.url.path
        if path.endswith("/calls"):
            if q.get("select") == "follow_up_at":
                return httpx.Response(400, json={"message": "column does not exist"})
            off, lim = int(q.get("offset", 0)), int(q.get("limit", 100))
            return httpx.Response(200, json=calls[off:off + lim])
        if path.endswith("/call_stage_logs"):
            ids = q["call_id"][4:-1].split(",")
            seen_log_queries.append(len(ids))
            return httpx.Response(200, json=[{"call_id": i, "stage_number": 1, "what_happened": "x",
                                              "created_at": "2026-01-01"} for i in ids])
        return httpx.Response(404)

    store = SupabaseStore.__new__(SupabaseStore)
    store.client = httpx.Client(base_url="http://fake/rest/v1", transport=httpx.MockTransport(handler))
    store.has_follow_ups = False

    assert len(store.all_calls_light()) == 2300            # 3 pages
    page = store.list_calls(500)
    assert len(page) == 500 and all(c["stage_logs"] for c in page)
    assert max(seen_log_queries) <= 80                       # URL stays short
    store.update_call  # follow-up fields are stripped when the column is missing
    assert store.follow_ups() == []


# --------------------------------------------------------------------------- #
# Bug fixes: practice-phone name, live audit duration, empty next step
# --------------------------------------------------------------------------- #

def test_practice_phone_uses_the_real_prospect_name(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    r = client.post("/api/ai/simulate", json={
        "stage_number": 1, "caller_message": "Hello", "prospect_name": "Meera Iyer", "company_name": "Iyer Polymers"})
    assert "Meera Iyer" in r.json()["reply"] and "Ramesh" not in r.json()["reply"]


def test_pre_close_audit_uses_time_so_far(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    cid = _new_call()
    main_mod.store.update_call(cid, {"started_at": "2020-01-01T00:00:00+00:00"})
    for n, tap in [(1, "right_person"), (5, "named_need"), (7, "named_time")]:
        client.post(f"/api/calls/{cid}/stage-log", json={"stage_number": n, "what_happened": tap, "prospect_words": "need help"})
    r = client.post(f"/api/calls/{cid}/audit", json={"outcome": "next_step_agreed", "next_step": "Thu 4pm call"})
    assert "0 seconds" not in (r.json().get("warning") or "")


def test_next_step_agreed_without_next_step_is_flagged(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    cid = _new_call()
    for n, tap in [(1, "right_person"), (7, "named_time")]:
        client.post(f"/api/calls/{cid}/stage-log", json={"stage_number": n, "what_happened": tap})
    r = client.post(f"/api/calls/{cid}/audit", json={"outcome": "next_step_agreed", "next_step": ""})
    assert "no next step" in r.json()["warning"]


def test_supabase_store_starts_when_supabase_is_unreachable(monkeypatch):
    """Production crash 2026-11-27: a DNS failure during start-up killed the
    server because the follow-up column check ran in the constructor."""
    import httpx
    from app import db

    def no_dns(request):
        raise httpx.ConnectError("[Errno -2] Name or service not known")

    real_client = httpx.Client
    monkeypatch.setattr(db.httpx, "Client", lambda **kw: real_client(**{**kw, "transport": httpx.MockTransport(no_dns)}))
    store = db.SupabaseStore("https://example.supabase.co", "key")   # must not raise
    assert store.has_follow_ups is False                              # unknown -> off, retried later

    ok = lambda request: httpx.Response(200, json=[])
    store.client = real_client(base_url="https://example.supabase.co/rest/v1", transport=httpx.MockTransport(ok))
    store._follow_ups_checked = 0.0                                   # pretend the retry window passed
    assert store.has_follow_ups is True
