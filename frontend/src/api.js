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

// Shared access token (server: SPINDLE_ACCESS_TOKEN). Typed in once by the
// caller and kept in this browser only; it is never built into the bundle.
const TOKEN_KEY = "spindle_access_token";

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lasts for this request only */
  }
}

async function call(path, options = {}, retried = false, tokenOverride) {
  const token = tokenOverride ?? getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && !retried && typeof window !== "undefined") {
    const entered = window.prompt("Enter the Spindle access token");
    if (entered && entered.trim()) {
      setToken(entered.trim());
      return call(path, options, true, entered.trim());
    }
  }
  if (res.status === 401) setToken("");
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(detail);
  }
  return res;
}

async function callJson(path, options) {
  return (await call(path, options)).json();
}

export const api = {
  base: BASE,
  health: () => callJson("/health"),
  content: () => callJson("/api/content"),
  startCall: (body) =>
    callJson("/api/calls", { method: "POST", body: JSON.stringify(body) }),
  listCalls: () => callJson("/api/calls"),
  getCall: (id) => callJson(`/api/calls/${id}`),
  saveStage: (id, body) =>
    callJson(`/api/calls/${id}/stage-log`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cue: (body) => callJson("/api/ai/cue", { method: "POST", body: JSON.stringify(body) }),
  simulate: (body) => callJson("/api/ai/simulate", { method: "POST", body: JSON.stringify(body) }),
  audit: (id, body) =>
    callJson(`/api/calls/${id}/audit`, { method: "POST", body: JSON.stringify(body) }),
  close: (id, body) =>
    callJson(`/api/calls/${id}/close`, { method: "POST", body: JSON.stringify(body) }),
  stats: () => callJson("/api/stats"),
  // Authenticated CSV download (a plain link could not send the token).
  exportCsv: async () => {
    const blob = await (await call("/api/calls/export.csv")).blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "spindle-calls.csv",
    });
    a.click();
    URL.revokeObjectURL(url);
  },
};
