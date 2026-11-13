import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { DEFAULT_CONTENT } from "./data/defaultContent.js";
import StartCall from "./views/StartCall.jsx";
import LiveCall from "./views/LiveCall.jsx";
import History from "./views/History.jsx";

const STORAGE_KEY = "meridian.currentCall";

export default function App() {
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [health, setHealth] = useState(null);
  const [view, setView] = useState("start");
  const [callId, setCallId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
  const [wakingUp, setWakingUp] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setWakingUp(false);
    } catch {
      setHealth(null);
      setWakingUp(true);
    }
  }, []);

  useEffect(() => {
    // Sync live content if backend has updates
    api
      .content()
      .then(setContent)
      .catch(() => {
        // Keeps DEFAULT_CONTENT safely
      });

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("call");
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      setCallId(id);
      setView("live");
    } else if (params.get("view") === "history") {
      setView("history");
    }
  }, []);

  const openCall = useCallback((id) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCallId(id);
    setView("live");
  }, []);

  const finishCall = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCallId(null);
    setView("history");
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-[#f1f5f9]">
      {/* Top Banner if Render backend is cold-starting */}
      {wakingUp && !health && (
        <div className="bg-blue-950/60 border-b border-blue-800/50 px-4 py-1.5 text-center text-xs text-blue-200 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>Connecting to Render backend & Supabase... App features are ready.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-5 border-b border-line bg-ink/95 px-5 backdrop-blur">
        <div className="flex min-w-[240px] items-center gap-2.5">
          <span className="h-2 w-2 rounded-sm bg-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.25)]" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-white">
              Meridian Growth Partners
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-blue-400/90 font-medium">
              Cold Call Copilot
            </div>
          </div>
        </div>

        <nav className="flex gap-1 rounded-lg border border-line bg-[#0a101f]/80 p-0.5">
          <button
            onClick={() => setView(callId ? "live" : "start")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition ${
              view === "live" || view === "start"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition ${
              view === "history"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Past calls
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              health
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                : "bg-blue-400 animate-pulse"
            }`}
          />
          <span className="font-mono text-xs text-slate-300">
            {health
              ? `${health.storage} · ${health.llm}`
              : wakingUp
              ? "Waking up server..."
              : "Connecting..."}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-5 pb-16 pt-7">
        {view === "start" && (
          <StartCall
            content={content}
            hasCall={Boolean(callId)}
            resume={() => setView("live")}
            onStart={openCall}
          />
        )}
        {view === "live" && (
          <LiveCall
            key={callId}
            callId={callId}
            content={content}
            onNew={() => setView("start")}
            onFinished={finishCall}
          />
        )}
        {view === "history" && (
          <History content={content} onOpen={openCall} onNew={() => setView("start")} />
        )}
      </main>
    </div>
  );
}
