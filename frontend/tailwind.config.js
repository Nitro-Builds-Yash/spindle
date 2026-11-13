/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b14",
        panel: "#0d1527",
        raised: "#131f38",
        line: "#1c2e50",
        hair: "#14223d",
        muted: "#94a3b8",
        faint: "#64748b",
        accent: "#3b82f6",
        accentHover: "#2563eb",
        accentDark: "#1d4ed8",
        good: "#10b981",
        ok: "#60a5fa",
        bad: "#f43f5e",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};
