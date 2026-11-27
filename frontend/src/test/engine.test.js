import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CONTENT } from "../data/defaultContent.js";
import { suggestOutcome } from "../lib/call.js";
import { engineAvailable, getEngine } from "../lib/engine.js";

// The compiled module only exists after CI's "Rust engine" workflow has run.
const pkg = import.meta.glob("../engine/pkg/spindle_engine.js");
const built = Object.keys(pkg).length > 0;

describe("Rust engine loader", () => {
  it.runIf(!built)("returns null when the engine isn't built, so the app falls back", async () => {
    expect(engineAvailable).toBe(false);
    expect(await getEngine(DEFAULT_CONTENT)).toBeNull();
  });
});

describe.runIf(built)("Rust engine (WebAssembly)", () => {
  let engine;
  beforeAll(async () => {
    const mod = await Object.values(pkg)[0]();
    const wasm = readFileSync(resolve(process.cwd(), "src/engine/pkg/spindle_engine_bg.wasm"));
    mod.initSync({ module: wasm });
    engine = new mod.Engine(JSON.stringify(DEFAULT_CONTENT));
  });

  it("reads the stage from the prospect's words", () => {
    expect(engine.detectStage("we already have a consultant")).toBe(6);
    expect(engine.detectStage("hello")).toBe(0);
  });

  it("gives a cue for the stage the words point to", () => {
    const cue = JSON.parse(engine.cue(3, "call me Thursday"));
    expect(cue.suggests_stage).toBe(7);
    expect(cue.cue).toMatch(/^Next step: /);
  });

  it("agrees with the JS suggestOutcome", () => {
    for (const logs of [
      [{ stage_number: 7, what_happened: "named_time" }],
      [{ stage_number: 1, what_happened: "wrong_person" }],
      [{ stage_number: 3, what_happened: "busy" }],
      [],
    ]) {
      expect(engine.suggestOutcome(JSON.stringify(logs))).toBe(suggestOutcome(logs));
    }
  });

  it("flags a positive outcome after a dead-end tap", () => {
    const audit = JSON.parse(
      engine.audit("{}", JSON.stringify([{ stage_number: 1, what_happened: "wrong_person" }]), "interested")
    );
    expect(audit.warning).toMatch(/buyer was not reached/);
  });
});
