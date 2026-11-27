import React from "react";

/** The four things that can happen at a stage; keys 1-4 pick them too. */
export default function TapGrid({ taps, value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {taps.map((t, i) => {
        const on = value === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative min-h-[56px] p-3 pr-7 rounded-lg2 border text-left text-[14px] font-medium leading-snug transition-colors group ${
              on
                ? "bg-navy text-white border-navy font-semibold shadow-[inset_4px_0_0_#F2A900]"
                : "bg-white text-ink-800 border-steel-300 hover:border-ink-500"
            }`}
          >
            <span
              className={`absolute top-1.5 right-1.5 tnum text-xs px-1 rounded-2xs transition-all ${
                on
                  ? "text-navy-100 bg-navy-700/60"
                  : "text-steel-400 bg-steel-100 group-hover:text-ink-600 group-hover:bg-steel-200"
              }`}
            >
              {i + 1}
            </span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
