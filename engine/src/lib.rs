//! # spindle-engine
//!
//! The deterministic half of Spindle: the rules that run when there is no
//! language model to ask (no key, quota, a slow provider, or no network).
//!
//! * [`Engine::detect_stage`]: which of the eight stages the prospect's words point to
//! * [`Engine::cue`]: the next line to say
//! * [`Engine::audit`]: does the chosen outcome match what was tapped
//! * [`Engine::summary`]: the one line a manager reads
//! * [`Engine::suggest_outcome`]: the outcome the taps imply
//!
//! It is a port of `backend/app/llm.py`'s fallbacks and is kept identical to
//! them by `tests/parity.rs`, which replays cases generated from the Python.
//! Compiled to WebAssembly (see `wasm.rs`) it runs in the browser, so the
//! caller gets a cue and the pre-close check instantly and offline.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[cfg(target_arch = "wasm32")]
mod wasm;

// ------------------------------------------------------------------ content --

#[derive(Debug, Clone, Deserialize)]
pub struct Tap {
    pub key: String,
    pub label: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Stage {
    pub number: u8,
    pub name: String,
    #[serde(default)]
    pub taps: Vec<Tap>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Outcome {
    pub key: String,
    pub label: String,
}

/// The `/api/content` payload (extra fields are ignored).
#[derive(Debug, Clone, Deserialize)]
pub struct Content {
    pub stages: Vec<Stage>,
    pub outcomes: Vec<Outcome>,
}

// --------------------------------------------------------------- call input --

/// The parts of a call record the rules read.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct CallFacts {
    #[serde(default)]
    pub prospect_name: Option<String>,
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub highest_stage_name: Option<String>,
    #[serde(default)]
    pub next_step: Option<String>,
    #[serde(default)]
    pub stage5_need_quote: Option<String>,
    #[serde(default)]
    pub duration_seconds: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LogEntry {
    pub stage_number: serde_json::Value, // the API sends numbers; older rows strings
    pub what_happened: String,
}

impl LogEntry {
    fn stage(&self) -> Option<u8> {
        match &self.stage_number {
            serde_json::Value::Number(n) => n.as_u64().map(|n| n as u8),
            serde_json::Value::String(s) => s.trim().parse().ok(),
            _ => None,
        }
    }
}

// ------------------------------------------------------------------ results --

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Cue {
    pub cue: String,
    pub source: String,
    pub stage: u8,
    pub suggests_stage: u8,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Audit {
    pub warning: Option<String>,
    pub summary: String,
    pub source: String,
}

// -------------------------------------------------------------------- rules --

/// Keyword groups, checked in order; the first group with a hit wins.
/// Same phrases and order as `cue_fallback` in `backend/app/llm.py`.
const STAGE_KEYWORDS: [(u8, &[&str]); 8] = [
    (
        1,
        &[
            "wrong number",
            "no longer",
            "left the company",
            "does not work here",
            "not here",
        ],
    ),
    (
        2,
        &[
            "what is this",
            "regarding",
            "where did you get",
            "job",
            "opening",
            "vacancy",
        ],
    ),
    (
        3,
        &[
            "busy",
            "driving",
            "meeting",
            "call later",
            "call after",
            "whatsapp",
            "send it",
        ],
    ),
    (
        4,
        &[
            "we make",
            "we manufacture",
            "job work",
            "our company",
            "back office",
            "corporate",
        ],
    ),
    (
        5,
        &[
            "problem",
            "need",
            "margin",
            "manpower",
            "dip",
            "growth",
            "looking for",
            "trying to",
        ],
    ),
    (
        6,
        &[
            "already",
            "consultant",
            "internal team",
            "charges",
            "cost",
            "expensive",
            "budget",
        ],
    ),
    (
        7,
        &[
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "next week",
            "send it by",
            "call me",
        ],
    ),
    (
        8,
        &[
            "bye",
            "not interested",
            "thank you for your time",
            "have to go",
        ],
    ),
];

const CUE_LINES: [&str; 8] = [
    "Am I speaking with the person who handles operations there?",
    "I called because we wrote a growth report on your company and I wanted you to hear the one thing in it.",
    "Is this a good two minutes, or should I call back at a better time?",
    "Before I say anything about us - what does your week actually look like on the floor?",
    "What is the one thing you are trying to fix this year that is not fixing itself?",
    "That is fair. Can I ask what the current arrangement does not cover for you?",
    "Let me say the next step back to you so I have it right.",
    "Thank you for the time. I will put that in writing today.",
];

const POSITIVE: [&str; 3] = ["next_step_agreed", "agreed_to_receive_report", "interested"];

/// Taps after which no positive outcome can be true.
const DEAD_ENDS: [(u8, &[&str]); 2] = [
    (1, &["wrong_person", "switchboard"]),
    (4, &["hq_decides", "wrong_department"]),
];

fn cue_line(stage: u8) -> &'static str {
    CUE_LINES
        .get(stage.wrapping_sub(1) as usize)
        .copied()
        .unwrap_or(CUE_LINES[2])
}

fn take_chars(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

/// Python's `str.lower()` and Rust's `to_lowercase` agree on everything the
/// keyword lists contain (ASCII), which is all the match depends on.
fn lower(s: &str) -> String {
    s.to_lowercase()
}

pub struct Engine {
    stages: HashMap<u8, Stage>,
    outcomes: HashMap<String, String>,
}

impl Engine {
    pub fn new(content: Content) -> Self {
        Engine {
            stages: content.stages.into_iter().map(|s| (s.number, s)).collect(),
            outcomes: content
                .outcomes
                .into_iter()
                .map(|o| (o.key, o.label))
                .collect(),
        }
    }

    pub fn from_json(content_json: &str) -> Result<Self, serde_json::Error> {
        Ok(Self::new(serde_json::from_str(content_json)?))
    }

    fn stage_name(&self, n: u8) -> &str {
        self.stages.get(&n).map(|s| s.name.as_str()).unwrap_or("")
    }

    fn outcome_label<'a>(&'a self, key: &'a str) -> &'a str {
        self.outcomes.get(key).map(String::as_str).unwrap_or(key)
    }

    fn tap_label(&self, stage: u8, key: Option<&str>) -> String {
        let (Some(st), Some(key)) = (self.stages.get(&stage), key) else {
            return String::new();
        };
        if key.is_empty() {
            return String::new();
        }
        st.taps
            .iter()
            .find(|t| t.key == key)
            .map(|t| t.label.clone())
            .unwrap_or_else(|| key.replace('_', " "))
    }

    /// The stage the prospect's words point to, if any keyword group matches.
    pub fn detect_stage(&self, words: &str) -> Option<u8> {
        let text = lower(words);
        STAGE_KEYWORDS
            .iter()
            .find(|(_, phrases)| phrases.iter().any(|p| text.contains(p)))
            .map(|(n, _)| *n)
    }

    /// Next line for the caller. If the words point to another stage, the line
    /// for that stage, prefixed with its name.
    pub fn cue(&self, stage: u8, words: &str) -> Cue {
        let suggested = self.detect_stage(words).unwrap_or(stage);
        let cue = if suggested != stage {
            format!("{}: {}", self.stage_name(suggested), cue_line(suggested))
        } else {
            cue_line(stage).to_string()
        };
        Cue {
            cue,
            source: "rules".into(),
            stage,
            suggests_stage: suggested,
        }
    }

    /// Outcome implied by the taps (what the close dialog pre-selects).
    pub fn suggest_outcome(&self, logs: &[LogEntry]) -> &'static str {
        let tap = taps(logs);
        let t = |n: u8| tap.get(&n).map(String::as_str);
        match (t(7), t(1), t(3), t(5)) {
            (Some("named_time"), ..) => "next_step_agreed",
            (Some("report_only"), ..) => "agreed_to_receive_report",
            (Some("vague_yes"), ..) => "interested",
            (Some("referred"), ..) => "follow_up",
            (_, Some("switchboard"), ..) => "follow_up",
            (_, Some("wrong_person"), ..) => "wrong_person",
            (_, Some("language"), ..) => "call_again",
            (_, _, Some("call_later" | "busy"), _) => "follow_up",
            (_, _, Some("whatsapp_first"), _) => "agreed_to_receive_report",
            (_, _, _, Some("everything_fine")) => "not_interested",
            _ => "not_logged",
        }
    }

    /// One line a sales manager reads after the call.
    pub fn summary(&self, call: &CallFacts, outcome: &str) -> String {
        let who = non_empty(&call.prospect_name).unwrap_or("The prospect");
        let place = non_empty(&call.company_name).unwrap_or("the company");
        let label = lower(self.outcome_label(outcome));
        let stage = non_empty(&call.highest_stage_name).unwrap_or("Opening");
        let next = call.next_step.as_deref().unwrap_or("").trim();
        let quote = call.stage5_need_quote.as_deref().unwrap_or("").trim();

        let mut line = format!("{who} at {place}: {label}, reached {stage}.");
        if !next.is_empty() {
            line += &format!(" Next: {}.", next.trim_end_matches('.'));
        } else if !quote.is_empty() {
            line += &format!(" They said: \"{}\"", take_chars(quote, 90));
        }
        take_chars(&line, 220)
    }

    /// Does the outcome contradict the taps? At most one warning, most
    /// important first, plus the summary line.
    pub fn audit(&self, call: &CallFacts, logs: &[LogEntry], outcome: &str) -> Audit {
        let tap = taps(logs);
        let t = |n: u8| tap.get(&n).map(String::as_str);
        let name = self.outcome_label(outcome);
        let positive = POSITIVE.contains(&outcome);
        let mut warning: Option<String> = None;

        if outcome == "not_logged" {
            warning = Some(
                "Nothing was logged. The brief's 13 not_logged calls are the failure this audit exists to catch."
                    .into(),
            );
        } else if positive {
            for (stage, bad) in DEAD_ENDS {
                if let Some(k) = t(stage).filter(|k| bad.contains(k)) {
                    warning = Some(format!(
                        "Stage {stage} recorded \"{}\", so the buyer was not reached. \"{name}\" is probably wrong_person or moved_company.",
                        self.tap_label(stage, Some(k))
                    ));
                    break;
                }
            }
            let mut check = |cond: bool, msg: &dyn Fn() -> String| {
                if warning.is_none() && cond {
                    warning = Some(msg());
                }
            };
            check(t(2) == Some("thought_job"), &|| {
                format!("Stage 2 says the prospect thought this was a job call. \"{name}\" does not fit that.")
            });
            check(t(7) == Some("referred"), &|| {
                "Stage 7 says they referred you to a colleague. That is wrong_person or follow_up, not an agreement with this person.".into()
            });
            check(
                outcome == "next_step_agreed" && t(7) != Some("named_time"),
                &|| {
                    let got = self.tap_label(7, t(7));
                    format!(
                        "next_step_agreed needs a named day and time. Stage 7 recorded \"{}\".",
                        if got.is_empty() {
                            "nothing".to_string()
                        } else {
                            got
                        }
                    )
                },
            );
            check(
                matches!(outcome, "next_step_agreed" | "agreed_to_receive_report")
                    && call.next_step.as_deref().unwrap_or("").trim().is_empty(),
                &|| {
                    format!(
                        "\"{name}\" but no next step is written. Note what was agreed, e.g. \"Thursday 16:00 call, send one-pager on WhatsApp first\"."
                    )
                },
            );
            check(
                call.stage5_need_quote
                    .as_deref()
                    .unwrap_or("")
                    .trim()
                    .is_empty(),
                &|| {
                    "No Stage 5 quote. The record has no words from the prospect, which is what the next call is built on.".into()
                },
            );
            let secs = call.duration_seconds.unwrap_or(0);
            check(secs < 30, &|| {
                format!("The call was {secs} seconds. That is short for \"{name}\".")
            });
        } else if t(1) == Some("wrong_person") && outcome == "not_interested" {
            warning = Some(
                "Stage 1 recorded \"Wrong person / left company\". \"Not interested\" hides the fact that the buyer was never on the call: use wrong_person or moved_company."
                    .into(),
            );
        } else if t(7) == Some("named_time") {
            warning = Some(format!(
                "Stage 7 agreed a named day and time, but the outcome is \"{name}\". One of the two is wrong."
            ));
        }

        Audit {
            warning,
            summary: self.summary(call, outcome),
            source: "rules".into(),
        }
    }
}

fn non_empty(v: &Option<String>) -> Option<&str> {
    v.as_deref().filter(|s| !s.is_empty())
}

/// Last tap per stage wins, like the server's upsert.
fn taps(logs: &[LogEntry]) -> HashMap<u8, String> {
    logs.iter()
        .filter_map(|l| l.stage().map(|n| (n, l.what_happened.clone())))
        .collect()
}
