"""The eight stages and the ten outcomes.

This file is the product; the screen only renders it.

Stage names, purposes, the three quotes and the four taps per stage are the
sixteen hundred words of structure in the task. The quotes are the sentences
that recur in the hundred calls; the taps are the smallest set of things a
caller can record without typing.

The comment on each tap's `hints` is what the close audit reads: a tap says what
probably happened, an outcome says what the caller decided, and the audit's job
is to notice when the two disagree.
"""

STAGES = [
    {
        "number": 1,
        "key": "opening",
        "name": "Opening",
        "purpose": "Reach the right person and say who you are. The first ten seconds decide whether this call is worth a minute.",
        "what_they_say": [
            "From where? Spindle? Can you say it again?",
            "Prakash Rao ka to 14 saal se ye number nahi hai.",
            "Kannada maatadi. / Marathi, Marathi.",
        ],
        "taps": [
            {
                "key": "wrong_person",
                "label": "Wrong person / left company",
                "hints": ["wrong_person", "moved_company", "do_not_call"],
            },
            {
                "key": "switchboard",
                "label": "Switchboard / reception",
                "hints": ["wrong_person", "follow_up", "do_not_call"],
            },
            {
                "key": "language",
                "label": "Language switch / voice breaking",
                "hints": ["call_again", "follow_up"],
            },
            {
                "key": "right_person",
                "label": "Reached right person",
                "hints": [],
            },
        ],
        "default_tap": "right_person",
    },
    {
        "number": 2,
        "key": "purpose",
        "name": "Purpose",
        "purpose": "Say in one or two sentences why you called, in words they can repeat to a colleague.",
        "what_they_say": [
            "What does a growth report mean, actually?",
            "Is this related to a job opportunity / opening?",
            "Where did you get my number? I didn't ask for this.",
        ],
        "taps": [
            {"key": "asked_what", "label": "Asked what we do", "hints": []},
            {"key": "thought_job", "label": "Thought it's a job / hiring call", "hints": []},
            {
                "key": "asked_source",
                "label": "Asked where we got number",
                "hints": [],
            },
            {"key": "understood", "label": "Understood purpose", "hints": []},
        ],
        "default_tap": "understood",
    },
    {
        "number": 3,
        "key": "permission",
        "name": "Permission",
        "purpose": "Find out whether they are willing to talk now. A clear yes, a no, or a callback time are all good outcomes.",
        "what_they_say": [
            "Call after 30 minutes; I'm in a meeting / driving.",
            "Send it on WhatsApp or email first, I'll check.",
            "Yes, tell me quickly. Make it short.",
        ],
        "taps": [
            {
                "key": "call_later",
                "label": "Call back later (time given)",
                "hints": ["follow_up", "call_again"],
            },
            {
                "key": "whatsapp_first",
                "label": "Send on WhatsApp / mail first",
                "hints": ["agreed_to_receive_report", "follow_up"],
            },
            {
                "key": "busy",
                "label": "Busy / declined to talk",
                "hints": ["follow_up", "do_not_call", "not_interested"],
            },
            {"key": "clear_yes", "label": "Clear yes to talk", "hints": []},
        ],
        "default_tap": "clear_yes",
    },
    {
        "number": 4,
        "key": "their_business",
        "name": "Their business",
        "purpose": "Ask about their company and work before saying anything about yours.",
        "what_they_say": [
            "We work on a job work basis; margins don't apply.",
            "All decisions are taken at corporate in the US.",
            "It's a back office / I only handle sustainability.",
        ],
        "taps": [
            {
                "key": "corrected_model",
                "label": "Corrected business model / size",
                "hints": [],
            },
            {
                "key": "hq_decides",
                "label": "US / HQ makes decisions",
                "hints": ["wrong_person", "follow_up", "do_not_call"],
            },
            {
                "key": "wrong_department",
                "label": "Wrong department / not decision maker",
                "hints": ["wrong_person", "follow_up"],
            },
            {
                "key": "confirmed_context",
                "label": "Confirmed business context",
                "hints": [],
            },
        ],
        "default_tap": "confirmed_context",
    },
    {
        "number": 5,
        "key": "their_need",
        "name": "Their need",
        "purpose": "Hear what they are trying to do or struggling with, in their exact words.",
        "what_they_say": [
            "Looking for help getting into new products with our facility.",
            "There was a dip the last two years; we were in negative.",
            "Everything is fine; we have robust internal processes.",
        ],
        "taps": [
            {
                "key": "everything_fine",
                "label": "Everything is fine / internal",
                "hints": ["not_interested", "do_not_call", "follow_up"],
            },
            {
                "key": "turned_around",
                "label": "Turned around & asked what we do",
                "hints": ["interested", "follow_up"],
            },
            {
                "key": "reorg",
                "label": "Re-org / moving roles",
                "hints": ["follow_up", "wrong_person"],
            },
            {
                "key": "named_need",
                "label": "Named a growth / operational need",
                "hints": ["next_step_agreed", "agreed_to_receive_report", "interested"],
            },
        ],
        "default_tap": "named_need",
        "captures_quote": True,
    },
    {
        "number": 6,
        "key": "objection",
        "name": "Objection",
        "purpose": "Hear the reason for a no and understand it without talking over them.",
        "what_they_say": [
            "We have global tie-ups with the Big Four consultants.",
            "Meri internal team hai, hum outsource nahi kar rahe.",
            "What are your charges? Are you an NGO or for-profit?",
        ],
        "taps": [
            {
                "key": "big_four",
                "label": "Have Big Four / in-house team",
                "hints": ["not_interested", "do_not_call", "agreed_to_receive_report"],
            },
            {
                "key": "charges",
                "label": "Questioned charges / commercial model",
                "hints": ["interested", "agreed_to_receive_report", "follow_up"],
            },
            {
                "key": "not_authorized",
                "label": "Not authorized / referred elsewhere",
                "hints": ["wrong_person", "follow_up"],
            },
            {
                "key": "resolved",
                "label": "Objection understood / resolved",
                "hints": [],
            },
        ],
        "default_tap": "resolved",
    },
    {
        "number": 7,
        "key": "next_step",
        "name": "Next step",
        "purpose": "Agree on one concrete thing with a named time or channel.",
        "what_they_say": [
            "Send it by Monday; call me Wednesday around this time.",
            "Send the draft on WhatsApp; I'll review and revert.",
            "Note down Mr. Suresh's number - speak to him.",
        ],
        "taps": [
            {
                "key": "report_only",
                "label": "Agreed to report only (no time)",
                "hints": ["agreed_to_receive_report"],
            },
            {
                "key": "referred",
                "label": "Referred to colleague",
                "hints": ["follow_up", "wrong_person"],
            },
            {
                "key": "vague_yes",
                "label": "Polite / vague yes",
                "hints": ["interested", "follow_up"],
            },
            {
                "key": "named_time",
                "label": "Named day & time agreed",
                "hints": ["next_step_agreed"],
            },
        ],
        "default_tap": "named_time",
    },
    {
        "number": 8,
        "key": "close",
        "name": "Close",
        "purpose": "End clearly and verify that the outcome, next step and Stage 5 words match what happened.",
        "what_they_say": [
            "Chalega, done. Call Wednesday. Thank you.",
            "Not interested at this point of time. Thanks for asking.",
            "(Line drops mid-sentence / placed on hold)",
        ],
        "taps": [
            {
                "key": "line_dropped",
                "label": "Line dropped / indefinite hold",
                "hints": ["call_again"],
            },
            {
                "key": "warm_no",
                "label": "Warm goodbye after a no",
                "hints": ["not_interested", "do_not_call"],
            },
            {
                "key": "audited",
                "label": "Outcome audited & fixed",
                "hints": [],
            },
            {
                "key": "clean_close",
                "label": "Clean close & logged",
                "hints": [],
            },
        ],
        "default_tap": "clean_close",
    },
]

