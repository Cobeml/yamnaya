import { describe, it, expect } from "vitest";
import { safeText, toolDetails, registerActivity } from "../openclaw/activity.mjs";
import { ActivityFeed, decodeActivity, type Activity } from "../scripts/demo/activity";
import { evidenceGates, validateEdit, type Manifest } from "../scripts/demo/evidence";
import { seedRun } from "../packages/core/src/index";
import type { PresentationState } from "../apps/web/lib/presentation";

describe("recording observation boundary", () => {
  it("omits secrets, sign-in links, code, private blocks and terminal escapes", () => {
    const result = safeText("Keep AMI online. pass-unique-4321 https://site/api/browser/enter?ticket=canary <analysis>hidden chain</analysis> ```js\nprivate source\n``` \x1b]52;c;clipboard\x07 \x1b[31m visible \u202e", ["pass-unique-4321"]);
    expect(result).toContain("Keep AMI online.");
    for (const secret of ["pass-unique", "canary", "hidden chain", "private source", "clipboard", "\x1b", "\u202e"]) expect(result).not.toContain(secret);
    expect(toolDetails("browser", { action: "open", targetUrl: "https://host?ticket=canary", snapshot: "secret" })).toEqual({ tool: "browser", detail: "open" });
    expect(toolDetails("yamnaya_standing_action", { action_json: JSON.stringify({ kind: "quarantine", sdpIds: ["SDP-001", "secret"] }) }).detail).toBe("quarantine SDP-001");
  });

  it("correlates actual hooks and cannot rewrite tools, including when the sink fails", async () => {
    const hooks = new Map<string, (e: Record<string, unknown>, c: Record<string, unknown>) => Promise<void>>();
    const events: Record<string, unknown>[] = [];
    let fail = false;
    registerActivity({ on: (name, handler) => { hooks.set(name, handler); } }, {
      getContext: async () => ({ sessionKey: "agent:main:yamnaya:defender:run-test", runId: "RUN-TEST", role: "defender", turn: 1 }),
      emit: async (_context, event) => { if (fail) throw new Error("disk unavailable"); events.push(event); },
    });
    const context = { sessionKey: "agent:main:yamnaya:defender:run-test", toolCallId: "actual-call" };
    const params = Object.freeze({ action: "open", targetUrl: "https://host?ticket=canary" });
    expect(await hooks.get("before_tool_call")!({ toolName: "browser", params }, context)).toBeUndefined();
    expect(await hooks.get("after_tool_call")!({ result: { details: { secret: "canary" } } }, context)).toBeUndefined();
    expect(events.map(e => e.kind)).toEqual(["tool.start", "tool.end"]);
    expect(events[0].callId).toBe(events[1].callId);
    expect(JSON.stringify(events)).not.toContain("canary");
    await hooks.get("before_tool_call")!({ toolName: "browser", params }, { ...context, sessionKey: "smoke-unrelated" });
    expect(events).toHaveLength(2);
    fail = true;
    expect(await hooks.get("before_tool_call")!({ toolName: "browser", params }, context)).toBeUndefined();
    expect(params.targetUrl).toContain("canary");
  });

  it("deduplicates reordered events, rejects other runs and identifies missing completions", () => {
    const output: Activity[] = [];
    const feed = new ActivityFeed("RUN-TEST", e => output.push(e));
    const base = { at: new Date().toISOString(), runId: "RUN-TEST", role: "defender", detail: "state", callId: "call" };
    feed.accept({ ...base, id: "end", kind: "tool.end" });
    feed.accept({ ...base, id: "end", kind: "tool.end" });
    expect(feed.summary().unmatched).toBe(1);
    feed.accept({ ...base, id: "start", kind: "tool.start" });
    feed.accept({ ...base, id: "different", runId: "RUN-OTHER", kind: "tool.start" });
    expect(feed.summary().unmatched).toBe(0);
    expect(output).toHaveLength(2);
    const raw = { ...base, id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", kind: "tool.end", secret: "canary", detail: "token=canary" };
    expect(JSON.stringify(decodeActivity(raw, "defender", "RUN-TEST"))).not.toContain("canary");
    expect(decodeActivity(raw, "attacker", "RUN-TEST")).toBeUndefined();
  });

  it("keeps named tracks on the shared clock and refuses incomplete terminal evidence", () => {
    const manifest: Manifest = { version: 1, runId: "RUN-TEST", mode: "live", origin: "https://example.com", startedAt: new Date().toISOString(), video: "raw.webm", reason: "test", timing: "wall clock", samples: [], interruptions: [], tracks: { dashboard: { video: "raw.webm", startedOffset: 0, duration: 30 }, terminal: { video: "terminal.webm", startedOffset: 2, duration: 20 } } };
    expect(evidenceGates(manifest).terminalComplete).toBe(false);
    const clip = { title: "Tools", start: 3, end: 8, seconds: 5, track: "terminal" as const };
    expect(() => validateEdit(manifest, { runId: "RUN-TEST", preview: true, segments: [clip] }, 30)).not.toThrow();
    expect(() => validateEdit(manifest, { runId: "RUN-TEST", preview: true, segments: [{ ...clip, start: 1 }] }, 30)).toThrow();
    expect(() => validateEdit(manifest, { runId: "RUN-TEST", preview: true, segments: [{ ...clip, end: 25 }] }, 30)).toThrow();
    expect(() => validateEdit(manifest, { runId: "RUN-TEST", preview: true, segments: [clip, { title: "Dashboard", start: 2, end: 4, seconds: 2 }] }, 30)).toThrow();
  });

  it("shows verified closure only after status changes, and reports subsequent regression", () => {
    const output: Activity[] = [];
    const state: PresentationState = { ...seedRun("RUN-TEST", "contractor", "simulation"), actor: { id: "defender", role: "defender", channel: "test" }, affected: [], checks: [{ id: "code", label: "Code", passed: true, detail: "tested" }] };
    const feed = new ActivityFeed(state.id, e => output.push(e));
    feed.observe(state);
    expect(output.at(-1)?.detail).toContain("closure pending");
    state.status = "verified";
    feed.observe(state);
    expect(output.at(-1)?.detail).toContain("closure verified");
    state.checks[0].passed = false;
    feed.observe(state);
    expect(output.at(-1)?.detail).toContain("0/1");
    expect(output.at(-1)?.detail).toContain("closure pending");
  });
});
