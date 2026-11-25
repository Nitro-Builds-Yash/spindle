import React, { useRef, useState } from "react";
import { api } from "../api";
import { prospectsFromCsv, SAMPLE_CSV } from "../lib/csv.js";

const KEY = "spindle.callList";

/** File -> text, also in browsers without Blob.text(). */
function readText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsText(file);
  });
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

/** A queue of prospects imported from CSV, worked top to bottom. Kept in this browser. */
export default function CallList({ onStart }) {
  const [list, setList] = useState(load);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const update = (next) => { setList(next); save(next); };
  const todo = list.filter((p) => !p.done);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    try {
      const people = prospectsFromCsv(await readText(file));
      if (!people.length) throw new Error("No rows with both a name and a company.");
      update([...list.filter((p) => !p.done), ...people.map((p, i) => ({ ...p, id: `${Date.now()}-${i}`, done: false }))]);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  async function call(p) {
    setBusy(true);
    setErr("");
    try {
      const { call } = await api.startCall({
        prospect_name: p.prospect_name,
        prospect_role: p.prospect_role,
        company_name: p.company_name,
        company_kind: p.company_kind,
        call_type: "first call",
      });
      update(list.map((x) => (x.id === p.id ? { ...x, done: true } : x)));
      onStart(call.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-ink-950">Call list</h2>
        {list.length > 0 && (
          <span className="tnum text-sm text-ink-500">{todo.length} of {list.length} left</span>
        )}
      </div>

      {todo.length === 0 ? (
        <p className="mt-1 text-sm text-ink-600">
          Import a CSV of prospects and work through them one by one.{" "}
          <a className="font-semibold text-navy hover:underline" href={sampleHref} download="spindle-call-list.csv">
            Get a sample file
          </a>
          .
        </p>
      ) : (
        <ol className="mt-3 card divide-y divide-steel-200 overflow-hidden">
          {todo.slice(0, 5).map((p, i) => (
            <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? "bg-signal-soft/60" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-ink-950">{p.prospect_name}</div>
                <div className="truncate text-sm text-ink-600">
                  {[p.prospect_role, p.company_name].filter(Boolean).join(", ")}
                </div>
                {p.phone && <div className="tnum text-xs text-ink-500">{p.phone}</div>}
              </div>
              {i === 0 ? (
                <button className="btn-primary px-3 py-1.5" disabled={busy} onClick={() => call(p)}>
                  Call
                </button>
              ) : null}
              <button
                className="text-sm font-semibold text-ink-500 hover:text-ink-900"
                onClick={() => update(list.map((x) => (x.id === p.id ? { ...x, done: true } : x)))}
                title="Skip this prospect"
              >
                Skip
              </button>
            </li>
          ))}
        </ol>
      )}

      {err && <p className="mt-2 text-sm text-stop">{err}</p>}

      <div className="mt-3 flex items-center gap-3 text-sm">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} id="call-list-file" />
        <label htmlFor="call-list-file" className="btn-ghost cursor-pointer px-3 py-1.5">
          {list.length ? "Add more from CSV" : "Import CSV"}
        </label>
        {list.length > 0 && (
          <button className="font-semibold text-ink-500 hover:text-stop" onClick={() => update([])}>
            Clear list
          </button>
        )}
      </div>
    </div>
  );
}
