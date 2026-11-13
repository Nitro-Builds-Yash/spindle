/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",          // High-contrast slate-900
        paper: "#f8fafc",        // Clean slate-50 background
        card: "#ffffff",         // Pure white surface
        line: "#cbd5e1",         // Crisp slate-300 border
        lineLight: "#e2e8f0",    // Soft slate-200 divider
        muted: "#475569",        // Slate-600
        faint: "#64748b",        // Slate-500
        cobalt: "#0047ff",       // Reference screen electric blue
        accent: "#0047ff",       // Electric blue accent
        good: "#059669",         // Emerald-600
        ok: "#0284c7",           // Sky-600
        bad: "#dc2626",          // Rose-600
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        md: "6px",
      },
    },
  },
  plugins: [],
};
