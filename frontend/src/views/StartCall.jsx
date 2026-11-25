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
    industry: "Precision Machining, Coimbatore",
  },
  {
    prospect_name: "Dev ji",
    prospect_role: "Technical Services Director",
    company_name: "Kalpana Chem Supplies",
    company_kind: "mid-size private company",
    call_type: "first call",
    industry: "Chemical Processing, Gujarat",
  },
  {
    prospect_name: "Vinod ji",
    prospect_role: "Director",
    company_name: "ChromaChem India",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
    industry: "Industrial Coatings, Pune",
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
        <h1 className="text-4xl sm:text-[46px] font-extrabold leading-[1.05] text-ink-950">
          Eight stages. One on screen at a time.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-700 max-w-[52ch]">
          Say who you're calling and start. During the call you only tap what happened
          and type the prospect's own words.
        </p>

        {/* The call, drawn as its eight stops; fills once on load */}
        <div className="mt-8 rounded-xl2 bg-navy-900 px-6 pt-6 pb-5 shadow-float" aria-hidden>
          <div className="relative grid grid-cols-8">
            <span className="absolute left-[6.25%] right-[6.25%] top-[13px] h-[3px] rounded-full bg-navy-700" />
            <span className="absolute left-[6.25%] right-[6.25%] top-[13px] h-[3px] origin-left rounded-full bg-gradient-to-r from-navy-300 via-navy-300 to-signal motion-safe:animate-[railFill_1.8s_cubic-bezier(.6,0,.2,1)_both]" />
            {content.stages.map((st, i) => (
              <div key={st.key} className="relative flex flex-col items-center">
                <span
                  className={`tnum relative z-10 flex h-[29px] w-[29px] items-center justify-center rounded-full text-[13px] font-bold ${
                    i === 7
                      ? "bg-signal text-ink-950 shadow-[0_0_18px_rgba(242,169,0,0.55)]"
                      : "bg-navy-300 text-navy-900"
                  }`}
                  style={{ animation: `nodeOn ${0.35 + i * 0.2}s ease-out both` }}
                >
                  {st.number}
                </span>
                <span className="mt-2 hidden sm:block text-center text-[11px] leading-tight text-navy-200">{st.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-navy-700 pt-3 text-sm text-navy-200">
            The average call in the transcripts lasts 93.5 seconds. Spindle keeps you on the right stage for all of it.
          </p>
        </div>

        {/* Quick Start Call Session */}
        <div className="mt-7 rounded-xl2 border border-steel-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div>
              <div className="text-[15px] font-bold text-ink-950">
                Practice first
              </div>
              <p className="text-sm text-ink-600 mt-0.5">
                Run a call with Ramesh Varma of Sri Balaji Precision, played by the practice phone.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-ghost shrink-0"
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
            {busy ? "Opening…" : "Start practice call"}
          </button>
        </div>

        {hasCall && (
          <div className="mt-5 flex items-center justify-between rounded-xl2 border border-signal bg-signal-soft px-5 py-3.5 text-sm text-ink-900">
            <span className="font-medium">You have a call in progress.</span>
            <button className="tnum text-xs font-bold text-navy hover:underline" onClick={resume}>
              Go back to it
            </button>
          </div>
        )}

        <form onSubmit={start} className="card mt-6 grid gap-4 p-7 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="grid gap-1.5">
              <span className="text-sm font-semibold text-ink-800">Prospect name</span>
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
              <span className="text-sm font-semibold text-ink-800">Role</span>
              <input
                className="input"
                value={form.prospect_role}
                onChange={set("prospect_role")}
                placeholder="e.g. Managing Director"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-ink-800">Company name</span>
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
              <span className="text-sm font-semibold text-ink-800">Company kind</span>
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
              <span className="text-sm font-semibold text-ink-800">Call type</span>
              <select className="input cursor-pointer" value={form.call_type} onChange={set("call_type")}>
                <option value="first call">first call</option>
                <option value="follow-up">follow-up</option>
              </select>
            </label>
          </div>

          {err && <p className="text-xs text-rose-600 tnum">{err}</p>}

          <button className="btn-primary mt-3 py-3.5 text-[15px]" disabled={busy}>
            {busy ? "Starting…" : "Start the call"}
          </button>
        </form>
      </section>

      <aside className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-ink-950">The eight stages</h2>
          <ol className="mt-3 border-t border-steel-200">
            {content.stages.map((s) => (
              <li key={s.key} className="border-b border-steel-200 py-3">
                <div className="flex gap-3">
                  <span className="tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-steel-300 text-xs font-bold text-ink-700">
                    {s.number}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-ink-950">{s.name}</div>
                    <div className="text-sm leading-snug text-ink-600 mt-0.5">{s.purpose}</div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="text-lg font-bold text-ink-950">Fill from a real call</h2>
          <p className="text-sm text-ink-500 mt-0.5 mb-3">Prospects taken from the transcripts.</p>
          <div className="space-y-2">
            {PRESETS.map((p) => (
              <button
                key={p.company_name}
                onClick={() => setForm(p)}
                className="w-full rounded-lg2 border border-steel-200 bg-white px-4 py-3 text-left hover:border-navy transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-semibold text-ink-950">
                    {p.company_name}
                  </div>
                  <span className="text-sm text-navy opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 font-semibold">
                    Use
                  </span>
                </div>
                <div className="text-sm text-ink-600 mt-0.5">
                  {p.prospect_name}, {p.prospect_role}
                </div>
                <div className="text-xs text-ink-400 mt-0.5">
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
