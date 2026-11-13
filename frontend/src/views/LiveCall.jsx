import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";

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

export default function LiveCall({ callId, content, onNew, onFinished }) {
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
        setClosed({ outcome: data.call.outcome, summary: data.call.ai_summary });
      }
    } catch (e) {
      setErr(e.message);
    }
  }, [callId]);

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
    setTap(stage.default_tap);
    setWords(existing?.prospect_words || "");
    setCue(existing?.ai_suggestion ? { cue: existing.ai_suggestion } : null);
    setErr("");
  }, [stageNo, stage, logs.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    await api.saveStage(callId, {
      stage_number: stageNo,
      what_happened: tap,
      prospect_words: words,
      ai_suggestion: cue?.cue || "",
    });
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
      <div className="grid place-items-center gap-4 py-24 text-slate-500">
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
    <div className="flex flex-col items-center">
      {/* Reference Card Container (Exact ClinicBooks reference layout elevated with modern depth) */}
      <div className="w-full max-w-[600px] rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-card text-ink-950 transition-all">
        
        {/* Top Reference Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#0047ff] animate-pulse" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#0047ff]">
              Meridian Growth Partners · Call Guide
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 font-mono text-sm font-bold text-ink-950 tabular-nums shadow-2xs">
            <span>⏱</span> {tick}
          </div>
        </div>

        {/* Prospect Title & Details */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold tracking-tight text-ink-950">
            {call.prospect_name || "Unknown prospect"}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-2">
            <span>{call.prospect_role || "Executive"}</span>
            <span>·</span>
            <span className="font-semibold text-ink-800">{call.company_name}</span>
            <span>·</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-mono uppercase text-slate-600 font-bold">
              {call.call_type}
            </span>
          </p>
        </div>

        {/* 8-Stage Square Stepper (Matches Reference Screen Exactly) */}
        <div className="grid grid-cols-8 gap-1.5 my-4">
          {stages.map((s) => {
            const now = s.number === stageNo;
            const past = s.number < stageNo;
            return (
              <button
                key={s.key}
                onClick={() => setStageNo(s.number)}
                className={`h-9 flex items-center justify-center font-mono text-xs font-bold rounded-lg border transition-all duration-150 ${
                  now
                    ? "bg-[#0047ff] text-white border-[#0047ff] shadow-sm shadow-blue-500/25 scale-[1.03]"
                    : past
                    ? "bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400"
                    : "bg-white text-slate-400 border-slate-200/80 hover:border-slate-300 hover:text-slate-600"
                }`}
              >
                {s.number}
              </button>
            );
          })}
        </div>

        {/* Stage Name & Glanceable Purpose */}
        <div className="mt-5 mb-5 rounded-xl bg-slate-50/70 border border-slate-100 p-4">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#0047ff]">
            Stage {stage.number} of 8
          </p>
          <h3 className="text-2xl font-bold tracking-tight text-ink-950 mt-0.5">
            {stage.name}
          </h3>
          <p className="text-[14px] text-slate-600 mt-1 leading-relaxed">
            {stage.purpose}
          </p>
        </div>

        {/* They May Say */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2.5">
            She may say / They may say
          </p>
          <div className="space-y-2">
            {stage.what_they_say.map((q, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200/80 bg-slate-50/60 px-3.5 py-2.5 text-[13px] text-slate-700 italic flex items-start gap-2 shadow-2xs"
              >
                <span className="text-slate-400 font-serif font-bold text-base leading-none">“</span>
                <span className="flex-1">{q}</span>
                <span className="text-slate-400 font-serif font-bold text-base leading-none">”</span>
              </div>
            ))}
          </div>
        </div>

        {/* What Happened (2x2 Grid with Blue Active Button) */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
              What happened
            </p>
            <span className="font-mono text-[10px] text-slate-400 bg-slate-100 rounded-sm px-1.5 py-0.5">
              Press 1–4
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {stage.taps.map((t, i) => {
              const on = tap === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTap(t.key)}
                  className={`p-3 rounded-lg border text-left text-[13px] transition-all duration-150 flex items-center justify-between ${
                    on
                      ? "bg-[#0047ff] text-white border-[#0047ff] font-semibold shadow-sm shadow-blue-500/20"
                      : "bg-white text-slate-700 border-slate-200/90 hover:border-slate-400 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <span>{t.label}</span>
                  {on && <span className="font-mono text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Their Words */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Her words / Their words
            </p>
            <button
              className="text-xs font-mono font-bold text-white bg-gradient-to-r from-[#0047ff] to-blue-700 px-3 py-1 rounded-md shadow-xs hover:shadow hover:brightness-110 flex items-center gap-1 transition-all"
              onClick={askCue}
              disabled={cueBusy}
            >
              <span>⚡</span>
              {cueBusy ? "Thinking…" : "AI Cue"}
            </button>
          </div>
          <textarea
            ref={wordsRef}
            rows={2}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Type exact words spoken by prospect..."
            className="w-full rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-ink-900 outline-none focus:border-[#0047ff] focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
          />
          {cue && (
            <div className="mt-2.5 rounded-lg border border-blue-200 bg-blue-50/90 p-3 text-xs text-blue-950 flex items-start gap-2 shadow-2xs">
              <span className="font-mono font-bold text-[#0047ff] uppercase">Cue:</span>
              <p className="flex-1 font-medium leading-relaxed">{cue.cue}</p>
            </div>
          )}
        </div>

        {err && <p className="mt-3 text-xs text-rose-600 font-mono">{err}</p>}

        {/* Action Buttons (Matches Reference Screen Exactly: Black Next + Outline End) */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
          <button
            className="flex-1 rounded-lg bg-ink-950 hover:bg-black text-white font-mono font-bold text-xs uppercase tracking-wider py-3.5 shadow-sm hover:shadow active:scale-[0.98] transition-all"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "Saving…" : next ? `Next: ${next.name} →` : "Close call →"}
          </button>
          <button
            className="px-6 rounded-lg border border-slate-200/90 hover:border-black text-ink-900 font-mono font-bold text-xs uppercase tracking-wider py-3.5 transition-all bg-white hover:bg-slate-50 active:scale-[0.98]"
            onClick={endCall}
            disabled={saving}
          >
            End call
          </button>
        </div>

      </div>

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
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-6 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[580px] rounded-2xl border border-slate-200/90 bg-white p-7 shadow-float text-ink-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-slate-100 pb-3.5">
          <h3 className="text-xl font-bold tracking-tight">Close the call</h3>
          <span className="font-mono text-xs text-[#0047ff] font-bold uppercase">Stage {stageNo} of 8</span>
        </div>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          The outcome is the caller's word. The audit checks it against the taps before
          the record is written to Supabase.
        </p>

        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-2 mt-5">Outcome</p>
        <div className="grid grid-cols-2 gap-2">
          {content.outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              className={`rounded-lg border px-3.5 py-2 text-left text-xs transition-all ${
                outcome === o.key
                  ? "border-[#0047ff] bg-[#0047ff] text-white font-semibold shadow-xs"
                  : "border-slate-200/90 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1.5 mt-5">Next step</p>
        <input
          className="w-full rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs text-ink-950 outline-none focus:border-[#0047ff] focus:ring-4 focus:ring-blue-500/10"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="e.g. Tuesday 14:00 Google Meet with MD"
        />

        <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-1.5 mt-3.5">Additional notes</p>
        <input
          className="w-full rounded-lg border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs text-ink-950 outline-none focus:border-[#0047ff] focus:ring-4 focus:ring-blue-500/10"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />

        {audit && (
          <div
            className={`mt-4 rounded-xl border p-3.5 ${
              audit.warning
                ? "border-rose-200 bg-rose-50/90 text-rose-900"
                : "border-emerald-200 bg-emerald-50/90 text-emerald-900"
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

        {err && <p className="mt-3 text-xs text-rose-600">{err}</p>}

        <div className="mt-6 flex justify-end gap-3 pt-3.5 border-t border-slate-100">
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
  return (
    <div className="mx-auto max-w-[620px] rounded-2xl border border-slate-200/90 bg-white p-8 sm:p-10 shadow-card text-center">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#0047ff]">
        Call closed · {call.company_name}
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-950">
        {call.prospect_name || "Unknown prospect"}
      </h1>
      <div
        className={`mt-3.5 inline-flex rounded-full border px-4 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
          outcome?.tone === "good"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : outcome?.tone === "ok"
            ? "border-blue-300 bg-blue-50 text-[#0047ff]"
            : "border-rose-300 bg-rose-50 text-rose-800"
        }`}
      >
        {outcome?.label || call.outcome}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/70 p-5 text-left">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          What a manager reads (CRM Summary)
        </p>
        <p className="text-sm leading-relaxed text-ink-900 font-medium">{call.ai_summary}</p>
        {call.next_step && (
          <div className="mt-3.5 pt-3.5 border-t border-slate-200">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Next step agreed</p>
            <p className="text-xs text-ink-800 font-semibold">{call.next_step}</p>
          </div>
        )}
        {call.audit_warning && (
          <div className="mt-3.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-left">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-1">Audit warning</p>
            <p className="text-xs text-rose-800 leading-relaxed font-medium">{call.audit_warning}</p>
          </div>
        )}
      </div>

      <p className="mt-5 font-mono text-xs text-slate-500">
        Duration: <span className="font-bold text-ink-800">{call.duration_seconds}s</span> · reached <span className="font-bold text-[#0047ff]">{call.highest_stage_name}</span> ·{" "}
        {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "no need quote"}
      </p>

      <div className="mt-8 flex justify-center gap-3.5">
        <button className="btn-ghost" onClick={onFinished}>
          See it in past calls
        </button>
        <button className="btn-primary" onClick={onNew}>
          + Next call
        </button>
      </div>
    </div>
  );
}
