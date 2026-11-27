"""Generate parity cases from the Python rules (backend/app/llm.py).

    python engine/fixtures/gen_python.py > engine/fixtures/python.json

tests/parity.rs replays every case through the Rust engine and expects the
same answer, so the two can never drift apart. CI regenerates this file and
fails if it changed without being committed.
"""
import itertools
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
os.environ.pop("LLM_API_KEY", None)

from app.content import OUTCOMES, STAGES  # noqa: E402
from app.llm import audit_fallback, cue_fallback, summary_fallback  # noqa: E402

PHRASES = [
    "", "Hello?", "WRONG NUMBER", "he no longer works here", "what is this regarding",
    "is this about a job opening", "I'm driving, call later", "send it on WhatsApp",
    "we manufacture castings", "we do job work for Tata", "our margin has a dip",
    "we are looking for manpower", "we already have a consultant", "too expensive",
    "call me Thursday", "next week Friday is fine", "not interested, bye",
    "thank you for your time", "Not Here", "budget is tight, we have an internal team",
    "धन्यवाद, busy hoon", "Ünïcödé growth", "regarding the job work we make",
]

cues = [
    {"stage": st, "words": w, "expect": cue_fallback(st, w)}
    for st in range(1, 9) for w in PHRASES
]

# Taps per stage worth combining (every dead end, every special case, a neutral one).
TAP_CHOICES = {
    1: [None, "right_person", "wrong_person", "switchboard"],
    2: [None, "thought_job"],
    4: [None, "hq_decides"],
    7: [None, "named_time", "referred", "report_only", "vague_yes"],
}
OUTCOME_KEYS = [o["key"] for o in OUTCOMES]
CALLS = [
    {},
    {"prospect_name": "Asha Rao", "company_name": "Rao Forge", "highest_stage_name": "Next step",
     "next_step": "Thu 16:00 call.", "stage5_need_quote": "scrap is 4%", "duration_seconds": 140},
    {"prospect_name": "Dev", "company_name": "", "highest_stage_name": "Their need",
     "next_step": "  ", "stage5_need_quote": "Q" * 120, "duration_seconds": 12},
    {"prospect_name": "Ravi", "company_name": "Beta", "next_step": "", "stage5_need_quote": "",
     "duration_seconds": None},
]

audits = []
for (t1, t2, t4, t7), outcome, call in itertools.product(
    itertools.product(*TAP_CHOICES.values()), OUTCOME_KEYS, CALLS
):
    logs = [
        {"stage_number": n, "what_happened": k}
        for n, k in zip(TAP_CHOICES.keys(), (t1, t2, t4, t7)) if k
    ]
    audits.append({"call": call, "logs": logs, "outcome": outcome,
                   "expect": audit_fallback(dict(call), logs, outcome)})

summaries = [
    {"call": call, "outcome": o, "expect": summary_fallback(dict(call), [], o)}
    for call in CALLS for o in OUTCOME_KEYS
]

content = {
    "stages": [{"number": s["number"], "name": s["name"],
                "taps": [{"key": t["key"], "label": t["label"]} for t in s["taps"]]} for s in STAGES],
    "outcomes": [{"key": o["key"], "label": o["label"]} for o in OUTCOMES],
}
json.dump({"content": content, "cues": cues, "audits": audits, "summaries": summaries},
          sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
sys.stdout.write("\n")
