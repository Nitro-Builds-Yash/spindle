/** @type {import('tailwindcss').Config} */
// Spindle design tokens: a machine-shop instrument panel.
// steel surfaces, graphite ink, blueprint navy for actions,
// safety amber reserved for "live now" (current stage, call timer).
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#141A22",
          900: "#1B2430",
          800: "#2A3441",
          700: "#3D4856",
          600: "#55606E",
          500: "#6E7884",
          400: "#98A1AB",
        },
        steel: {
          50: "#F6F7F8",
          100: "#EDEFF1",
          200: "#DDE1E5",
          300: "#C6CCD2",
          400: "#A3ABB4",
        },
        navy: {
          DEFAULT: "#1F3A5F",
          50: "#EEF2F7",
          100: "#DCE4EE",
          200: "#B9C8DB",
          300: "#8DA5C2",
          400: "#5D7DA3",
          500: "#36577F",
          600: "#1F3A5F",
          700: "#192F4D",
          800: "#13243B",
          900: "#0E1A2B",
        },
        signal: { DEFAULT: "#F2A900", soft: "#FDF3D7", ink: "#6B4A00" },
        go: { DEFAULT: "#1F7A5A", soft: "#E3F1EB" },
        stop: { DEFAULT: "#B3261E", soft: "#F9E5E3" },
      },
      fontFamily: {
        sans: ['"Archivo Variable"', '"Archivo"', "system-ui", "sans-serif"],
        mono: ['"Archivo Variable"', '"Archivo"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        xs: "0 1px 0 0 rgba(20,26,34,0.04)",
        soft: "0 1px 2px rgba(20,26,34,0.06)",
        card: "0 1px 0 rgba(20,26,34,0.04), 0 1px 3px rgba(20,26,34,0.06)",
        float: "0 18px 40px -12px rgba(14,26,43,0.28)",
        blueGlow: "0 0 0 3px rgba(31,58,95,0.18)",
      },
      borderRadius: { lg2: "6px", xl2: "8px" },
    },
  },
  plugins: [],
};
