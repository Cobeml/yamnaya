import type { Actor, Run, VerificationCheck } from "@yamnaya/core";

export type PresentationState = Omit<Run, "physical" | "scenario" | "idempotency"> & {
  affected: string[];
  checks: VerificationCheck[];
  actor: Actor;
};

export function presentation(state: PresentationState) {
  const plan = state.plans.at(-1);
  const current = plan?.threatVersion === state.threatVersion;
  const approvals = plan?.approvals.filter(a => current && a.planVersion === plan.version &&
    a.decision === "approved" && Date.parse(a.expiresAt) > Date.parse(state.clock)) ?? [];
  const pendingRoles = plan?.requiredRoles.filter(role => !approvals.some(a => a.role === role)) ?? [];
  const passed = (id: string) => state.checks.some(c => c.id === id && c.passed);
  const verified = state.status === "verified" && state.checks.length > 0 && state.checks.every(c => c.passed);
  const fields = state.workOrders.filter(w => w.type === "field-verification");
  const patch = state.artifacts.find(a => a.id === "repair-candidate");
  const leaked = state.credentials.filter(c => c.leakProven);
  const workers = state.workers.filter(w => w.available && w.status === "running");
  let next = "Watching for changes to the mission";
  if (state.status === "stopped") next = "Run stopped by the operator";
  else if (verified) next = "Mission verified. Evidence retained.";
  else if (plan) {
    if (!current) next = "Threat changed — plan and approvals need renewed review";
    else if (["FAILED", "BLOCKED", "INDETERMINATE", "EXPIRED"].includes(plan.status)) next = `${plan.status}: ${plan.error ?? "Review the plan evidence"}`;
    else if (plan.status === "DRAFT") next = "Proposed plan awaits rehearsal";
    else if (plan.status === "VERIFIED") next = "Plan completed; remaining mission checks still need attention";
    else if (["EXECUTING", "VERIFYING"].includes(plan.status)) next = `Executing approved plan · ${plan.stepIndex}/${plan.steps.length} steps applied`;
    else if (pendingRoles.length) next = `Awaiting ${pendingRoles.join(" + ")} approval for ${plan.id} v${plan.version}`;
    else next = plan.requiredRoles.length ? "Approvals recorded; awaiting execution" : "Standing authority; awaiting execution";
  } else if (state.status !== "monitoring") next = "Incident detected; awaiting a recorded response plan";
  return { plan, current, approvals, pendingRoles, verified, fields, patch, leaked, workers, next, passed };
}
