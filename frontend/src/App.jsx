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

  const openCall = useCallback((id) => {
    localStorage.setItem(STORAGE_KEY, id);
    setCallId(id);
    setView("live");
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

  const finishCall = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCallId(null);
    setView("history");
  }, []);

  const clearCall = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCallId(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-ink-900">
      {/* Top Banner if Render backend is cold-starting */}
      {wakingUp && !health && (
        <div className="bg-blue-50/90 border-b border-blue-200/80 px-4 py-2 text-center text-xs text-blue-900 flex items-center justify-center gap-2.5 backdrop-blur-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0047ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0047ff]"></span>
          </span>
          <span className="font-mono font-medium">Connecting to Render backend & Supabase... App features are ready.</span>
        </div>
      )}

      {/* Enterprise Frosted Glass Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 sm:px-8 backdrop-blur-md shadow-xs">
        {/* Brand Mark */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0047ff] to-blue-700 text-white shadow-sm shadow-blue-500/25 font-mono text-sm font-bold">
            M
          </div>
          <div>
            <div className="text-[14px] font-bold tracking-tight text-ink-950">
              Meridian Growth Partners
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>PostgreSQL Supabase · Gemini Flash Lite</span>
            </div>
          </div>
        </div>

        {/* Central Segmented Pill Navigation: Start call | Live call | Past calls */}
        <nav className="flex gap-1 rounded-xl bg-slate-100/90 border border-slate-200/80 p-1 shadow-inner">
          <button
            onClick={() => setView("start")}
            className={`rounded-lg px-3 sm:px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 ${
              view === "start"
                ? "bg-white text-ink-950 shadow-xs ring-1 ring-slate-900/5"
                : "text-slate-600 hover:text-ink-950"
            }`}
          >
            Start call
          </button>
          <button
            onClick={() => {
              if (callId) {
                setView("live");
              } else {
                api
                  .startCall({
                    prospect_name: "Ramesh Varma",
                    prospect_role: "Managing Director",
                    company_name: "Sri Balaji Precision",
                    company_kind: "mid-size private manufacturer",
                    call_type: "first call",
                  })
                  .then((res) => openCall(res.call.id))
                  .catch(() => setView("start"));
              }
            }}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-lg px-3 sm:px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 ${
              view === "live"
                ? "bg-white text-ink-950 shadow-xs ring-1 ring-slate-900/5"
                : "text-slate-600 hover:text-ink-950"
            }`}
          >
            {callId && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`rounded-lg px-3 sm:px-4 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all duration-150 ${
              view === "history"
                ? "bg-white text-ink-950 shadow-xs ring-1 ring-slate-900/5"
                : "text-slate-600 hover:text-ink-950"
            }`}
          >
            Past calls
          </button>
        </nav>

        {/* Clean right spacer for balanced navbar alignment */}
        <div className="w-[80px] sm:w-[120px] hidden sm:block" />
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 sm:px-6 pb-16 pt-8">
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
            onClear={clearCall}
          />
        )}
        {view === "history" && (
          <History
            content={content}
            onOpen={openCall}
            onNew={() => setView("start")}
          />
        )}
      </main>

      {/* Enterprise Tech Stack Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-5 px-6 backdrop-blur-md">
        <div className="mx-auto max-w-[1240px] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">Meridian Cold Call Copilot</span>
            <span className="text-slate-300">|</span>
            <span>8-Stage Indian B2B Call Guide</span>
          </div>

          {/* Technology Stack Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
              Supabase PostgreSQL
            </span>
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
              Google Gemini Flash Lite
            </span>
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
              Python FastAPI
            </span>
            <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 font-medium text-slate-700">
              React 18 · Vite · Tailwind
            </span>
            <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-[#0047ff]">
              100 Transcripts (T001–T100)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
