import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import PhoneSimulator from "../components/PhoneSimulator.jsx";
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
} from "../utils/speech.js";

function clock(startedAt) {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
}

/** The outcome the taps already imply, used as the modal's first guess. */
function suggestOutcome(logs) {
  const tap = (n) => logs.find((l) => Number(l.stage_number) === n)?.what_happened;
  if (tap(7) === "named_time") return "next_step_agreed";
  if (tap(7) === "report_only") return "agreed_to_receive_report";
  if (tap(7) === "vague_yes") return "interested";
  if (tap(7) === "referred") return "follow_up";
  if (tap(1) === "switchboard") return "follow_up";
  if (tap(1) === "wrong_person") return "wrong_person";
  if (tap(1) === "language") return "call_again";
  if (tap(3) === "call_later" || tap(3) === "busy") return "follow_up";
  if (tap(3) === "whatsapp_first") return "agreed_to_receive_report";
  if (tap(5) === "everything_fine") return "not_interested";
  return "not_logged";
}

export default function LiveCall({ callId, content, onNew, onFinished, onClear }) {
  const [call, setCall] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stageNo, setStageNo] = useState(1);
  const [tap, setTap] = useState("");
  const [words, setWords] = useState("");
  const [cue, setCue] = useState(null);
  const [cueBusy, setCueBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState("00:00");
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(null);
  const [showSim, setShowSim] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isWhispering, setIsWhispering] = useState(false);
  const wordsRef = useRef(null);
  const recognizerRef = useRef(null);

  function toggleDictation() {
    if (isListening) {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }
    const recognizer = createSpeechRecognizer({
      onStart: () => setIsListening(true),
      onResult: (transcript) => {
        setWords((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
      },
      onEnd: () => setIsListening(false),
      onError: () => setIsListening(false),
    });
    if (recognizer) {
      recognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch {
        setIsListening(false);
      }
    } else {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }
  }

  function handleWhisperCue() {
    if (isWhispering) {
      stopSpeaking();
      setIsWhispering(false);
      return;
    }
    if (!cue?.cue) return;
    setIsWhispering(true);
    speakText(cue.cue, {
      onEnd: () => setIsWhispering(false),
      onError: () => setIsWhispering(false),
      rate: 1.05,
    });
  }

  const stages = content.stages;
  const stage = useMemo(
    () => stages.find((s) => s.number === stageNo) || stages[0],
    [stages, stageNo]
  );
  const next = stages.find((s) => s.number === stageNo + 1);

  const load = useCallback(async () => {
    try {
      const data = await api.getCall(callId);
      setCall(data.call);
      setLogs(data.stage_logs || []);
      const no = Number(data.call.highest_stage_reached) || 1;
      setStageNo(no);
      if (data.call.status !== "in_progress") {
        setClosed({ outcome: data.call.outcome, summary: data.call.ai_summary });
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [callId, onClear]);

  useEffect(() => {
    if (callId) load();
  }, [callId, load]);

  useEffect(() => {
    if (!call?.started_at) return;
    setTick(clock(call.started_at));
    const t = setInterval(() => setTick(clock(call.started_at)), 1000);
    return () => clearInterval(t);
  }, [call?.started_at]);

  useEffect(() => {
    const existing = logs.find((l) => Number(l.stage_number) === stageNo);
    setTap(existing?.what_happened || stage.default_tap);
    setWords(existing?.prospect_words || "");
    setCue(existing?.ai_suggestion ? { cue: existing.ai_suggestion } : null);
    setErr("");
  }, [stageNo, stage, logs]);

  useEffect(() => {
    function onKey(e) {
      if (closing) return;
      if (["TEXTAREA", "INPUT", "SELECT"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= stage.taps.length) setTap(stage.taps[n - 1].key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, closing]);

  async function askCue() {
    setCueBusy(true);
    try {
      const res = await api.cue({
        stage_number: stageNo,
        prospect_words: words,
        call_id: callId,
      });
      setCue(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCueBusy(false);
    }
  }

  async function saveStage() {
    if (!tap) {
      setErr("Tap what happened. The tap is the record.");
      return false;
    }
    const res = await api.saveStage(callId, {
      stage_number: stageNo,
      what_happened: tap,
      prospect_words: words,
      ai_suggestion: cue?.cue || "",
    });
    if (res?.stage_logs) {
      setLogs(res.stage_logs);
    }
    if (res?.call) {
      setCall(res.call);
    }
    return true;
  }

  async function goNext() {
    setSaving(true);
    setErr("");
    try {
      const ok = await saveStage();
      if (!ok) return;
      if (stageNo === 8) {
        setClosing(true);
      } else {
        setStageNo(stageNo + 1);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function endCall() {
    setSaving(true);
    setErr("");
    try {
      await saveStage();
    } catch {
      /* the call can still be closed without the last tap */
    } finally {
      setSaving(false);
      setClosing(true);
    }
  }

  if (err && !call) {
    return (
      <div className="grid place-items-center gap-4 py-24 text-ink-500 tnum text-sm">
        <p>{err}</p>
        <button className="btn-primary" onClick={onNew}>
          Start a new call
        </button>
      </div>
    );
  }
  if (!call) return <div className="py-24 text-center text-ink-500 tnum text-sm">Loading call…</div>;

  if (closed) {
    return (
      <Closed
        call={call}
        content={content}
        onNew={onNew}
        onFinished={onFinished}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 py-2 sm:py-6 relative">
      
      {/* Call guide panel */}
      <div className="w-full max-w-[520px] rounded-xl2 border border-steel-200 bg-white p-6 sm:p-7 shadow-card text-ink-900 shrink-0">

        {/* Prospect + call controls */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[22px] font-bold leading-tight text-ink-950 truncate">
              {call.prospect_name || "Unknown prospect"}
            </h2>
            <p className="text-sm text-ink-500 mt-1">
              {[call.prospect_role, call.company_name].filter(Boolean).join(", ")}
              {call.call_type ? <span className="text-ink-400"> ({call.call_type})</span> : null}
            </p>
          </div>
          <span
            className="tnum shrink-0 rounded-full bg-signal px-3 py-1 text-sm font-bold text-ink-950"
            title="Time on this call"
            aria-label={`Call time ${tick}`}
          >
            {tick}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <button type="button" onClick={onNew} className="font-semibold text-navy hover:underline">
            New call
          </button>
          <span className="text-steel-300" aria-hidden>|</span>
          <button
            type="button"
            onClick={() => setShowSim(!showSim)}
            className="font-semibold text-ink-600 hover:text-ink-900"
            aria-pressed={showSim}
          >
            {showSim ? "Hide practice phone" : "Show practice phone"}
          </button>
        </div>

        {/* Stage rail: the call as one thread, eight stops */}
        <ol className="relative mt-6 mb-2 grid grid-cols-8" aria-label="Call stages">
          <span className="absolute left-[6.25%] right-[6.25%] top-[13px] h-[3px] rounded-full bg-steel-200" aria-hidden />
          <span
            className="absolute left-[6.25%] top-[13px] h-[3px] rounded-full bg-navy transition-[width] duration-300"
            style={{ width: `${((stageNo - 1) / 7) * 87.5}%` }}
            aria-hidden
          />
          {stages.map((s) => {
            const now = s.number === stageNo;
            const past = s.number < stageNo;
            return (
              <li key={s.key} className="relative flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setStageNo(s.number)}
                  aria-current={now ? "step" : undefined}
                  title={s.name}
                  className={`tnum relative z-10 flex h-[29px] w-[29px] items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    now
                      ? "bg-signal text-ink-950 ring-4 ring-signal/25"
                      : past
                      ? "bg-navy text-white hover:bg-navy-700"
                      : "bg-white text-ink-500 border-2 border-steel-300 hover:border-ink-500"
                  }`}
                >
                  {s.number}
                </button>
                <span
                  className={`mt-1.5 px-0.5 text-center text-[11px] leading-tight ${
                    now ? "font-bold text-ink-950 whitespace-nowrap" : "hidden sm:block text-ink-500"
                  }`}
                >
                  {s.name}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Stage name & purpose */}
        <div className="mt-6 mb-5 border-l-[3px] border-signal pl-4">
          <h3 className="text-[26px] font-bold leading-tight text-ink-950">
            {stage.name}
          </h3>
          <p className="text-[15px] text-ink-700 mt-1.5 leading-relaxed max-w-[60ch]">
            {stage.purpose}
          </p>
        </div>

        {/* They may say */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="label">
              They may say
            </p>
            <span className="text-xs text-ink-400">Tap one to use it</span>
          </div>
          <div className="space-y-1.5">
            {stage.what_they_say.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setWords(q);
                  if (wordsRef.current) wordsRef.current.focus();
                }}
                className="w-full text-left rounded-lg2 border border-steel-200 bg-steel-50 hover:bg-white hover:border-navy-300 px-3.5 py-2.5 text-[14px] text-ink-800 leading-snug transition-colors cursor-pointer"
                title="Click to insert this quote into 'Their Words'"
              >
                <span>“{q}”</span>
              </button>
            ))}
          </div>
        </div>

        {/* What happened (2x2 Grid with Exact Reference Layout) */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="label">
              What happened
            </p>
            <span className="tnum text-xs text-steel-400">Keys 1–4</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stage.taps.map((t, i) => {
              const on = tap === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTap(t.key)}
                  className={`relative min-h-[56px] p-3 pr-7 rounded-lg2 border text-left text-[14px] font-medium leading-snug transition-colors group ${
                    on
                      ? "bg-navy text-white border-navy font-semibold"
                      : "bg-white text-ink-800 border-steel-300 hover:border-ink-500"
                  }`}
                >
                  <span
                    className={`absolute top-1.5 right-1.5 tnum text-xs px-1 rounded-2xs transition-all ${
                      on
                        ? "text-navy-100 bg-navy-700/60"
                        : "text-steel-400 bg-steel-100 group-hover:text-ink-600 group-hover:bg-steel-200"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Their words */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="label">
                Their words
              </p>
              {/* Hands-free Voice Dictation Button */}
              <button
                type="button"
                onClick={toggleDictation}
                className={`flex items-center gap-1 rounded-xs px-2 py-0.5 tnum text-xs font-bold transition-all shadow-2xs ${
                  isListening
                    ? "bg-rose-500 text-white animate-pulse border border-rose-600"
                    : "bg-steel-100 hover:bg-steel-200 text-ink-700 border border-steel-300"
                }`}
                title={isListening ? "Listening... click to stop" : "Speak to dictate prospect's quote hands-free"}
              >
                <span>{isListening ? "🔴 Listening…" : "🎤 Dictate"}</span>
              </button>
            </div>
            <button
              className="text-xs tnum font-bold text-navy hover:underline flex items-center gap-1"
              onClick={askCue}
              disabled={cueBusy}
            >
              {cueBusy && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-navy"></span>
                </span>
              )}
              {cueBusy ? "Gemini is thinking…" : "⚡ Ask AI cue"}
            </button>
          </div>
          <textarea
            ref={wordsRef}
            rows={2}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Type, click quotes above, or click 🎤 Dictate to speak..."
            className={`w-full rounded-xs border bg-white/90 backdrop-blur-xs px-3 py-2 text-[12.5px] text-ink-900 outline-none transition-all placeholder:text-steel-400 font-sans ${
              isListening
                ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/20"
                : "border-steel-300/90 focus:border-navy focus:ring-2 focus:ring-navy-500/15"
            }`}
          />
          {cue && (
            <div className="mt-2.5 rounded-lg border border-navy-200/90 bg-gradient-to-r from-navy-50/95 to-indigo-50/90 backdrop-blur-xs p-3 text-xs text-navy-950 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="tnum font-bold text-navy text-xs flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-navy"></span>
                  Spoken AI Cue
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleWhisperCue}
                    className={`flex items-center gap-1 tnum text-xs font-bold px-1.5 py-0.5 rounded-xs transition-all ${
                      isWhispering
                        ? "bg-navy-600 text-white animate-pulse"
                        : "bg-white text-navy-700 hover:bg-navy-100 border border-navy-200"
                    }`}
                    title={isWhispering ? "Whispering into ear... click to stop" : "Whisper cue into earpiece via Text-to-Speech"}
                  >
                    <span>{isWhispering ? "🔊 Whispering…" : "🔊 Whisper to Ear"}</span>
                  </button>
                  <span className="tnum text-xs text-navy-700 font-semibold bg-white/90 border border-navy-200 px-1.5 py-0.2 rounded-xs">
                    ⚡ Gemini Flash Lite
                  </span>
                </div>
              </div>
              <p className="font-medium text-ink-900 leading-relaxed text-[12px] pl-2.5 border-l-2 border-navy">
                “{cue.cue}”
              </p>
            </div>
          )}
        </div>

        {err && <p className="mt-2.5 text-xs text-rose-600 tnum">{err}</p>}

        {/* Actions */}
        <div className="mt-5 pt-3.5 border-t border-steel-200/60 flex gap-2.5">
          <button
            className="btn-primary flex-1 py-3.5 text-[15px]"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "Saving…" : next ? `Next: ${next.name}` : "Close the call"}
          </button>
          <button
            className="btn-ghost px-5 py-3.5 text-[15px] text-stop hover:border-stop"
            onClick={endCall}
            disabled={saving}
          >
            End call
          </button>
        </div>

      </div>

      {/* Side Companion Chatbot Phone Simulator */}
      {showSim && (
        <PhoneSimulator
          stageNo={stageNo}
          call={call}
          tick={tick}
          onInsertWords={(quote) => {
            setWords(quote);
            if (wordsRef.current) wordsRef.current.focus();
          }}
          onClose={() => setShowSim(false)}
        />
      )}

      {closing && (
        <CloseModal
          callId={callId}
          content={content}
          logs={logs}
          stageNo={stageNo}
          onCancel={() => setClosing(false)}
          onClosed={(data) => {
            setCall(data.call);
            setLogs(data.stage_logs || []);
            setClosed({ outcome: data.call.outcome, summary: data.call.ai_summary });
            setClosing(false);
          }}
        />
      )}
    </div>
  );
}

function CloseModal({ callId, content, logs, stageNo, onCancel, onClosed }) {
  const [outcome, setOutcome] = useState(() => suggestOutcome(logs));
  const [nextStep, setNextStep] = useState("");
  const [note, setNote] = useState("");
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api
        .audit(callId, { outcome, next_step: nextStep })
        .then((r) => live && setAudit(r))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [callId, outcome, nextStep]);

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      const data = await api.close(callId, { outcome, next_step: nextStep, note });
      onClosed(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-steel-200/60 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold tracking-tight">Close the call</h3>
            <span className="tnum text-xs text-navy font-bold">Stage {stageNo} of 8</span>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-steel-400 hover:bg-steel-100 hover:text-ink-700 transition-all"
            title="Close without saving (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed">
          You choose the outcome. Spindle checks it against what you tapped before saving.
        </p>

        <p className="tnum text-xs font-bold text-steel-400 mb-2 mt-4">Outcome</p>
        <div className="grid grid-cols-2 gap-1.5">
          {content.outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              className={`rounded-xs border px-3 py-2 text-left text-xs transition-all ${
                outcome === o.key
                  ? "border-navy bg-navy text-white font-bold shadow-xs"
                  : "border-steel-300/80 bg-white/80 text-ink-700 hover:border-ink-500 hover:bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="tnum text-xs font-bold text-steel-400 mb-1 mt-4">Next step</p>
        <input
          className="w-full rounded-xs border border-steel-300/90 bg-white/90 px-3 py-2 text-xs text-ink-900 outline-none focus:border-navy"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="e.g. Tuesday 14:00 Google Meet with MD"
        />

        <p className="tnum text-xs font-bold text-steel-400 mb-1 mt-3">Notes</p>
        <input
          className="w-full rounded-xs border border-steel-300/90 bg-white/90 px-3 py-2 text-xs text-ink-900 outline-none focus:border-navy"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />

        {audit && (
          <div
            className={`mt-4 rounded-xs border p-3 ${
              audit.warning
                ? "border-rose-300 bg-rose-50/90 text-rose-900"
                : "border-emerald-300 bg-emerald-50/90 text-emerald-900"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className={`tnum text-xs font-bold ${audit.warning ?"text-rose-700" : "text-emerald-700"}`}>
                {audit.warning ? "Audit: this does not match" : "Audit: consistent"}
              </span>
              <span className="tnum text-xs text-ink-500">{audit.source}</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {audit.warning || audit.summary}
            </p>
          </div>
        )}

        {err && <p className="mt-3 text-xs text-rose-600 tnum">{err}</p>}

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-steel-200/60">
          <button className="btn-ghost" onClick={onCancel}>
            Keep call open
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save and close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Closed({ call, content, onNew, onFinished }) {
  const outcome = content.outcomes.find((o) => o.key === call.outcome);

  useEffect(() => {
    localStorage.removeItem("spindle.currentCall");
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        onNew();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNew]);

  return (
    <div className="relative mx-auto max-w-[540px] rounded-2xl border border-white/80 bg-white/90 backdrop-blur-xl p-8 shadow-card text-center">
      <button
        onClick={onNew}
        className="absolute top-4 right-4 rounded-lg p-1.5 text-steel-400 hover:bg-steel-100 hover:text-ink-700 transition-all"
        title="Close & Start new call (Esc)"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="tnum text-xs font-bold text-navy">
        CALL CLOSED · {call.company_name}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">
        {call.prospect_name || "Unknown prospect"}
      </h1>
      <div
        className={`mt-3 inline-flex rounded-xs border px-3 py-1 tnum text-xs font-bold ${
          outcome?.tone === "good"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : outcome?.tone === "ok"
            ? "border-navy-300 bg-navy-50 text-navy"
            : "border-rose-300 bg-rose-50 text-rose-800"
        }`}
      >
        {outcome?.label || call.outcome}
      </div>

      <div className="mt-5 rounded-xs border border-steel-200/80 bg-steel-50/80 p-4 text-left">
        <p className="tnum text-xs font-bold text-steel-400 mb-1">
          WHAT A MANAGER READS
        </p>
        <p className="text-xs leading-relaxed text-ink-800 font-medium">{call.ai_summary}</p>
        {call.next_step && (
          <div className="mt-3 pt-3 border-t border-steel-200">
            <p className="tnum text-xs font-bold text-steel-400 mb-0.5">Next step</p>
            <p className="text-xs text-ink-900 font-bold">{call.next_step}</p>
          </div>
        )}
        {call.audit_warning && (
          <div className="mt-3 rounded-xs border border-rose-300 bg-rose-50 p-3 text-left">
            <p className="tnum text-xs font-bold text-rose-700 mb-0.5">Audit warning</p>
            <p className="text-xs text-rose-800 leading-relaxed font-medium">{call.audit_warning}</p>
          </div>
        )}
      </div>

      <p className="mt-4 tnum text-[11.5px] text-ink-500">
        Duration: <span className="font-bold text-ink-900">{call.duration_seconds}s</span> · reached <span className="font-bold text-navy">{call.highest_stage_name}</span> ·{" "}
        {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "no need quote"}
      </p>

      <div className="mt-6 flex justify-center gap-3">
        <button className="btn-ghost" onClick={onFinished}>
          See it in past calls
        </button>
        <button className="btn-primary" onClick={onNew}>
          + Next Call
        </button>
      </div>
    </div>
  );
}
