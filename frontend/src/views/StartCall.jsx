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
    prospect_name: "Suresh Kumar",
    prospect_role: "Director",
    company_name: "Deccan Auto Components",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
  },
  {
    prospect_name: "Farah Sultana",
    prospect_role: "Director, Quality",
    company_name: "Nova Fasteners",
    company_kind: "mid-size private manufacturer",
    call_type: "follow-up",
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
    <div className="grid grid-cols-1 gap-12 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="max-w-[600px]">
        <p className="eyebrow">Before you dial</p>
        <h1 className="mt-2 max-w-[20ch] text-[32px] font-semibold leading-tight tracking-tight">
          The call is eight stages. The screen holds one at a time.
        </h1>
        <p className="mt-3 max-w-[54ch] text-[14.5px] leading-relaxed text-muted">
          Fill in who you are calling. The timer starts when the screen opens, and the
          caller types nothing on the call except one tap and the prospect's own words.
        </p>

        {hasCall && (
          <div className="card mt-5 flex items-center gap-2 p-3 text-[13px] text-muted">
            A call is still open.
            <button className="btn-link" onClick={resume}>
              Return to it
            </button>
          </div>
        )}

        <form onSubmit={start} className="card mt-6 grid gap-3.5 p-5">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-medium text-muted">Prospect</span>
              <input
                className="input"
                value={form.prospect_name}
                onChange={set("prospect_name")}
                placeholder="Ramesh Varma"
                autoFocus
                required
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-medium text-muted">Role</span>
              <input
                className="input"
                value={form.prospect_role}
                onChange={set("prospect_role")}
                placeholder="Managing Director"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-[11.5px] font-medium text-muted">Company</span>
            <input
              className="input"
              value={form.company_name}
              onChange={set("company_name")}
              placeholder="Sri Balaji Precision"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3.5">
            <label className="grid gap-1.5">
              <span className="text-[11.5px] font-medium text-muted">Company kind</span>
              <select
                className="input"
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
              <span className="text-[11.5px] font-medium text-muted">Call type</span>
              <select className="input" value={form.call_type} onChange={set("call_type")}>
                <option value="first call">first call</option>
                <option value="follow-up">follow-up</option>
              </select>
            </label>
          </div>

          {err && <p className="text-[12.5px] text-bad">{err}</p>}

          <button className="btn-primary mt-1 py-3" disabled={busy}>
            {busy ? "Starting…" : "Start the call"}
          </button>
        </form>
      </section>

      <aside>
        <p className="eyebrow">The eight stages</p>
        <ol className="mt-3 space-y-0">
          {content.stages.map((s) => (
            <li key={s.key} className="border-t border-hair py-2.5">
              <div className="flex gap-3">
                <span className="font-mono text-[11px] text-faint">
                  {String(s.number).padStart(2, "0")}
                </span>
                <div>
                  <div className="text-[13px] font-medium">{s.name}</div>
                  <div className="text-[11.5px] leading-snug text-muted">{s.purpose}</div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="eyebrow mt-7">Or rehearse one</p>
        <div className="mt-3 space-y-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.company_name}
              onClick={() => setForm(p)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-left hover:border-[#363d47]"
            >
              <div className="text-[12.5px] font-medium">{p.company_name}</div>
              <div className="text-[11px] text-muted">
                {p.prospect_name} · {p.prospect_role}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
