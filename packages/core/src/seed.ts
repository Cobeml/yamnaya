import type { Run, Scenario, Mode, Association } from "./contracts";
import { approvedSource, compromisedSource } from "./mapping";

export function seedRun(
  id: string,
  scenario: Scenario = "contractor",
  mode: Mode = "simulation",
  createdAt = new Date().toISOString(),
): Run {
  const clock = "2026-09-10T14:00:00.000Z";
  const servicePoints = Array.from({ length: 20 }, (_, n) => ({
    id: `SDP-${String(n + 1).padStart(3, "0")}`,
    premise: `${110 + n * 8} ${n < 10 ? "Canal" : "Water"} Street`,
    account: `ACCT-${4000 + n}`,
    area: n < 10 ? "Canal district" : "Water district",
    x: 10 + (n % 5) * 19,
    y: 14 + Math.floor(n / 5) * 23,
  }));
  const meters = servicePoints.flatMap((s, n) => [
    {
      id: `MTR-${1000 + n}`,
      serial: `CE-SIM-${70000 + n}`,
      status: "installed" as const,
      channels: ["15-minute interval", "cumulative register"],
    },
    ...(n < 3
      ? [
          {
            id: `MTR-${2000 + n}`,
            serial: `CE-SIM-${80000 + n}`,
            status: "stock" as const,
            channels: ["15-minute interval", "cumulative register"],
          },
        ]
      : []),
  ]);
  const initial: Association[] = servicePoints.map((s, n) => ({
    meterId: `MTR-${1000 + n}`,
    sdpId: s.id,
    from: "2026-01-01T05:00:00.000Z",
    to: null,
  }));
  const physical = structuredClone(initial);
  for (let n = 0; n < 3; n++) {
    physical[n].to = clock;
    physical.push({
      meterId: `MTR-${2000 + n}`,
      sdpId: servicePoints[n].id,
      from: clock,
      to: null,
    });
  }
  const run: Run = {
    schemaVersion: 1,
    id,
    scenario,
    mode,
    name: "Meter operations / Canal district",
    status: "monitoring",
    revision: 0,
    threatVersion: 0,
    clock,
    createdAt,
    tick: 0,
    attackCount: 0,
    servicePoints,
    meters,
    people: [
      {
        id: "security",
        name: "Alex Morgan",
        role: "Incident commander",
        team: "Security",
        available: true,
      },
      {
        id: "platform",
        name: "Jordan Chen",
        role: "Platform engineer · contractor sponsor",
        team: "Platform",
        available: true,
      },
      {
        id: "operations",
        name: "Sam Rivera",
        role: "Meter operations lead",
        team: "Meter operations",
        available: true,
      },
      {
        id: "contractor",
        name: "Taylor Brooks",
        role: "Integration contractor",
        team: "Contract services",
        sponsorId: "platform",
        available: false,
      },
      {
        id: "field-team",
        name: "Canal field crew",
        role: "Meter installation and verification",
        team: "Field operations",
        available: true,
      },
    ],
    credentials: [
      {
        id: "cred-contractor",
        principalId: "contractor",
        kind: "session",
        status: "active",
        permissions: ["mapping:deploy", "support:write", "workorder:write"],
        leakProven: false,
        version: 1,
      },
      {
        id: "cred-integration",
        principalId: "contractor",
        kind: "integration",
        status: "active",
        permissions: ["sync:submit"],
        leakProven: false,
        version: 1,
      },
      {
        id: "cred-operator",
        principalId: "operations",
        kind: "session",
        status: "active",
        permissions: ["assets:read", "workorder:confirm"],
        leakProven: false,
        version: 1,
      },
    ],
    workers: [
      {
        id: "primary",
        name: "FlexSync primary",
        artifactId: "approved-v1",
        identityId: "worker-primary",
        configuration: "primary-config",
        available: true,
        validated: true,
        status: "running",
        processed: 0,
      },
      {
        id: "reserve",
        name: "FlexSync reserve",
        artifactId: "approved-v1",
        identityId:
          scenario === "shared-reserve" ? "worker-primary" : "worker-reserve",
        configuration:
          scenario === "shared-reserve" ? "primary-config" : "reserve-config",
        available: scenario !== "reserve-unavailable",
        validated: false,
        status: "standby",
        processed: 0,
      },
    ],
    artifacts: [
      {
        id: "approved-v1",
        name: "Approved mapping",
        trusted: true,
        commit: "fixture:approved-v1",
        digest: "",
        source: approvedSource,
        validation: "fixture",
      },
      {
        id: "compromised-v2",
        name: "Contractor mapping change",
        trusted: false,
        commit: "fixture:contractor-v2",
        digest: "",
        source: compromisedSource,
        validation: "fixture",
      },
    ],
    sor: structuredClone(physical),
    physical,
    mdm: structuredClone(initial),
    cache: Object.fromEntries(initial.map((a) => [a.sdpId, [a.meterId]])),
    transactions: [0, 1, 2].map((n) => ({
      id: `TX-${101 + n}`,
      request: {
        id: `MSG-EX-${n + 1}`,
        source: "WMS",
        verb: "exchange",
        sdpId: servicePoints[n].id,
        oldMeterId: `MTR-${1000 + n}`,
        meterId: `MTR-${2000 + n}`,
        effectiveAt: clock,
        receivedAt: clock,
        credentialId: "trusted-wms",
        manualRead: 2300 + n * 10,
      },
      status: "queued",
      stages: [],
      attempts: 0,
      history: [],
    })),
    workOrders: [0, 1, 2].map((n) => ({
      id: `WO-${301 + n}`,
      sdpId: servicePoints[n].id,
      meterId: `MTR-${2000 + n}`,
      type: "exchange",
      status: "open",
      ownerId: "field-team",
    })),
    observations: [
      {
        id: "OBS-1",
        kind: "baseline",
        source: "utility-seed",
        message:
          "Three completed physical meter exchanges await WMS synchronization. Bulk AMI ingestion uses a separate adapter.",
        time: clock,
        resourceIds: ["SDP-001", "SDP-002", "SDP-003"],
        status: "assumed_for_simulation",
        trusted: true,
      },
    ],
    events: [],
    notifications: [],
    plans: [],
    jobs: [],
    quarantinedSdps: [],
    verification: [],
    processedMessageIds: [],
    metrics: {
      amiReads: 1200,
      healthyProcessed: 0,
      unauthorizedDefenseActions: 0,
    },
    chat: [],
    idempotency: {},
  };
  return run;
}
