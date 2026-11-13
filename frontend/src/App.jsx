import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import StartCall from "./views/StartCall.jsx";
import LiveCall from "./views/LiveCall.jsx";
import History from "./views/History.jsx";

const STORAGE_KEY = "meridian.currentCall";

export default function App() {
  const [content, setContent] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [view, setView] = useState("start");
  const [callId, setCallId] = useState(() => localStorage.getItem(STORAGE_KEY) || null);

  useEffect(() => {
    api
      .content()
      .then(setContent)
      .catch((e) => setError(`Cannot reach the API at ${api.base}. ${e.message}`));
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  // A call can be opened directly: /?call=<id>. Used by the README screenshots
  // and to reopen a call on another machine.
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

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-muted">
        <div className="card max-w-lg p-6">
          <h1 className="mb-2 text-lg font-semibold text-[#e9ebee]">Backend not reachable</h1>
          <p className="text-sm">{error}</p>
          <pre className="mt-4 overflow-auto rounded-lg border border-line bg-[#080a0d] p-3 text-xs text-[#e9ebee]">
            cd backend{"\n"}pip install -r requirements.txt{"\n"}uvicorn app.main:app --reload --port 8000
          </pre>
          <p className="mt-3 text-xs text-faint">
            The screen reads VITE_API_BASE. On Vercel that is the Render URL.
          </p>
        </div>
      </div>
    );
  }

  if (!content) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading the call model…</div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-5 border-b border-line bg-ink/90 px-5 backdrop-blur">
        <div className="flex min-w-[240px] items-center gap-2.5">
          <span className="h-2 w-2 rounded-sm bg-accent shadow-[0_0_0_4px_rgba(233,161,59,0.12)]" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">
              Meridian Growth Partners
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-faint">
              Call guide
            </div>
          </div>
        </div>

        <nav className="flex gap-0.5 rounded-lg border border-line bg-panel p-0.5">
          <button
            onClick={() => setView(callId ? "live" : "start")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium ${
              view === "live" || view === "start"
                ? "bg-raised text-[#e9ebee] shadow-[inset_0_0_0_1px_#232830]"
                : "text-muted hover:text-[#e9ebee]"
            }`}
          >
            Live call
          </button>
          <button
            onClick={() => setView("history")}
            className={`rounded-md px-3.5 py-1.5 text-[12.5px] font-medium ${
              view === "history"
                ? "bg-raised text-[#e9ebee] shadow-[inset_0_0_0_1px_#232830]"
                : "text-muted hover:text-[#e9ebee]"
            }`}
          >
            Past calls
          </button>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-faint">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              health ? "bg-good shadow-[0_0_0_3px_rgba(70,207,149,0.14)]" : "bg-bad"
            }`}
          />
          <span className="font-mono">
            {health ? `${health.storage} · ${health.llm}` : "offline"}
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
