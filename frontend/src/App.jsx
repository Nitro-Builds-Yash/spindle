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
    api
      .content()
      .then(setContent)
      .catch(() => {});

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
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-[#0f172a]">
      {/* Top Banner if Render backend is cold-starting */}
      {wakingUp && !health && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-1.5 text-center text-xs text-blue-900 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0047ff] animate-ping" />
          <span className="font-mono">Connecting to Render backend & Supabase... App features are ready.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
        <div className="flex min-w-[240px] items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-none bg-[#0047ff]" />
          <div className="leading-tight">
            <div className="text-[13px] font-bold tracking-tight text-[#0f172a]">
              Meridian Growth Partners
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#0047ff] font-semibold">
              Call Guide · FDE Platform
            </div>
          </div>
        </div>

        <nav className="flex gap-1 rounded-md border border-slate-300 bg-slate-100 p-0.5">
          <button
            onClick={() => setView(callId ? "live" : "start")}
            className={`rounded-sm px-3.5 py-1.5 text-[12px] font-mono font-semibold uppercase tracking-wider transition ${
              view === "live" || view === "start"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-black"
            }`}
          >
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`rounded-sm px-3.5 py-1.5 text-[12px] font-mono font-semibold uppercase tracking-wider transition ${
              view === "history"
                ? "bg-[#0f172a] text-white shadow-xs"
                : "text-slate-600 hover:text-black"
            }`}
          >
            Past calls
          </button>
        </nav>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <span
            className={`h-2 w-2 rounded-full ${
              health
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-blue-500 animate-pulse"
            }`}
          />
          <span>
            {health
              ? `${health.storage} · ${health.llm}`
              : wakingUp
              ? "Waking up server..."
              : "Connecting..."}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] flex-1 px-5 pb-16 pt-7">
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
