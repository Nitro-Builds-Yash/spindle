import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import FollowUps from "../components/FollowUps.jsx";

const PAGE = 100;

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString("en-IN", { day:"2-digit", month : "short"})}, ${time}`;
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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const d = await api.listCalls(PAGE, calls.length);
      setCalls((prev) => [...prev, ...d.calls.filter((c) => !prev.some((p) => p.id === c.id))]);
      setHasMore(d.calls.length === PAGE);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingMore(false);
    }
  }

  async function callAgain(f) {
    const { call } = await api.startCall({
      prospect_name: f.prospect_name,
      prospect_role: f.prospect_role,
      company_name: f.company_name,
      company_kind: f.company_kind,
      call_type: "follow-up",
    });
    onOpen(call.id);
  }

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
      .listCalls(PAGE)
      .then((d) => {
        setCalls(d.calls);
        setHasMore(d.calls.length === PAGE);
      })
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

  if (err) return <div className="py-20 text-center text-rose-600 tnum text-sm">{err}</div>;
  if (!calls) return <div className="py-20 text-center text-ink-500 tnum text-sm">Loading past calls…</div>;

  const exportCSV = async () => {
    // Server export: one source of truth, formula-escaped, and sends the token.
    try {
      await api.exportCsv();
    } catch (e) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const selected = calls.find((c) => c.id === openId);
  const byStage = stats?.ended_by_stage || {};
  const peak = Math.max(1, ...Object.values(byStage));

  return (
    <div className="flex flex-col gap-8 max-w-[1020px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
                    <h1 className="text-4xl font-extrabold text-ink-950">Past calls</h1>
          <p className="text-[15px] text-ink-600 mt-2 max-w-[60ch]">
            Every saved call, with how far it got. Open one to see what was tapped at each stage.
          </p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={exportCSV}
            className="btn-ghost"
            title="Export all logged calls to CSV"
          >
            <svg className="w-3.5 h-3.5 text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button className="btn-primary" onClick={onNew}>
            New call
          </button>
        </div>
      </div>

      <FollowUps onCallAgain={callAgain} />

      {/* Numbers band */}
      <div className="grid grid-cols-1 sm:grid-cols-[170px_230px_1fr] overflow-hidden rounded-xl2 bg-navy-900 text-white shadow-float">
        <div className="flex flex-col justify-end p-6 border-b sm:border-b-0 sm:border-r border-navy-700">
          <span className="display tnum text-[56px] font-extrabold leading-none">{stats?.calls ?? calls.length}</span>
          <span className="mt-3 text-sm font-semibold text-navy-200">
            Calls logged{stats?.abandoned ? <span className="block font-normal text-navy-300">{stats.abandoned} abandoned</span> : null}
          </span>
        </div>
        <div className="flex flex-col justify-end p-6 border-b sm:border-b-0 sm:border-r border-navy-700">
          <span className="display tnum text-[56px] font-extrabold leading-none text-signal">
            {Math.round((stats?.connect_rate || 0) * 100)}%
          </span>
          <span className="mt-3 text-sm font-semibold text-navy-200">Reached the right person</span>
        </div>
        <div className="p-6">
          <span className="text-sm font-semibold text-navy-200">Stage where each call ended</span>
          <div className="mt-3 grid grid-cols-8 items-end gap-2">
            {Object.entries(byStage).map(([n, c]) => (
              <div key={n} className="grid h-[112px] grid-rows-[16px_1fr_18px] items-end justify-items-center gap-1">
                <span className="tnum text-xs font-bold text-white">{c || ""}</span>
                <div
                  className={`w-full max-w-[28px] self-end rounded-t-[3px] ${c === peak && c ? "bg-signal" : "bg-navy-300"}`}
                  style={{ height: `${c ? Math.max(10, (c / peak) * 100) : 0}%` }}
                />
                <span className="tnum w-full border-t border-navy-700 pt-1 text-center text-xs font-semibold text-navy-200">{n}</span>
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
            placeholder="Search prospect, company or outcome"
            className="input"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-steel-400 hover:text-ink-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
        <span className="tnum text-sm text-ink-500">
          {filteredCalls.length} of {calls.length} calls
        </span>
      </div>

      {/* Reference Card List (Matches ClinicBooks Past Calls Exactly) */}
      {filteredCalls.length === 0 ? (
        <div className="card p-16 text-center text-ink-500 tnum text-sm">
          {filterQuery ? "No calls match that search." : "No calls yet. Start one with New call."}
        </div>
      ) : (
        <ul className="card divide-y divide-steel-200 overflow-hidden">
          {filteredCalls.map((c) => {
            const outcome = outcomeByKey[c.outcome];
            const live = c.status === "in_progress";
            const abandoned = (c.audit_warning || "").startsWith("Abandoned");
            const reached = Number(c.highest_stage_reached) || 1;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_190px_120px] items-center gap-3 sm:gap-6 px-5 py-4 text-left hover:bg-steel-50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-[15px] text-ink-950 truncate">
                        {c.prospect_name || "Unknown prospect"}
                        {c.company_name ? <span className="font-normal text-ink-600">, {c.company_name}</span> : null}
                      </span>
                      {live && <span className="badge badge-live">In progress</span>}
                      {!live && abandoned && <span className="badge">Abandoned</span>}
                      {!live && !abandoned && outcome && <span className={toneClass[outcome.tone] || "badge"}>{outcome.label}</span>}
                    </div>
                    <p className="text-sm text-ink-500 mt-1 truncate">
                      {c.next_step || c.ai_summary || "Nothing noted on this call."}
                    </p>
                  </div>
                  <div title={`Reached stage ${reached}: ${c.highest_stage_name}`}>
                    <div className="flex gap-1" aria-hidden>
                      {Array.from({ length: 8 }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i < reached ? (live && i === reached - 1 ? "bg-signal" : "bg-navy") : "bg-steel-200"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-ink-600">
                      {reached}. {c.highest_stage_name}
                    </p>
                  </div>
                  <p className="tnum text-sm text-ink-500 sm:text-right">{when(c.started_at)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !filterQuery && (
        <button className="btn-ghost self-center" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Loading…" : "Show older calls"}
        </button>
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

function Drawer({ call, loading, onClose, onResume, when, tapLabel, stageName, outcome }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => closeRef.current?.focus(), []);

  const logs = call.stage_logs || [];
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-ink-950/40" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col overflow-y-auto bg-white shadow-float text-ink-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-navy-900 px-6 pt-5 pb-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-navy-200">{when(call.started_at)}</p>
              <h2 id="drawer-title" className="mt-1 text-[22px] font-extrabold leading-tight truncate">
                {call.prospect_name || "Unknown prospect"}
              </h2>
              <p className="text-sm text-navy-200 mt-0.5">
                {[call.prospect_role, call.company_name, call.call_type].filter(Boolean).join(", ")}
              </p>
            </div>
            <button
              ref={closeRef}
              className="rounded-lg2 border border-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700"
              onClick={onClose}
              title="Esc"
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-navy-200">
            <span className={toneClass[outcome?.tone] || "badge"}>
              {call.status === "in_progress" ? "In progress" : outcome?.label || call.outcome || "Not logged"}
            </span>
            <span>Reached {call.highest_stage_reached}. {call.highest_stage_name}</span>
            <span aria-hidden>|</span>
            <span className="tnum">{call.duration_seconds} s</span>
            {call.status === "in_progress" && (
              <button className="ml-auto font-semibold text-signal hover:underline" onClick={onResume}>
                Resume call
              </button>
            )}
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div>
            <p className="label mb-1">What a manager reads</p>
            <p className="text-[15px] leading-relaxed text-ink-900">{call.ai_summary || "No summary written."}</p>
          </div>

          {call.next_step && (
            <div>
              <p className="label mb-1">Next step</p>
              <p className="text-[15px] font-semibold text-ink-950">{call.next_step}</p>
            </div>
          )}

          {call.audit_warning && (
            <div className="rounded-lg2 border border-stop/30 bg-stop-soft px-4 py-3">
              <p className="text-sm font-semibold text-stop">Check this record</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-800">{call.audit_warning}</p>
            </div>
          )}

          <div>
            <p className="label mb-1">Their need, in their words</p>
            <p className="text-[15px] italic text-ink-800">
              {call.stage5_need_quote ? `“${call.stage5_need_quote}”` : "Nothing captured."}
            </p>
          </div>

          <div>
            <p className="label mb-2">Stage by stage</p>
            <ol className="relative space-y-0 border-l-2 border-steel-200 ml-3">
              {logs.map((l) => (
                <li key={l.id || l.stage_number} className="relative pl-6 pb-4">
                  <span className="tnum absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
                    {l.stage_number}
                  </span>
                  <div className="text-sm font-semibold text-navy">{stageName(Number(l.stage_number))}</div>
                  <div className="text-[15px] text-ink-950 mt-0.5">{tapLabel(l)}</div>
                  {l.prospect_words && (
                    <div className="mt-1 text-sm italic text-ink-600">“{l.prospect_words}”</div>
                  )}
                </li>
              ))}
            </ol>
            {loading && <p className="text-sm text-ink-500 py-2">Loading stages…</p>}
            {!loading && logs.length === 0 && <p className="text-sm text-ink-500">No stages saved.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
