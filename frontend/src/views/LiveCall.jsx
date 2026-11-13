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
      setLogs((prev) => prev);
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

  // On entering a stage: the fourth tap is pre-selected, and any words already
  // saved for that stage come back. One tap, one box, nothing else.
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
      <div className="grid place-items-center gap-4 py-24 text-muted">
        <p>{err}</p>
        <button className="btn-primary" onClick={onNew}>
          Start a new call
        </button>
      </div>
    );
  }
  if (!call) return <div className="py-24 text-center text-muted">Loading call…</div>;

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

  const progress = stageNo;

  return (
    <div className="flex flex-col gap-5">
      {/* Header: who you are calling, the clock, and a way out from anywhere. */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Meridian Growth Partners · Call Guide</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight">
            {call.prospect_name || "Unknown prospect"}
          </h2>
          <p className="text-[13px] text-muted">
            {[call.prospect_role, call.company_name, call.call_type]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[20px] tabular-nums">{tick}</span>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={endCall}>
            End call
          </button>
        </div>
      </div>

      {/* The eight stages, and where the caller is. */}
      <div className="mx-auto grid w-full max-w-[880px] grid-cols-8 gap-1 border-b border-line pb-3">
        {stages.map((s) => {
          const now = s.number === stageNo;
          const past = s.number < progress;
          return (
            <button
              key={s.key}
              onClick={() => setStageNo(s.number)}
              className={`border-t-2 px-1 pt-2 text-left transition-colors ${
                now
                  ? "border-accent text-[#e9ebee]"
                  : past
                  ? "border-good/50 text-muted hover:text-[#e9ebee]"
                  : "border-line text-faint hover:text-muted"
              }`}
            >
              <span className={`block font-mono text-[11px] ${now ? "text-accent" : ""}`}>
                {s.number}
              </span>
              <span className={`block text-[11.5px] leading-tight ${now ? "font-semibold" : ""}`}>
                {s.name}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-[880px]">
        <section className="card px-6 py-6">
          <p className="label">Stage {stage.number} of 8</p>
          <h3 className="mt-2 text-[26px] font-semibold tracking-tight">{stage.name}</h3>
          <p className="mt-2 max-w-[62ch] text-[17px] leading-relaxed text-[#d5d9de]">
            {stage.purpose}
          </p>

          <div className="mt-6 border-t border-hair pt-5">
            <p className="label mb-3">They may say</p>
            <ul className="space-y-2">
              {stage.what_they_say.map((q) => (
                <li key={q} className="text-[15px] leading-snug text-muted">
                  “{q}”
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-hair pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="label">What happened</p>
              <span className="text-[10px] text-faint">keys 1–{stage.taps.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {stage.taps.map((t, i) => {
                const on = tap === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTap(t.key)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors ${
                      on
                        ? "border-accent bg-accent/10 text-[#e9ebee]"
                        : "border-line bg-[#0b0e11] text-[#d5d9de] hover:border-[#363d47]"
                    }`}
                  >
                    <span
                      className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[4px] font-mono text-[10px] ${
                        on ? "bg-accent text-[#1d1405]" : "bg-line text-faint"
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

          <div className="mt-6 border-t border-hair pt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="label">Their words</p>
              <button className="btn-link" onClick={askCue} disabled={cueBusy}>
                {cueBusy ? "thinking…" : "AI cue"}
              </button>
            </div>
            <textarea
              ref={wordsRef}
              rows={3}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder="Type it as they say it. This is the only free text on the screen."
              className="input resize-y leading-relaxed"
            />
            {cue && (
              <div className="mt-3 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="label text-accent">AI cue</span>
                  <span className="font-mono text-[10px] text-faint">{cue.source}</span>
                </div>
                <p className="text-[14.5px] leading-snug">{cue.cue}</p>
              </div>
            )}
          </div>

          {err && <p className="mt-4 text-[12.5px] text-bad">{err}</p>}

          <div className="mt-7 flex items-center justify-end gap-2.5 border-t border-hair pt-5">
            <button className="btn-ghost" onClick={endCall} disabled={saving}>
              End call
            </button>
            <button className="btn-primary px-6" onClick={goNext} disabled={saving}>
              {saving ? "Saving…" : next ? `Next: ${next.name} →` : "Close call →"}
            </button>
          </div>
        </section>

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

function tapLabel(content, log) {
  const stage = content.stages.find((s) => s.number === Number(log.stage_number));
  const t = stage?.taps.find((x) => x.key === log.what_happened);
  return t?.label || String(log.what_happened).replace(/_/g, " ");
}

function CloseModal({ callId, content, logs, stageNo, onCancel, onClosed }) {
  const [outcome, setOutcome] = useState(() => suggestOutcome(logs));
  const [nextStep, setNextStep] = useState("");
  const [note, setNote] = useState("");
  const [audit, setAudit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Audit is a preview, not a save: it runs whenever the choice changes, so the
  // caller sees the contradiction before the record is written.
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
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-[620px] rounded-xl2 border border-line bg-panel p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Close the call</h3>
          <span className="label">Stage {stageNo} of 8</span>
        </div>
        <p className="mt-1 text-[12.5px] text-muted">
          The outcome is the caller's word. The audit checks it against the taps before
          the record is written.
        </p>

        <p className="label mb-2 mt-5">Outcome</p>
        <div className="grid grid-cols-2 gap-1.5">
          {content.outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              className={`rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors ${
                outcome === o.key
                  ? "border-accent bg-accent/10 text-[#e9ebee]"
                  : "border-line bg-[#0b0e11] text-muted hover:border-[#363d47]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="label mb-2 mt-5">Next step</p>
        <input
          className="input"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="Tuesday 11:00, plant visit with the MD"
        />

        <p className="label mb-2 mt-4">Anything else for the record</p>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional"
        />

        {audit && (
          <div
            className={`mt-5 rounded-lg border px-3.5 py-3 ${
              audit.warning
                ? "border-bad/40 bg-bad/[0.07]"
                : "border-good/30 bg-good/[0.05]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className={`label ${audit.warning ? "text-bad" : "text-good"}`}>
                {audit.warning ? "Audit: this does not match" : "Audit: consistent"}
              </span>
              <span className="font-mono text-[10px] text-faint">{audit.source}</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-[#d5d9de]">
              {audit.warning || audit.summary}
            </p>
          </div>
        )}

        {err && <p className="mt-3 text-[12.5px] text-bad">{err}</p>}

        <div className="mt-6 flex justify-end gap-2.5">
          <button className="btn-ghost" onClick={onCancel}>
            Keep the call open
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
    <div className="mx-auto max-w-[720px] py-10 text-center">
      <p className="eyebrow">Call closed · {call.company_name}</p>
      <h1 className="mt-2 text-[30px] font-semibold tracking-tight">
        {call.prospect_name || "Unknown prospect"}
      </h1>
      <div
        className={`mt-4 inline-flex rounded-full border px-4 py-1.5 text-[13px] font-semibold ${
          outcome?.tone === "good"
            ? "border-good/35 bg-good/10 text-good"
            : outcome?.tone === "ok"
            ? "border-ok/30 bg-ok/[0.08] text-ok"
            : "border-bad/30 bg-bad/[0.08] text-bad"
        }`}
      >
        {outcome?.label || call.outcome}
      </div>

      <div className="card mt-6 p-5 text-left">
        <p className="label mb-2">What a manager reads</p>
        <p className="text-[15.5px] leading-relaxed">{call.ai_summary}</p>
        {call.next_step && (
          <>
            <p className="label mb-2 mt-4">Next step</p>
            <p className="text-[14px] text-muted">{call.next_step}</p>
          </>
        )}
        {call.audit_warning && (
          <div className="mt-4 rounded-lg border border-bad/40 bg-bad/[0.07] px-3.5 py-3 text-left">
            <p className="label mb-1 text-bad">Audit warning</p>
            <p className="text-[12.5px] leading-relaxed text-[#d5d9de]">{call.audit_warning}</p>
          </div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-muted">
        {call.duration_seconds}s · reached {call.highest_stage_name} ·{" "}
        {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "no need quote"}
      </p>

      <div className="mt-6 flex justify-center gap-2.5">
        <button className="btn-ghost" onClick={onFinished}>
          See it in past calls
        </button>
        <button className="btn-primary" onClick={onNew}>
          Next call
        </button>
      </div>
    </div>
  );
}
