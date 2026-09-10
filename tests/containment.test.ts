import { describe, it, expect } from "vitest";
import { seedRun, attack, advance, affectedSdps, standaloneAction, createPlan, rehearse, approve, enqueuePlan,
  executeStep, suggestedPlan, verify, credentialWorks, defenderView, attackerView, revisePlan, type Actor, type Run } from "../packages/core/src/index";
import { approvalMessage, approvalAcknowledgement } from "../services/worker/slack-messages";
import { sample, evidenceGates, type Manifest } from "../scripts/demo/evidence";

const defender: Actor = { id: "defender", role: "defender", channel: "tool" };
const red: Actor = { id: "attacker", role: "attacker", channel: "tool" };
const executor: Actor = { id: "worker", role: "worker", channel: "worker" };
const misuse = { kind: "use_leaked_access", credentialId: "cred-integration", sdpId: "SDP-001" } as const;
const human = (role: "security" | "platform" | "operations"): Actor => ({ id: `U-${role}`, role, channel: "slack" });
function incident() {
  const run = seedRun("RUN-EASY", "credential-leak");
  attack(run, misuse, red);
  for (let i = 0; i < 4; i++) advance(run);
  return run;
}
function planFor(run: Run) {
  const p = createPlan(run, suggestedPlan(run, "containment"), defender);
  rehearse(run, p.id, defender);
  return p;
}
const snapshot = (run: Run, offset: number) => sample({ ...defenderView(run), affected: affectedSdps(run), checks: verify(run), actor: defender }, offset);

