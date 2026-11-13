"""The two model calls, and the honest fallback.

Both features are server-side because the key is server-side. If no key is
configured the app still works: `cue_fallback` reads the same stage model with
rules, and `audit_fallback` runs the consistency check against the taps. The
response says which one answered (`source: "llm"` or `"rules"`), so a demo
never pretends a model was there when it was not.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import httpx

from .content import (
    OUTCOME_BY_KEY,
    POSITIVE_OUTCOMES,
    STAGES_BY_NUMBER,
    WRONG_PERSON_OUTCOMES,
)

SYSTEM = (
    "You are a sales-call coach sitting beside an Indian B2B tele-caller who is on a "
    "live cold call to a manufacturer or a company owner. You are terse, concrete and "
    "never flattering. You never invent facts about the prospect. You answer in JSON."
)


def _provider() -> tuple[str, str, str]:
    return (
        os.getenv("LLM_PROVIDER", "").strip().lower(),
        os.getenv("LLM_API_KEY", "").strip(),
        os.getenv("LLM_MODEL", "").strip(),
    )


def _parse_json(text: str) -> dict[str, Any]:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no json object in model reply")
    return json.loads(text[start : end + 1])


def _openai_compatible(base: str, model: str, key: str, prompt: str) -> str:
    r = httpx.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "model": model,
            "temperature": 0.2,
            "max_tokens": 400,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=25.0,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _gemini(model: str, key: str, prompt: str) -> str:
    r = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        params={"key": key},
        json={
            "system_instruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 400},
        },
        timeout=25.0,
    )
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def _call_model(prompt: str) -> Optional[str]:
    provider, key, model = _provider()
    if not provider or not key:
        return None
    try:
        if provider == "gemini":
            return _gemini(model or "gemini-2.0-flash", key, prompt)
        if provider == "cerebras":
            return _openai_compatible(
                "https://api.cerebras.ai/v1", model or "llama-3.3-70b", key, prompt
            )
        if provider == "mistral":
            return _openai_compatible(
                "https://api.mistral.ai/v1", model or "mistral-small-latest", key, prompt
            )
        if provider == "openai":
            return _openai_compatible(
                "https://api.openai.com/v1", model or "gpt-4o-mini", key, prompt
            )
    except Exception:
        # A dead model must not take a live call down with it.
        return None
    return None


# --------------------------------------------------------------------------- #
# AI Cue - one line, mid call
# --------------------------------------------------------------------------- #

CUE_PROMPT = """Stage {stage_no} of 8: "{stage_name}".
What this stage is for: {purpose}
The taps available: {taps}
The prospect's words, typed by the caller: "{words}"

Give the caller ONE spoken sentence to say next, under 20 words, in the register of
an Indian B2B phone call. No stage names, no coaching language, no quotes around it.
If the words point at a different stage, start the sentence with "Stage N is next -"
and then the line.

