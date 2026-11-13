import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${time}`;
}

const toneClass = {
  good: "badge badge-good",
  ok: "badge badge-ok",
  bad: "badge badge-bad",
};

export default function History({ content, onOpen, onNew }) {
  const [calls, setCalls] = useState(null);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  const [openId, setOpenId] = useState(
    () => new URLSearchParams(window.location.search).get("open") || null
  );

  useEffect(() => {
    api
      .listCalls()
      .then((d) => setCalls(d.calls))
      .catch((e) => setErr(e.message));
    api.stats().then(setStats).catch(() => {});
  }, []);

  const outcomeByKey = useMemo(
    () => Object.fromEntries(content.outcomes.map((o) => [o.key, o])),
    [content]
  );
  const stageName = (n) => content.stages.find((s) => s.number === n)?.name || `Stage ${n}`;
  const tapLabel = (log) => {
    const stage = content.stages.find((s) => s.number === Number(log.stage_number));
    return (
      stage?.taps.find((t) => t.key === log.what_happened)?.label ||
      String(log.what_happened).replace(/_/g, " ")
    );
  };

  if (err) return <div className="py-20 text-center text-rose-600 font-mono text-sm">{err}</div>;
  if (!calls) return <div className="py-20 text-center text-slate-500 font-mono text-sm">Loading past calls…</div>;

  const selected = calls.find((c) => c.id === openId);
  const byStage = stats?.ended_by_stage || {};
  const peak = Math.max(1, ...Object.values(byStage));

  return (
    <div className="flex flex-col gap-6 max-w-[960px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-4">
        <div>
          <p className="eyebrow">The Second Screen</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0f172a]">Past calls</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            After a call is saved it appears here with the stage it reached. A list like this is how a caller sees where their calls end.
          </p>
        </div>
        <button className="btn-primary" onClick={onNew}>
          + New call
        </button>
      </div>

      {/* Analytics Snapshot Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_200px_1fr]">
        <div className="card flex flex-col justify-center p-4">
          <span className="font-mono text-3xl font-bold text-[#0f172a] leading-none">{stats?.calls ?? calls.length}</span>
          <span className="label mt-1">Total calls</span>
        </div>
        <div className="card flex flex-col justify-center p-4">
          <span className="font-mono text-3xl font-bold text-[#0047ff] leading-none">
            {Math.round((stats?.connect_rate || 0) * 100)}%
          </span>
          <span className="label mt-1">Reached right person</span>
        </div>
        <div className="card p-4">
          <span className="label">Where calls ended</span>
          <div className="mt-2 grid grid-cols-8 items-end gap-1.5 border-b border-slate-200 pb-1">
            {Object.entries(byStage).map(([n, c]) => (
              <div key={n} className="grid h-[52px] grid-rows-[12px_1fr_11px] items-end justify-items-center gap-0.5">
                <span className="font-mono text-[9px] text-slate-500 font-bold">{c || ""}</span>
                <div
                  className="w-1/2 max-w-[24px] self-end rounded-xs bg-[#0047ff]"
                  style={{ height: `${c ? Math.max(8, (c / peak) * 100) : 0}%` }}
                />
                <span className="font-mono text-[9px] text-slate-500 font-semibold">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reference Card List (Matches ClinicBooks Past Calls Exactly) */}
      {calls.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 font-mono text-sm">
          No calls recorded yet. Click "+ New call" above to start your first cold call!
        </div>
      ) : (
        <div className="space-y-2.5">
          {calls.map((c) => {
            const outcome = outcomeByKey[c.outcome];
            const live = c.status === "in_progress";
            return (
              <div
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="rounded-md border border-slate-300 bg-white p-4 hover:border-[#0f172a] hover:shadow-xs transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#0f172a] tracking-tight">
                      {c.prospect_name || "Unknown prospect"}
                      {c.company_name ? `, ${c.company_name}` : ""}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                      {c.next_step || c.ai_summary || "No notes logged for this call."}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0047ff]">
                      {c.highest_stage_name}
                    </span>
                    <p className="font-mono text-[10.5px] text-slate-500 mt-0.5 font-medium">
                      {when(c.started_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <Drawer
          call={selected}
          content={content}
          onClose={() => setOpenId(null)}
          onResume={() => onOpen(selected.id)}
          when={when}
          tapLabel={tapLabel}
          stageName={stageName}
          outcome={outcomeByKey[selected.outcome]}
        />
      )}
    </div>
  );
}

function Drawer({ call, content, onClose, onResume, when, tapLabel, stageName, outcome }) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[540px] flex-col overflow-y-auto border-l border-slate-300 bg-white shadow-2xl text-[#0f172a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="eyebrow">{when(call.started_at)}</p>
            <h2 className="mt-1 text-lg font-bold">
              {call.prospect_name || "Unknown"}
            </h2>
            <p className="text-xs text-slate-500">
              {[call.prospect_role, call.company_name, call.call_type].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={toneClass[outcome?.tone] || "badge"}>
              {outcome?.label || call.outcome || "in progress"}
            </span>
            <span className="badge">
              Stage {call.highest_stage_reached}/8 · {call.highest_stage_name}
            </span>
            <span className="badge font-mono">{call.duration_seconds}s</span>
            {call.status === "in_progress" && (
              <button className="text-xs font-mono font-bold text-[#0047ff] ml-auto hover:underline" onClick={onResume}>
                Resume call →
              </button>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
            <p className="label mb-1">AI 1-line CRM summary</p>
            <p className="text-xs text-slate-800 leading-relaxed font-medium">
              {call.ai_summary || "No summary written."}
            </p>
          </div>

          {call.next_step && (
            <div className="rounded-md border border-slate-200 p-3">
              <p className="label mb-1">Next step agreed</p>
              <p className="text-xs text-[#0f172a] font-semibold">{call.next_step}</p>
            </div>
          )}

          {call.audit_warning && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3">
              <p className="label mb-1 text-rose-700 font-bold">Audit inconsistency note</p>
              <p className="text-xs text-rose-800 leading-relaxed font-medium">
                {call.audit_warning}
              </p>
            </div>
          )}

          <div className="rounded-md border border-slate-200 p-3">
            <p className="label mb-1">Prospect's exact words (Stage 5 Need Quote)</p>
            <p className="text-xs italic text-slate-800">
              {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "Nothing captured."}
            </p>
          </div>

          <div>
            <p className="label mb-2">Stage-by-stage progression</p>
            <div className="space-y-2">
              {(call.stage_logs || []).map((l) => (
                <div key={l.id} className="grid grid-cols-[24px_1fr] gap-2 rounded-sm border border-slate-200 p-2.5 bg-slate-50/50">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {String(l.stage_number).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#0047ff] font-semibold">
                      {stageName(Number(l.stage_number))}
                    </div>
                    <div className="text-xs font-semibold text-[#0f172a] mt-0.5">{tapLabel(l)}</div>
                    {l.prospect_words && (
                      <div className="mt-1 text-[11.5px] italic text-slate-600 border-l-2 border-slate-300 pl-2">
                        “{l.prospect_words}”
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(call.stage_logs || []).length === 0 && (
                <p className="text-xs text-slate-400 font-mono">No stage logs saved.</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
