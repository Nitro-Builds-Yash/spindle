"""Fill the past-calls screen so it is not empty on first run.

    python -m scripts.seed_demo          (from backend/)

Writes through the same store as the API: SQLite locally, Supabase if the env
points there. Safe to run twice; it only adds.

These are invented calls, not the hundred transcripts. The transcripts stay
local and unpublished; this file carries no line from them.
"""

from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta, timezone

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import build_store, now_iso
from app.content import STAGES_BY_NUMBER
from app.llm import audit_fallback

random.seed(23)

# (stage_number, tap key, the prospect's words)
CALLS = [
    {
        "prospect_name": "Ramesh Varma",
        "prospect_role": "Managing Director",
        "company_name": "Sri Balaji Precision",
        "company_kind": "mid-size private manufacturer",
        "call_type": "first call",
        "duration": 312,
        "logs": [
            (1, "right_person", "Ramesh speaking."),
            (2, "understood", "Okay, growth report. Go on."),
            (3, "clear_yes", "Two minutes, tell me."),
            (4, "confirmed_context", "Pressed components, two units, mostly auto OEMs."),
            (5, "named_need", "Utilisation is the problem. Some weeks the press sits idle."),
            (6, "resolved", "Fair. What would you need from us?"),
            (7, "named_time", "Tuesday after eleven works."),
            (8, "clean_close", "Tuesday eleven. Thank you."),
        ],
        "outcome": "next_step_agreed",
        "next_step": "Tuesday 11:00, plant visit with the MD",
    },
    {
        "prospect_name": "Suresh Kumar",
        "prospect_role": "Director",
        "company_name": "Deccan Auto Components",
        "company_kind": "mid-size private manufacturer",
        "call_type": "first call",
        "duration": 74,
        "logs": [
            (1, "switchboard", "Sir is on the floor. May I know what this is about?"),
            (2, "asked_what", "What is it that your company does?"),
        ],
        "outcome": "wrong_person",
        "next_step": "",
    },
    {
        "prospect_name": "Anil Reddy",
        "prospect_role": "Owner",
        "company_name": "Vishwa Plastics",
        "company_kind": "small private company",
        "call_type": "first call",
        "duration": 268,
        "logs": [
            (1, "right_person", "Anil here."),
            (2, "asked_source", "Where did you get this number?"),
            (3, "clear_yes", "Okay, quickly."),
            (4, "corrected_model", "We are not that big. One unit, sixty people."),
            (5, "named_need", "Rejection is twelve percent and nobody records why."),
            (6, "charges", "What do you charge for this?"),
            (7, "report_only", "Send the report on WhatsApp, I will look."),
            (8, "clean_close", "Send it today if you can."),
        ],
        "outcome": "agreed_to_receive_report",
        "next_step": "WhatsApp the growth report today, follow up Friday",
    },
    {
        "prospect_name": "Farah Sultana",
        "prospect_role": "Director, Quality",
        "company_name": "Nova Fasteners",
        "company_kind": "mid-size private manufacturer",
        "call_type": "follow-up",
        "duration": 421,
        "logs": [
            (1, "right_person", "Farah speaking."),
            (2, "understood", "You had sent something earlier, yes."),
            (3, "clear_yes", "Go ahead."),
            (4, "confirmed_context", "Fasteners for automotive, two plants."),
            (5, "everything_fine", "The QMS gives me reports nobody reads."),
            (6, "big_four", "We already pay a Big Four firm for this."),
            (7, "vague_yes", "Let me see, I will tell you."),
            (8, "warm_no", "Nothing for now, thank you."),
        ],
        "outcome": "not_interested",
        "next_step": "",
    },
    {
        "prospect_name": "Prakash Rao",
        "prospect_role": "CEO",
        "company_name": "Ganga Alloys",
        "company_kind": "mid-size private manufacturer",
        "call_type": "first call",
        "duration": 356,
        "logs": [
            (1, "right_person", "Prakash."),
            (2, "understood", "Tell me quickly."),
            (3, "clear_yes", "Okay."),
            (4, "confirmed_context", "Alloys. One furnace, three shifts."),
            (5, "named_need", "Each breakdown costs us about forty thousand."),
            (6, "resolved", "That is a fair question. We tried a dashboard once."),
            (7, "named_time", "Come Monday at ten."),
            (8, "clean_close", "Monday ten. Bring the one page."),
        ],
        "outcome": "next_step_agreed",
        "next_step": "Monday 10:00 at the plant, one-page summary",
    },
    {
        "prospect_name": "",
        "prospect_role": "not the person on the list",
        "company_name": "Krishna Industries",
        "company_kind": "not known",
        "call_type": "first call",
        "duration": 41,
        "logs": [
            (1, "wrong_person", "Nobody by that name here. This is a shop number."),
        ],
        "outcome": "moved_company",
        "next_step": "",
    },
    {
        "prospect_name": "Meena Joshi",
        "prospect_role": "Partner",
        "company_name": "Sunrise Packaging",
        "company_kind": "small private company",
        "call_type": "first call",
        "duration": 63,
        "logs": [
            (1, "right_person", "This is Meena."),
            (2, "thought_job", "Is this about a vacancy? We are not hiring."),
            (3, "busy", "We are not looking at anything new this year."),
        ],
        "outcome": "not_interested",
        "next_step": "",
    },
    {
        "prospect_name": "Vikram Shetty",
        "prospect_role": "Director",
        "company_name": "Anand Tools",
        "company_kind": "mid-size private manufacturer",
        "call_type": "follow-up",
        "duration": 288,
        "logs": [
            (1, "right_person", "Vikram here, I am in the car."),
            (2, "understood", "Okay."),
            (3, "clear_yes", "Speak, I have five minutes."),
            (4, "hq_decides", "All of that is decided at corporate in the US."),
            (5, "everything_fine", "Honestly, everything is fine."),
            (6, "not_authorized", "I am not the right person for this."),
            (7, "referred", "Speak to Mr. Sen in the India office."),
            (8, "clean_close", "Thanks for calling."),
        ],
        "outcome": "agreed_to_receive_report",
        "next_step": "",
    },
]

