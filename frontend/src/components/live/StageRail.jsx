import React from "react";

/** The call as one thread: eight stops, finished ones checked, current one amber. */
export default function StageRail({ stages, stageNo, onPick, logged = new Set() }) {
  return (
    <ol className="relative mt-6 grid grid-cols-8" aria-label="Call stages">
      <span className="absolute left-[6.25%] right-[6.25%] top-[13px] h-[3px] rounded-full bg-navy-700" aria-hidden />
      <span
        className="absolute left-[6.25%] top-[13px] h-[3px] rounded-full bg-gradient-to-r from-navy-300 to-signal transition-[width] duration-500"
        style={{ width: `${((stageNo - 1) / 7) * 87.5}%` }}
        aria-hidden
      />
      {stages.map((s) => {
        const now = s.number === stageNo;
        // Passed over without a tap (jumped ahead on the rail): not "done".
        const past = s.number < stageNo && logged.has(s.number);
        const skipped = s.number < stageNo && !past;
        return (
          <li key={s.key} className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={() => onPick(s.number)}
              aria-current={now ? "step" : undefined}
              title={skipped ? `${s.name} (nothing tapped)` : s.name}
              className={`tnum relative z-10 flex h-[29px] w-[29px] items-center justify-center rounded-full text-[13px] font-bold transition-all duration-200 ${
                now
                  ? "scale-110 bg-signal text-ink-950 ring-4 ring-signal/25 shadow-[0_0_18px_rgba(242,169,0,0.55)]"
                  : past
                  ? "bg-navy-300 text-navy-900 hover:bg-white"
                  : skipped
                  ? "bg-navy-900 text-navy-200 border-2 border-dashed border-navy-400 hover:border-white"
                  : "bg-navy-900 text-navy-300 border-2 border-navy-600 hover:border-navy-300"
              }`}
            >
              {past ? (
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
              ) : (
                s.number
              )}
            </button>
            <span
              className={`mt-2 px-0.5 text-center text-[11px] leading-tight ${
                now ? "font-bold text-white whitespace-nowrap" : "hidden sm:block text-navy-300"
              }`}
            >
              {s.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
