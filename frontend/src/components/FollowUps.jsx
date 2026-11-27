import React, { useEffect, useState } from "react";
import { api } from "../api";

const DUE = {
  overdue: { label: "Overdue", cls: "badge badge-bad" },
  today: { label: "Today", cls: "badge badge-live" },
  later: { label: "Upcoming", cls: "badge" },
};

function at(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** Callbacks promised on closed calls, soonest first. */
export default function FollowUps({ onCallAgain }) {
  const [items, setItems] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.followUps()
      .then((d) => { setItems(d.follow_ups); setEnabled(d.enabled); })
      .catch(() => setItems([]));
  }, []);

  if (!items || (!items.length && enabled)) return null;
  if (!enabled) {
    return (
      <p className="rounded-lg2 border border-steel-300 bg-white px-4 py-3 text-sm text-ink-600">
        Follow-ups are switched off until the database update in <code>migrations/002_follow_ups.sql</code> is run.
      </p>
    );
  }

  async function act(id, fn) {
    setBusyId(id);
    setErr("");
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  }

  return (
    <section aria-labelledby="follow-ups-title">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="follow-ups-title" className="text-xl font-bold text-ink-950">Follow-ups</h2>
        <span className="text-sm text-ink-500">
          {items.filter((f) => f.due !== "later").length} due now
        </span>
      </div>
      {err && <p className="mb-2 text-sm text-stop">{err}</p>}
      <ul className="card divide-y divide-steel-200 overflow-hidden">
        {items.map((f) => (
          <li key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="truncate text-[15px] font-semibold text-ink-950">
                  {f.prospect_name}
                  {f.company_name && <span className="font-normal text-ink-600">, {f.company_name}</span>}
                </span>
                <span className={DUE[f.due].cls}>{DUE[f.due].label}</span>
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-500">
                <span className="tnum text-ink-700">{at(f.follow_up_at)}</span>
                {f.next_step ? `: ${f.next_step}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                className="btn-ghost px-3 py-1.5"
                disabled={busyId === f.id}
                onClick={() => act(f.id, () => api.followUpIcs(f.id))}
              >
                Add to calendar
              </button>
              <button
                className="btn-ghost px-3 py-1.5"
                disabled={busyId === f.id}
                onClick={() => act(f.id, async () => {
                  await api.followUpDone(f.id);
                  setItems((xs) => xs.filter((x) => x.id !== f.id));
                })}
              >
                Mark done
              </button>
              <button
                className="btn-primary px-3 py-1.5"
                disabled={busyId === f.id}
                onClick={() => act(f.id, async () => {
                  await api.followUpDone(f.id);
                  await onCallAgain(f);
                })}
              >
                Call now
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
