import React, { useEffect } from "react";

const TONE = { good: "badge badge-good", ok: "badge badge-ok", bad: "badge badge-bad" };

function duration(s) {
  const n = Number(s) || 0;
  return n >= 60 ? `${Math.floor(n / 60)} min ${n % 60} s` : `${n} s`;
}

/** Shown once a call is saved: what was recorded, and where to go next. */
export default function CallSummary({ call, content, onNew, onFinished }) {
  const outcome = content.outcomes.find((o) => o.key === call.outcome);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onNew();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNew]);

  return (
    <div className="mx-auto max-w-[560px] overflow-hidden rounded-xl2 bg-white shadow-float">
      <div className="bg-navy-900 px-7 pt-6 pb-5 text-white">
        <p className="text-sm text-navy-200">Call saved{call.company_name ? `, ${call.company_name}` : ""}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight">{call.prospect_name || "Unknown prospect"}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-navy-200">
          <span className={TONE[outcome?.tone] || "badge"}>{outcome?.label || call.outcome}</span>
          <span className="tnum">{duration(call.duration_seconds)}</span>
          <span aria-hidden>|</span>
          <span>Reached {call.highest_stage_name}</span>
        </div>
      </div>

      <div className="px-7 py-6 space-y-4">
        <div>
          <p className="label mb-1">What a manager reads</p>
          <p className="text-[15px] leading-relaxed text-ink-900">{call.ai_summary}</p>
        </div>
        {call.next_step && (
          <div>
            <p className="label mb-1">Next step</p>
            <p className="text-[15px] font-semibold text-ink-950">{call.next_step}</p>
          </div>
        )}
        {call.stage5_need_quote && (
          <div>
            <p className="label mb-1">Their need, in their words</p>
            <p className="text-[15px] italic text-ink-800">“{call.stage5_need_quote}”</p>
          </div>
        )}
        {call.audit_warning && (
          <div className="rounded-lg2 border border-stop/30 bg-stop-soft px-4 py-3">
            <p className="text-sm font-semibold text-stop">Check this record</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-800">{call.audit_warning}</p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 border-t border-steel-200 pt-5">
          <button className="btn-ghost" onClick={onFinished}>
            See it in past calls
          </button>
          <button className="btn-primary" onClick={onNew} title="Esc">
            Start the next call
          </button>
        </div>
      </div>
    </div>
  );
}
