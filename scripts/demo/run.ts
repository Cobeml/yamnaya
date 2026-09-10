import "dotenv/config";
import { randomUUID } from "node:crypto";
import { presentation, type PresentationState } from "../../apps/web/lib/presentation";
import { scenarioSchema } from "../../packages/core/src/contracts";

async function main() {
  const value = process.argv.find(s => s.startsWith("--url="))?.slice(6) ?? "https://yamnaya.vercel.app";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
  const origin = url.origin;
  const stateResponse = await fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${process.env.DEFENDER_TOKEN}` }, signal: AbortSignal.timeout(20000) });
  if (!stateResponse.ok) throw new Error();
  let state: PresentationState = await stateResponse.json();
  const start = process.argv.includes("--start"), stop = process.argv.includes("--stop");
  const scenario = scenarioSchema.parse(process.argv.find(s => s.startsWith("--scenario="))?.slice(11) ?? "credential-leak");
  if (start && stop) throw new Error();
  if (start || stop) {
    // These explicit presenter commands reset/stop runs, never grant plan approvals.
    if (start && state.mode === "live" && !["monitoring", "verified", "stopped"].includes(state.status)) {
      console.error("A live incident is active. Stop and reconcile it before starting another take."); process.exitCode = 1; return;
    }
    const login = await fetch(`${origin}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "security", password: process.env.DEMO_SECURITY_PASSWORD }), signal: AbortSignal.timeout(20000) });
    if (!login.ok) throw new Error();
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error();
    const response = await fetch(`${origin}/api/${start ? "runs/reset" : "runs/stop"}`, {
      method: "POST", headers: { cookie, origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify({ runId: state.id, ...(start ? { mode: "live", scenario } : {}) }), signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error();
    const refreshed = await fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${process.env.DEFENDER_TOKEN}` }, signal: AbortSignal.timeout(20000) });
    if (!refreshed.ok) throw new Error();
    state = await refreshed.json();
  }
  const view = presentation(state);
  console.log(JSON.stringify({ runId: state.id, mode: state.mode, status: state.status, revision: state.revision, affected: state.affected.length, checks: `${state.checks.filter(c => c.passed).length}/${state.checks.length}`, amiReads: state.metrics.amiReads, healthyBatches: state.metrics.healthyProcessed, next: view.next, plan: view.plan ? { id: view.plan.id, version: view.plan.version, status: view.plan.status, completed: view.plan.stepIndex, total: view.plan.steps.length, pendingRoles: view.pendingRoles } : null, fieldAssignments: view.fields.map(w => ({ sdp: w.sdpId, status: w.status })), threadStarted: !!state.slackThreadTs, latestEvents: state.events.slice(-5).map(e => ({ type: e.type, actor: e.actor, sequence: e.sequence })) }, null, 2));
}
main().catch(() => { console.error("Demo command failed; check hosted connectivity and role credentials. Raw responses withheld."); process.exitCode = 1; });
