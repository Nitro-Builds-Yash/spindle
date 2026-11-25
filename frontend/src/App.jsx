import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { DEFAULT_CONTENT } from "./data/defaultContent.js";
import StartCall from "./views/StartCall.jsx";
import LiveCall from "./views/LiveCall.jsx";
import History from "./views/History.jsx";

const STORAGE_KEY = "spindle.currentCall";

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

  const startNewCall = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCallId(null);
    setView("start");
  }, []);

  const clearCall = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCallId(null);
  }, []);

  return (
    <div className="flex min-h-screen flex-col text-ink-900">
      {/* Top Banner if Render backend is cold-starting */}
      {wakingUp && !health && (
        <div className="bg-navy-50/90 border-b border-navy-200/80 px-4 py-2 text-center text-xs text-navy-900 flex items-center justify-center gap-2.5 backdrop-blur-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-navy"></span>
          </span>
          <span className="tnum font-medium">Waking up the server. This can take up to 30 seconds the first time.</span>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-steel-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-baseline gap-3">
          <span className="display text-[22px] font-extrabold text-ink-950" style={{ fontStretch: "125%" }}>
            Spindle
          </span>
          <span className="hidden md:inline text-sm text-ink-500">Live call guide</span>
        </div>

        {/* Central Segmented Pill Navigation: Start call | Live call | Past calls */}
        <nav className="flex h-16 items-stretch gap-1" aria-label="Sections">
          <button
            onClick={() => setView("start")}
            className={`whitespace-nowrap px-2.5 sm:px-4 text-sm font-semibold border-b-[3px] transition-colors ${
              view === "start"
                ? "border-navy text-ink-950"
                : "border-transparent text-ink-500 hover:text-ink-900"
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
            className={`flex items-center gap-1.5 sm:gap-2 whitespace-nowrap px-2.5 sm:px-4 text-sm font-semibold border-b-[3px] transition-colors ${
              view === "live"
                ? "border-navy text-ink-950"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {callId && <span className="h-2 w-2 rounded-full bg-signal" aria-label="call in progress" />}
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`whitespace-nowrap px-2.5 sm:px-4 text-sm font-semibold border-b-[3px] transition-colors ${
              view === "history"
                ? "border-navy text-ink-950"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            Past calls
          </button>
        </nav>

        </div>
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
          callId ? (
            <LiveCall
              key={callId}
              callId={callId}
              content={content}
              onNew={startNewCall}
              onFinished={finishCall}
              onClear={clearCall}
            />
          ) : (
            <div className="mx-auto max-w-md py-16 text-center rounded-2xl border border-steel-200/90 bg-white p-8 shadow-sm">
                            <h3 className="text-lg font-bold text-ink-900 mt-1">No call in progress</h3>
              <p className="text-xs text-ink-500 mt-1.5">
                Start a call to open the eight-stage guide.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button className="btn-primary" onClick={() => setView("start")}>
                  Start a call
                </button>
              </div>
            </div>
          )
        )}
        {view === "history" && (
          <History
            content={content}
            onOpen={openCall}
            onNew={() => setView("start")}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-steel-200 py-5 px-6">
        <div className="mx-auto max-w-[1240px] flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
          <span>Spindle guides a cold call to an Indian manufacturer through eight stages.</span>
          <span>Built on 100 real call transcripts.</span>
        </div>
      </footer>
    </div>
  );
}