LIVE = {
    "prospect_name": "Naveen Chowdhary",
    "prospect_role": "Head, Operations",
    "company_name": "Bharat Gears Unit 2",
    "company_kind": "mid-size private manufacturer",
    "call_type": "first call",
    "logs": [
        (1, "right_person", "Naveen speaking."),
        (2, "asked_what", "What is this regarding?"),
        (3, "clear_yes", "Okay, go ahead."),
        (4, "confirmed_context", "Gear blanks for tractor OEMs, one plant."),
    ],
}


def add_call(store, spec, started: datetime, closed: bool) -> None:
    call = store.create_call(spec)
    store.update_call(call["id"], {"started_at": started.isoformat(timespec="seconds")})

    for stage_no, tap, words in spec["logs"]:
        store.upsert_stage_log(
            call["id"],
            {
                "stage_number": stage_no,
                "stage_name": STAGES_BY_NUMBER[stage_no]["name"],
                "what_happened": tap,
                "prospect_words": words,
            },
        )

    highest = max(s[0] for s in spec["logs"])
    patch = {
        "highest_stage_reached": highest,
        "highest_stage_name": STAGES_BY_NUMBER[highest]["name"],
    }
    five = next((w for s, t, w in spec["logs"] if s == 5), "")
    if five:
        patch["stage5_need_quote"] = five

    if not closed:
        store.update_call(call["id"], {**patch, "status": "in_progress"})
        return

    ended = started + timedelta(seconds=spec["duration"])
    shaped = {
        **call,
        **patch,
        "duration_seconds": spec["duration"],
        "next_step": spec["next_step"],
        "stage5_need_quote": five or None,
    }
    logs = store.logs_for(call["id"])
    result = audit_fallback(shaped, logs, spec["outcome"])

    status = "completed"
    if highest <= 1 and spec["outcome"] in ("wrong_person", "moved_company", "not_logged"):
        status = "dropped"

    store.update_call(
        call["id"],
        {
            **patch,
            "status": status,
            "ended_at": ended.isoformat(timespec="seconds"),
            "duration_seconds": spec["duration"],
            "outcome": spec["outcome"],
            "next_step": spec["next_step"] or None,
            "stage5_need_quote": five or None,
            "ai_summary": result["summary"],
            "audit_warning": result["warning"],
        },
    )


def main() -> int:
    store, kind = build_store()
    print(f"seeding into {kind}")

    for spec in CALLS:
        started = datetime.now(timezone.utc) - timedelta(
            hours=random.randint(2, 70), minutes=random.randint(0, 59)
        )
        add_call(store, spec, started, closed=True)

    add_call(
        store,
        LIVE,
        datetime.now(timezone.utc) - timedelta(minutes=3, seconds=41),
        closed=False,
    )

    print(f"added {len(CALLS)} closed calls and 1 live call at {now_iso()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