STAGES_BY_NUMBER = {s["number"]: s for s in STAGES}
STAGE_BY_KEY = {s["key"]: s for s in STAGES}

OUTCOMES = [
    {
        "key": "next_step_agreed",
        "label": "Next step agreed",
        "meaning": "A meeting, a call at a set time, or a report plus a follow-up call was agreed.",
        "tone": "good",
    },
    {
        "key": "agreed_to_receive_report",
        "label": "Agreed to receive report",
        "meaning": "Agreed to receive a document on WhatsApp or email. No fixed time yet.",
        "tone": "ok",
    },
    {
        "key": "interested",
        "label": "Interested",
        "meaning": "Said they were interested, without a fixed next step.",
        "tone": "ok",
    },
    {
        "key": "follow_up",
        "label": "Follow up",
        "meaning": "The caller is to call again.",
        "tone": "ok",
    },
    {
        "key": "call_again",
        "label": "Call again",
        "meaning": "Number to be called again: line quality, voice breaking, or a language switch.",
        "tone": "ok",
    },
    {
        "key": "not_interested",
        "label": "Not interested",
        "meaning": "The prospect declined.",
        "tone": "bad",
    },
    {
        "key": "do_not_call",
        "label": "Do not call",
        "meaning": "The prospect asked not to be called, or gave a hard rejection.",
        "tone": "bad",
    },
    {
        "key": "wrong_person",
        "label": "Wrong person",
        "meaning": "Reached someone else: switchboard, staff, wrong department, unrelated role.",
        "tone": "bad",
    },
    {
        "key": "moved_company",
        "label": "Moved company",
        "meaning": "The person no longer works at the listed company.",
        "tone": "bad",
    },
    {
        "key": "not_logged",
        "label": "Not logged",
        "meaning": "The caller logged nothing. This is the outcome the audit exists to reduce.",
        "tone": "bad",
    },
]

OUTCOME_BY_KEY = {o["key"]: o for o in OUTCOMES}
POSITIVE_OUTCOMES = {"next_step_agreed", "agreed_to_receive_report", "interested"}

# Outcomes that mean the person on the phone was not the buyer.
WRONG_PERSON_OUTCOMES = {"wrong_person", "moved_company"}