describe("simple containment mission", () => {
  it("bounds the attack to one exposed account/work update and keeps authoritative meter data intact", () => {
    const run = seedRun("RUN-EASY", "credential-leak");
    expect(affectedSdps(run)).toEqual([]);
    expect(() => attack(run, { ...misuse, sdpId: "SDP-020" }, red)).toThrow("outside");
    expect(() => attack(run, { kind: "deploy_mapping", credentialId: "cred-contractor", variant: "wrong-sdp" }, red)).toThrow("one synthetic");
    attack(run, misuse, red);
    expect(affectedSdps(run)).toEqual(["SDP-001"]);
    expect(run.mdm).toEqual(run.sor);
    expect(run.workOrders[0].evidence).toContain("Unverified");
    expect(attackerView(run).actionBudgetRemaining).toBe(0);
    expect(() => attack(run, misuse, red)).toThrow("one synthetic");
    expect(defenderView(run).mission.kind).toBe("containment");
    expect(attackerView(run)).not.toHaveProperty("mission");
    expect(attackerView(run)).not.toHaveProperty("physical");
  });
  it("requires all three real role decisions, then verifies scoped containment with healthy work continuing", () => {
    const run = incident(), p = planFor(run);
    expect(p.rehearsal?.problems).toEqual([]);
    expect(run.credentials.filter(c => c.principalId === "contractor").every(c => c.status === "active")).toBe(true);
    expect(run.quarantinedSdps).toEqual([]);
    expect(() => enqueuePlan(run, p.id, defender)).toThrow("Missing security");
    expect(() => approve(run, p.id, 1, "approved", defender)).toThrow("authenticated humans");
    for (const role of ["security", "platform"] as const) approve(run, p.id, 1, "approved", human(role));
    expect(() => enqueuePlan(run, p.id, defender)).toThrow("Missing operations");
    approve(run, p.id, 1, "approved", human("operations"));
    enqueuePlan(run, p.id, defender);
    while (p.stepIndex < p.steps.length) executeStep(run, p.id, executor);
    expect(run.status).toBe("verified");
    expect(verify(run).every(c => c.passed)).toBe(true);
    expect(run.quarantinedSdps).toEqual(["SDP-001"]);
    expect(run.transactions.find(t => t.id === "TX-EXPOSED-1")?.status).toBe("quarantined");
    expect(run.workOrders[0].status).toBe("held");
    expect(credentialWorks(run, "cred-integration", "sync:submit")).toBe(false);
    expect(credentialWorks(run, "cred-contractor", "workorder:write")).toBe(false);
    expect(credentialWorks(run, "cred-operator", "assets:read")).toBe(true);
    expect(run.metrics.healthyProcessed).toBeGreaterThan(0);
    expect(p.receipts).toHaveLength(4);
    expect(run.artifacts.some(a => a.id === "repair-candidate")).toBe(false);
    run.workOrders[0].status = "confirmed";
    expect(verify(run).find(c => c.id === "physical")?.passed).toBe(false);
    run.credentials[0].status = "active";
    expect(verify(run).find(c => c.id === "access")?.passed).toBe(false);
  });
  it("blocks bypasses, unsupported repairs, and disabling unrelated identities even in rehearsal", () => {
    const run = incident();
    expect(() => standaloneAction(run, { kind: "disable_principal", principalId: "contractor" }, defender)).toThrow("rehearsed plan");
    expect(() => standaloneAction(run, { kind: "quarantine", sdpIds: ["SDP-001"] }, human("operations"))).toThrow("rehearsed plan");
    expect(() => standaloneAction(run, { kind: "revoke_credential", credentialId: "cred-contractor" }, human("security"))).toThrow("containment mission");
    const raw = suggestedPlan(run, "containment");
    expect(() => createPlan(run, { ...raw, steps: [{ kind: "repair_data", sdpIds: ["SDP-001"] }] }, defender)).toThrow("containment mission");
    const bad = createPlan(run, { ...raw, steps: [{ kind: "disable_principal", principalId: "operations" }] }, defender);
    rehearse(run, bad.id, defender);
    expect(bad.status).toBe("BLOCKED");
    expect(credentialWorks(run, "cred-operator", "assets:read")).toBe(true);
    const broad = createPlan(run, { ...raw, steps: [{ kind: "quarantine", sdpIds: ["SDP-001", "SDP-020"] }] }, defender);
    rehearse(run, broad.id, defender);
    expect(broad.status).toBe("BLOCKED");
    const advanced = seedRun("ADVANCED");
    expect(() => createPlan(advanced, { ...raw, evidenceIds: ["OBS-1"] }, defender)).toThrow("only in the containment");
  });
  it("sends concrete review instructions once and rejects stale or stopped approvals", () => {
    const run = incident(), p = planFor(run);
    expect(run.notifications).toHaveLength(3);
    const message = approvalMessage(run, run.notifications[0]);
    expect(message).toContain("approve PLAN-1 v1");
    expect(message).toContain("SDP-001");
    expect(message).toContain("all sessions and integration tokens");
    approve(run, p.id, 1, "approved", human("security"));
    expect(approvalAcknowledgement(p, "U-security")).toContain("Waiting for platform and operations");
    revisePlan(run, p.id, suggestedPlan(run, "containment"), defender);
    expect(approvalMessage(run, run.notifications[0])).toBeUndefined();
    rehearse(run, p.id, defender);
    expect(() => approve(run, p.id, 1, "approved", human("security"))).toThrow("changed plan");
    expect(run.notifications).toHaveLength(6);
    rehearse(run, p.id, defender);
    expect(run.notifications).toHaveLength(6);
    run.status = "stopped";
    expect(() => approve(run, p.id, 2, "approved", human("security"))).toThrow("no longer accepting");
  });
  it("requires three Slack approvals for a containment export and retains stronger recovery export gates", () => {
    const run = seedRun("RUN-EASY", "credential-leak", "live");
    const first = snapshot(run, 0);
    attack(run, misuse, red);
    for (let i = 0; i < 4; i++) advance(run);
    const p = planFor(run);
    for (const role of p.requiredRoles) approve(run, p.id, 1, "approved", human(role));
    enqueuePlan(run, p.id, defender);
    while (p.stepIndex < p.steps.length) executeStep(run, p.id, executor);
    run.notifications.forEach(n => { n.status = "delivered"; n.deliveredVia = "slack"; });
    const last = snapshot(run, 10);
    const manifest: Manifest = { version: 1, origin: "http://localhost", startedAt: "", runId: run.id, mode: "live", video: "raw.webm", reason: "mission_verified", timing: "", samples: [first, last], interruptions: [] };
    expect(evidenceGates(manifest).humanDecisions).toBe(true);
    expect(evidenceGates(manifest).codeIntegrity).toBe(true);
    last.slackApprovedRoles = ["security", "platform"];
    expect(evidenceGates(manifest).humanDecisions).toBe(false);
    first.mission = last.mission = "recovery";
    expect(evidenceGates(manifest).codeReceipt).toBe(false);
    expect(evidenceGates(manifest).humanDecisions).toBe(false);
  });
});
