import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { safeText } from "../../openclaw/activity.mjs";
import type { PresentationState } from "../../apps/web/lib/presentation";

const exec = promisify(execFile);
export interface Activity {
  id: string; at: string; runId: string; role: string; kind: string; detail: string;
  callId?: string; tool?: string; turn?: number; durationMs?: number; outcome?: string;
}
const kinds = new Set(["turn.start", "turn.end", "turn.failed", "tool.start", "tool.end", "capture.gap"]);
const toolNames = new Set(["browser", "yamnaya_observe", "yamnaya_standing_action", "yamnaya_plan", "yamnaya_admin_browser", "yamnaya_red_observe", "yamnaya_red_action", "unknown_tool"]);
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9-]{36}$/.test(v);
export function decodeActivity(raw: unknown, role: string, runId: string): Activity | undefined {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Record<string, unknown>;
  if (!uuid(r.id) || r.runId !== runId || r.role !== role || !kinds.has(String(r.kind)) ||
    typeof r.at !== "string" || !Number.isFinite(Date.parse(r.at))) return;
  // Rebuild, rather than spread, the producer's object. The host is another sanitization boundary.
  return { id: r.id, runId, role, kind: String(r.kind), at: new Date(r.at).toISOString(), detail: safeText(r.detail),
    ...(uuid(r.callId) ? { callId: r.callId } : {}),
    ...(toolNames.has(String(r.tool)) ? { tool: String(r.tool) } : {}),
    ...(Number.isInteger(r.turn) && Number(r.turn) >= 0 && Number(r.turn) <= 40 ? { turn: Number(r.turn) } : {}),
    ...(typeof r.durationMs === "number" && r.durationMs >= 0 && r.durationMs < 3600000 ? { durationMs: r.durationMs } : {}),
    ...(["failed", "returned"].includes(String(r.outcome)) ? { outcome: String(r.outcome) } : {}) };
}

export function formatActivity(e: Activity): string {
  const time = e.at.slice(11, 23);
  const labels: Record<string, string> = { "turn.start": "AGENT TURN STARTED", "turn.end": "AGENT SUMMARY", "turn.failed": "AGENT TURN FAILED", "plan.rationale": "DECISION RATIONALE", "action.receipt": "ACTION RECEIPT", "artifact.tested": "TESTED ARTIFACT", "mission.checks": "INDEPENDENT CHECKS", "mission.status": "MISSION STATUS", "human.decision": "HUMAN DECISION", "capture.gap": "CAPTURE GAP" };
  const label = e.kind === "tool.start" ? "REQUESTED" : e.kind === "tool.end" ? (e.outcome === "failed" ? "FAILED" : "TOOL RETURNED") : e.kind.startsWith("snapshot.") ? `EXISTING ${labels[e.kind.slice(9)] ?? e.kind.slice(9).toUpperCase()}` : labels[e.kind] ?? e.kind.toUpperCase();
  const text = `${time} ${e.role.toUpperCase()}  ${label}${e.tool ? ` ${e.tool}` : ""}${e.turn ? ` [turn ${e.turn}]` : ""}${e.durationMs !== undefined ? ` ${(e.durationMs / 1000).toFixed(1)}s` : ""}\n  ${safeText(e.detail)}`;
  return text.split("\n").flatMap(line => line.match(/.{1,116}(?:\s|$)|.{1,116}/g) ?? [""]).join("\n");
}

