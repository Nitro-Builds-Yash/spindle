import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const DEFAULT_STAGE_DIALOGUES = {
  1: {
    prospect: "Haanji, Ramesh Varma speaking. Kaun baat kar rahe hain?",
    prompts: [
      "Hello Ramesh ji, this is Athota from Meridian Growth Partners.",
      "Ramesh ji, am I speaking with the Managing Director of Sri Balaji Precision?",
    ],
  },
  2: {
    prospect: "Meridian? Look, I'm with a supervisor on the plant floor. What is this regarding? Is this a sales call?",
    prompts: [
      "We help mid-size precision machining plants fix CNC rework bottlenecks and cut scrap rates.",
      "We analyzed machining throughput in the cluster and noticed a pattern in precision tooling plants.",
    ],
  },
  3: {
    prospect: "Look, everyone is selling something. I can give you exactly two minutes. What do you people do?",
    prompts: [
      "Fair enough, 2 minutes is all I need. If it's not relevant, we stop right there.",
      "Understood. Just 90 seconds to see if your line faces what other MDs told us.",
    ],
  },
  4: {
    prospect: "Right now our rework is touching 4.5% on the CNC line. Delivery schedules are slipping because of rework.",
    prompts: [
      "Is that rework caused by tooling wear, operator shifts, or incoming bar stock tolerance?",
      "How much machine capacity is lost when you have to run those rework setups?",
    ],
  },
  5: {
    prospect: "Everyone claims they can optimize throughput. But our operators have been here 15 years. How would an outsider fix it?",
    prompts: [
      "We don't replace your operators. We run a 3-day telemetry check on spindle load and idle shifts.",
      "We benchmark your cycle times against similar 4-axis machine setups in the cluster.",
    ],
  },
  6: {
    prospect: "You worked with IndoTech in Pune? Hmm, their stamping plant is similar size to ours. Did their scrap actually drop?",
    prompts: [
      "Yes, scrap went from 5.1% down to 2.2% within 60 days, adding 14 machine hours/week.",
      "We have their MD's case audit. I can share the 1-page telemetry graph.",
    ],
  },
  7: {
    prospect: "Fine. Send your one-pager on WhatsApp first. Then call me Thursday 4 PM, I will give you 15 minutes.",
    prompts: [
      "Thursday 4:00 PM is confirmed. I'll send the 1-pager on WhatsApp now.",
      "Perfect. Is this the right number for WhatsApp?",
    ],
  },
  8: {
    prospect: "Yes, send it to this WhatsApp number. Don't spam me with emails. Speak to you Thursday.",
    prompts: [
      "Thank you Ramesh ji, WhatsApp note sent. Have a productive shift.",
      "Confirmed. Thursday 4:00 PM on the calendar. Goodbye.",
    ],
  },
};

