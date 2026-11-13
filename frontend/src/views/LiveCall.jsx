import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import PhoneSimulator from "../components/PhoneSimulator.jsx";

function clock(startedAt) {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
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
  const wordsRef = useRef(null);

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
        if (onClear) onClear();
        localStorage.removeItem("spindle.currentCall");
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
      <div className="grid place-items-center gap-4 py-24 text-slate-500 font-mono text-sm">
        <p>{err}</p>
        <button className="btn-primary" onClick={onNew}>
          Start a new call
        </button>
      </div>
    );
  }
  if (!call) return <div className="py-24 text-center text-slate-500 font-mono text-sm">Loading call…</div>;

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
      
      {/* Subtle Background Glow Orbs for Glassmorphism */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[750px] h-[400px] bg-gradient-to-tr from-blue-400/15 via-indigo-300/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Reference Card Container (Exact ClinicBooks reference layout with modern frosted glass) */}
      <div className="w-full max-w-[500px] rounded-2xl border border-white/70 bg-white/85 backdrop-blur-xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(8,112,184,0.08),0_1px_3px_rgba(0,0,0,0.05)] text-slate-900 transition-all shrink-0">
        
        {/* Top Reference Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#0047ff]">
            SPINDLE · CALL GUIDE
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNew}
              className="rounded-xs px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all"
              title="Start a new cold call"
            >
              + New Call
            </button>
            <button
              type="button"
              onClick={() => setShowSim(!showSim)}
              className={`rounded-xs px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider transition-all ${
                showSim
                  ? "bg-blue-50 text-[#0047ff] border border-blue-200/90 shadow-2xs"
                  : "bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200"
              }`}
              title="Toggle Simulated Prospect Phone Chatbot"
            >
              Sim Phone {showSim ? "ON" : "OFF"}
            </button>
            <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
              {tick}
            </span>
          </div>
        </div>

        {/* Prospect Title & Details */}
        <div className="mb-3.5">
          <h2 className="text-[19px] font-bold tracking-tight text-slate-900">
            {call.prospect_name || "Unknown prospect"}
          </h2>
          <p className="text-[11.5px] text-slate-500 font-medium mt-0.5">
            {[call.prospect_role, call.company_name, call.call_type]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* 8-Stage Square Stepper (Exact 1:1 match with ClinicBooks Reference) */}
        <div className="grid grid-cols-8 gap-1.5 my-3">
          {stages.map((s) => {
            const now = s.number === stageNo;
            const past = s.number < stageNo;
            return (
              <button
                key={s.key}
                onClick={() => setStageNo(s.number)}
                className={`h-8 flex items-center justify-center font-mono text-xs font-bold rounded-xs border transition-all ${
                  now
                    ? "bg-[#0047ff] text-white border-[#0047ff] shadow-sm shadow-blue-500/30"
                    : past
                    ? "bg-[#0b132b] text-white border-[#0b132b]"
                    : "bg-white/80 text-slate-400 border-slate-200 hover:border-slate-400"
                }`}
              >
                {s.number}
              </button>
            );
          })}
        </div>

        {/* Stage Name & Glanceable Purpose */}
        <div className="mt-4 mb-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            STAGE {stage.number} OF 8
          </p>
          <h3 className="text-[22px] font-bold tracking-tight text-slate-900 mt-0.5">
            {stage.name}
          </h3>
          <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">
            {stage.purpose}
          </p>
        </div>

        {/* THEY MAY SAY */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              THEY MAY SAY
            </p>
            <span className="font-mono text-[9px] text-slate-400">Click to insert</span>
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
                className="w-full text-left rounded-xs border border-slate-200/80 bg-white/70 hover:bg-blue-50/50 hover:border-blue-300 backdrop-blur-xs px-3 py-2 text-[12.5px] text-slate-800 leading-snug shadow-2xs transition-all cursor-pointer group"
                title="Click to insert this quote into 'Their Words'"
              >
                <span>“{q}”</span>
              </button>
            ))}
          </div>
        </div>

        {/* WHAT HAPPENED (2x2 Grid with Exact Reference Layout) */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              WHAT HAPPENED
            </p>
            <span className="font-mono text-[9px] text-slate-400 uppercase">Keys 1–4</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stage.taps.map((t, i) => {
              const on = tap === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTap(t.key)}
                  className={`p-3 rounded-xs border text-center text-[12px] font-medium transition-all ${
                    on
                      ? "bg-[#0047ff] text-white border-[#0047ff] font-bold shadow-md shadow-blue-500/25"
                      : "bg-white/80 backdrop-blur-xs text-slate-800 border-slate-300/80 hover:border-slate-500 hover:bg-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* THEIR WORDS */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              THEIR WORDS
            </p>
            <button
              className="text-[11px] font-mono font-bold text-[#0047ff] hover:underline"
              onClick={askCue}
              disabled={cueBusy}
            >
              {cueBusy ? "Thinking…" : "Ask AI cue"}
            </button>
          </div>
          <textarea
            ref={wordsRef}
            rows={2}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Type exact words spoken by prospect..."
            className="w-full rounded-xs border border-slate-300/90 bg-white/90 backdrop-blur-xs px-3 py-2 text-[12.5px] text-slate-900 outline-none focus:border-[#0047ff] focus:ring-2 focus:ring-blue-500/15 transition-all placeholder:text-slate-400"
          />
          {cue && (
            <div className="mt-2 rounded-xs border border-blue-200 bg-blue-50/90 backdrop-blur-xs p-2.5 text-xs text-blue-950 flex items-start gap-2 shadow-2xs">
              <span className="font-mono font-bold text-[#0047ff] uppercase text-[10px]">Cue:</span>
              <p className="flex-1 font-medium leading-relaxed text-[11.5px]">{cue.cue}</p>
            </div>
          )}
        </div>

        {err && <p className="mt-2.5 text-xs text-rose-600 font-mono">{err}</p>}

        {/* Action Buttons (Matches Reference Screen Exactly: Black Next + Outline End) */}
        <div className="mt-5 pt-3.5 border-t border-slate-200/60 flex gap-2.5">
          <button
            className="flex-1 rounded-xs bg-[#0b132b] hover:bg-black text-white font-mono font-bold text-xs uppercase tracking-wider py-3 shadow-sm hover:shadow active:scale-[0.98] transition-all"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "Saving…" : next ? `NEXT: ${next.name.toUpperCase()}` : "CLOSE CALL"}
          </button>
          <button
            className="px-6 rounded-xs border border-slate-300/90 hover:border-black text-slate-800 font-mono font-bold text-xs uppercase tracking-wider py-3 transition-all bg-white/80 hover:bg-white active:scale-[0.98]"
            onClick={endCall}
            disabled={saving}
          >
            END CALL
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
            if (onClear) onClear();
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
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold tracking-tight">Close the call</h3>
            <span className="font-mono text-xs text-[#0047ff] font-bold uppercase">Stage {stageNo} of 8</span>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
            title="Close without saving (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          The outcome is the caller's word. The audit checks it against the taps before
          the record is written to Supabase.
        </p>

        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2 mt-4">OUTCOME</p>
        <div className="grid grid-cols-2 gap-1.5">
          {content.outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              className={`rounded-xs border px-3 py-2 text-left text-xs transition-all ${
                outcome === o.key
                  ? "border-[#0047ff] bg-[#0047ff] text-white font-bold shadow-xs"
                  : "border-slate-300/80 bg-white/80 text-slate-700 hover:border-slate-500 hover:bg-white"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1 mt-4">NEXT STEP</p>
        <input
          className="w-full rounded-xs border border-slate-300/90 bg-white/90 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0047ff]"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="e.g. Tuesday 14:00 Google Meet with MD"
        />

        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1 mt-3">ADDITIONAL NOTES</p>
        <input
          className="w-full rounded-xs border border-slate-300/90 bg-white/90 px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#0047ff]"
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
              <span className={`font-mono text-xs font-bold uppercase tracking-wider ${audit.warning ? "text-rose-700" : "text-emerald-700"}`}>
                {audit.warning ? "Audit: this does not match" : "Audit: consistent"}
              </span>
              <span className="font-mono text-[10px] text-slate-500">{audit.source}</span>
            </div>
            <p className="text-xs leading-relaxed font-medium">
              {audit.warning || audit.summary}
            </p>
          </div>
        )}

        {err && <p className="mt-3 text-xs text-rose-600 font-mono">{err}</p>}

        <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-200/60">
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
        className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
        title="Close & Start new call (Esc)"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#0047ff]">
        CALL CLOSED · {call.company_name}
      </p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {call.prospect_name || "Unknown prospect"}
      </h1>
      <div
        className={`mt-3 inline-flex rounded-xs border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
          outcome?.tone === "good"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : outcome?.tone === "ok"
            ? "border-blue-300 bg-blue-50 text-[#0047ff]"
            : "border-rose-300 bg-rose-50 text-rose-800"
        }`}
      >
        {outcome?.label || call.outcome}
      </div>

      <div className="mt-5 rounded-xs border border-slate-200/80 bg-slate-50/80 p-4 text-left">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          WHAT A MANAGER READS
        </p>
        <p className="text-xs leading-relaxed text-slate-800 font-medium">{call.ai_summary}</p>
        {call.next_step && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">NEXT STEP</p>
            <p className="text-xs text-slate-900 font-bold">{call.next_step}</p>
          </div>
        )}
        {call.audit_warning && (
          <div className="mt-3 rounded-xs border border-rose-300 bg-rose-50 p-3 text-left">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-0.5">AUDIT WARNING</p>
            <p className="text-xs text-rose-800 leading-relaxed font-medium">{call.audit_warning}</p>
          </div>
        )}
      </div>

      <p className="mt-4 font-mono text-[11.5px] text-slate-500">
        Duration: <span className="font-bold text-slate-900">{call.duration_seconds}s</span> · reached <span className="font-bold text-[#0047ff]">{call.highest_stage_name}</span> ·{" "}
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