export class ActivityFeed {
  private seen = new Set<string>();
  private started = new Set<string>();
  private completed = new Set<string>();
  private roles = new Set<string>();
  private ends = new Set<string>();
  private cursors = new Map<string, number>();
  private baseline = false;
  private stateSeen = new Set<string>();
  private lastStatus = "";
  private lastChecks = "";
  private failed = new Set<string>();
  gaps = 0;
  constructor(readonly runId: string, private emit: (event: Activity) => void, private recordingId = runId) {}
  accept(event: Activity) {
    if (event.runId !== this.runId || this.seen.has(event.id)) return;
    this.seen.add(event.id);
    if (event.kind === "tool.start" && event.callId) this.started.add(event.callId);
    if (event.kind === "tool.end" && event.callId) { this.completed.add(event.callId); this.roles.add(event.role); }
    if (event.kind === "turn.start") this.started.add(`turn:${event.role}:${event.turn}`);
    if (["turn.end", "turn.failed"].includes(event.kind)) this.ends.add(`turn:${event.role}:${event.turn}`);
    if (event.kind === "capture.gap") this.gaps++;
    this.emit(event);
  }
  report(kind: string, detail: string, role = "recorder") {
    this.accept({ id: `host-${this.seen.size}`, at: new Date().toISOString(), runId: this.runId, role, kind, detail: safeText(detail) });
  }
  async poll() {
    await Promise.all(["defender", "attacker"].map(async role => {
      try {
        const { stdout } = await exec("docker", ["compose", "exec", "-T", role === "defender" ? "openclaw-agent" : "attacker-agent", "node", "/opt/yamnaya/read-activity.mjs", this.recordingId, String(this.cursors.get(role) ?? 0)], { timeout: 8000, maxBuffer: 160000 });
        const body = JSON.parse(stdout);
        if (!["connected", "waiting"].includes(body.health) || !Array.isArray(body.events) || !Number.isSafeInteger(body.cursor) || body.cursor < (this.cursors.get(role) ?? 0)) throw new Error();
        this.cursors.set(role, body.cursor);
        if (this.failed.delete(role)) this.report("capture.restored", "Activity reader reconnected", role);
        for (const raw of body.events) {
          const event = decodeActivity(raw, role, this.runId);
          if (event) this.accept(event);
          else this.report("capture.gap", "Unattributed or invalid activity omitted", role);
        }
      } catch {
        if (!this.failed.has(role)) { this.failed.add(role); this.report("capture.gap", "Activity reader unavailable; retrying", role); }
      }
    }));
  }
  observe(state: PresentationState) {
    if (state.id !== this.runId) return;
    const first = !this.baseline;
    this.baseline = true;
    const once = (key: string, kind: string, detail: string, role: string) => {
      if (this.stateSeen.has(key)) return;
      this.stateSeen.add(key);
      this.report(first ? `snapshot.${kind}` : kind, detail, role);
    };
    if (this.lastStatus !== state.status) { this.report(first ? "snapshot.mission.status" : "mission.status", state.status, "policy"); this.lastStatus = state.status; }
    for (const plan of state.plans) {
      once(`plan:${plan.id}:${plan.version}`, "plan.rationale", `${plan.id} v${plan.version}: ${plan.rationale}`, "defender");
      for (const receipt of plan.receipts) once(`receipt:${plan.id}:${plan.version}:${receipt.id}`, "action.receipt", `${plan.id} v${plan.version} ${receipt.kind}: ${receipt.status}. ${receipt.message}`, "executor");
      for (const approval of plan.approvals) once(`approval:${approval.id}`, "human.decision", `${approval.role}: ${approval.decision} ${plan.id} v${approval.planVersion}`, "policy");
    }
    for (const artifact of state.artifacts.filter(a => a.validation === "tested")) {
      once(`artifact:${artifact.id}:${artifact.digest}`, "artifact.tested", `${artifact.id}: tested artifact recorded${artifact.prUrl && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(artifact.prUrl) ? `; PR ${new URL(artifact.prUrl).pathname}` : ""}`, "executor");
    }
    const checks = `${state.status}:` + state.checks.map(c => `${c.id}:${c.passed}`).join(",");
    if (this.lastChecks !== checks) {
      this.report(first ? "snapshot.mission.checks" : "mission.checks", `${state.checks.filter(c => c.passed).length}/${state.checks.length} independent checks passed. ${state.status === "verified" && state.checks.length > 0 && state.checks.every(c => c.passed) ? "Mission closure verified." : "Mission closure pending."}`, "policy");
      this.lastChecks = checks;
    }
  }
  summary() {
    const unmatched = [...this.started].filter(id => !this.completed.has(id) && !this.ends.has(id)).length + [...this.completed].filter(id => !this.started.has(id)).length;
    return { gaps: this.gaps, unmatched, readersConnected: this.failed.size === 0, defenderTools: this.roles.has("defender"), attackerTools: this.roles.has("attacker") };
  }
}
