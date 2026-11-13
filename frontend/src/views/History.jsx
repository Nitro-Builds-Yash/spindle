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
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  useEffect(() => {
    if (!openId) {
      setSelectedDetail(null);
      return;
    }
    setLoadingDetail(true);
    api
      .getCall(openId)
      .then((data) => {
        setSelectedDetail({ ...data.call, stage_logs: data.stage_logs || [] });
      })
      .catch(() => {
        const item = calls?.find((c) => c.id === openId);
        if (item) setSelectedDetail(item);
      })
      .finally(() => setLoadingDetail(false));
  }, [openId, calls]);

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

  const filteredCalls = useMemo(() => {
    if (!calls) return [];
    if (!filterQuery.trim()) return calls;
    const q = filterQuery.toLowerCase();
    return calls.filter((c) =>
      (c.prospect_name || "").toLowerCase().includes(q) ||
      (c.company_name || "").toLowerCase().includes(q) ||
      (c.outcome || "").toLowerCase().includes(q) ||
      (c.highest_stage_name || "").toLowerCase().includes(q)
    );
  }, [calls, filterQuery]);

  const selected = calls.find((c) => c.id === openId);
  const byStage = stats?.ended_by_stage || {};
  const peak = Math.max(1, ...Object.values(byStage));

  return (
    <div className="flex flex-col gap-8 max-w-[1020px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <p className="eyebrow">The Second Screen · Performance Analytics</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-950">Past calls</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-[65ch]">
            After a call is saved it appears here with the stage it reached. A list like this is how a caller sees where their calls end.
          </p>
        </div>
        <button className="btn-primary self-start sm:self-auto" onClick={onNew}>
          + New call
        </button>
      </div>

      {/* Analytics Snapshot Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_220px_1fr]">
        <div className="card flex flex-col justify-center p-5">
          <span className="font-mono text-4xl font-bold text-ink-950 leading-none">{stats?.calls ?? calls.length}</span>
          <span className="label mt-2">Total calls logged</span>
        </div>
        <div className="card flex flex-col justify-center p-5">
          <span className="font-mono text-4xl font-bold text-[#0047ff] leading-none">
            {Math.round((stats?.connect_rate || 0) * 100)}%
          </span>
          <span className="label mt-2">Reached right person</span>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="label">Where calls ended (Stage Drop-off Funnel)</span>
            <span className="font-mono text-[10px] text-slate-400">Stages 1–8</span>
          </div>
          <div className="mt-3 grid grid-cols-8 items-end gap-2 border-b border-slate-100 pb-1.5">
            {Object.entries(byStage).map(([n, c]) => (
              <div key={n} className="grid h-[54px] grid-rows-[12px_1fr_12px] items-end justify-items-center gap-0.5">
                <span className="font-mono text-[9px] text-slate-500 font-bold">{c || ""}</span>
                <div
                  className="w-full max-w-[20px] self-end rounded-t-sm bg-gradient-to-t from-[#0047ff] to-blue-500 transition-all hover:brightness-110"
                  style={{ height: `${c ? Math.max(10, (c / peak) * 100) : 0}%` }}
                />
                <span className="font-mono text-[10px] text-slate-500 font-semibold">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search by prospect, company, outcome..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#0047ff] focus:ring-2 focus:ring-blue-500/15 shadow-2xs"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
        <span className="font-mono text-xs text-slate-400">
          Showing {filteredCalls.length} of {calls.length} calls
        </span>
      </div>

      {/* Reference Card List (Matches ClinicBooks Past Calls Exactly) */}
      {filteredCalls.length === 0 ? (
        <div className="card p-16 text-center text-slate-500 font-mono text-sm">
          {filterQuery ? "No calls match your search query." : "No calls recorded yet. Click '+ New call' above to dial your first prospect."}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((c) => {
            const outcome = outcomeByKey[c.outcome];
            const live = c.status === "in_progress";
            return (
              <div
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="rounded-xl border border-slate-200/90 bg-white p-4.5 hover:border-ink-950 hover:shadow-card hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-[14.5px] text-ink-950 tracking-tight">
                        {c.prospect_name || "Unknown prospect"}
                        {c.company_name ? `, ${c.company_name}` : ""}
                      </h4>
                      {live && <span className="badge badge-live">Live</span>}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-1 font-medium">
                      {c.next_step || c.ai_summary || "No notes logged for this call."}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0047ff] bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-sm">
                      {c.highest_stage_name}
                    </span>
                    <p className="font-mono text-[11px] text-slate-400 mt-1 font-medium">
                      {when(c.started_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(selectedDetail || selected) && (
        <Drawer
          call={selectedDetail || selected}
          loading={loadingDetail}
          content={content}
          onClose={() => {
            setOpenId(null);
            setSelectedDetail(null);
          }}
          onResume={() => onOpen((selectedDetail || selected).id)}
          when={when}
          tapLabel={tapLabel}
          stageName={stageName}
          outcome={outcomeByKey[(selectedDetail || selected).outcome]}
        />
      )}
    </div>
  );
}

function Drawer({ call, loading, content, onClose, onResume, when, tapLabel, stageName, outcome }) {
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-float text-ink-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-6 py-5 backdrop-blur-md">
          <div>
            <p className="eyebrow">{when(call.started_at)}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-ink-950">
              {call.prospect_name || "Unknown prospect"}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {[call.prospect_role, call.company_name, call.call_type].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={toneClass[outcome?.tone] || "badge"}>
              {outcome?.label || call.outcome || "in progress"}
            </span>
            <span className="badge">
              Stage {call.highest_stage_reached}/8 · {call.highest_stage_name}
            </span>
            <span className="badge font-mono font-bold text-ink-900">{call.duration_seconds}s</span>
            {call.status === "in_progress" && (
              <button className="text-xs font-mono font-bold text-[#0047ff] ml-auto hover:underline" onClick={onResume}>
                Resume call →
              </button>
            )}
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">AI 1-line CRM summary</p>
            <p className="text-xs text-ink-900 leading-relaxed font-medium">
              {call.ai_summary || "No summary written."}
            </p>
          </div>

          {call.next_step && (
            <div className="rounded-xl border border-slate-200/80 p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Next step agreed</p>
              <p className="text-xs text-ink-950 font-bold">{call.next_step}</p>
            </div>
          )}

          {call.audit_warning && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700">Audit inconsistency warning</p>
              <p className="text-xs text-rose-900 leading-relaxed font-medium mt-1">
                {call.audit_warning}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200/80 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Prospect's exact words (Stage 5 Need Quote)</p>
            <p className="text-xs italic text-slate-800 leading-relaxed font-serif">
              {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "Nothing captured."}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Stage-by-stage progression</p>
            <div className="space-y-2">
              {(call.stage_logs || []).map((l) => (
                <div key={l.id} className="grid grid-cols-[28px_1fr] gap-2.5 rounded-lg border border-slate-200/80 p-3 bg-slate-50/50">
                  <span className="font-mono text-xs font-bold text-slate-400">
                    {String(l.stage_number).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[#0047ff] font-bold">
                      {stageName(Number(l.stage_number))}
                    </div>
                    <div className="text-xs font-semibold text-ink-950 mt-0.5">{tapLabel(l)}</div>
                    {l.prospect_words && (
                      <div className="mt-1 text-[11.5px] italic text-slate-600 border-l-2 border-slate-300 pl-2">
                        “{l.prospect_words}”
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <p className="text-xs text-blue-600 font-mono animate-pulse py-2">Loading stage logs from Supabase…</p>
              )}
              {!loading && (call.stage_logs || []).length === 0 && (
                <p className="text-xs text-slate-400 font-mono">No stage logs saved.</p>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