Reply with JSON only: {{"cue": "..."}}"""


def cue(stage_no: int, words: str, context: str = "") -> dict[str, Any]:
    stage = STAGES_BY_NUMBER.get(stage_no, STAGES_BY_NUMBER[1])
    prompt = CUE_PROMPT.format(
        stage_no=stage["number"],
        stage_name=stage["name"],
        purpose=stage["purpose"],
        taps=", ".join(t["label"] for t in stage["taps"]),
        words=(words or "").strip() or "(nothing typed yet)",
    )
    if context:
        prompt += f"\nEarlier taps on this call: {context}"
    raw = _call_model(prompt)
    if raw:
        try:
            text = str(_parse_json(raw).get("cue", "")).strip()
            if text:
                return {"cue": text[:220], "source": "llm", "stage": stage_no}
        except Exception:
            pass
    return cue_fallback(stage_no, words)


CUE_FALLBACK = {
    1: "Am I speaking with the person who handles operations there?",
    2: "I called because we wrote a growth report on your company and I wanted you to hear the one thing in it.",
    3: "Is this a good two minutes, or should I call back at a better time?",
    4: "Before I say anything about us - what does your week actually look like on the floor?",
    5: "What is the one thing you are trying to fix this year that is not fixing itself?",
    6: "That is fair. Can I ask what the current arrangement does not cover for you?",
    7: "Let me say the next step back to you so I have it right.",
    8: "Thank you for the time. I will put that in writing today.",
}


def cue_fallback(stage_no: int, words: str) -> dict[str, Any]:
    """Keyword read of what the prospect said, then a line for the stage."""
    text = (words or "").lower()
    stage = STAGES_BY_NUMBER.get(stage_no, STAGES_BY_NUMBER[1])
    suggested = stage_no

    if re.search(r"wrong number|no longer|left the company|does not work here|not here", text):
        suggested = 1
    elif re.search(r"what is this|regarding|where did you get|job|opening|vacancy", text):
        suggested = 2
    elif re.search(r"busy|driving|meeting|call later|call after|whatsapp|send it", text):
        suggested = 3
    elif re.search(r"we make|we manufacture|job work|our company|back office|corporate", text):
        suggested = 4
    elif re.search(r"problem|need|margin|manpower|dip|growth|looking for|trying to", text):
        suggested = 5
    elif re.search(r"already|consultant|internal team|charges|cost|expensive|budget", text):
        suggested = 6
    elif re.search(r"monday|tuesday|wednesday|thursday|friday|next week|send it by|call me", text):
        suggested = 7
    elif re.search(r"bye|not interested|thank you for your time|have to go", text):
        suggested = 8

    line = CUE_FALLBACK.get(stage_no, CUE_FALLBACK[3])
    if suggested != stage_no and suggested in CUE_FALLBACK:
        nxt = STAGES_BY_NUMBER[suggested]
        line = f"Stage {suggested} is next - {CUE_FALLBACK[suggested]}"
        line = line.replace("Stage " + str(suggested) + " is next - ", f"{nxt['name']}: ")
    return {"cue": line, "source": "rules", "stage": stage_no, "suggests_stage": suggested}


# --------------------------------------------------------------------------- #
# Close audit - does the outcome match the call
# --------------------------------------------------------------------------- #

AUDIT_PROMPT = """A cold call just ended and the caller chose an outcome. Your job is
to check the outcome against what the taps and the prospect's own words say, and to
write the one line a sales manager reads thirty seconds later.

Prospect: {prospect}, {role} at {company}
Call length: {duration} seconds
Highest stage reached: {stage_name} ({stage_no} of 8)
Outcome chosen by the caller: {outcome} - {meaning}
Next step typed by the caller: {next_step}
Stage 5 need quote: {quote}

Stage log (stage: tap | words):
{log}

Reply with JSON only:
{{"warning": "one short sentence naming any contradiction, or null",
  "summary": "under 25 words: what happened, what they said, what the next step is"}}

