/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0c0f",
        panel: "#12151a",
        raised: "#171b21",
        line: "#232830",
        hair: "#1b1f25",
        muted: "#939aa4",
        faint: "#616873",
        accent: "#e9a13b",
        good: "#46cf95",
        ok: "#7ba4ff",
        bad: "#ee6f6f",
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
