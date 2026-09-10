import type { Run } from "./contracts";

export function terrain(run: Run) {
  const objects: {
    id: string;
    type: string;
    label: string;
    domain: string;
    properties: Record<string, unknown>;
  }[] = [
    {
      id: "mission",
      type: "Mission",
      label: "Trustworthy meter operations",
      domain: "mission",
      properties: { accountableOwner: "operations", status: run.status },
    },
    ...["deployment", "association-write", "workorder-authority"].map((id) => ({
      id: `space:${id}`,
      type: "ProtectedAccessSpace",
      label: id.replaceAll("-", " "),
      domain: "mission",
      properties: { mission: "mission" },
    })),
    ...run.workers.map((w) => ({
      id: w.id,
      type: "Workload",
      label: w.name,
      domain: "infrastructure",
      properties: { ...w },
    })),
    ...run.artifacts.map((a) => ({
      id: a.id,
      type: "BuildArtifact",
      label: a.name,
      domain: "code",
      properties: { commit: a.commit, digest: a.digest, trusted: a.trusted },
    })),
    ...run.servicePoints.map((s) => ({
      id: s.id,
      type: "ServiceDeliveryPoint",
      label: s.id,
      domain: "physical",
      properties: { ...s },
    })),
    ...run.meters.map((m) => ({
      id: m.id,
      type: "Meter",
      label: m.id,
      domain: "physical",
      properties: { ...m },
    })),
    ...run.people.map((p) => ({
      id: p.id,
      type: "Principal",
      label: p.name,
      domain: "personnel",
      properties: { ...p },
    })),
    ...run.credentials.map((c) => ({
      id: c.id,
      type: "AccessGrant",
      label: c.id,
      domain: "access",
      properties: { ...c },
    })),
    {
      id: "sor",
      type: "Database",
      label: "Utility system of record",
      domain: "data",
      properties: { authoritative: true },
    },
    {
      id: "mdm",
      type: "Database",
      label: "Meter data management",
      domain: "data",
      properties: { authoritative: false },
    },
  ];
  const relations: {
    from: string;
    to: string;
    type: string;
    evidenceRefs: string[];
    validFrom?: string;
    validTo?: string | null;
    semantics?: string;
  }[] = [
    {
      from: "mission",
      to: "mdm",
      type: "SUPPORTED_BY",
      evidenceRefs: ["OBS-1"],
    },
    {
      from: "mission",
      to: "operations",
      type: "SUPPORTED_BY",
      evidenceRefs: ["OBS-1"],
    },
    ...run.workers.flatMap((w) => [
      {
        from: w.id,
        to: w.artifactId,
        type: "RUNS",
        evidenceRefs: run.observations
          .filter((o) => o.resourceIds.includes(w.id))
          .map((o) => o.id),
      },
      { from: w.id, to: "mdm", type: "WRITES", evidenceRefs: ["OBS-1"] },
      { from: w.id, to: "sor", type: "READS", evidenceRefs: ["OBS-1"] },
    ]),
    ...run.credentials.map((c) => ({
      from: c.principalId,
      to: c.id,
      type: "HOLDS_GRANT",
      evidenceRefs: run.observations
        .filter((o) => o.resourceIds.includes(c.id))
        .map((o) => o.id),
    })),
    ...run.mdm.map((a) => ({
      from: a.meterId,
      to: a.sdpId,
      type: "INSTALLED_AT",
      evidenceRefs: run.observations
        .filter((o) => o.resourceIds.includes(a.sdpId))
        .map((o) => o.id),
      validFrom: a.from,
      validTo: a.to,
    })),
    {
      from: "platform",
      to: "contractor",
      type: "SPONSORS",
      evidenceRefs: ["OBS-1"],
    },
    {
      from: "space:deployment",
      to: "primary",
      type: "PROTECTS",
      evidenceRefs: ["OBS-1"],
    },
    {
      from: "space:association-write",
      to: "mdm",
      type: "PROTECTS",
      evidenceRefs: ["OBS-1"],
    },
  ];
  return {
    schemaVersion: 1,
    runId: run.id,
    validTime: run.clock,
    recordedTime: new Date().toISOString(),
    objects,
    relations,
  };
}
export function defenderView(run: Run) {
  const {
    physical: _physical,
    scenario: _scenario,
    idempotency: _idempotency,
    ...visible
  } = run;
  void _physical;
  void _scenario;
  void _idempotency;
  return visible;
}
export function attackerView(run: Run) {
  return {
    runId: run.id,
    mode: run.mode,
    time: run.clock,
    stopped: run.status === "stopped" || run.status === "verified",
    actionBudgetRemaining: 12 - run.attackCount,
    credentials: run.credentials
      .filter((c) => c.principalId === "contractor")
      .map((c) => ({ id: c.id, status: c.status, permissions: c.permissions })),
    workers: run.workers
      .filter((w) => w.id === "primary")
      .map((w) => ({ id: w.id, status: w.status, artifactId: w.artifactId })),
    servicePoints: run.servicePoints.slice(0, 3).map((s) => ({ id: s.id })),
    workOrders: run.workOrders
      .filter((w) => w.type === "exchange")
      .map((w) => ({ id: w.id, status: w.status, sdpId: w.sdpId })),
    recentResults: run.events
      .filter((e) =>
        ["access.denied", "deployment.changed", "sync.submitted"].includes(
          e.type,
        ),
      )
      .slice(-6),
  };
}
