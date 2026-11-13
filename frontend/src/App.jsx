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
    <div className="flex min-h-screen flex-col bg-[#0b0e14] text-[#e9ebee]">
      {/* Top Banner if Render backend is cold-starting */}
      {wakingUp && !health && (
        <div className="bg-amber-950/50 border-b border-amber-800/40 px-4 py-1.5 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>Waking up Render backend (Free Tier sleeps when idle ~25s)... App features are ready.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center gap-5 border-b border-neutral-800 bg-[#0b0e14]/90 px-5 backdrop-blur">
        <div className="flex min-w-[240px] items-center gap-2.5">
          <span className="h-2 w-2 rounded-sm bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.15)]" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-white">
              Meridian Growth Partners
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
              Call guide
            </div>
          </div>
        </div>

        <nav className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5">
          <button
            onClick={() => setView(callId ? "live" : "start")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition ${
              view === "live" || view === "start"
                ? "bg-neutral-800 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition ${
              view === "history"
                ? "bg-neutral-800 text-white shadow"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Past calls
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-neutral-400">
          <span
            className={`h-2 w-2 rounded-full ${
              health
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="font-mono text-xs">
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
