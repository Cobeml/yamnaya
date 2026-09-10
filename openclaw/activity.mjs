// This is an observation channel, never an agent tool or an authority source.
/* eslint-disable no-control-regex -- strip terminal and bidi control sequences before capture */
import { appendFile, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const directory = "/home/node/.openclaw/yamnaya-activity";
const contextFile = `${directory}/context.json`;

export function safeText(value, secrets = Object.entries(process.env)
  .filter(([key]) => /TOKEN|SECRET|PASSWORD|API_KEY|DATABASE_URL/.test(key))
  .map(([, value]) => value).filter(Boolean)) {
  let text = String(value ?? "");
  for (const secret of secrets) if (secret.length >= 4) text = text.split(secret).join("[redacted]");
  return text
    .replace(/<(thinking|analysis|reasoning)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, "[private reasoning omitted]")
    .replace(/```[\s\S]*?(?:```|$)/g, "[code omitted]")
    .replace(/\u001b\][\s\S]*?(?:\u0007|\u001b\\|$)/g, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s<>]+/gi, "[link omitted]")
    .replace(/\b(?:sk-|xox[baprs]-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\b(Bearer|password|token|secret|ticket|cookie|authorization)\s*[:= ]\s*[^\s,;]+/gi, "$1 [redacted]")
    .replace(/\b[A-Za-z0-9_+/=-]{48,}\b/g, "[opaque value omitted]")
    .replace(/\s+/g, " ").trim().slice(0, 650);
}

const operations = new Set(["state", "terrain", "capabilities", "create", "revise", "rehearse", "inspect", "execute", "status", "start", "stop", "open", "navigate", "snapshot", "act", "click", "close", "tabs", "quarantine", "notify", "assign_field", "verify", "deploy_mapping", "submit_stale_exchange", "forge_support", "alter_work_order"]);
const tools = new Set(["browser", "yamnaya_observe", "yamnaya_standing_action", "yamnaya_plan", "yamnaya_admin_browser", "yamnaya_red_observe", "yamnaya_red_action"]);
export function toolDetails(name, params = {}) {
  if (!tools.has(name)) return { tool: "unknown_tool", detail: "Details omitted" };
  let action = {};
  try { action = JSON.parse(params.action_json ?? "{}"); } catch { /* Invalid input is still visible as a failed call. */ }
  const op = params.operation ?? params.resource ?? (typeof params.action === "string" ? params.action : undefined) ?? action?.kind;
  const targets = [params.plan_id, action?.sdpId, ...(Array.isArray(action?.sdpIds) ? action.sdpIds : [])]
    .filter(v => typeof v === "string" && /^(PLAN-\d+|SDP-\d{3})$/.test(v)).slice(0, 20);
  return { tool: name, detail: [operations.has(op) ? op : "", ...targets].filter(Boolean).join(" ") || "bounded request" };
}

export async function setActivityContext(context) {
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(`${contextFile}.tmp`, JSON.stringify(context), { mode: 0o600 });
    await rename(`${contextFile}.tmp`, contextFile);
  } catch { console.warn("CAPTURE WARNING: activity context unavailable"); }
}

export async function emitActivity(context, value) {
  try {
    if (!context || !/^(RUN|SMOKE)-[A-Z0-9-]+$/.test(context.recordingId)) return;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const event = { version: 1, id: randomUUID(), at: new Date().toISOString(), runId: context.runId,
      role: context.role, turn: context.turn, invocation: context.invocation, ...value };
    await appendFile(`${directory}/${context.recordingId}.jsonl`, JSON.stringify(event) + "\n", { mode: 0o600 });
  } catch { console.warn("CAPTURE WARNING: activity write failed"); }
}

export function registerActivity(api, dependencies = {}) {
  const pending = new Map();
  const emit = dependencies.emit ?? emitActivity;
  async function active(ctx) {
    try {
      const context = dependencies.getContext ? await dependencies.getContext() : JSON.parse(await readFile(contextFile, "utf8"));
      return context.sessionKey === ctx.sessionKey?.toLowerCase() ? context : undefined;
    } catch { return undefined; }
  }
  api.on("before_tool_call", async (event, ctx) => {
    // Always return undefined: this observer cannot grant or block a call.
    try {
      const context = await active(ctx);
      if (!context) return;
      const details = toolDetails(event.toolName, event.params);
      const key = ctx.toolCallId ?? event.toolCallId;
      if (!key) { await emit(context, { kind: "capture.gap", detail: "Tool call has no correlation ID" }); return; }
      const callId = randomUUID();
      pending.set(key, { context, callId, details, started: Date.now() });
      await emit(context, { kind: "tool.start", callId, ...details });
    } catch { /* Observation must not affect execution. */ }
  });
  api.on("after_tool_call", async (event, ctx) => {
    try {
      const key = ctx.toolCallId ?? event.toolCallId;
      const prior = pending.get(key);
      if (!prior) {
        const context = await active(ctx);
        if (context) await emit(context, { kind: "capture.gap", detail: "Unmatched tool completion" });
        return;
      }
      pending.delete(key);
      await emit(prior.context, { kind: "tool.end", callId: prior.callId, ...prior.details,
        durationMs: Date.now() - prior.started, outcome: event.error || event.result?.isError ? "failed" : "returned" });
    } catch { /* No raw errors or tool results in telemetry. */ }
  });
}
