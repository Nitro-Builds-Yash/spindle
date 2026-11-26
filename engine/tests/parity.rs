//! Replays thousands of cases generated from the Python and JavaScript rules
//! (`fixtures/gen_python.py`, `fixtures/gen_js.mjs`) through the Rust engine.
//! Any difference fails with the exact input that diverged.

use serde::Deserialize;
use spindle_engine::{Audit, CallFacts, Content, Cue, Engine, LogEntry};

#[derive(Deserialize)]
struct CueCase {
    stage: u8,
    words: String,
    expect: Cue,
}
#[derive(Deserialize)]
struct AuditCase {
    call: CallFacts,
    logs: Vec<LogEntry>,
    outcome: String,
    expect: Audit,
}
#[derive(Deserialize)]
struct SummaryCase {
    call: CallFacts,
    outcome: String,
    expect: String,
}
#[derive(Deserialize)]
struct PyFixtures {
    content: Content,
    cues: Vec<CueCase>,
    audits: Vec<AuditCase>,
    summaries: Vec<SummaryCase>,
}
#[derive(Deserialize)]
struct SuggestCase {
    logs: Vec<LogEntry>,
    expect: String,
}
#[derive(Deserialize)]
struct JsFixtures {
    suggest: Vec<SuggestCase>,
}

fn load() -> (Engine, PyFixtures) {
    let py: PyFixtures = serde_json::from_str(include_str!("../fixtures/python.json")).unwrap();
    (Engine::new(py.content.clone()), py)
}

#[test]
fn cues_match_python() {
    let (engine, py) = load();
    for c in &py.cues {
        assert_eq!(
            engine.cue(c.stage, &c.words),
            c.expect,
            "stage {} words {:?}",
            c.stage,
            c.words
        );
    }
}

#[test]
fn audits_match_python() {
    let (engine, py) = load();
    assert!(py.audits.len() > 1000);
    for (i, c) in py.audits.iter().enumerate() {
        assert_eq!(
            engine.audit(&c.call, &c.logs, &c.outcome),
            c.expect,
            "case {i}: outcome {}",
            c.outcome
        );
    }
}

#[test]
fn summaries_match_python() {
    let (engine, py) = load();
    for c in &py.summaries {
        assert_eq!(engine.summary(&c.call, &c.outcome), c.expect);
    }
}

#[test]
fn suggested_outcomes_match_javascript() {
    let (engine, _) = load();
    let js: JsFixtures = serde_json::from_str(include_str!("../fixtures/js.json")).unwrap();
    for c in &js.suggest {
        assert_eq!(engine.suggest_outcome(&c.logs), c.expect);
    }
}
