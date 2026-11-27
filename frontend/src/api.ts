// Typed client for the Spindle API.
//
// Two jobs beyond fetch():
//  * the shared access token (SPINDLE_ACCESS_TOKEN) — typed once, kept in this
//    browser only, never built into the bundle;
//  * an outbox for stage taps — if the network drops mid-call (or Render is
//    waking up), taps are kept in localStorage and sent when it comes back.

// ---------------------------------------------------------------- types ----
export type Tone = "good" | "ok" | "bad";
export type CallStatus = "in_progress" | "completed" | "dropped";

export interface Tap { key: string; label: string; hints: string[] }
export interface Stage {
  number: number; key: string; name: string; purpose: string;
  what_they_say: string[]; taps: Tap[]; default_tap: string; captures_quote?: boolean;
}
export interface Outcome { key: string; label: string; meaning: string; tone: Tone }
export interface Content { stages: Stage[]; outcomes: Outcome[] }

export interface StageLog {
  id?: string; call_id: string; stage_number: number; stage_name: string;
  what_happened: string; prospect_words: string; ai_suggestion: string;
  created_at?: string; pending?: boolean;
}
export interface Call {
  id: string; prospect_name: string; prospect_role: string; company_name: string;
  company_kind: string; call_type: string; started_at: string; ended_at: string | null;
  duration_seconds: number; highest_stage_reached: number; highest_stage_name: string;
  status: CallStatus; outcome: string | null; next_step: string | null;
  stage5_need_quote: string | null; ai_summary: string | null; audit_warning: string | null;
  follow_up_at?: string | null; follow_up_done?: boolean; stage_logs?: StageLog[];
}
export interface NewCall {
  prospect_name: string; prospect_role?: string; company_name: string;
  company_kind?: string; call_type?: string;
}
export interface StageLogBody {
  stage_number: number; what_happened: string; prospect_words?: string; ai_suggestion?: string;
}
export interface CloseBody { outcome: string; next_step?: string; note?: string; follow_up_at?: string | null }
export interface Audit { warning: string | null; summary: string; source: "llm" | "rules" }
export interface Cue { cue: string; source: "llm" | "rules"; stage: number; suggests_stage?: number }
export interface Stats {
  calls: number; closed: number; abandoned: number; ended_by_stage: Record<string, number>;
  outcomes: Record<string, number>; connect_rate: number; audit_warnings: number;
}
export interface FollowUp extends Call { due: "overdue" | "today" | "later" }
export interface Health {
  status: string; storage: string; llm: string; llm_last_error: string | null;
  auth: boolean; warnings: string[]; stages: number; time: string;
}
export interface SaveStageResult { log?: StageLog; call?: Call; stage_logs?: StageLog[]; queued?: boolean }

// ----------------------------------------------------------------- base ----
const isLocal =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

// Default Render deployment URL (override with VITE_API_BASE on Vercel)
const DEFAULT_REMOTE_BACKEND = "https://call-copilot-api.onrender.com";

const BASE: string = (
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (isLocal ? "http://127.0.0.1:8000" : DEFAULT_REMOTE_BACKEND)
).replace(/\/$/, "");

const TOKEN_KEY = "spindle_access_token";
const OUTBOX_KEY = "spindle.outbox";

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
const getToken = () => store()?.getItem(TOKEN_KEY) || "";
const setToken = (t: string) => (t ? store()?.setItem(TOKEN_KEY, t) : store()?.removeItem(TOKEN_KEY));

/** Thrown for HTTP errors; `offline` is true when the request never got an answer. */
export class ApiError extends Error {
  constructor(message: string, public status = 0, public offline = false) { super(message); }
}

async function call(path: string, options: RequestInit = {}, retried = false): Promise<Response> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0, true);
  }
  if (res.status === 401 && !retried && typeof window !== "undefined") {
    const entered = window.prompt("Enter the Spindle access token")?.trim();
    if (entered) {
      setToken(entered);
      return call(path, options, true);
    }
  }
  if (res.status === 401) setToken("");
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* keep statusText */ }
    // 502/503/504: Render is asleep or restarting — treat like offline.
    throw new ApiError(String(detail), res.status, res.status >= 502 && res.status <= 504);
  }
  return res;
}

