import type { Action, Notification, Plan, Run } from "../../packages/core/src/contracts";

const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function describeStep(step: Action): string {
  switch (step.kind) {
    case "disable_principal": return `Disable ${escape(step.principalId)} access (all sessions and integration tokens).`;
    case "quarantine": return `Hold data updates and field work for ${step.sdpIds.map(escape).join(", ")}.`;
    case "verify": return "Check blocked access, held work, and continuing healthy operations.";
    case "close_incident": return "Finish only if every independent check passes; held work stays under review.";
    case "notify": return `Notify ${escape(step.recipientId)}.`;
    default: return escape(step.kind.replaceAll("_", " "));
  }
}

export function approvalMessage(run: Run, notification: Notification): string | undefined {
  const request = notification.approvalRequest;
  if (!request) return notification.message;
  const plan = run.plans.find(p => p.id === request.planId);
  if (!plan || plan.version !== request.planVersion || plan.threatVersion !== run.threatVersion ||
    !["REHEARSED", "AUTHORIZED"].includes(plan.status) || !plan.requiredRoles.includes(request.role)) return undefined;
  const responsibilities = {
    security: "Security: review the evidence of leaked access and authorize containment.",
    platform: "Platform: review disabling the contractor's access while the healthy meter service keeps running.",
    operations: "Operations: review holding the affected data and field work. Electricity and meter readings stay on.",
  };
  return ["*Your approval is needed*", responsibilities[request.role],
    `*Plan: ${escape(plan.title)}*`, ...plan.steps.map((step, i) => `${i + 1}. ${describeStep(step)}`),
    "", "If you approve these actions, reply in this thread with exactly:",
    `\`approve ${plan.id} v${plan.version}\``,
    `To decline: \`reject ${plan.id} v${plan.version}\`. You can also ask a question here; ordinary conversation does not grant approval.`,
    `Review reference: ${run.id} / ${plan.id} v${plan.version}. All three employees must approve before execution.`].join("\n");
}

export function approvalAcknowledgement(plan: Plan, userId: string): string | undefined {
  const decision = plan.approvals?.find(a => a.actorId === userId && a.planVersion === plan.version);
  if (!decision) return undefined;
  if (decision.decision === "rejected") return `${decision.role}: rejection recorded for ${plan.id} v${plan.version}. Execution is blocked; Yamnaya must revise the plan.`;
  const remaining = plan.requiredRoles.filter(r => !plan.approvals.some(a => a.role === r && a.decision === "approved"));
  return `${decision.role}: approval recorded for ${plan.id} v${plan.version}. ${remaining.length ? `Waiting for ${remaining.join(" and ")}.` : "All approvals are recorded. Yamnaya can now execute the plan."}`;
}
