//! JavaScript bindings. Everything crosses the boundary as JSON strings, so
//! the JS side needs no generated types and the module stays small.

use crate::{CallFacts, Engine, LogEntry};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = Engine)]
pub struct JsEngine(Engine);

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

#[wasm_bindgen(js_class = Engine)]
impl JsEngine {
    /// `content_json`: the `/api/content` payload.
    #[wasm_bindgen(constructor)]
    pub fn new(content_json: &str) -> Result<JsEngine, JsError> {
        Engine::from_json(content_json).map(JsEngine).map_err(err)
    }

    /// Stage number the words point to, or 0 for none.
    #[wasm_bindgen(js_name = detectStage)]
    pub fn detect_stage(&self, words: &str) -> u8 {
        self.0.detect_stage(words).unwrap_or(0)
    }

    /// JSON `{cue, source, stage, suggests_stage}`.
    pub fn cue(&self, stage: u8, words: &str) -> String {
        serde_json::to_string(&self.0.cue(stage, words)).unwrap_or_default()
    }

    /// `logs_json`: `[{stage_number, what_happened}]`. Returns an outcome key.
    #[wasm_bindgen(js_name = suggestOutcome)]
    pub fn suggest_outcome(&self, logs_json: &str) -> Result<String, JsError> {
        let logs: Vec<LogEntry> = serde_json::from_str(logs_json).map_err(err)?;
        Ok(self.0.suggest_outcome(&logs).to_string())
    }

    /// JSON `{warning, summary, source}`.
    pub fn audit(
        &self,
        call_json: &str,
        logs_json: &str,
        outcome: &str,
    ) -> Result<String, JsError> {
        let call: CallFacts = serde_json::from_str(call_json).map_err(err)?;
        let logs: Vec<LogEntry> = serde_json::from_str(logs_json).map_err(err)?;
        serde_json::to_string(&self.0.audit(&call, &logs, outcome)).map_err(err)
    }
}
