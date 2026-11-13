import React, { useState } from "react";
import { api } from "../api.js";

const PRESETS = [
  {
    prospect_name: "Ramesh Varma",
    prospect_role: "Managing Director",
    company_name: "Sri Balaji Precision",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
    tag: "Precision Machining · Coimbatore",
  },
  {
    prospect_name: "Dev ji",
    prospect_role: "Technical Services Director",
    company_name: "Kalpana Chem Supplies",
    company_kind: "mid-size private company",
    call_type: "first call",
    tag: "Chemical Processing · Gujarat",
  },
  {
    prospect_name: "Vinod ji",
    prospect_role: "Director",
    company_name: "ChromaChem India",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
    tag: "Industrial Coatings · Pune",
  },
];

export default function NewCallModal({ isOpen, onClose, onStart }) {
  const [form, setForm] = useState({
    prospect_name: "",
    prospect_role: "",
    company_name: "",
    company_kind: "mid-size private manufacturer",
    call_type: "first call",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!isOpen) return null;

  async function dial(data) {
    setBusy(true);
    setErr("");
    try {
      const res = await api.startCall(data);
      onStart(res.call.id);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] rounded-2xl border border-white/80 bg-white/95 backdrop-blur-xl p-6 sm:p-7 shadow-2xl text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Start New Cold Call</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select an authentic transcript preset or enter prospect info
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
          >
            ✕
          </button>
        </div>

        {/* 1-Click Transcript Presets */}
        <div className="mt-4 space-y-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            1-Click Transcript Presets
          </p>
          {PRESETS.map((p) => (
            <button
              key={p.company_name}
              disabled={busy}
              onClick={() => dial(p)}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-[#0047ff] hover:bg-blue-50/40 hover:shadow-xs transition-all text-left"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {p.company_name}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {p.prospect_name} · {p.prospect_role}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {p.tag}
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#0047ff] bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg shrink-0">
                Dial →
              </span>
            </button>
          ))}
        </div>

        {/* Or Dial Custom Prospect */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dial(form);
          }}
          className="mt-5 pt-4 border-t border-slate-200/80 space-y-3"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Or Dial Custom Prospect
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="input text-xs"
              placeholder="Prospect name"
              value={form.prospect_name}
              onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
              required
            />
            <input
              className="input text-xs"
              placeholder="Role (e.g. Managing Director)"
              value={form.prospect_role}
              onChange={(e) => setForm({ ...form, prospect_role: e.target.value })}
            />
          </div>
          <input
            className="input text-xs"
            placeholder="Company name"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            required
          />

          {err && <p className="text-xs text-rose-600 font-mono">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy}
            >
              {busy ? "Starting…" : "Start Call →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