export default function PhoneSimulator({
  stageNo,
  call,
  tick,
  onInsertWords,
  onClose,
}) {
  const [messages, setMessages] = useState([
    {
      sender: "prospect",
      text: "Haanji, Ramesh Varma speaking. Kaun baat kar rahe hain?",
      time: "00:03",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  // Auto-advance prospect dialogue when stage changes
  const prevStage = useRef(stageNo);
  useEffect(() => {
    if (stageNo !== prevStage.current) {
      prevStage.current = stageNo;
      const stageData = DEFAULT_STAGE_DIALOGUES[stageNo];
      if (stageData) {
        setMessages((prev) => [
          ...prev,
          {
            sender: "prospect",
            text: stageData.prospect,
            time: tick,
            stageTag: `Stage ${stageNo}`,
          },
        ]);
      }
    }
  }, [stageNo, tick]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  async function sendMessage(text) {
    const callerText = (text || input).trim();
    if (!callerText) return;

    const newMsg = { sender: "caller", text: callerText, time: tick };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
    setBusy(true);

    try {
      const res = await api.simulate({
        stage_number: stageNo,
        caller_message: callerText,
        prospect_name: call?.prospect_name || "Ramesh Varma",
        company_name: call?.company_name || "Sri Balaji Precision",
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: "prospect",
          text: res.reply,
          reaction: res.reaction,
          source: res.source,
          time: tick,
        },
      ]);
    } catch {
      // Fallback to authentic transcript dialogue
      const fallback =
        DEFAULT_STAGE_DIALOGUES[stageNo]?.prospect ||
        "Tell me what this is regarding.";
      setMessages((prev) => [
        ...prev,
        {
          sender: "prospect",
          text: fallback,
          time: tick,
          source: "transcripts",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const currentPrompts = DEFAULT_STAGE_DIALOGUES[stageNo]?.prompts || [];

  return (
    <aside className="w-full lg:w-[380px] rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-xl flex flex-col h-[680px] overflow-hidden text-slate-900 transition-all">
      {/* Phone Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-900 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-mono text-xs font-bold text-white shadow-inner">
            RV
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-tight">
                {call?.prospect_name || "Ramesh Varma"}
              </span>
              <span className="rounded-xs bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase text-emerald-400">
                Call Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              {call?.company_name || "Sri Balaji Precision"} · {tick}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          title="Hide Simulator"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Simulator Description Banner */}
      <div className="bg-slate-50 border-b border-slate-200/80 px-3.5 py-2 flex items-center justify-between text-xs text-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
          <span className="font-mono text-[11px] font-semibold text-slate-800">Gemini Flash Lite & Transcripts</span>
        </div>
        <span className="font-mono text-[10px] text-[#0047ff] font-bold bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded-sm">
          Stage {stageNo}/8
        </span>
      </div>

      {/* Chat Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-slate-50/60 to-white text-xs"
      >
        {messages.map((m, i) => {
          const isProspect = m.sender === "prospect";
          return (
            <div
              key={i}
              className={`flex flex-col ${
                isProspect ? "items-start" : "items-end"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-400">
                  {isProspect ? "Ramesh Varma (Prospect)" : "You (Caller)"}
                </span>
                <span className="font-mono text-[9px] text-slate-400">
                  {m.time}
                </span>
                {m.stageTag && (
                  <span className="font-mono text-[9px] text-[#0047ff] font-bold">
                    [{m.stageTag}]
                  </span>
                )}
              </div>

              <div
                className={`max-w-[88%] rounded-xl p-3 leading-relaxed shadow-2xs ${
                  isProspect
                    ? "bg-white border border-slate-200/90 text-slate-900 rounded-tl-xs"
                    : "bg-[#0b132b] text-white rounded-tr-xs"
                }`}
              >
                <p className="font-medium text-[12px]">{m.text}</p>
              </div>

              {/* One-click quote inserter into THEIR WORDS */}
              {isProspect && (
                <button
                  type="button"
                  onClick={() => onInsertWords(m.text)}
                  className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold text-[#0047ff] hover:underline px-1"
                  title="Insert this exact quote into 'Their Words' box"
                >
                  <span>↳</span> Insert into "Their Words"
                </button>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] p-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span>Ramesh is responding…</span>
          </div>
        )}
      </div>

      {/* Stage-Matched Quick Pitch Pills */}
      <div className="border-t border-slate-200/80 bg-slate-50/70 p-2.5">
        <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
          Quick Pitch (Stage {stageNo})
        </p>
        <div className="space-y-1">
          {currentPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(p)}
              disabled={busy}
              className="w-full text-left rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-800 hover:border-[#0047ff] hover:bg-blue-50/40 transition-all line-clamp-1 truncate"
              title={p}
            >
              “{p}”
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2 border-t border-slate-200/80 bg-white p-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type what you say on call..."
          className="flex-1 rounded-lg border border-slate-300/90 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-[#0047ff] focus:bg-white"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-[#0047ff] hover:bg-blue-600 disabled:opacity-50 text-white font-mono text-xs font-bold px-3 py-1.5 shadow-sm transition-all shrink-0"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
