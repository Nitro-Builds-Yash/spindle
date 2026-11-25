import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, onOutboxChange, pendingFor } from "../api";
import PhoneSimulator from "../components/PhoneSimulator.jsx";
import CloseModal from "../components/live/CloseModal.jsx";
import CallSummary from "../components/live/CallSummary.jsx";
import StageRail from "../components/live/StageRail.jsx";
import TapGrid from "../components/live/TapGrid.jsx";
import { clock } from "../lib/call.js";
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
} from "../utils/speech.js";

/** Server logs plus taps still waiting in the outbox (marked pending). */
function mergePending(logs, callId) {
  const out = logs.filter((l) => !pendingFor(callId).some((p) => p.stage_number === Number(l.stage_number)));
  for (const p of pendingFor(callId)) out.push({ ...p, call_id: callId, pending: true });
  return out.sort((a, b) => Number(a.stage_number) - Number(b.stage_number));
}

export default function LiveCall({ callId, content, onNew, onFinished, onClear }) {
  const [call, setCall] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stageNo, setStageNo] = useState(1);
  const [tap, setTap] = useState("");
  const [words, setWords] = useState("");
  const [cue, setCue] = useState(null);
  const [cueBusy, setCueBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState("00:00");
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(null);
  const [showSim, setShowSim] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isWhispering, setIsWhispering] = useState(false);
  const wordsRef = useRef(null);
  const recognizerRef = useRef(null);
  const heardRef = useRef("");
  const [pending, setPending] = useState(() => pendingFor(callId).length);
  useEffect(() => onOutboxChange(() => setPending(pendingFor(callId).length)), [callId]);

  function toggleDictation() {
    if (isListening) {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }
    const recognizer = createSpeechRecognizer({
      onStart: () => {
        heardRef.current = "";
        setIsListening(true);
      },
      onResult: (transcript) => {
        heardRef.current = `${heardRef.current} ${transcript}`.trim();
        setWords((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
      },
      onEnd: () => {
        setIsListening(false);
        // What they said is in: get the next line without another tap.
        if (heardRef.current) askCue(`${wordsRef.current?.value || heardRef.current}`);
      },
      onError: () => setIsListening(false),
    });
    if (recognizer) {
      recognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch {
        setIsListening(false);
      }
    } else {
      alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    }
  }

  function handleWhisperCue() {
    if (isWhispering) {
      stopSpeaking();
      setIsWhispering(false);
      return;
    }
    if (!cue?.cue) return;
    setIsWhispering(true);
    speakText(cue.cue, {
      onEnd: () => setIsWhispering(false),
      onError: () => setIsWhispering(false),
      rate: 1.05,
    });
  }

  const stages = content.stages;
  const stage = useMemo(
    () => stages.find((s) => s.number === stageNo) || stages[0],
    [stages, stageNo]
  );
  const next = stages.find((s) => s.number === stageNo + 1);

  const load = useCallback(async () => {
    try {
      const data = await api.getCall(callId);
      setCall(data.call);
      setLogs(mergePending(data.stage_logs || [], callId));
      const no = Number(data.call.highest_stage_reached) || 1;
      setStageNo(no);
      if (data.call.status !== "in_progress") {
        setClosed({ outcome: data.call.outcome, summary: data.call.ai_summary });
      }
    } catch (e) {
      // The saved call no longer exists (deleted, or a different database):
      // forget it instead of showing a dead screen.
      if (e instanceof ApiError && e.status === 404) return onClear?.();
      setErr(e.message);
    }
  }, [callId, onClear]);

  useEffect(() => {
    if (callId) load();
  }, [callId, load]);

  useEffect(() => {
    if (!call?.started_at) return;
    setTick(clock(call.started_at));
    const t = setInterval(() => setTick(clock(call.started_at)), 1000);
    return () => clearInterval(t);
  }, [call?.started_at]);

  useEffect(() => {
    const existing = logs.find((l) => Number(l.stage_number) === stageNo);
    setTap(existing?.what_happened || stage.default_tap);
    setWords(existing?.prospect_words || "");
    setCue(existing?.ai_suggestion ? { cue: existing.ai_suggestion } : null);
    setErr("");
  }, [stageNo, stage, logs]);

  useEffect(() => {
    function onKey(e) {
      if (closing) return;
      if (["TEXTAREA", "INPUT", "SELECT"].includes(e.target.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= stage.taps.length) setTap(stage.taps[n - 1].key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, closing]);

  async function askCue(text) {
    setCueBusy(true);
    try {
      const res = await api.cue({
        stage_number: stageNo,
        prospect_words: typeof text === "string" ? text : words,
        call_id: callId,
      });
      setCue(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setCueBusy(false);
    }
  }

  async function saveStage() {
    if (!tap) {
      setErr("Tap what happened. The tap is the record.");
      return false;
    }
    const body = {
      stage_number: stageNo,
      what_happened: tap,
      prospect_words: words,
      ai_suggestion: cue?.cue || "",
    };
    const res = await api.saveStage(callId, body);
    if (res?.queued) {
      // Offline: keep going; the tap is on this device and syncs later.
      setLogs((prev) => mergePending(prev, callId));
      return true;
    }
    if (res?.stage_logs) {
      setLogs(res.stage_logs);
    }
    if (res?.call) {
      setCall(res.call);
    }
    return true;
  }

  async function goNext() {
    setSaving(true);
    setErr("");
    try {
      const ok = await saveStage();
      if (!ok) return;
      if (stageNo === 8) {
        setClosing(true);
      } else {
        setStageNo(stageNo + 1);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function endCall() {
    setSaving(true);
    setErr("");
    try {
      await saveStage();
    } catch {
      /* the call can still be closed without the last tap */
    } finally {
      setSaving(false);
      setClosing(true);
    }
  }

  if (err && !call) {
    return (
      <div className="grid place-items-center gap-4 py-24 text-ink-500 tnum text-sm">
        <p>{err}</p>
        <button className="btn-primary" onClick={onNew}>
          Start a new call
        </button>
      </div>
    );
  }
  if (!call) return <div className="py-24 text-center text-ink-500 tnum text-sm">Loading call…</div>;

  if (closed) {
    return (
      <CallSummary
        call={call}
        content={content}
        onNew={onNew}
        onFinished={onFinished}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 py-2 sm:py-6 relative">
      
      {/* Call guide panel */}
      <div className="w-full max-w-[520px] rounded-xl2 border border-steel-200 bg-white p-6 sm:p-7 shadow-float text-ink-900 shrink-0">

        {/* Instrument header: who, how long, where in the call */}
        <div className="-mx-6 -mt-6 sm:-mx-7 sm:-mt-7 mb-6 rounded-t-xl2 bg-navy-900 px-6 sm:px-7 pt-6 pb-5 text-white bg-[radial-gradient(120%_140%_at_100%_0%,rgba(242,169,0,0.10),transparent_45%)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[24px] font-extrabold leading-tight truncate">
                {call.prospect_name || "Unknown prospect"}
              </h2>
              <p className="text-sm text-navy-200 mt-1">
                {[call.prospect_role, call.company_name].filter(Boolean).join(", ")}
                {call.call_type ? <span className="text-navy-300"> ({call.call_type})</span> : null}
              </p>
            </div>
            <div className="shrink-0 text-right" aria-label={`Call time ${tick}`}>
              <div className="display tnum text-[30px] font-extrabold leading-none text-signal">{tick}</div>
              <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-navy-200">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
                </span>
                On call
              </div>
            </div>
          </div>

          <StageRail stages={stages} stageNo={stageNo} onPick={setStageNo} />
        </div>

        <div className="flex items-center justify-between gap-2 text-sm -mt-2 mb-5">
          <span className="tnum text-ink-500">Stage {stage.number} of 8</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onNew} className="font-semibold text-navy hover:underline">
              New call
            </button>
            <span className="text-steel-300" aria-hidden>|</span>
            <button
              type="button"
              onClick={() => setShowSim(!showSim)}
              className="font-semibold text-ink-600 hover:text-ink-900"
              aria-pressed={showSim}
            >
              {showSim ? "Hide practice phone" : "Show practice phone"}
            </button>
          </div>
        </div>

        {pending > 0 && (
          <div role="status" className="mb-4 rounded-lg2 border border-signal bg-signal-soft px-4 py-2.5 text-sm text-ink-900">
            You're offline. {pending === 1 ? "1 tap is" : `${pending} taps are`} saved on this device
            and will send when the connection is back. Keep going.
          </div>
        )}

        {/* Stage name & purpose */}
        <div key={stage.key} className="mb-5 border-l-[3px] border-signal pl-4 motion-safe:animate-[stageIn_220ms_ease-out]">
          <h3 className="text-[26px] font-bold leading-tight text-ink-950">
            {stage.name}
          </h3>
          <p className="text-[15px] text-ink-700 mt-1.5 leading-relaxed max-w-[60ch]">
            {stage.purpose}
          </p>
        </div>

        {/* They may say */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="label">
              They may say
            </p>
            <span className="text-xs text-ink-400">Tap one to use it</span>
          </div>
          <div className="space-y-1.5">
            {stage.what_they_say.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setWords(q);
                  if (wordsRef.current) wordsRef.current.focus();
                }}
                className="w-full text-left rounded-lg2 border border-steel-200 bg-steel-50 hover:bg-white hover:border-navy-300 px-3.5 py-2.5 text-[14px] text-ink-800 leading-snug transition-colors cursor-pointer"
                title="Click to insert this quote into 'Their Words'"
              >
                <span>“{q}”</span>
              </button>
            ))}
          </div>
        </div>

        {/* What happened (2x2 Grid with Exact Reference Layout) */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <p className="label">
              What happened
            </p>
            <span className="tnum text-xs text-steel-400">Keys 1–4</span>
          </div>
          <TapGrid taps={stage.taps} value={tap} onChange={setTap} />
        </div>

        {/* Their words */}
        <div className="mt-4 pt-3.5 border-t border-steel-200/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="label">
                Their words
              </p>
              {/* Hands-free Voice Dictation Button */}
              <button
                type="button"
                onClick={toggleDictation}
                className={`flex items-center gap-1 rounded-xs px-2 py-0.5 tnum text-xs font-bold transition-all shadow-2xs ${
                  isListening
                    ? "bg-rose-500 text-white animate-pulse border border-rose-600"
                    : "bg-steel-100 hover:bg-steel-200 text-ink-700 border border-steel-300"
                }`}
                title={isListening ? "Listening... click to stop" : "Speak to dictate prospect's quote hands-free"}
              >
                <span>{isListening ? "🔴 Listening…" : "🎤 Dictate"}</span>
              </button>
            </div>
            <button
              className="text-xs tnum font-bold text-navy hover:underline flex items-center gap-1"
              onClick={askCue}
              disabled={cueBusy}
            >
              {cueBusy && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-navy"></span>
                </span>
              )}
              {cueBusy ? "Gemini is thinking…" : "⚡ Ask AI cue"}
            </button>
          </div>
          <textarea
            ref={wordsRef}
            rows={2}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="Type, click quotes above, or click 🎤 Dictate to speak..."
            className={`w-full rounded-xs border bg-white/90 backdrop-blur-xs px-3 py-2 text-[12.5px] text-ink-900 outline-none transition-all placeholder:text-steel-400 font-sans ${
              isListening
                ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/20"
                : "border-steel-300/90 focus:border-navy focus:ring-2 focus:ring-navy-500/15"
            }`}
          />
          {cue && (
            <div className="mt-2.5 rounded-lg border border-navy-200/90 bg-gradient-to-r from-navy-50/95 to-indigo-50/90 backdrop-blur-xs p-3 text-xs text-navy-950 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="tnum font-bold text-navy text-xs flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-navy"></span>
                  Spoken AI Cue
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleWhisperCue}
                    className={`flex items-center gap-1 tnum text-xs font-bold px-1.5 py-0.5 rounded-xs transition-all ${
                      isWhispering
                        ? "bg-navy-600 text-white animate-pulse"
                        : "bg-white text-navy-700 hover:bg-navy-100 border border-navy-200"
                    }`}
                    title={isWhispering ? "Whispering into ear... click to stop" : "Whisper cue into earpiece via Text-to-Speech"}
                  >
                    <span>{isWhispering ? "🔊 Whispering…" : "🔊 Whisper to Ear"}</span>
                  </button>
                  <span className="tnum text-xs text-navy-700 font-semibold bg-white/90 border border-navy-200 px-1.5 py-0.2 rounded-xs">
                    ⚡ Gemini Flash Lite
                  </span>
                </div>
              </div>
              <p className="font-medium text-ink-900 leading-relaxed text-[12px] pl-2.5 border-l-2 border-navy">
                “{cue.cue}”
              </p>
            </div>
          )}
        </div>

        {err && <p className="mt-2.5 text-xs text-rose-600 tnum">{err}</p>}

        {/* Actions */}
        <div className="mt-5 pt-3.5 border-t border-steel-200/60 flex gap-2.5">
          <button
            className="btn-primary flex-1 py-3.5 text-[15px]"
            onClick={goNext}
            disabled={saving}
          >
            {saving ? "Saving…" : next ? `Next: ${next.name}` : "Close the call"}
          </button>
          <button
            className="btn-ghost px-5 py-3.5 text-[15px] text-stop hover:border-stop"
            onClick={endCall}
            disabled={saving}
          >
            End call
          </button>
        </div>

      </div>

      {/* Side Companion Chatbot Phone Simulator */}
      {showSim && (
        <PhoneSimulator
          stageNo={stageNo}
          call={call}
          tick={tick}
          onInsertWords={(quote) => {
            setWords(quote);
            if (wordsRef.current) wordsRef.current.focus();
          }}
          onClose={() => setShowSim(false)}
        />
      )}

      {closing && (
        <CloseModal
          callId={callId}
          content={content}
          logs={logs}
          stageNo={stageNo}
          onCancel={() => setClosing(false)}
          onClosed={(data) => {
            setCall(data.call);
            setLogs(data.stage_logs || []);
            setClosed({ outcome: data.call.outcome, summary: data.call.ai_summary });
            setClosing(false);
          }}
        />
      )}
    </div>
  );
}

