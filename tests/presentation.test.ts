import { describe, expect, it } from "vitest";
import { seedRun, createPlan, type Run } from "../packages/core/src/index";
import { presentation, type PresentationState } from "../apps/web/lib/presentation";
import { sample, evidenceGates, validateEdit, type Manifest } from "../scripts/demo/evidence";

function view(run: Run): PresentationState {
  return { ...run, affected: [], checks: [{ id: "code", label: "Code", passed: true, detail: "tested" }], actor: { id: "security", role: "security", channel: "web" } };
}
function fixture() {
  const run = seedRun("RUN-TEST", "contractor", "simulation");
  const state = view(run);
  const plan = createPlan(run, { title: "Scoped recovery", rationale: "Check current evidence before closing the mission.", evidenceIds: [state.observations[0].id], steps: [{ kind: "close_incident" }], alternatives: [] }, state.actor);
  plan.status = "REHEARSED";
  plan.approvals.push({ id: "approval", planId: plan.id, planVersion: plan.version, role: "security", actorId: "human", decision: "approved", time: state.clock, expiresAt: new Date(Date.parse(state.clock) + 60000).toISOString() });
  return { state, plan };
}
describe("recording evidence", () => {
  it("does not present a completed containment plan or green checks as mission closure", () => {
    const { state, plan } = fixture();
    plan.status = "VERIFIED";
    expect(presentation(state).verified).toBe(false);
    expect(presentation(state).next).toContain("remaining mission checks");
    state.status = "verified";
    expect(presentation(state).verified).toBe(true);
    state.checks[0].passed = false;
    expect(presentation(state).verified).toBe(false);
  });
  it("stops displaying old or expired approvals as current authority", () => {
    const { state, plan } = fixture();
    expect(presentation(state).pendingRoles).toEqual([]);
    state.threatVersion++;
    expect(presentation(state).pendingRoles).toEqual(["security"]);
    expect(presentation(state).next).toContain("Threat changed");
    plan.threatVersion = state.threatVersion;
    state.clock = plan.approvals[0].expiresAt;
    expect(presentation(state).approvals).toEqual([]);
  });
  it("withholds raw code, credentials, chat and evaluator state from recording manifests", () => {
    const { state } = fixture();
    const snapshot = sample(state, 1);
    expect(snapshot).not.toHaveProperty("physical");
    expect(snapshot).not.toHaveProperty("credentials");
    expect(snapshot).not.toHaveProperty("artifacts");
    expect(snapshot).not.toHaveProperty("chat");
    expect(snapshot.events.every(e => !("message" in e))).toBe(true);
  });
  it("refuses a live final from simulation, mixed incidents, or a partial recovery", () => {
    const { state } = fixture();
    const manifest: Manifest = { version: 1, origin: "http://localhost", startedAt: "", runId: state.id, mode: state.mode, video: "raw.webm", reason: "time_limit", timing: "", samples: [sample(state, 0), sample(state, 5)], interruptions: [] };
    const edit = { runId: state.id, preview: false, segments: [{ title: "Recovery", start: 0, end: 5, seconds: 60 }] };
    expect(() => validateEdit(manifest, edit, 6)).toThrow("evidence gates");
    expect(() => validateEdit(manifest, { ...edit, preview: true }, 6)).not.toThrow();
    manifest.samples[1].runId = "RUN-OTHER";
    expect(evidenceGates(manifest).oneRun).toBe(false);
    expect(() => validateEdit(manifest, { ...edit, runId: "RUN-OTHER" }, 6)).toThrow("IDs differ");
    expect(() => validateEdit(manifest, { ...edit, preview: true, segments: [{ title: "Preview", start: 5, end: 8, seconds: 3 }] }, 6)).toThrow("fit the recording");
  });
});
