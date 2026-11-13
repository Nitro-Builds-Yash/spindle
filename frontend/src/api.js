const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

// Default Render deployment URL (customizable via VITE_API_BASE on Vercel)
const DEFAULT_REMOTE_BACKEND = "https://call-copilot-api.onrender.com";

const BASE = (
  import.meta.env.VITE_API_BASE ||
  (isLocal ? "http://127.0.0.1:8000" : DEFAULT_REMOTE_BACKEND)
).replace(/\/$/, "");

async function call(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  base: BASE,
  health: () => call("/health"),
  content: () => call("/api/content"),
  startCall: (body) =>
    call("/api/calls", { method: "POST", body: JSON.stringify(body) }),
  listCalls: () => call("/api/calls"),
  getCall: (id) => call(`/api/calls/${id}`),
  saveStage: (id, body) =>
    call(`/api/calls/${id}/stage-log`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cue: (body) => call("/api/ai/cue", { method: "POST", body: JSON.stringify(body) }),
  audit: (id, body) =>
    call(`/api/calls/${id}/audit`, { method: "POST", body: JSON.stringify(body) }),
  close: (id, body) =>
    call(`/api/calls/${id}/close`, { method: "POST", body: JSON.stringify(body) }),
  stats: () => call("/api/stats"),
};
