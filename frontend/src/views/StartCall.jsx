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
  },
  {
    prospect_name: "Dev ji",
    prospect_role: "Technical Services Director",
    company_name: "Kalpana Chem Supplies",
    company_kind: "mid-size private company",
    call_type: "first call",
  },
  {
    prospect_name: "Vinod ji",
    prospect_role: "Director",
    company_name: "ChromaChem India",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
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

        {/* 1-Click Instant Live Call Launcher */}
        <div className="mt-5 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#0047ff] flex items-center gap-1.5">
              <span>⚡</span> 1-Click Live Call Launcher
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Launch the live 8-stage screen directly with Ramesh Varma (Sri Balaji Precision).
            </p>
          </div>
          <button
            type="button"
            className="btn-blue py-2.5 px-5 rounded-xl shadow-md text-xs shrink-0"
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
            {busy ? "Opening..." : "▶ Open Live Call Screen"}
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
          <p className="eyebrow">Rehearse with real transcripts</p>
          <div className="mt-2.5 space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p.company_name}
                onClick={() => setForm(p)}
                className="w-full rounded-xl border border-slate-200/90 bg-white p-3.5 text-left hover:border-[#0047ff] hover:shadow-card hover:-translate-y-0.5 transition-all duration-150"
              >
                <div className="text-xs font-bold text-ink-950">{p.company_name}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {p.prospect_name} · {p.prospect_role}
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
