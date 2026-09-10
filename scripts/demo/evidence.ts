import type { PresentationState } from "../../apps/web/lib/presentation";

export interface Sample {
  offset: number;
  observedAt: string;
  runId: string;
  mode: string;
  revision: number;
  status: string;
  affected: number;
  quarantined: number;
  blockedCredentials: number;
  amiReads: number;
  healthyBatches: number;
  activeWorkers: number;
  approvals: number;
  fieldsConfirmed: number;
  slackDelivered: number;
  patchTested: boolean;
  prUrl?: string;
  checksPassed: number;
  checksTotal: number;
  missionVerified: boolean;
  events: { id: string; sequence: number; type: string; actor: string; simulationTime: string }[];
}
export interface Manifest {
  version: 1;
  origin: string;
  startedAt: string;
  finishedAt?: string;
  runId?: string;
  mode?: string;
  video: string;
  duration?: number;
  reason: string;
  timing: string;
  samples: Sample[];
  interruptions: { offset: number; kind: string }[];
}
export interface Edit {
  runId: string;
  preview: boolean;
  segments: { title: string; start: number; end: number; seconds: number; source?: string }[];
}

export function sample(state: PresentationState, offset: number, observedAt = new Date().toISOString()): Sample {
  const patch = state.artifacts.find(a => a.id === "repair-candidate");
  return {
    offset, observedAt, runId: state.id, mode: state.mode, revision: state.revision, status: state.status,
    affected: state.affected.length, quarantined: state.quarantinedSdps.length,
    blockedCredentials: state.credentials.filter(c => c.leakProven && c.status === "revoked").length,
    amiReads: state.metrics.amiReads, healthyBatches: state.metrics.healthyProcessed,
    activeWorkers: state.workers.filter(w => w.available && w.status === "running").length,
    approvals: state.plans.reduce((n, p) => n + p.approvals.filter(a => a.decision === "approved").length, 0),
    fieldsConfirmed: state.workOrders.filter(w => w.type === "field-verification" && w.status === "confirmed").length,
    slackDelivered: state.notifications.filter(n => n.deliveredVia === "slack" && n.status === "delivered").length,
    patchTested: patch?.validation === "tested",
    ...(patch?.prUrl && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(patch.prUrl) ? { prUrl: patch.prUrl } : {}),
    checksPassed: state.checks.filter(c => c.passed).length, checksTotal: state.checks.length,
    missionVerified: state.status === "verified" && state.checks.length > 0 && state.checks.every(c => c.passed),
    events: state.events.map(e => ({ id: e.id, sequence: e.sequence, type: e.type, actor: e.actor, simulationTime: e.time })),
  };
}

export function evidenceGates(manifest: Manifest) {
  const samples = manifest.samples;
  const first = samples[0], last = samples.at(-1);
  const events = samples.flatMap(s => s.events);
  const firstEvents = new Set(first?.events.map(e => e.id));
  const recordedEvents = events.filter(e => !firstEvents.has(e.id));
  return {
    oneRun: !!manifest.runId && samples.length > 1 && samples.every(s => s.runId === manifest.runId && s.mode === manifest.mode),
    liveAgents: manifest.mode === "live" && ["defender", "attacker"].every(actor => recordedEvents.some(e => e.type === "agent.turn" && e.actor === actor)),
    incidentCaptured: first?.status === "monitoring" && samples.some(s => s.affected > 0),
    accessBlocked: !!last && last.blockedCredentials > (first?.blockedCredentials ?? 0),
    humanDecisions: !!last && last.approvals > (first?.approvals ?? 0) && last.fieldsConfirmed > 0 && last.slackDelivered > 0,
    codeReceipt: !!last?.patchTested && !!last.prUrl,
    verified: last?.missionVerified === true,
    continuityObserved: !!first && !!last && last.amiReads > first.amiReads && last.healthyBatches > first.healthyBatches && samples.every(s => s.activeWorkers > 0),
    uninterrupted: manifest.interruptions.length === 0,
  };
}

export function validateEdit(manifest: Manifest, edit: Edit, duration: number) {
  if (edit.runId !== manifest.runId) throw new Error("Edit and recording run IDs differ.");
  if (!edit.preview && Object.values(evidenceGates(manifest)).some(ok => !ok))
    throw new Error("Live final export requires all recorded evidence gates. Use a labeled preview for incomplete or simulation footage.");
  if (!edit.segments.length || edit.segments.length > 12) throw new Error("Choose 1–12 segments.");
  let previous = -1;
  for (const s of edit.segments) {
    if (![s.start, s.end, s.seconds].every(Number.isFinite) || s.start < 0 || s.end <= s.start || s.seconds <= 0 || s.seconds > 60)
      throw new Error("Invalid clip timing.");
    if (!s.source && (s.end > duration + 0.04 || s.start < previous)) throw new Error("Source clips must fit the recording and retain chronological order.");
    if (!s.source) previous = s.start;
    if (!/^[\w .,()&:+-]{1,90}$/.test(s.title)) throw new Error("Use a short plain-text clip title.");
  }
  if (!edit.preview && Math.abs(edit.segments.reduce((n, s) => n + s.seconds, 0) - 60) > 0.001)
    throw new Error("The final edit must be exactly 60 seconds.");
}

export function suggestedEdit(manifest: Manifest, duration: number): Edit {
  const samples = manifest.samples;
  const preview = Object.values(evidenceGates(manifest)).some(ok => !ok);
  if (preview) return { runId: manifest.runId ?? "unbound", preview: true, segments: [{ title: "Recording preview", start: Math.min(samples[0]?.offset ?? 0, Math.max(0, duration - 1)), end: duration, seconds: Math.min(20, Math.max(1, duration - (samples[0]?.offset ?? 0))) }] };
  const find = (fn: (s: Sample) => boolean) => samples.find(fn)?.offset ?? samples[0].offset;
  const cues = [samples[0].offset, find(s => s.affected > 0), find(s => s.quarantined > 0 || s.blockedCredentials > 0), find(s => s.approvals > 0 || s.fieldsConfirmed > 0 || s.slackDelivered > 0), find(s => s.patchTested), find(s => s.missionVerified)];
  const titles = ["Preserve the mission", "The attack reaches meter operations", "Contain affected work", "Mobilize accountable people", "Restore trusted code and data", "Independently verified recovery"];
  const lengths = [6, 8, 14, 12, 12, 8];
  let previous = 0;
  return { runId: manifest.runId!, preview: false, segments: cues.map((cue, i) => {
    const start = Math.min(Math.max(previous, cue - (i ? 1 : 0)), Math.max(0, duration - 1));
    previous = start;
    return { title: titles[i], start, end: Math.min(duration, start + lengths[i]), seconds: lengths[i] };
  }) };
}
