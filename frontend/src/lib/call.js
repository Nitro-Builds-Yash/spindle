/** Small pure helpers shared by the live-call components. */

export function clock(startedAt) {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;
}

/** The outcome the taps already imply, used as the modal's first guess. */
export function suggestOutcome(logs) {
  const tap = (n) => logs.find((l) => Number(l.stage_number) === n)?.what_happened;
  if (tap(7) === "named_time") return "next_step_agreed";
  if (tap(7) === "report_only") return "agreed_to_receive_report";
  if (tap(7) === "vague_yes") return "interested";
  if (tap(7) === "referred") return "follow_up";
  if (tap(1) === "switchboard") return "follow_up";
  if (tap(1) === "wrong_person") return "wrong_person";
  if (tap(1) === "language") return "call_again";
  if (tap(3) === "call_later" || tap(3) === "busy") return "follow_up";
  if (tap(3) === "whatsapp_first") return "agreed_to_receive_report";
  if (tap(5) === "everything_fine") return "not_interested";
  return "not_logged";
}

/** "2026-11-27T15:00" from a datetime-local input -> ISO with this browser's offset. */
export function localToIsoWithOffset(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  return `${local.length === 16 ? `${local}:00` : local}${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

/** Value for a datetime-local input, `days` from today at `hour`:00 local time. */
export function localSlot(days, hour) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(hour)}:00`;
}

/** Outcomes that mean someone should ring this prospect again. */
export const CALLBACK_OUTCOMES = new Set([
  "next_step_agreed", "agreed_to_receive_report", "interested", "follow_up", "call_again",
]);
