// Loads the Rust rules engine (engine/ crate, compiled to WebAssembly).
//
// The compiled module lives in src/engine/pkg and is produced by CI
// (.github/workflows/engine.yml). If it isn't there, glob() finds nothing and
// every caller gets `null`: the app works exactly as before, server-side.

import { useEffect, useState } from "react";

const modules = import.meta.glob("../engine/pkg/spindle_engine.js");
const loader = Object.values(modules)[0];

let ready = null; // Promise<module | null>
const cache = new WeakMap(); // content object -> Engine

function loadModule() {
  if (!ready) {
    ready = loader
      ? loader()
          .then(async (mod) => {
            await mod.default();
            return mod;
          })
          .catch((e) => {
            console.warn("Rust engine unavailable, using server rules:", e);
            return null;
          })
      : Promise.resolve(null);
  }
  return ready;
}

/** Thin JS wrapper: JSON in, objects out. */
function wrap(raw) {
  return {
    detectStage: (words) => raw.detectStage(words || "") || null,
    cue: (stage, words) => ({ ...JSON.parse(raw.cue(stage, words || "")), source: "rules (on device)" }),
    suggestOutcome: (logs) => raw.suggestOutcome(JSON.stringify(logs || [])),
    audit: (call, logs, outcome) => ({
      ...JSON.parse(raw.audit(JSON.stringify(call || {}), JSON.stringify(logs || []), outcome)),
      source: "rules (on device)",
    }),
  };
}

/** Engine for this content, or null while loading / if not built. */
export async function getEngine(content) {
  const mod = await loadModule();
  if (!mod || !content) return null;
  if (!cache.has(content)) {
    try {
      cache.set(content, wrap(new mod.Engine(JSON.stringify(content))));
    } catch (e) {
      console.warn("Rust engine rejected the content:", e);
      return null;
    }
  }
  return cache.get(content);
}

export const engineAvailable = Boolean(loader);

/** React hook: the engine once loaded, else null. */
export function useEngine(content) {
  const [engine, setEngine] = useState(null);
  useEffect(() => {
    let live = true;
    getEngine(content).then((e) => live && setEngine(e));
    return () => {
      live = false;
    };
  }, [content]);
  return engine;
}
