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

  if (err) return <div className="py-20 text-center text-muted">{err}</div>;
  if (!calls) return <div className="py-20 text-center text-muted">Loading calls…</div>;

  const selected = calls.find((c) => c.id === openId);
  const byStage = stats?.ended_by_stage || {};
  const peak = Math.max(1, ...Object.values(byStage));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">After the call</p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">Past calls</h1>
          <p className="text-[13px] text-muted">
            Every call, the highest stage it reached, and the outcome as logged.
          </p>
        </div>
        <button className="btn-primary" onClick={onNew}>
          New call
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[130px_200px_1fr]">
        <div className="card flex flex-col gap-0.5 p-3.5">
          <span className="font-mono text-[24px] leading-none">{stats?.calls ?? calls.length}</span>
          <span className="label">calls</span>
        </div>
        <div className="card flex flex-col gap-0.5 p-3.5">
          <span className="font-mono text-[24px] leading-none">
            {Math.round((stats?.connect_rate || 0) * 100)}%
          </span>
          <span className="label">reached the right person</span>
        </div>
        <div className="card p-3.5">
          <span className="label">Where calls ended</span>
          <div className="mt-2 grid grid-cols-8 items-end gap-1.5 border-b border-line pb-1">
            {Object.entries(byStage).map(([n, c]) => (
              <div key={n} className="grid h-[52px] grid-rows-[12px_1fr_11px] items-end justify-items-center gap-0.5">
                <span className="font-mono text-[9px] text-faint">{c || ""}</span>
                <div
                  className="w-1/2 max-w-[26px] self-end rounded-t-sm bg-gradient-to-b from-accent to-accent/30"
                  style={{ height: `${c ? Math.max(6, (c / peak) * 100) : 0}%` }}
                />
                <span className="font-mono text-[9px] text-faint">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="grid place-items-center gap-3 py-20 text-muted">
          <p>No calls yet.</p>
          <button className="btn-primary" onClick={onNew}>
            Start a call
          </button>
        </div>
      ) : (
        <ul className="border-t border-line">
          {calls.map((c) => {
            const outcome = outcomeByKey[c.outcome];
            const live = c.status === "in_progress";
            return (
              <li key={c.id} className="border-b border-hair">
                <button
                  onClick={() => setOpenId(c.id)}
                  className="grid w-full grid-cols-1 items-center gap-2 px-3 py-3.5 text-left hover:bg-white/[0.015] sm:grid-cols-[minmax(0,1fr)_220px_132px] sm:gap-5"
                >
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold">
                      {c.prospect_name || "No name"}
                      {c.company_name ? `, ${c.company_name}` : ""}
                    </div>
                    <div className="truncate text-[12.5px] italic text-muted">
                      {c.ai_summary || "No summary."}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {live ? (
                      <span className="badge badge-live">on the phone</span>
                    ) : (
                      <span className={toneClass[outcome?.tone] || "badge"}>
                        {outcome?.label || c.outcome || "closed"}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-[12px] text-muted">
                      <span className="font-mono text-[10.5px] text-faint">
                        {c.highest_stage_reached}/8
                      </span>{" "}
                      {c.highest_stage_name}
                    </span>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[11.5px] text-faint sm:text-right">
                    {when(c.started_at)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-y-auto border-l border-line bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel px-6 py-5">
          <div>
            <p className="eyebrow">{when(call.started_at)}</p>
            <h2 className="mt-1 text-[19px] font-semibold">
              {call.prospect_name || "No name"}
            </h2>
            <p className="text-[12.5px] text-muted">
              {[call.prospect_role, call.company_name, call.call_type].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={toneClass[outcome?.tone] || "badge"}>
              {outcome?.label || call.outcome || "in progress"}
            </span>
            <span className="badge">
              {call.highest_stage_reached}/8 · {call.highest_stage_name}
            </span>
            <span className="badge">{call.duration_seconds}s</span>
            {call.status === "in_progress" && (
              <button className="btn-link ml-auto" onClick={onResume}>
                Resume this call →
              </button>
            )}
          </div>

          <div>
            <p className="label mb-1.5">AI summary</p>
            <p className="text-[13.5px] leading-relaxed text-[#d5d9de]">
              {call.ai_summary || "No summary written."}
            </p>
          </div>

          {call.next_step && (
            <div>
              <p className="label mb-1.5">Next step</p>
              <p className="text-[13px] text-muted">{call.next_step}</p>
            </div>
          )}

          {call.audit_warning && (
            <div className="rounded-lg border border-bad/40 bg-bad/[0.07] px-3.5 py-3">
              <p className="label mb-1 text-bad">Audit note</p>
              <p className="text-[12.5px] leading-relaxed text-[#d5d9de]">
                {call.audit_warning}
              </p>
            </div>
          )}

          <div>
            <p className="label mb-1.5">Their words, stage 5</p>
            <p className="text-[13px] italic text-muted">
              {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "Nothing captured."}
            </p>
          </div>

          <div>
            <p className="label mb-2">Stage by stage</p>
            <ol className="space-y-3">
              {(call.stage_logs || []).map((l) => (
                <li key={l.id} className="grid grid-cols-[22px_1fr] gap-2.5">
                  <span className="font-mono text-[10.5px] text-faint">
                    {String(l.stage_number).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.1em] text-faint">
                      {stageName(Number(l.stage_number))}
                    </div>
                    <div className="text-[13px]">{tapLabel(l)}</div>
                    {l.prospect_words && (
                      <div className="mt-0.5 text-[12px] italic text-muted">
                        “{l.prospect_words}”
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {(call.stage_logs || []).length === 0 && (
                <li className="text-[12px] text-faint">No stages logged.</li>
              )}
            </ol>
          </div>
        </div>
      </aside>
    </div>
  );
}
