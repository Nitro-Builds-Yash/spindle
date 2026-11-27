import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  speakText,
  stopSpeaking,
  createSpeechRecognizer,
} from "../utils/speech.js";

const DEFAULT_STAGE_DIALOGUES = {
  1: {
    prospect: "Haanji, {name} speaking. Kaun baat kar rahe hain?",
    prompts: [
      "Hello {first} ji, this is Athota from Spindle.",
      "{first} ji, am I speaking with the {role} of {company}?",
    ],
  },
  2: {
    prospect: "Spindle? Look, I'm with a supervisor on the plant floor. What is this regarding? Is this a sales call?",
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
      "Thank you {first} ji, WhatsApp note sent. Have a productive shift.",
      "Confirmed. Thursday 4:00 PM on the calendar. Goodbye.",
    ],
  },
};

/** Fill {name} / {first} / {role} / {company} in a script line from the call. */
function fill(text, call) {
  const name = call?.prospect_name?.trim() || "the prospect";
  return String(text)
    .replaceAll("{name}", name)
    .replaceAll("{first}", name.split(/\s+/)[0])
    .replaceAll("{role}", call?.prospect_role?.trim() || "person in charge")
    .replaceAll("{company}", call?.company_name?.trim() || "your company");
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

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
      text: "Haanji, {name} speaking. Kaun baat kar rahe hain?",
      time: "00:03",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState(null);
  const [isCallerSpeaking, setIsCallerSpeaking] = useState(false);
  const scrollRef = useRef(null);
  const recognizerRef = useRef(null);

  function speakProspect(text, idx) {
    if (speakingIndex === idx) {
      stopSpeaking();
      setSpeakingIndex(null);
      return;
    }
    setSpeakingIndex(idx);
    speakText(text, {
      onEnd: () => setSpeakingIndex(null),
      onError: () => setSpeakingIndex(null),
      rate: 1.0,
    });
  }

  function toggleCallerSpeech() {
    if (isCallerSpeaking) {
      if (recognizerRef.current) {
        try {
          recognizerRef.current.stop();
        } catch {}
      }
      setIsCallerSpeaking(false);
      return;
    }
    const recognizer = createSpeechRecognizer({
      onStart: () => setIsCallerSpeaking(true),
      onResult: (transcript) => {
        setInput((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript));
      },
      onEnd: () => setIsCallerSpeaking(false),
      onError: () => setIsCallerSpeaking(false),
    });
    if (recognizer) {
      recognizerRef.current = recognizer;
      try {
        recognizer.start();
      } catch {
        setIsCallerSpeaking(false);
      }
    }
  }

  // Auto-advance prospect dialogue when stage changes
  const tickRef = useRef(tick);
  tickRef.current = tick;

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
            time: tickRef.current,
            stageTag: `Stage ${stageNo}`,
          },
        ]);
      }
    }
  }, [stageNo]);

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
        prospect_name: call?.prospect_name || "the prospect",
        company_name: call?.company_name || "their company",
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

  const currentPrompts = (DEFAULT_STAGE_DIALOGUES[stageNo]?.prompts || []).map((p) => fill(p, call));

  return (
    <aside className="w-full lg:w-[380px] rounded-xl2 border border-steel-200 bg-white shadow-card flex flex-col h-[680px] overflow-hidden text-ink-900">
      {/* Phone header */}
      <div className="flex items-center justify-between bg-navy-900 px-4 py-3.5 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-500 text-sm font-bold">
            {initials(call?.prospect_name)}
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold truncate">
              {call?.prospect_name || "Prospect"}
            </div>
            <p className="text-sm text-navy-200 truncate">
              {call?.company_name || ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum text-sm font-semibold text-signal">{tick}</span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-navy-200 hover:bg-navy-700 hover:text-white transition-colors"
            title="Hide practice phone"
            aria-label="Hide practice phone"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Practice phone status */}
      <div className="border-b border-steel-200 px-4 py-2 flex items-center justify-between text-sm text-ink-600">
        <span>Practice phone, stage {stageNo} of 8</span>
        <button
          type="button"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          aria-pressed={voiceEnabled}
          className="font-semibold text-navy hover:underline"
          title={`Read ${call?.prospect_name || "the prospect"}'s replies aloud`}
        >
          {voiceEnabled ? "Mute voice" : "Turn on voice"}
        </button>
      </div>

      {/* Chat Messages Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-steel-50/60 to-white text-xs"
      >
        {messages.map((m, i) => {
          const isProspect = m.sender === "prospect";
          return (
            <div
              key={i}
              className={`flex flex-col ${
                isProspect ?"items-start" : "items-end"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="tnum text-xs font-bold text-steel-400">
                  {isProspect ? call?.prospect_name || "Prospect" : "You"}
                </span>
                <span className="tnum text-xs text-steel-400">
                  {m.time}
                </span>
                {m.stageTag && (
                  <span className="tnum text-xs text-navy font-bold">
                    [{m.stageTag}]
                  </span>
                )}
              </div>

              <div
                className={`max-w-[88%] rounded-xl p-3 leading-relaxed shadow-2xs ${
                  isProspect
                    ? "bg-white border border-steel-200/90 text-ink-900 rounded-tl-xs"
                    : "bg-navy text-white rounded-tr-xs"
                }`}
              >
                <p className="text-[14px] leading-snug">{fill(m.text, call)}</p>
              </div>

              {/* One-click quote inserter into Their words & Audio Replay */}
              {isProspect && (
                <div className="mt-1 flex items-center gap-3 px-1">
                  <button
                    type="button"
                    onClick={() => onInsertWords(fill(m.text, call))}
                    className="flex items-center gap-1 tnum text-xs font-bold text-navy hover:underline"
                    title="Insert this exact quote into 'Their Words' box"
                  >
                    Use as their words
                  </button>
                  <button
                    type="button"
                    onClick={() => speakProspect(fill(m.text, call), i)}
                    className={`flex items-center gap-1 tnum text-xs font-semibold px-1.5 py-0.5 rounded-xs transition-all ${
                      speakingIndex === i
                        ? "bg-navy-600 text-white animate-pulse"
                        : "text-ink-500 hover:text-ink-800 hover:bg-steel-100"
                    }`}
                    title={speakingIndex === i ? "Speaking… click to stop" : "Hear this line"}
                  >
                    <span>{speakingIndex === i ? "🔊 Playing…" : "🔊 Hear audio"}</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {busy && (
          <div className="flex items-center gap-2 text-steel-400 tnum text-xs p-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-navy-500"></span>
            </span>
            <span>{(call?.prospect_name || "Prospect").split(" ")[0]} is replying…</span>
          </div>
        )}
      </div>

      {/* Stage-Matched Quick Pitch Pills */}
      <div className="border-t border-steel-200/80 bg-steel-50/70 p-2.5">
        <p className="tnum text-xs font-bold text-steel-400 mb-1.5 px-1">
          Lines you could say
        </p>
        <div className="space-y-1">
          {currentPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(p)}
              disabled={busy}
              className="w-full text-left rounded-lg border border-steel-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-800 hover:border-navy hover:bg-navy-50/40 transition-all line-clamp-1 truncate"
              title={p}
            >
              “{p}”
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Box with Voice Dictation */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="flex items-center gap-2 border-t border-steel-200/80 bg-white p-2.5"
      >
        <button
          type="button"
          onClick={toggleCallerSpeech}
          className={`rounded-lg p-2 transition-all border shrink-0 ${
            isCallerSpeaking
              ? "bg-rose-500 text-white animate-pulse border-rose-600 shadow-xs"
              : "bg-steel-50 hover:bg-steel-100 text-ink-600 border-steel-300"
          }`}
          title={isCallerSpeaking ? "Listening... click to stop" : "Speak your message into microphone (Speech-to-Text)"}
        >
          <span className="text-xs">{isCallerSpeaking ? "🔴" : "🎤"}</span>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isCallerSpeaking ? "Listening... speak now" : "Type or click 🎤 to speak..."}
          className="flex-1 rounded-lg border border-steel-300/90 bg-steel-50/50 px-3 py-1.5 text-xs text-ink-900 outline-none focus:border-navy focus:bg-white"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg bg-navy hover:bg-navy-600 disabled:opacity-50 text-white tnum text-xs font-bold px-3 py-1.5 shadow-sm transition-all shrink-0"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
