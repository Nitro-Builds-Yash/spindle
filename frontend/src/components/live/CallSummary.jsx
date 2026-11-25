import React, { useEffect } from "react";

export default function CallSummary({ call, content, onNew, onFinished }) {
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
