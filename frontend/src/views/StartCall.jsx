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
    <div className="grid grid-cols-1 gap-10 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="max-w-[620px]">
        <p className="eyebrow">Before you dial</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight text-[#0f172a]">
          The call is eight stages. The screen holds one at a time.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Fill in who you are calling. The timer starts when the screen opens, and the
          caller types nothing on the call except one tap and the prospect's own words.
        </p>

        {hasCall && (
          <div className="card mt-4 flex items-center justify-between p-3.5 text-xs text-slate-700 bg-blue-50/50 border-blue-200">
            <span>An active call is still open in this session.</span>
            <button className="font-mono text-xs font-bold text-[#0047ff] hover:underline uppercase" onClick={resume}>
              Return to it →
            </button>
          </div>
        )}

        <form onSubmit={start} className="card mt-5 grid gap-4 p-6">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-700">Prospect name</span>
              <input
                className="input"
                value={form.prospect_name}
                onChange={set("prospect_name")}
                placeholder="e.g. Ramesh Varma"
                autoFocus
                required
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-700">Role</span>
              <input
                className="input"
                value={form.prospect_role}
                onChange={set("prospect_role")}
                placeholder="e.g. Managing Director"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-slate-700">Company name</span>
            <input
              className="input"
              value={form.company_name}
              onChange={set("company_name")}
              placeholder="e.g. Sri Balaji Precision"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3.5">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-700">Company kind</span>
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
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-slate-700">Call type</span>
              <select className="input cursor-pointer" value={form.call_type} onChange={set("call_type")}>
                <option value="first call">first call</option>
                <option value="follow-up">follow-up</option>
              </select>
            </label>
          </div>

          {err && <p className="text-xs text-rose-600 font-mono">{err}</p>}

          <button className="btn-primary mt-2 py-3" disabled={busy}>
            {busy ? "Starting…" : "Start the call"}
          </button>
        </form>
      </section>

      <aside>
        <p className="eyebrow">The eight stages</p>
        <ol className="mt-3 space-y-0 border-t border-slate-200">
          {content.stages.map((s) => (
            <li key={s.key} className="border-b border-slate-200 py-2.5">
              <div className="flex gap-2.5">
                <span className="font-mono text-xs font-bold text-[#0047ff]">
                  {String(s.number).padStart(2, "0")}
                </span>
                <div>
                  <div className="text-xs font-bold text-[#0f172a]">{s.name}</div>
                  <div className="text-[11px] leading-snug text-slate-500 mt-0.5">{s.purpose}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="eyebrow mt-6">Load real transcript</p>
        <div className="mt-2.5 space-y-2">
          {PRESETS.map((p) => (
            <button
              key={p.company_name}
              onClick={() => setForm(p)}
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-left hover:border-[#0047ff] hover:shadow-xs transition-all"
            >
              <div className="text-xs font-bold text-[#0f172a]">{p.company_name}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {p.prospect_name} · {p.prospect_role}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
