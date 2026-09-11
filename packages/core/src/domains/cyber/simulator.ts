import type {
  Run,
  Actor,
  Attack,
  Association,
  SyncRequest,
  Transaction,
} from "./contracts";
import { DomainError } from "./contracts";
import {
  equalAssociations,
  mapApproved,
  mapCompromised,
  pipelineStages,
} from "./mapping";
import type { ParsedGroup } from "./ingest";

export function event(
  run: Run,
  type: string,
  actor: string,
  message: string,
  resourceIds: string[] = [],
  refs: { planId?: string; actionId?: string } = {},
) {
  const e = {
    id: `${run.id}:EV-${run.events.length + 1}`,
    sequence: run.events.length + 1,
    time: run.clock,
    type,
    actor,
    message,
    resourceIds,
    ...refs,
  };
  run.events.push(e);
  return e;
}
export function observe(
  run: Run,
  kind: string,
  source: string,
  message: string,
  resourceIds: string[],
  trusted = true,
) {
  const o = {
    id: `OBS-${run.observations.length + 1}`,
    kind,
    source,
    message,
    time: run.clock,
    resourceIds,
    status: "observed" as const,
    trusted,
  };
  run.observations.push(o);
  return o;
}
export function mismatchedSdps(run: Run): string[] {
  return run.servicePoints
    .filter((s) => {
      const pending = run.transactions.some(
        (t) =>
          t.request.sdpId === s.id && t.status === "queued" && t.attempts === 0,
      );
      if (pending) return false;
      return !equalAssociations(
        run.sor.filter((a) => a.sdpId === s.id),
        run.mdm.filter((a) => a.sdpId === s.id),
      );
    })
    .map((s) => s.id);
}
export function invalidAssociations(run: Run): string[] {
  return run.servicePoints
    .filter(
      (s) => run.mdm.filter((a) => a.sdpId === s.id && !a.to).length !== 1,
    )
    .map((s) => s.id);
}
export function affectedSdps(run: Run): string[] {
  return [
    ...new Set([
      ...mismatchedSdps(run),
      ...invalidAssociations(run),
      ...run.quarantinedSdps,
      ...containmentScope(run),
    ]),
  ];
}
export function containmentScope(run: Run): string[] {
  if (run.scenario !== "credential-leak") return [];
  return [...new Set(run.observations
    .filter(o => o.kind === "credential-misuse" && o.trusted)
    .flatMap(o => o.resourceIds)
    .filter(id => run.servicePoints.some(s => s.id === id)))];
}
export function credentialWorks(
  run: Run,
  credentialId: string,
  operation: string,
): boolean {
  return run.credentials.some(
    (c) =>
      c.id === credentialId &&
      c.status === "active" &&
      c.permissions.includes(operation),
  );
}
function failTransaction(run: Run, tx: Transaction, message: string) {
  tx.status = "failed";
  tx.error = message;
  tx.stages.push("Status / exception");
  observe(run, "sync-exception", "FlexSync exception table", message, [
    tx.id,
    tx.request.sdpId,
  ]);
  event(run, "sync.failed", "sync-worker", `${tx.id}: ${message}`, [
    tx.id,
    tx.request.sdpId,
  ]);
}
export function processNext(run: Run, suppliedMapping?: Association[]): void {
  const worker = run.workers.find((w) => w.status === "running" && w.available);
  if (!worker) return;
  const tx = run.transactions.find(
    (t) =>
      t.status === "queued" && !run.quarantinedSdps.includes(t.request.sdpId),
  );
  if (!tx) return;
  const artifact = run.artifacts.find((a) => a.id === worker.artifactId)!;
  if (
    artifact.validation === "tested" &&
    tx.request.verb === "exchange" &&
    !suppliedMapping
  )
    return;
  tx.attempts++;
  tx.artifactId = artifact.id;
  tx.workerId = worker.id;
  tx.stages = pipelineStages.slice(0, 3);
  const r = tx.request;
  if (run.processedMessageIds.includes(r.id)) {
    tx.status = "processed";
    tx.history.push("Duplicate message: no additional write");
    return;
  }
  if (
    !["trusted-wms", "trusted-cis", "trusted-field"].includes(r.credentialId) &&
    !credentialWorks(run, r.credentialId, "sync:submit")
  ) {
    failTransaction(
      run,
      tx,
      "Source credential is revoked or cannot submit synchronization",
    );
    return;
  }
  if (
    !run.servicePoints.some((s) => s.id === r.sdpId) ||
    !run.meters.some((m) => m.id === r.meterId)
  ) {
    failTransaction(run, tx, "Unknown service point or meter MRID");
    return;
  }
  if (r.verb === "exchange" && !r.oldMeterId) {
    failTransaction(run, tx, "Meter exchange requires the outgoing meter MRID");
    return;
  }
  const expected = run.sor.find(
    (a) => a.meterId === r.meterId && a.sdpId === r.sdpId && !a.to,
  );
  if (artifact.trusted && (!expected || expected.from !== r.effectiveAt)) {
    failTransaction(
      run,
      tx,
      "Source/effective-date conflict with the authoritative asset record",
    );
    return;
  }
  tx.stages = pipelineStages.slice();
  const next =
    r.verb === "upsert"
      ? structuredClone(run.mdm)
      : (suppliedMapping ??
        (artifact.trusted
          ? mapApproved(run.mdm, r)
          : mapCompromised(run.mdm, r)));
  const prior = structuredClone(run.mdm);
  run.mdm = next;
  const changed = run.servicePoints
    .filter(
      (s) =>
        !equalAssociations(
          prior.filter((a) => a.sdpId === s.id),
          next.filter((a) => a.sdpId === s.id),
        ),
    )
    .map((s) => s.id);
  for (const id of changed)
    run.cache[id] = next
      .filter((a) => a.sdpId === id && !a.to)
      .map((a) => a.meterId);
  tx.status = "processed";
  tx.error = undefined;
  tx.history.push(`Saved with ${artifact.id} / ${worker.id}`);
  run.processedMessageIds.push(r.id);
  worker.processed++;
  if (r.verb === "upsert") run.metrics.healthyProcessed++;
  event(
    run,
    "sync.saved",
    worker.id,
    `${tx.id} completed source mapping → derivation → cache refresh → save`,
    [tx.id, r.sdpId, artifact.id],
  );
  const mismatch = mismatchedSdps(run);
  if (mismatch.length) {
    run.status = "incident";
    run.metrics.detectedAt ??= run.clock;
    observe(
      run,
      "mapping-disagreement",
      "SOR / MDM reconciliation",
      `Authoritative asset relationships disagree with MDM for ${mismatch.join(", ")}`,
      mismatch,
    );
  }
}
export function advance(run: Run, mapping?: Association[]) {
  if (run.status === "stopped") return;
  run.tick++;
  run.clock = new Date(Date.parse(run.clock) + 2000).toISOString();
  run.metrics.amiReads += 20;
  // Background asset updates traverse the same worker, separately from bulk AMI ingestion.
  if (run.tick % 3 === 0 && run.transactions.length < 250) {
    const sdp = run.servicePoints[3 + (Math.floor(run.tick / 3) % 17)];
    const asset = run.sor.find((a) => a.sdpId === sdp.id && !a.to)!;
    run.transactions.push({
      id: `TX-HEALTHY-${run.tick}`,
      request: {
        id: `MSG-CIS-${run.tick}`,
        source: "CIS",
        verb: "upsert",
        sdpId: sdp.id,
        meterId: asset.meterId,
        effectiveAt: asset.from,
        receivedAt: run.clock,
        credentialId: "trusted-cis",
      },
      status: "queued",
      stages: [],
      attempts: 0,
      history: [],
    });
  }
  processNext(run, mapping);
}
export function addInput(run: Run, groups: ParsedGroup[]) {
  for (const group of groups) {
    // Validate every row before committing any row in an SDP transaction group.
    const problem =
      group.error ??
      group.requests
        .map((r) =>
          !run.servicePoints.some((s) => s.id === r.sdpId) ||
          !run.meters.some((m) => m.id === r.meterId)
            ? "Unknown MRID in transaction group"
            : undefined,
        )
        .find(Boolean);
    if (problem) {
      observe(run, "input-error", "FlexSync input adapter", problem, [
        group.sdpId,
      ]);
      for (const r of group.requests)
        run.transactions.push({
          id: `TX-IN-${run.transactions.length + 1}`,
          request: r,
          status: "failed",
          error: problem,
          stages: ["Source mapping", "Status / exception"],
          attempts: 0,
          history: ["Entire consecutive SDP group rejected"],
        });
      continue;
    }
    for (const r of group.requests) {
      if (run.transactions.some((t) => t.request.id === r.id)) continue;
      run.transactions.push({
        id: `TX-IN-${run.transactions.length + 1}`,
        request: r,
        status: run.quarantinedSdps.includes(r.sdpId)
          ? "quarantined"
          : "queued",
        stages: [],
        attempts: 0,
        history: [],
      });
    }
  }
}
export function attack(run: Run, input: Attack, actor: Actor) {
  if (actor.role !== "attacker" && actor.role !== "security")
    throw new DomainError("Attacker capability required", "FORBIDDEN", 403);
  if (run.status === "stopped" || run.status === "verified")
    throw new DomainError("This run is not accepting attacker actions");
  if (run.attackCount >= 12)
    throw new DomainError("Attacker action budget exhausted");
  if (run.scenario === "credential-leak") {
    if (input.kind !== "use_leaked_access" || run.attackCount >= 1)
      throw new DomainError("This surface permits one synthetic leaked-access attempt");
    if (input.sdpId !== "SDP-001" || input.credentialId !== "cred-integration")
      throw new DomainError("Request is outside the exposed contractor surface");
  } else if (input.kind === "use_leaked_access") {
    throw new DomainError("Leaked-access exercise is unavailable on this surface");
  }
  const permission = {
    use_leaked_access: "sync:submit",
    deploy_mapping: "mapping:deploy",
    submit_stale_exchange: "sync:submit",
    forge_support: "support:write",
    alter_work_order: "workorder:write",
  }[input.kind];
  run.attackCount++;
  if (!credentialWorks(run, input.credentialId, permission)) {
    event(
      run,
      "access.denied",
      "access-controller",
      `Denied ${permission} using ${input.credentialId}`,
      [input.credentialId],
    );
    throw new DomainError(
      "Credential cannot perform this operation",
      "ACCESS_DENIED",
      403,
    );
  }
  run.threatVersion++;
  run.verification = [];
  run.status = "incident";
  if (input.kind === "use_leaked_access") {
    const exposed = run.credentials.filter(c => c.principalId === "contractor");
    exposed.forEach(c => { c.leakProven = true; });
    observe(run, "credential-leak", "Synthetic leak detector", "Both contractor access fingerprints match the exposed test fixture. The account's session and integration token are compromised.", exposed.map(c => c.id));
    const wo = run.workOrders.find(w => w.sdpId === input.sdpId)!;
    wo.status = "confirmed";
    wo.evidence = "Unverified update through exposed contractor access";
    run.transactions.push({ id: "TX-EXPOSED-1", request: {
      id: "MSG-EXPOSED-1", source: "WMS", verb: "exchange", sdpId: wo.sdpId,
      oldMeterId: "MTR-1000", meterId: wo.meterId, effectiveAt: run.clock,
      receivedAt: run.clock, credentialId: input.credentialId,
    }, status: "failed", stages: ["Source mapping", "SOR filtering", "Status / exception"],
      error: "Untrusted work update rejected before changing meter associations", attempts: 1,
      history: ["Ingress validation prevented an unapproved meter association write"] });
    observe(run, "credential-misuse", "Work update audit", "Exposed contractor access falsely marked one meter work order complete. Its related data update was rejected before changing meter records. Hold the affected data and field dispatch for review.", ["contractor", input.credentialId, wo.id, wo.sdpId, "TX-EXPOSED-1"]);
    run.metrics.detectedAt ??= run.clock;
    event(run, "credential.misused", "contractor", "Leaked access used for an unauthorized meter work update; affected scope identified", [wo.sdpId, wo.id, "TX-EXPOSED-1"]);
  } else if (input.kind === "deploy_mapping") {
    const primary = run.workers.find((w) => w.id === "primary")!;
    if (run.scenario === "benign") {
      run.status = "monitoring";
      observe(
        run,
        "authorized-maintenance",
        "Approved change register and sponsor",
        "Valid maintenance window; the deployed revision is the approved artifact. No leaked credential fingerprint is present.",
        ["primary", "cred-contractor"],
      );
      event(
        run,
        "maintenance.validated",
        "platform",
        "Authorized maintenance retains the approved mapping revision",
        ["primary"],
      );
      return;
    }
    primary.artifactId = "compromised-v2";
    primary.validated = false;
    const credential = run.credentials.find(
      (c) => c.id === input.credentialId,
    )!;
    {
      credential.leakProven = true;
      observe(
        run,
        "credential-leak",
        "demo credential leak detector",
        "Exact fingerprint of the active contractor session appears in the synthetic leaked-credential fixture.",
        [credential.id],
      );
    }
    observe(
      run,
      "deployment",
      "deployment registry",
      "Contractor revision promoted to the primary synchronization worker.",
      ["primary", "compromised-v2", credential.id],
    );
    event(
      run,
      "deployment.changed",
      "contractor",
      "Mapping revision deployed through retained contractor access",
      ["primary", "compromised-v2"],
    );
  } else if (input.kind === "submit_stale_exchange") {
    const sdp = run.servicePoints.find((s) => s.id === input.sdpId);
    const original = run.sor.find((a) => a.sdpId === sdp?.id && a.to);
    if (!sdp || !original)
      throw new DomainError("Only seeded meter exchanges are in attack scope");
    const request: SyncRequest = {
      id: `MSG-STALE-${run.attackCount}`,
      source: "WMS",
      verb: "exchange",
      sdpId: sdp.id,
      meterId: original.meterId,
      oldMeterId: run.sor.find((a) => a.sdpId === sdp.id && !a.to)?.meterId,
      effectiveAt: "2026-09-09T12:00:00.000Z",
      receivedAt: run.clock,
      credentialId: input.credentialId,
    };
    run.transactions.push({
      id: `TX-PIVOT-${run.attackCount}`,
      request,
      status: run.quarantinedSdps.includes(sdp.id) ? "quarantined" : "queued",
      stages: [],
      attempts: 0,
      history: [],
    });
    run.credentials.find((c) => c.id === input.credentialId)!.leakProven = true;
    observe(
      run,
      "credential-leak",
      "demo credential leak detector",
      "Integration token fingerprint matches the synthetic exposed-token fixture.",
      [input.credentialId],
    );
    observe(
      run,
      "source-anomaly",
      "WMS ingress audit",
      "Integration credential submitted a backdated meter exchange after contractor containment.",
      [input.credentialId, sdp.id],
    );
    event(
      run,
      "sync.submitted",
      "contractor",
      "Backdated exchange submitted using an integration credential",
      [input.credentialId, sdp.id],
    );
  } else if (input.kind === "forge_support") {
    observe(
      run,
      "support-note",
      "Support inbox (unverified sender)",
      input.text,
      [input.credentialId],
      false,
    );
    event(
      run,
      "support.received",
      "support-inbox",
      "An unverified maintenance authorization claim was received",
      [],
    );
  } else {
    const wo = run.workOrders.find(
      (w) => w.id === input.workOrderId && w.type === "exchange",
    );
    if (!wo) throw new DomainError("Work order is outside attacker scope");
    wo.status = "confirmed";
    wo.evidence = "Unverified contractor update";
    observe(
      run,
      "workorder-anomaly",
      "Field work audit",
      "Meter exchange marked complete by contractor credential without field confirmation.",
      [wo.id, wo.sdpId],
      false,
    );
  }
}
export function confirmField(run: Run, sdpIds: string[], actor: Actor) {
  if (actor.role !== "operations")
    throw new DomainError(
      "Meter operations approval required",
      "FORBIDDEN",
      403,
    );
  for (const id of sdpIds) {
    const wo = run.workOrders.find(
      (w) => w.sdpId === id && w.type === "field-verification",
    );
    if (!wo) throw new DomainError(`No assigned verification for ${id}`);
    const physical = run.physical.find((a) => a.sdpId === id && !a.to);
    wo.status = "confirmed";
    wo.evidence = `Operations acknowledged field observation: ${physical?.meterId} installed at ${id}`;
    observe(
      run,
      "field-confirmation",
      `Field crew acknowledged by ${actor.id}`,
      wo.evidence,
      [wo.id, id, physical?.meterId ?? "unknown"],
    );
    event(run, "field.confirmed", actor.id, wo.evidence, [wo.id, id]);
  }
}
