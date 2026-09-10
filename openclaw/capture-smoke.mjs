// An actual model/tool recording check, restricted to observation on a simulation.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { emitActivity, setActivityContext } from "./activity.mjs";
const role = process.env.YAMNAYA_AGENT_ROLE;
try {
  const response = await fetch(`${process.env.YAMNAYA_URL}/api/${role === "attacker" ? "red/observe" : "state"}`, {
    headers: { Authorization: `Bearer ${process.env[`${role.toUpperCase()}_TOKEN`]}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error();
  const state = await response.json();
  if (state.mode !== "simulation") throw new Error();
  const recordingId = process.argv[2] ?? `SMOKE-${randomUUID().toUpperCase()}`;
  if (!/^SMOKE-[A-F0-9-]{36}$/.test(recordingId)) throw new Error();
  const context = { recordingId, runId: state.runId ?? state.id, role, turn: 0, invocation: randomUUID(), sessionKey: `agent:main:yamnaya:capture:${recordingId.toLowerCase()}` };
  await setActivityContext(context);
  await emitActivity(context, { kind: "turn.start", detail: "Observation-only capture smoke" });
  const tool = role === "attacker" ? "yamnaya_red_observe" : "yamnaya_observe";
  const completion = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`, "Content-Type": "application/json", "x-openclaw-session-key": context.sessionKey },
    body: JSON.stringify({ model: "openclaw", user: context.sessionKey, stream: false, messages: [{ role: "user", content: `Observation-only capture verification on a simulation, not a live incident. Call ${tool} once${role === "defender" ? ' with resource "state", then call browser with action "status" once' : ""}. Do not call other tools, create plans, notify anyone, attack, or modify utility state. Reply with one sentence confirming observation.` }] }),
    signal: AbortSignal.timeout(180000),
  });
  if (!completion.ok) throw new Error();
  await completion.json();
  await emitActivity(context, { kind: "turn.end", detail: "Observation-only model request completed" });
  const events = (await readFile(`/home/node/.openclaw/yamnaya-activity/${recordingId}.jsonl`, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  const starts = events.filter(e => e.kind === "tool.start");
  const ends = events.filter(e => e.kind === "tool.end");
  const expected = role === "defender" ? [tool, "browser"] : [tool];
  const passed = expected.every(name => ends.some(e => e.tool === name && e.outcome === "returned")) && starts.length === ends.length && !events.some(e => e.kind === "capture.gap");
  console.log(JSON.stringify({ passed, role, recordingId, runId: context.runId, toolStarts: starts.length, toolCompletions: ends.length, recordedTools: [...new Set(ends.map(e => e.tool))], gaps: events.filter(e => e.kind === "capture.gap").length }));
  if (!passed) process.exitCode = 1;
} catch { console.log(JSON.stringify({ passed: false, role, error: "Capture smoke failed; raw responses withheld" })); process.exitCode = 1; }