const json = async <T>(path: string, options?: RequestInit): Promise<T> => (await call(path, options)).json();
const post = <T>(path: string, body?: unknown) =>
  json<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

async function download(path: string, filename: string): Promise<void> {
  const blob = await (await call(path)).blob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------- outbox ----
interface OutboxItem { callId: string; body: StageLogBody; at: number }
type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

function readOutbox(): OutboxItem[] {
  try { return JSON.parse(store()?.getItem(OUTBOX_KEY) || "[]"); } catch { return []; }
}
function writeOutbox(items: OutboxItem[]) {
  store()?.setItem(OUTBOX_KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn(items.length));
}
function enqueue(callId: string, body: StageLogBody) {
  // Last tap per stage wins, like the server's upsert.
  const items = readOutbox().filter((i) => !(i.callId === callId && i.body.stage_number === body.stage_number));
  writeOutbox([...items, { callId, body, at: Date.now() }]);
}

let flushing: Promise<number> | null = null;

/** Send queued taps in order. Returns how many are still waiting. */
export function flushOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const item of readOutbox()) {
      try {
        await post(`/api/calls/${item.callId}/stage-log`, item.body);
      } catch (e) {
        if (e instanceof ApiError && e.offline) break; // still offline: keep the rest
        // 404 / 409 / 422: the call is gone or closed; the tap can't apply.
      }
      writeOutbox(readOutbox().filter((i) => i !== item && !(i.callId === item.callId && i.at === item.at)));
    }
    return readOutbox().length;
  })().finally(() => { flushing = null; });
  return flushing;
}

export const pendingFor = (callId?: string) =>
  readOutbox().filter((i) => !callId || i.callId === callId).map((i) => i.body);

export function onOutboxChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flushOutbox());
  setInterval(() => { if (readOutbox().length) void flushOutbox(); }, 15000);
}

// ------------------------------------------------------------------ api ----
export const api = {
  base: BASE,
  health: () => json<Health>("/health"),
  content: () => json<Content>("/api/content"),
  startCall: (body: NewCall) => post<{ call: Call; stage_logs: StageLog[] }>("/api/calls", body),
  listCalls: (limit = 100, offset = 0) => json<{ calls: Call[] }>(`/api/calls?limit=${limit}&offset=${offset}`),
  getCall: (id: string) => json<{ call: Call; stage_logs: StageLog[] }>(`/api/calls/${id}`),

  /** Saves a tap; if the network is down it is queued and `{queued: true}` comes back. */
  saveStage: async (id: string, body: StageLogBody): Promise<SaveStageResult> => {
    try {
      if (readOutbox().length) await flushOutbox();
      return await post<SaveStageResult>(`/api/calls/${id}/stage-log`, body);
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        enqueue(id, body);
        return { queued: true };
      }
      throw e;
    }
  },
  cue: (body: { stage_number: number; prospect_words?: string; call_id?: string }) => post<Cue>("/api/ai/cue", body),
  simulate: (body: { stage_number: number; caller_message: string; prospect_name?: string; company_name?: string; call_id?: string }) =>
    post<{ reply: string; reaction: string; suggested_words: string; source?: string }>("/api/ai/simulate", body),
  audit: (id: string, body: { outcome: string; next_step?: string }) => post<Audit>(`/api/calls/${id}/audit`, body),
  close: async (id: string, body: CloseBody) => {
    await flushOutbox(); // never close a call with its taps still in the outbox
    return post<{ call: Call; stage_logs: StageLog[]; audit: Audit }>(`/api/calls/${id}/close`, body);
  },
  stats: () => json<Stats>("/api/stats"),
  followUps: () => json<{ follow_ups: FollowUp[]; enabled: boolean }>("/api/follow-ups"),
  followUpDone: (id: string) => post<{ call: Call }>(`/api/calls/${id}/follow-up/done`),
  followUpIcs: (id: string) => download(`/api/calls/${id}/follow-up.ics`, "spindle-follow-up.ics"),
  exportCsv: () => download("/api/calls/export.csv", "spindle-calls.csv"),
};
