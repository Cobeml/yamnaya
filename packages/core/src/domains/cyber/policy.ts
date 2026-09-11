import type {
  Action,
  Actor,
  Artifact,
  HumanRole,
  Plan,
  PlanInput,
  Run,
} from "./contracts";
import { DomainError, planInputSchema } from "./contracts";
import { affectedSdps, credentialWorks, event, processNext } from "./simulator";
import { approvedSource, equalAssociations } from "./mapping";
import { verify } from "./verification";

export interface EffectProof {
  sourceDigest?: string;
  testsPassed?: boolean;
  externalRef?: string;
  commit?: string;
  message?: string;
}
export function rolesFor(action: Action, run?: Run): HumanRole[] {
  if (run?.scenario === "credential-leak") {
    if (action.kind === "quarantine") return ["operations"];
    if (action.kind === "close_incident") return ["security", "platform", "operations"];
  }
  switch (action.kind) {
    case "disable_principal":
      return ["security", "platform"];
    case "promote_worker":
    case "route_reserve":
      return ["platform"];
    case "pause_worker":
      return ["security", "platform"];
    case "repair_data":
    case "replay":
    case "resume":
      return ["operations"];
    case "close_incident":
      return ["security"];
    default:
      return [];
  }
}
function demand(ok: unknown, message: string): asserts ok {
  if (!ok) throw new DomainError(message);
}
export function assertActor(actor: Actor) {
  if (!["defender", "security", "platform", "operations"].includes(actor.role))
    throw new DomainError(
      "This identity cannot plan or execute defense",
      "FORBIDDEN",
      403,
    );
}
function assertMissionAction(run: Run, action: Action) {
  if (run.scenario === "credential-leak")
    demand(["disable_principal", "quarantine", "notify", "verify", "close_incident"].includes(action.kind),
      "This containment mission permits approved account disablement, scoped quarantine, notification, verification and closure");
  else demand(action.kind !== "disable_principal", "Account disablement is available only in the containment mission");
}
export function createPlan(run: Run, raw: PlanInput, actor: Actor): Plan {
  assertActor(actor);
  const input = planInputSchema.parse(raw);
  input.steps.forEach(a => assertMissionAction(run, a));
  demand(
    actor.role !== "defender" ||
      !input.steps.some((s) => s.kind === "revoke_credential"),
    "Credential revocation must use the browser administration workflow",
  );
  demand(
    input.evidenceIds.every((id) => run.observations.some((o) => o.id === id)),
    "Plan references unknown evidence",
  );
  const plan: Plan = {
    ...input,
    id: `PLAN-${run.plans.length + 1}`,
    version: 1,
    threatVersion: run.threatVersion,
    status: "DRAFT",
    createdAt: run.clock,
    requiredRoles: [...new Set(input.steps.flatMap(a => rolesFor(a, run)))],
    approvals: [],
    stepIndex: 0,
    receipts: [],
  };
  run.plans.push(plan);
  event(run, "plan.created", actor.id, input.title, [], { planId: plan.id });
  return plan;
}
export function revisePlan(
  run: Run,
  planId: string,
  raw: PlanInput,
  actor: Actor,
) {
  assertActor(actor);
  const plan = getPlan(run, planId);
  demand(
    !["EXECUTING", "VERIFYING"].includes(plan.status),
    "Stop execution before revising a plan",
  );
  const input = planInputSchema.parse(raw);
  input.steps.forEach(a => assertMissionAction(run, a));
  demand(
    actor.role !== "defender" ||
      !input.steps.some((s) => s.kind === "revoke_credential"),
    "Credential revocation must use the browser administration workflow",
  );
  demand(
    input.evidenceIds.every((id) => run.observations.some((o) => o.id === id)),
    "Plan references unknown evidence",
  );
  Object.assign(plan, input, {
    version: plan.version + 1,
    threatVersion: run.threatVersion,
    status: "DRAFT",
    requiredRoles: [...new Set(input.steps.flatMap(a => rolesFor(a, run)))],
    approvals: [],
    rehearsal: undefined,
    stepIndex: 0,
    receipts: [],
    error: undefined,
  });
  event(
    run,
    "plan.revised",
    actor.id,
    `Plan v${plan.version}; prior approvals invalidated`,
    [],
    { planId },
  );
  return plan;
}
export function getPlan(run: Run, id: string): Plan {
  const p = run.plans.find((p) => p.id === id);
  demand(p, "Unknown plan");
  return p;
}
export function applyAction(
  run: Run,
  action: Action,
  actor: Actor,
  options: { rehearsal?: boolean; proof?: EffectProof } = {},
) {
  const { rehearsal, proof } = options;
  assertMissionAction(run, action);
  switch (action.kind) {
    case "disable_principal": {
      const credentials = run.credentials.filter(c => c.principalId === action.principalId);
      demand(credentials.length && credentials.some(c => c.leakProven && run.observations.some(o =>
        o.kind === "credential-leak" && o.trusted && o.resourceIds.includes(c.id))),
        "Account disablement requires independently proven exposed access for that principal");
      for (const c of credentials) {
        c.status = "revoked";
        c.version++;
      }
      demand(credentials.every(c => c.permissions.every(p => !credentialWorks(run, c.id, p))), "Account access denial probe failed");
      run.metrics.containedAt ??= run.clock;
      return `Disabled ${action.principalId}: ${credentials.length} access grants revoked; all subsequent access probes denied`;
    }
    case "revoke_credential": {
      const c = run.credentials.find((c) => c.id === action.credentialId);
      demand(c, "Unknown credential");
      demand(
        c.leakProven &&
          run.observations.some(
            (o) =>
              o.kind === "credential-leak" &&
              o.trusted &&
              o.resourceIds.includes(c.id),
          ),
        "Standing revocation requires independent evidence of an exact leaked credential",
      );
      c.status = "revoked";
      c.version++;
      demand(
        c.permissions.every((p) => !credentialWorks(run, c.id, p)),
        "Negative access probe failed",
      );
      run.metrics.containedAt ??= run.clock;
      return `Revoked ${c.id}; subsequent requests denied`;
    }
    case "quarantine": {
      const affected = affectedSdps(run);
      demand(
        action.sdpIds.every((id) => affected.includes(id)),
        "Standing quarantine is limited to observed affected service points",
      );
      run.quarantinedSdps = [
        ...new Set([...run.quarantinedSdps, ...action.sdpIds]),
      ];
      for (const tx of run.transactions)
        if (action.sdpIds.includes(tx.request.sdpId) && (tx.status === "queued" || (run.scenario === "credential-leak" && tx.status === "failed")))
          tx.status = "quarantined";
      for (const wo of run.workOrders)
        if (action.sdpIds.includes(wo.sdpId) && wo.type === "exchange")
          wo.status = "held";
      return `Quarantined ${action.sdpIds.length} affected service points; unrelated processing continues`;
    }
    case "notify": {
      demand(
        run.people.some((p) => p.id === action.recipientId),
        "Recipient must be in the ownership register",
      );
      const n = {
        id: `NOTIFY-${run.notifications.length + 1}`,
        recipientId: action.recipientId,
        message: action.message,
        status: "queued" as const,
      };
      run.notifications.push(n);
      run.jobs.push({
        id: `JOB-${run.jobs.length + 1}`,
        kind: "notification",
        targetId: n.id,
        status: "queued",
        attempts: 0,
      });
      return `Notification queued for ${action.recipientId}`;
    }
    case "assign_field": {
      demand(
        action.sdpIds.every((id) => run.servicePoints.some((s) => s.id === id)),
        "Unknown service point",
      );
      for (const id of action.sdpIds)
        if (
          !run.workOrders.some(
            (w) => w.type === "field-verification" && w.sdpId === id,
          )
        )
          run.workOrders.push({
            id: `WO-FIELD-${run.workOrders.length + 1}`,
            sdpId: id,
            meterId:
              run.sor.find((a) => a.sdpId === id && !a.to)?.meterId ??
              "unknown",
            type: "field-verification",
            status: "assigned",
            ownerId: "operations",
          });
      return `Field verification assigned to meter operations for ${action.sdpIds.join(", ")}`;
    }
    case "prepare_patch": {
      demand(
        rehearsal || (proof?.testsPassed && proof.sourceDigest),
        "Patch requires an isolated regression-test receipt",
      );
      if (run.mode === "live" && !rehearsal)
        demand(
          proof?.externalRef?.startsWith("https://github.com/"),
          "Live mode requires a real corrective GitHub pull request",
        );
      const artifact: Artifact = {
        id: "repair-candidate",
        name: "Corrective mapping candidate",
        trusted: true,
        source: action.source,
        digest: proof?.sourceDigest ?? "rehearsal-only",
        commit: proof?.commit ?? "local:candidate",
        validation: rehearsal ? "fixture" : "tested",
        prUrl: proof?.externalRef,
      };
      run.artifacts = [
        ...run.artifacts.filter((a) => a.id !== artifact.id),
        artifact,
      ];
      return rehearsal
        ? "Predicted patch passes regression tests (execution must supply proof)"
        : `Patch regression tests passed${artifact.prUrl ? `; PR ${artifact.prUrl}` : "; local artifact retained"}`;
    }
    case "promote_worker": {
      const worker = run.workers.find((w) => w.id === action.workerId);
      const artifact = run.artifacts.find((a) => a.id === action.artifactId);
      demand(worker?.available, "Target worker is unavailable");
      demand(
        artifact?.trusted,
        "Artifact must have trusted provenance and passing tests",
      );
      if (artifact.id === "repair-candidate")
        demand(
          rehearsal ||
            (artifact.validation === "tested" &&
              artifact.digest !== "rehearsal-only"),
          "Rehearsal artifacts cannot be promoted",
        );
      worker.artifactId = artifact.id;
      worker.validated = true;
      return `${worker.name} now runs ${artifact.id}`;
    }
    case "route_reserve": {
      const primary = run.workers.find((w) => w.id === "primary")!;
      const reserve = run.workers.find((w) => w.id === "reserve")!;
      demand(reserve.available, "Reserve is unavailable");
      demand(
        reserve.identityId !== primary.identityId &&
          reserve.configuration !== primary.configuration,
        "Reserve shares the primary identity or configuration dependency",
      );
      demand(
        run.artifacts.find((a) => a.id === reserve.artifactId)?.trusted,
        "Reserve artifact is not trusted",
      );
      reserve.validated = true;
      reserve.status = "running";
      primary.status = "paused";
      return "Validated independent reserve and moved synchronization before pausing the suspect primary";
    }
    case "pause_worker": {
      const worker = run.workers.find((w) => w.id === action.workerId)!;
      demand(
        run.workers.some(
          (w) =>
            w.id !== worker.id &&
            w.status === "running" &&
            w.available &&
            w.validated &&
            run.artifacts.find((a) => a.id === w.artifactId)?.trusted,
        ),
        "Pausing the only validated processing path would interrupt unaffected work",
      );
      worker.status = "paused";
      return `Paused ${worker.name}`;
    }
    case "repair_data": {
      demand(
        run.workers.some(
          (w) =>
            w.status === "running" &&
            w.available &&
            w.validated &&
            run.artifacts.find((a) => a.id === w.artifactId)?.trusted,
        ),
        "Restore trusted execution before data repair",
      );
      demand(
        action.sdpIds.every((id) => run.quarantinedSdps.includes(id)),
        "Repair requires a quarantined scope",
      );
      demand(
        action.sdpIds.every((id) =>
          run.workOrders.some(
            (w) =>
              w.type === "field-verification" &&
              w.sdpId === id &&
              w.status === "confirmed",
          ),
        ),
        "Operations must acknowledge field verification before repairing physical asset relationships",
      );
      const selectedMeters = new Set(
        run.sor
          .filter((a) => action.sdpIds.includes(a.sdpId))
          .map((a) => a.meterId),
      );
      // Remove misplaced links as well as links currently attached to the requested SDPs.
      const crossScope = run.mdm.filter(
        (a) =>
          selectedMeters.has(a.meterId) && !action.sdpIds.includes(a.sdpId),
      );
      demand(
        crossScope.every(
          (a) =>
            run.quarantinedSdps.includes(a.sdpId) &&
            action.sdpIds.includes(a.sdpId),
        ),
        "Repair scope must include the destination of misplaced associations",
      );
      run.mdm = [
        ...run.mdm.filter((a) => !action.sdpIds.includes(a.sdpId)),
        ...structuredClone(
          run.sor.filter((a) => action.sdpIds.includes(a.sdpId)),
        ),
      ];
      for (const id of action.sdpIds)
        run.cache[id] = run.mdm
          .filter((a) => a.sdpId === id && !a.to)
          .map((a) => a.meterId);
      return `Restored authoritative, effective-dated relationships and refreshed ${action.sdpIds.length} cache entries`;
    }
    case "replay": {
      demand(
        action.sdpIds.every((id) => run.quarantinedSdps.includes(id)),
        "Replay requires quarantined scope",
      );
      demand(
        run.workers.some(
          (w) =>
            w.available &&
            w.status === "running" &&
            w.validated &&
            run.artifacts.find((a) => a.id === w.artifactId)?.trusted,
        ),
        "Replay requires trusted execution",
      );
      for (const tx of run.transactions.filter((t) =>
        action.sdpIds.includes(t.request.sdpId),
      )) {
        if (
          tx.status === "failed" &&
          tx.error?.includes("Source/effective-date conflict")
        )
          continue;
        const expected = run.sor.some(
          (a) =>
            a.meterId === tx.request.meterId &&
            a.sdpId === tx.request.sdpId &&
            a.from === tx.request.effectiveAt,
        );
        if (!expected) {
          tx.status = "failed";
          tx.error =
            "Source/effective-date conflict: stale transaction rejected during replay";
          tx.history.push("Retained in exception ledger; not replayed");
          continue;
        }
        // After an authoritative rebuild this original transaction is already materialized.
        demand(
          equalAssociations(
            run.mdm.filter((a) => a.sdpId === tx.request.sdpId),
            run.sor.filter((a) => a.sdpId === tx.request.sdpId),
          ),
          "Repair must precede replay",
        );
        tx.status = "processed";
        tx.error = undefined;
        tx.attempts++;
        tx.stages = [
          "Source mapping",
          "SOR filtering",
          "Idempotency reconciliation",
          "Cache invalidation",
          "Save",
          "Status / exception",
        ];
        tx.history.push(
          "Replayed against repaired SOR snapshot: already materialized; no duplicate write",
        );
        if (!run.processedMessageIds.includes(tx.request.id))
          run.processedMessageIds.push(tx.request.id);
      }
      return "Reconciled valid transactions idempotently; stale exchanges retained as rejected exceptions";
    }
    case "resume": {
      demand(
        action.sdpIds.every((id) =>
          equalAssociations(
            run.sor.filter((a) => a.sdpId === id),
            run.mdm.filter((a) => a.sdpId === id),
          ),
        ),
        "Associations must match SOR before resumption",
      );
      demand(
        !run.transactions.some(
          (t) =>
            action.sdpIds.includes(t.request.sdpId) &&
            ["queued", "quarantined"].includes(t.status),
        ),
        "Replay or reject pending transactions before resumption",
      );
      demand(
        action.sdpIds.every((id) =>
          run.workOrders.some(
            (w) =>
              w.type === "field-verification" &&
              w.sdpId === id &&
              w.status === "confirmed",
          ),
        ),
        "Field verification required",
      );
      run.quarantinedSdps = run.quarantinedSdps.filter(
        (id) => !action.sdpIds.includes(id),
      );
      for (const wo of run.workOrders)
        if (action.sdpIds.includes(wo.sdpId) && wo.type === "exchange")
          wo.status = "confirmed";
      return "Affected meter operations resumed with confirmed installation records";
    }
    case "verify": {
      run.verification = verify(run);
      if (run.verification.every((v) => v.passed)) {
        run.status = "recovering";
        run.metrics.recoveredAt = run.clock;
      }
      return `${run.verification.filter((v) => v.passed).length}/${run.verification.length} independent mission checks passed`;
    }
    case "close_incident": {
      run.verification = verify(run);
      demand(
        run.verification.every((v) => v.passed),
        "All independent mission checks must pass before closure",
      );
      run.status = "verified";
      run.metrics.recoveredAt ??= run.clock;
      return run.scenario === "credential-leak"
        ? "Containment verified: contractor access disabled, affected data and field work held, healthy operations continue. Held work remains under review."
        : "Incident closed with verified recovery across all four domains";
    }
  }
}
export function rehearse(run: Run, planId: string, actor: Actor) {
  assertActor(actor);
  const plan = getPlan(run, planId);
  demand(plan.stepIndex === 0, "Create a revised plan after partial execution");
  const branch = structuredClone(run);
  const problems: string[] = [];
  // Field acknowledgement cannot be invented by rehearsal. Its absence blocks recovery plans.
  for (let i = 0; i < plan.steps.length; i++) {
    try {
      applyAction(branch, plan.steps[i], actor, { rehearsal: true });
    } catch (e) {
      problems.push(
        `Step ${i + 1} (${plan.steps[i].kind}): ${e instanceof Error ? e.message : "failed"}`,
      );
      break;
    }
  }
  plan.threatVersion = run.threatVersion;
  plan.rehearsal = {
    passed: problems.length === 0,
    problems,
    predicted: verify(branch),
  };
  plan.status = problems.length ? "BLOCKED" : "REHEARSED";
  plan.error = problems.join("; ") || undefined;
  plan.approvals = [];
  event(
    run,
    "plan.rehearsed",
    actor.id,
    problems.length
      ? `Rehearsal blocked: ${problems[0]}`
      : "Isolated rehearsal passed; live approvals still required",
    [],
    { planId },
  );
  if (!problems.length && run.scenario === "credential-leak") {
    for (const role of plan.requiredRoles) {
      // Generate review requests from the stored, rehearsed plan, never a model's approval claim.
      if (run.notifications.some(n => n.approvalRequest?.planId === plan.id &&
        n.approvalRequest.planVersion === plan.version && n.approvalRequest.role === role)) continue;
      const n = { id: `NOTIFY-${run.notifications.length + 1}`, recipientId: role,
        message: "Review the rehearsed containment plan", status: "queued" as const,
        approvalRequest: { planId: plan.id, planVersion: plan.version, role } };
      run.notifications.push(n);
      run.jobs.push({ id: `JOB-${run.jobs.length + 1}`, kind: "notification", targetId: n.id, status: "queued", attempts: 0 });
    }
  }
  return plan;
}
export function approve(
  run: Run,
  planId: string,
  version: number,
  decision: "approved" | "rejected",
  actor: Actor,
  now = new Date(),
) {
  demand(run.status !== "stopped" && run.status !== "verified", "Run is no longer accepting approvals");
  const plan = getPlan(run, planId);
  demand(
    ["security", "platform", "operations"].includes(actor.role),
    "Only authenticated humans can approve",
  );
  demand(
    plan.version === version && plan.threatVersion === run.threatVersion,
    "Approval refers to a changed plan or threat state",
  );
  demand(
    plan.status === "REHEARSED" || plan.status === "AUTHORIZED",
    "Only a successfully rehearsed plan can be approved",
  );
  demand(
    plan.requiredRoles.includes(actor.role as HumanRole),
    "This role is not an approver for this plan",
  );
  plan.approvals = plan.approvals.filter((a) => a.role !== actor.role);
  plan.approvals.push({
    id: `APP-${run.events.length + 1}`,
    planId,
    planVersion: version,
    role: actor.role as HumanRole,
    actorId: actor.id,
    channel: actor.channel,
    decision,
    time: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * 60000).toISOString(),
  });
  if (decision === "rejected") {
    plan.status = "BLOCKED";
    plan.error = `Rejected by ${actor.role}`;
  } else if (
    plan.requiredRoles.every((r) =>
      plan.approvals.some((a) => a.role === r && a.decision === "approved"),
    )
  )
    plan.status = "AUTHORIZED";
  event(
    run,
    `plan.${decision}`,
    actor.id,
    `${actor.role} ${decision} plan v${version}`,
    [],
    { planId },
  );
  return plan;
}
export function authorize(run: Run, plan: Plan, now = new Date()) {
  demand(plan.rehearsal?.passed, "Rehearsal must pass before execution");
  if (plan.threatVersion !== run.threatVersion) {
    plan.status = "BLOCKED";
    throw new DomainError(
      "Threat state changed; revise or rehearse and renew approvals",
    );
  }
  const required = plan.steps.slice(plan.stepIndex).flatMap(a => rolesFor(a, run));
  for (const role of new Set(required)) {
    const approval = plan.approvals.find(
      (a) =>
        a.role === role &&
        a.planVersion === plan.version &&
        a.decision === "approved",
    );
    demand(approval, `Missing ${role} approval`);
    if (Date.parse(approval.expiresAt) <= now.getTime()) {
      plan.status = "EXPIRED";
      throw new DomainError("Approval expired; renew the response plan");
    }
  }
}
export function enqueuePlan(run: Run, planId: string, actor: Actor) {
  assertActor(actor);
  demand(run.status !== "stopped", "Run is stopped");
  const plan = getPlan(run, planId);
  demand(
    ["REHEARSED", "AUTHORIZED"].includes(plan.status),
    "Plan cannot be queued in its current state",
  );
  authorize(run, plan);
  plan.status = "EXECUTING";
  run.status = "recovering";
  const existing = run.jobs.find(
    (j) =>
      j.kind === "plan" &&
      j.targetId === plan.id &&
      ["queued", "leased"].includes(j.status),
  );
  if (!existing)
    run.jobs.push({
      id: `JOB-${run.jobs.length + 1}`,
      kind: "plan",
      targetId: plan.id,
      status: "queued",
      attempts: 0,
    });
  event(
    run,
    "plan.queued",
    actor.id,
    "Authorized plan queued for the executor",
    [],
    { planId },
  );
  return plan;
}
export function executeStep(
  run: Run,
  planId: string,
  actor: Actor,
  proof?: EffectProof,
) {
  demand(
    actor.role === "worker",
    "Only the executor can run queued plan steps",
  );
  demand(run.status !== "stopped", "Run is stopped");
  const plan = getPlan(run, planId);
  demand(plan.status === "EXECUTING", "Plan is not executing");
  authorize(run, plan);
  const action = plan.steps[plan.stepIndex];
  demand(action, "No remaining action");
  const actionId = `${run.id}:${plan.id}:v${plan.version}:${plan.stepIndex}`;
  if (
    plan.receipts.some((r) => r.actionId === actionId && r.status === "applied")
  ) {
    plan.stepIndex++;
    return plan;
  }
  const message = applyAction(run, action, actor, { proof });
  plan.receipts.push({
    id: `RECEIPT-${plan.receipts.length + 1}`,
    actionId,
    kind: action.kind,
    time: run.clock,
    status: "applied",
    message,
    externalRef: proof?.externalRef,
  });
  event(run, "action.applied", actor.id, message, [], { planId, actionId });
  plan.stepIndex++;
  if (plan.stepIndex === plan.steps.length) {
    plan.status = "VERIFYING";
    run.verification = verify(run);
    plan.status = "VERIFIED";
  }
  return plan;
}
export function reconcilePlan(
  run: Run,
  planId: string,
  note: string,
  actor: Actor,
) {
  demand(
    actor.role === "security",
    "Only the incident commander can reconcile interrupted execution",
  );
  demand(run.status !== "stopped", "Run is stopped");
  demand(
    note.trim().length >= 20,
    "Record the external evidence checked before retrying",
  );
  const plan = getPlan(run, planId);
  demand(
    ["FAILED", "INDETERMINATE"].includes(plan.status),
    "Plan is not awaiting reconciliation",
  );
  const job = run.jobs.find(
    (j) =>
      j.kind === "plan" &&
      j.targetId === plan.id &&
      ["failed", "indeterminate"].includes(j.status),
  );
  demand(job, "No interrupted job to reconcile");
  authorize(run, plan);
  // Completed steps retain their receipts. The current step must be reconciled by
  // the commander; connector retries use the same incident/version identifiers.
  job.status = "queued";
  job.error = undefined;
  job.leaseOwner = undefined;
  job.leaseUntil = undefined;
  plan.status = "EXECUTING";
  plan.error = undefined;
  event(run, "plan.reconciled", actor.id, note, [], { planId });
  return plan;
}
export function standaloneAction(run: Run, action: Action, actor: Actor) {
  assertActor(actor);
  demand(run.status !== "stopped", "Run is stopped");
  demand(
    rolesFor(action, run).length === 0 && action.kind !== "prepare_patch",
    "This action needs a rehearsed plan and an executor",
  );
  if (action.kind === "revoke_credential" && actor.role === "defender")
    demand(
      actor.channel === "web",
      "Use the access administration browser to revoke credentials",
    );
  const message = applyAction(run, action, actor);
  event(run, "standing.action", actor.id, message);
  return message;
}
export function suggestedPlan(
  run: Run,
  kind: "containment" | "recovery" | "disruptive",
): PlanInput {
  const scope = affectedSdps(run);
  const evidenceIds = run.observations
    .filter((o) => o.trusted)
    .map((o) => o.id)
    .slice(-8);
  if (run.scenario === "credential-leak") return {
    title: "Disable exposed contractor access and hold affected work",
    rationale: "The leak detector and work audit identify exposed contractor access and affected work. Disable both access grants, quarantine the observed scope, and preserve healthy meter processing while employees review held work.",
    evidenceIds, alternatives: [], steps: [
      { kind: "disable_principal", principalId: "contractor" },
      { kind: "quarantine", sdpIds: scope },
      { kind: "verify" }, { kind: "close_incident" },
    ],
  };
  if (kind === "disruptive")
    return {
      title: "Pause all synchronization",
      rationale:
        "Manual baseline candidate: stop the affected worker before establishing an alternative.",
      evidenceIds,
      steps: [{ kind: "pause_worker", workerId: "primary" }],
      alternatives: [],
    };
  if (kind === "containment")
    return {
      title: "Contain exposure and mobilize owners",
      rationale:
        "Limit writes to affected service points while the sponsor checks authorization and operations validates physical meter installations.",
      evidenceIds,
      steps: [
        { kind: "quarantine", sdpIds: scope },
        { kind: "assign_field", sdpIds: scope },
        {
          kind: "notify",
          recipientId: "platform",
          message:
            "Please confirm whether the contractor mapping deployment was authorized and review the corrective code change.",
        },
        {
          kind: "notify",
          recipientId: "operations",
          message: `Verify installed meters at ${scope.join(", ")}; affected exchanges are held pending trustworthy records.`,
        },
      ],
      alternatives: [
        {
          title: "Pause all synchronization",
          reason:
            "Would interrupt unrelated asset processing before a replacement is validated.",
        },
      ],
    };
  return {
    title: "Restore trusted meter operations",
    rationale:
      "Promote tested mapping code, restore authoritative effective-dated associations, reconcile queued messages, and resume only after field acknowledgement.",
    evidenceIds,
    steps: [
      { kind: "prepare_patch", source: approvedSource },
      {
        kind: "promote_worker",
        workerId: "primary",
        artifactId: "repair-candidate",
      },
      { kind: "repair_data", sdpIds: scope },
      { kind: "replay", sdpIds: scope },
      { kind: "resume", sdpIds: scope },
      { kind: "verify" },
      { kind: "close_incident" },
    ],
    alternatives: [
      {
        title: "Use independent reserve",
        reason: run.workers.find((w) => w.id === "reserve")?.available
          ? "Available if its identity, configuration, and code are validated first."
          : "Reserve is unavailable in this scenario.",
      },
    ],
  };
}

export function finishFixturePlan(run: Run, planId: string) {
  // Offline evaluation only. Never exposed as an application or agent route.
  demand(run.mode !== "live", "Fixture execution cannot run in live mode");
  const plan = getPlan(run, planId);
  while (plan.stepIndex < plan.steps.length)
    executeStep(
      run,
      planId,
      { id: "fixture-executor", role: "worker", channel: "test" },
      {
        testsPassed: true,
        sourceDigest: "fixture:approved",
        message: "Deterministic fixture test receipt",
      },
    );
  for (const w of run.workers)
    if (w.artifactId === "repair-candidate") {
      run.artifacts.find((a) => a.id === w.artifactId)!.validation = "fixture";
      processNext(run);
    }
}
