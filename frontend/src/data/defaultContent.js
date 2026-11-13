export const DEFAULT_CONTENT = {
  company: "Meridian Growth Partners",
  stages: [
    {
      number: 1,
      key: "opening",
      name: "Opening",
      purpose: "Reach the right person and say who you are. The first ten seconds decide whether this call is worth a minute.",
      what_they_say: [
        "From where? Meridian? Can you say it again?",
        "Prakash Rao ka to 14 saal se ye number nahi hai.",
        "Kannada maatadi. / Marathi, Marathi."
      ],
      taps: [
        { key: "wrong_person", label: "Wrong person / left company" },
        { key: "switchboard", label: "Switchboard / reception" },
        { key: "language", label: "Language switch / voice breaking" },
        { key: "right_person", label: "Reached right person" }
      ],
      default_tap: "right_person"
    },
    {
      number: 2,
      key: "purpose",
      name: "Purpose",
      purpose: "Say in one or two sentences why you called, in words they can repeat to a colleague.",
      what_they_say: [
        "What does a growth report mean, actually?",
        "Is this related to a job opportunity / hiring?",
        "Where did you get my number? I didn't ask for this."
      ],
      taps: [
        { key: "asked_what_we_do", label: "Asked what Meridian does" },
        { key: "thought_hiring", label: "Thought it's a job / hiring call" },
        { key: "asked_source", label: "Asked where we got number" },
        { key: "understood", label: "Understood purpose" }
      ],
      default_tap: "understood"
    },
    {
      number: 3,
      key: "permission",
      name: "Permission",
      purpose: "Find out whether they are willing to talk now—a clear yes, no, or callback time.",
      what_they_say: [
        "Call after 30 minutes; I'm in a meeting / driving.",
        "Send it on WhatsApp or email first, I'll check.",
        "Yes, tell me quickly. Make it short."
      ],
      taps: [
        { key: "call_later", label: "Call back later (time given)" },
        { key: "whatsapp_first", label: "Send on WhatsApp / mail first" },
        { key: "busy", label: "Busy / declined to talk" },
        { key: "can_talk", label: "Clear yes to talk" }
      ],
      default_tap: "can_talk"
    },
    {
      number: 4,
      key: "their_business",
      name: "Their business",
      purpose: "Ask about their company and work before saying anything about yours.",
      what_they_say: [
        "We work on a job work basis; margins don't apply.",
        "All decisions are taken at corporate in the US.",
        "It's a back office / I only handle sustainability."
      ],
      taps: [
        { key: "job_work", label: "Corrected business model / size" },
        { key: "hq_decides", label: "US / HQ makes decisions" },
        { key: "wrong_dept", label: "Wrong department / not decision maker" },
        { key: "confirmed_context", label: "Confirmed business context" }
      ],
      default_tap: "confirmed_context"
    },
    {
      number: 5,
      key: "their_need",
      name: "Their need",
      purpose: "Hear what they are trying to do or struggling with, in their exact words.",
      what_they_say: [
        "Looking for help getting into new products with our facility.",
        "There was a dip the last two years; we were in negative.",
        "Everything is fine; we have robust internal processes."
      ],
      taps: [
        { key: "everything_fine", label: "Everything is fine / internal" },
        { key: "turned_around", label: "Turned around & asked what we do" },
        { key: "reorg", label: "Re-org / moving roles" },
        { key: "named_need", label: "Named a growth / operational need" }
      ],
      default_tap: "named_need"
    },
    {
      number: 6,
      key: "objection",
      name: "Objection",
      purpose: "Hear the reason for a no and understand it without talking over them.",
      what_they_say: [
        "We have global tie-ups with the Big Four consultants.",
        "Meri internal team hai, hum outsource nahi kar rahe.",
        "What are your charges? Are you an NGO or for-profit?"
      ],
      taps: [
        { key: "has_consultants", label: "Have Big Four / in-house team" },
        { key: "asked_charges", label: "Questioned charges / commercial model" },
        { key: "referred_elsewhere", label: "Not authorized / referred elsewhere" },
        { key: "resolved", label: "Objection understood / resolved" }
      ],
      default_tap: "resolved"
    },
    {
      number: 7,
      key: "next_step",
      name: "Next step",
      purpose: "Agree on one concrete thing with a named time or channel.",
      what_they_say: [
        "Send it by Monday; call me Wednesday around this time.",
        "Send the draft on WhatsApp; I'll review and revert.",
        "Note down Mr. Suresh's number—speak to him."
      ],
      taps: [
        { key: "report_only", label: "Agreed to report only (no time)" },
        { key: "referred", label: "Referred to colleague" },
        { key: "vague_yes", label: "Polite / vague yes" },
        { key: "named_time", label: "Named day & time agreed" }
      ],
      default_tap: "named_time"
    },
    {
      number: 8,
      key: "close",
      name: "Close",
      purpose: "End clearly and verify that the outcome, next step, and Stage 5 words match what happened.",
      what_they_say: [
        "Chalega, done. Call Wednesday. Thank you.",
        "Not interested at this point of time. Thanks for asking.",
        "(Line drops mid-sentence / placed on hold)"
      ],
      taps: [
        { key: "dropped", label: "Line dropped / indefinite hold" },
        { key: "warm_goodbye", label: "Warm goodbye after a no" },
        { key: "audited", label: "Outcome audited & fixed" },
        { key: "clean_close", label: "Clean close & logged" }
      ],
      default_tap: "clean_close"
    }
  ],
  outcomes: [
    { key: "next_step_agreed", label: "Next step agreed", tone: "good", meaning: "Meeting, call at a set time, or report + scheduled call" },
    { key: "agreed_to_receive_report", label: "Agreed to report", tone: "good", meaning: "Agreed to receive doc on WhatsApp or email" },
    { key: "interested", label: "Interested (no time)", tone: "good", meaning: "Interested, but no fixed next step" },
    { key: "follow_up", label: "Follow up later", tone: "ok", meaning: "Caller to call again" },
    { key: "call_again", label: "Call again (line/language)", tone: "ok", meaning: "Bad line quality or language switch" },
    { key: "not_interested", label: "Not interested", tone: "bad", meaning: "Prospect declined" },
    { key: "do_not_call", label: "Do not call", tone: "bad", meaning: "Hard rejection or asked not to call" },
    { key: "wrong_person", label: "Wrong person / dept", tone: "bad", meaning: "Reached someone else or wrong role" },
    { key: "moved_company", label: "Moved company / left", tone: "bad", meaning: "No longer works at listed company" },
    { key: "not_logged", label: "Not logged", tone: "bad", meaning: "Caller logged nothing" }
  ]
};
