import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "@fontsource-variable/archivo/wdth.css";
import "./index.css";

// Error tracking only when VITE_SENTRY_DSN is set; the SDK is a separate
// chunk, so it costs nothing otherwise.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  import("@sentry/react").then((Sentry) =>
    Sentry.init({ dsn, sendDefaultPii: false, tracesSampleRate: 0 })
  );
}

createRoot(document.getElementById("root")).render(<App />);
