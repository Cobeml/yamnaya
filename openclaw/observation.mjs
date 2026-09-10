// Bounded projections of the already-authorized API view. Never evaluator state.
const omitSource = ({ source: _source, ...value }) => ({ ...value, ...(_source ? { sourceAvailableByArtifactId: true } : {}) });
const planSummary = p => ({ id: p.id, version: p.version, status: p.status, threatVersion: p.threatVersion,
  title: p.title, rationale: p.rationale?.slice(0, 1200), evidenceIds: p.evidenceIds, requiredRoles: p.requiredRoles,
  approvals: p.approvals, stepIndex: p.stepIndex, steps: p.steps?.map(({ source, ...step }) => ({ ...step, ...(source ? { sourceOmitted: true, inspectPlanId: p.id } : {}) })),
  rehearsal: p.rehearsal, receipts: p.receipts, error: p.error });

export function agentState(s) {
  const focus = new Set([...(s.affected ?? []), ...(s.quarantinedSdps ?? [])]);
  const observations = new Map();
  for (const o of s.observations ?? []) {
    const key = `${o.kind}:${o.source}:${(o.resourceIds ?? []).join(",")}`;
    observations.delete(key); observations.set(key, o);
  }
  const tx = (s.transactions ?? []).filter(t => focus.has(t.request.sdpId) || t.status !== "processed");
  const view = { id: s.id, mode: s.mode, mission: s.mission, status: s.status, revision: s.revision, clock: s.clock, threatVersion: s.threatVersion,
    chat: s.chat?.slice(-12), checks: s.checks, affected: s.affected, quarantinedSdps: s.quarantinedSdps,
    credentials: s.credentials, workers: s.workers, workOrders: s.workOrders, metrics: s.metrics,
    plans: s.plans?.slice(-4).map(planSummary), observations: [...observations.values()].slice(-18),
    transactions: tx.slice(-12).map(({ history: _history, ...t }) => { void _history; return t; }),
    transactionCounts: (s.transactions ?? []).reduce((counts, t) => { counts[t.status] = (counts[t.status] ?? 0) + 1; return counts; }, {}),
    sor: s.sor, mdm: s.mdm, cache: s.cache, artifacts: s.artifacts?.map(omitSource),
    servicePoints: s.servicePoints, meters: s.meters, people: s.people,
    jobs: s.jobs?.slice(-6), notifications: s.notifications?.slice(-4),
    events: s.events?.filter(e => !["sync.saved", "agent.turn"].includes(e.type)).slice(-8),
    view: "Current operational view; history arrays are selected, not complete. Full history is retained by the server. Use resource artifact, observation, or transaction with resource_id to inspect an individual record, including deployed mapping source. Use yamnaya_plan inspect for full plan source." };
  // Remove whole historical entries, never cut JSON or current authority/check fields.
  for (const key of ["events", "notifications", "observations", "transactions", "chat"]) {
    while (JSON.stringify(view).length > 44000 && view[key]?.length > 1) view[key].shift();
  }
  if (JSON.stringify(view).length > 48000) throw new Error("Operational view exceeds its bound; inspect individual records.");
  return view;
}

export function driverFingerprint(s, role) {
  if (role === "attacker") return JSON.stringify([s.credentials, s.workers, s.workOrders]);
  return JSON.stringify([s.threatVersion, s.chat?.length, s.affected, s.credentials?.map(c => [c.id, c.status, c.leakProven]),
    s.workers?.map(w => [w.id, w.status, w.artifactId, w.available, w.validated]),
    s.plans?.map(p => [p.id, p.version, p.status, p.approvals.length]),
    s.workOrders?.map(w => [w.id, w.status])]);
}