Rules for a contradiction: a positive outcome after a wrong-person or gatekeeper tap;
next_step_agreed without a named day and time at stage 7; not_interested or do_not_call
after a named day and time was agreed; a positive outcome with no stage 5 quote."""


# Taps after which no positive outcome can be true.
DEAD_END_TAPS = {
    1: {"wrong_person", "switchboard"},
    4: {"hq_decides", "wrong_department"},
}


def audit_fallback(call: dict[str, Any], logs: list[dict[str, Any]], outcome: str) -> dict[str, Any]:
    by_stage = {int(l["stage_number"]): l for l in logs}
    tap = {n: l["what_happened"] for n, l in by_stage.items()}
    name = OUTCOME_BY_KEY.get(outcome, {}).get("label", outcome)
    positive = outcome in POSITIVE_OUTCOMES
    warning: Optional[str] = None

    if outcome == "not_logged":
        warning = (
            "Nothing was logged. The brief's 13 not_logged calls are the failure this "
            "audit exists to catch."
        )
    elif positive:
        for stage_no, bad in DEAD_END_TAPS.items():
            if tap.get(stage_no) in bad:
                warning = (
                    f"Stage {stage_no} recorded \"{_label(stage_no, tap[stage_no])}\", so the "
                    f"buyer was not reached. \"{name}\" is probably wrong_person or moved_company."
                )
                break
        if not warning and tap.get(2) == "thought_job":
            warning = (
                "Stage 2 says the prospect thought this was a job call. "
                f"\"{name}\" does not fit that."
            )
        if not warning and tap.get(7) == "referred":
            warning = (
                "Stage 7 says they referred you to a colleague. That is wrong_person or "
                "follow_up, not an agreement with this person."
            )
        if not warning and outcome == "next_step_agreed" and tap.get(7) != "named_time":
            warning = (
                "next_step_agreed needs a named day and time. Stage 7 recorded "
                f"\"{_label(7, tap.get(7)) or 'nothing'}\"."
            )
        if not warning and not (call.get("stage5_need_quote") or "").strip():
            warning = (
                "No Stage 5 quote. The record has no words from the prospect, which is "
                "what the next call is built on."
            )
        if not warning and int(call.get("duration_seconds") or 0) < 30:
            warning = (
                f"The call was {call.get('duration_seconds', 0)} seconds. That is short "
                f"for \"{name}\"."
            )
    elif tap.get(1) == "wrong_person" and outcome == "not_interested":
        warning = (
            "Stage 1 recorded \"Wrong person / left company\". \"Not interested\" hides "
            "the fact that the buyer was never on the call: use wrong_person or moved_company."
        )
    elif tap.get(7) == "named_time":
        warning = (
            f"Stage 7 agreed a named day and time, but the outcome is \"{name}\". "
            "One of the two is wrong."
        )

    return {
        "warning": warning,
        "summary": summary_fallback(call, logs, outcome),
        "source": "rules",
    }


def _label(stage_no: int, key: Optional[str]) -> str:
    stage = STAGES_BY_NUMBER.get(stage_no)
    if not stage or not key:
        return ""
    for t in stage["taps"]:
        if t["key"] == key:
            return t["label"]
    return key.replace("_", " ")


def summary_fallback(call: dict[str, Any], logs: list[dict[str, Any]], outcome: str) -> str:
    who = call.get("prospect_name") or "The prospect"
    where = call.get("company_name") or "the company"
    label = OUTCOME_BY_KEY.get(outcome, {}).get("label", outcome)
    stage_name = call.get("highest_stage_name") or "Opening"
    next_step = (call.get("next_step") or "").strip()
    quote = (call.get("stage5_need_quote") or "").strip()

    line = f"{who} at {where}: {label.lower()}, reached {stage_name}."
    if next_step:
        line += f" Next: {next_step.rstrip('.')}."
    elif quote:
        line += f' They said: "{quote[:90]}"'
    return line[:220]


def audit(call: dict[str, Any], logs: list[dict[str, Any]], outcome: str) -> dict[str, Any]:
    meaning = OUTCOME_BY_KEY.get(outcome, {}).get("meaning", "")
    log_lines = "\n".join(
        f'- stage {l["stage_number"]} {l["stage_name"]}: {l["what_happened"]} | '
        f'"{(l["prospect_words"] or "").strip()[:160]}"'
        for l in logs
    ) or "(nothing logged)"

    prompt = AUDIT_PROMPT.format(
        prospect=call.get("prospect_name") or "unknown",
        role=call.get("prospect_role") or "unknown role",
        company=call.get("company_name") or "unknown company",
        duration=call.get("duration_seconds") or 0,
        stage_name=call.get("highest_stage_name") or "Opening",
        stage_no=call.get("highest_stage_reached") or 1,
        outcome=outcome,
        meaning=meaning,
        next_step=(call.get("next_step") or "(none)"),
        quote=(call.get("stage5_need_quote") or "(none)"),
        log=log_lines,
    )
    raw = _call_model(prompt)
    if not raw:
        return audit_fallback(call, logs, outcome)
    try:
        data = _parse_json(raw)
    except Exception:
        return audit_fallback(call, logs, outcome)

    warning = data.get("warning")
    if isinstance(warning, str) and warning.strip().lower() in ("null", "none", ""):
        warning = None
    summary = str(data.get("summary") or "").strip()
    if not summary:
        summary = summary_fallback(call, logs, outcome)
    return {"warning": warning, "summary": summary[:240], "source": "llm"}
