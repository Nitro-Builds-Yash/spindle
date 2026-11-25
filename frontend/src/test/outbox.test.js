import { afterEach, describe, expect, it, vi } from "vitest";
import { api, flushOutbox, pendingFor } from "../api";

const ok = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe("stage-tap outbox", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("queues a tap when offline and sends it when back online", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    const res = await api.saveStage("call-1", { stage_number: 3, what_happened: "clear_yes" });
    expect(res).toEqual({ queued: true });
    expect(pendingFor("call-1")).toHaveLength(1);

    // A second tap on the same stage replaces the first, like the server upsert.
    await api.saveStage("call-1", { stage_number: 3, what_happened: "busy" });
    expect(pendingFor("call-1").map((b) => b.what_happened)).toEqual(["busy"]);

    const fetchMock = vi.fn(() => ok({ log: {} }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await flushOutbox()).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).what_happened).toBe("busy");
  });

  it("treats a sleeping server (503) as offline", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 503 }))));
    expect(await api.saveStage("call-2", { stage_number: 1, what_happened: "right_person" })).toEqual({ queued: true });
  });

  it("drops a queued tap the server rejects for good (call closed)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    await api.saveStage("call-3", { stage_number: 2, what_happened: "understood" });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response('{"detail":"call already closed"}', { status: 409 }))));
    expect(await flushOutbox()).toBe(0);
  });

  it("flushes the outbox before closing a call", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("offline"))));
    await api.saveStage("call-4", { stage_number: 8, what_happened: "clean_close" });
    const order = [];
    vi.stubGlobal("fetch", vi.fn((url) => { order.push(String(url).split("/api/")[1]); return ok({}); }));
    await api.close("call-4", { outcome: "interested" });
    expect(order).toEqual(["calls/call-4/stage-log", "calls/call-4/close"]);
  });
});
