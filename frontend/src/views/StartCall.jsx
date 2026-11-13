import React, { useState } from "react";
import { api } from "../api.js";

const KINDS = [
  "mid-size private company",
  "mid-size private manufacturer",
  "India arm of a multinational",
  "listed Indian company",
  "large private company",
  "small private company",
  "startup",
  "public sector utility",
  "not known",
];

const PRESETS = [
  {
    prospect_name: "Ramesh Varma",
    prospect_role: "Managing Director",
    company_name: "Sri Balaji Precision",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
    industry: "Precision Machining · Coimbatore",
  },
  {
    prospect_name: "Dev ji",
    prospect_role: "Technical Services Director",
    company_name: "Kalpana Chem Supplies",
    company_kind: "mid-size private company",
    call_type: "first call",
    industry: "Chemical Processing · Gujarat",
  },
  {
    prospect_name: "Vinod ji",
    prospect_role: "Director",
    company_name: "ChromaChem India",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
    industry: "Industrial Coatings · Pune",
  },
];

export default function StartCall({ content, hasCall, resume, onStart }) {
  const [form, setForm] = useState({
    prospect_name: "",
    prospect_role: "",
    company_name: "",
    company_kind: "mid-size private company",
    call_type: "first call",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function start(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { call } = await api.startCall(form);
      onStart(call.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-12 pt-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="max-w-[620px]">
        <p className="eyebrow">Before you dial · Live Call Initiation</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-ink-950">
          The call is eight stages. The screen holds one at a time.
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-slate-600">
          Fill in who you are calling. The timer starts when the screen opens, and the
          caller types nothing on the call except one tap and the prospect's own words.
        </p>

        {/* Quick Start Call Session */}
        <div className="mt-5 rounded-xl border border-slate-200/90 bg-white p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0047ff] border border-blue-200/80 shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-ink-950">
                Simulate Call Session
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Start an interactive 8-stage call with Ramesh Varma (Sri Balaji Precision).
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-blue py-2 px-4.5 rounded-lg shadow-sm text-xs shrink-0"
            onClick={() => {
              setBusy(true);
              api
                .startCall({
                  prospect_name: "Ramesh Varma",
                  prospect_role: "Managing Director",
                  company_name: "Sri Balaji Precision",
                  company_kind: "mid-size private manufacturer",
                  call_type: "first call",
                })
                .then((res) => onStart(res.call.id))
                .catch((e) => setErr(e.message))
                .finally(() => setBusy(false));
            }}
            disabled={busy}
          >
            {busy ? "Opening..." : "Start Call Guide →"}
          </button>
        </div>

        {hasCall && (
          <div className="card mt-5 flex items-center justify-between p-4 text-xs text-slate-700 bg-blue-50/60 border-blue-200/80 shadow-xs">
            <span className="font-medium">An active cold call is currently open in this session.</span>
            <button className="font-mono text-xs font-bold text-[#0047ff] hover:underline uppercase" onClick={resume}>
              Return to it →
            </button>
          </div>
        )}

        <form onSubmit={start} className="card mt-6 grid gap-4 p-7 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-ink-800">Prospect name</span>
              <input
                className="input"
                value={form.prospect_name}
                onChange={set("prospect_name")}
                placeholder="e.g. Ramesh Varma"
                autoFocus
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-ink-800">Role</span>
              <input
                className="input"
                value={form.prospect_role}
                onChange={set("prospect_role")}
                placeholder="e.g. Managing Director"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-ink-800">Company name</span>
            <input
              className="input"
              value={form.company_name}
              onChange={set("company_name")}
              placeholder="e.g. Sri Balaji Precision"
              required
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-ink-800">Company kind</span>
              <select
                className="input cursor-pointer"
                value={form.company_kind}
                onChange={set("company_kind")}
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-ink-800">Call type</span>
              <select className="input cursor-pointer" value={form.call_type} onChange={set("call_type")}>
                <option value="first call">first call</option>
                <option value="follow-up">follow-up</option>
              </select>
            </label>
          </div>

          {err && <p className="text-xs text-rose-600 font-mono">{err}</p>}

          <button className="btn-primary mt-3 py-3.5 shadow-md shadow-slate-900/10 text-xs" disabled={busy}>
            {busy ? "Starting session…" : "Start the call →"}
          </button>
        </form>
      </section>

      <aside className="space-y-6">
        <div>
          <p className="eyebrow">The eight stages</p>
          <ol className="mt-3 space-y-0 border-t border-slate-200/80">
            {content.stages.map((s) => (
              <li key={s.key} className="border-b border-slate-200/80 py-2.5">
                <div className="flex gap-3">
                  <span className="font-mono text-xs font-bold text-[#0047ff]">
                    {String(s.number).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-ink-950">{s.name}</div>
                    <div className="text-[11.5px] leading-snug text-slate-500 mt-0.5">{s.purpose}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="eyebrow">Transcript Presets</p>
            <span className="font-mono text-[10px] text-slate-400">1-Click Load</span>
          </div>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p.company_name}
                onClick={() => setForm(p)}
                className="w-full rounded-xl border border-slate-200/90 bg-white p-3 text-left hover:border-[#0047ff] hover:bg-blue-50/20 hover:shadow-card hover:-translate-y-0.5 transition-all duration-150 group"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-ink-950 group-hover:text-[#0047ff] transition-colors">
                    {p.company_name}
                  </div>
                  <span className="font-mono text-[9px] text-[#0047ff] opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                    Load →
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {p.prospect_name} · {p.prospect_role}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {p.industry}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
