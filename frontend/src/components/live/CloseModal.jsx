import React, { useEffect, useState } from "react";
import { api } from "../../api";
import { CALLBACK_OUTCOMES, localSlot, localToIsoWithOffset, suggestOutcome } from "../../lib/call.js";

export default function CloseModal({ callId, content, logs, stageNo, onCancel, onClosed }) {
  const [outcome, setOutcome] = useState(() => suggestOutcome(logs));
  const [nextStep, setNextStep] = useState("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
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
      const data = await api.close(callId, {
        outcome,
        next_step: nextStep,
        note,
        follow_up_at: CALLBACK_OUTCOMES.has(outcome) ? localToIsoWithOffset(followUp) : null,
      });
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
        className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto rounded-xl2 bg-white p-6 sm:p-7 shadow-float text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-steel-200/60 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">Close the call</h3>
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

        <p className="label mb-2 mt-4">Outcome</p>
        <div className="grid grid-cols-2 gap-1.5">
          {content.outcomes.map((o) => (
            <button
              key={o.key}
              onClick={() => setOutcome(o.key)}
              className={`rounded-lg2 border px-3 py-2 text-left text-sm transition-colors ${
                outcome === o.key
                  ? "border-navy bg-navy text-white font-semibold"
                  : "border-steel-300 bg-white text-ink-700 hover:border-ink-500"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <p className="label mb-1 mt-4">Next step</p>
        <input
          className="input py-2 text-sm"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="e.g. Tuesday 14:00 Google Meet with MD"
        />

        {CALLBACK_OUTCOMES.has(outcome) && (
          <div className="mt-3">
            <label htmlFor="follow-up-at" className="label block mb-1">Call back on</label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="follow-up-at"
                type="datetime-local"
                className="input w-auto py-2 text-sm"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
              />
              {[["Tomorrow 11:00", 1, 11], ["In 2 days", 2, 11], ["Next week", 7, 11]].map(([label, d, h]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFollowUp(localSlot(d, h))}
                  className="rounded-full border border-steel-300 px-3 py-1 text-sm text-ink-700 hover:border-navy hover:text-navy"
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-500">Shows up under Follow-ups in Past calls, and you can add it to your calendar.</p>
          </div>
        )}

        <p className="label mb-1 mt-3">Notes</p>
        <input
          className="input py-2 text-sm"
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
