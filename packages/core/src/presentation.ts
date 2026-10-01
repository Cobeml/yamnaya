import type { Camp } from "./camps";
export interface CampAction {
  id: string;
  title: string;
  detail: string;
  target: "task" | "publications" | "research" | "settings";
  taskId?: string;
}
export function campActions(camp: Camp): CampAction[] {
  const items: CampAction[] = [];
  for (const t of camp.cultural?.tasks ?? []) {
    if (t.status === "waiting_input" && !t.dependsOn.length)
      items.push({ id: `task-${t.id}-${t.jobId}`, title: `${camp.agents.find(a => a.id === t.role)?.name ?? t.role} needs help`,
        detail: t.waitKind === "handoff" || t.output?.startsWith("Agent finished without")
          ? "The research turn ended before handing work to the next agent." : (t.output ?? "Supply the missing input to continue."), target: "task", taskId: t.id });
  }
  for (const p of camp.publications) {
    if (p.build?.sourceVersion === p.version && p.build.checks.every(c => c.passed) && p.approval?.digest !== p.build.digest)
      items.push({ id: `review-${p.id}-${p.version}-${p.build.digest}`, title: "Report ready for review", detail: p.title, target: "publications" });
  }
  for (const b of camp.imageBriefs ?? []) if (b.status === "awaiting_operator")
    items.push({ id: b.id, title: "Illustration requested", detail: b.caption, target: "publications" });
  for (const o of camp.cultural?.outbox ?? []) if (["draft", "indeterminate"].includes(o.status))
    items.push({ id: `outreach-${o.id}-${o.version}-${o.buildDigest}`, title: o.status === "draft" ? "Outreach needs review" : "Check message delivery", detail: o.subject, target: "research" });
  // Surface only unresolved current work, not the camp's entire failure history.
  for (const j of camp.jobs.filter(j => j.status === "indeterminate"))
    items.push({ id: j.id, title: "Check an interrupted action", detail: j.receipt?.detail ?? "Delivery could not be confirmed. Inspect before retrying.", target: "settings" });
  return items;
}
export function campProgress(camp: Camp, now: number) {
  if (camp.status !== "running") return { label: camp.status === "archived" ? "Archived" : "Paused", active: false };
  const work = camp.jobs.filter(j => ["queued", "leased"].includes(j.status));
  if (work.some(j => j.status === "leased" && Date.parse(j.leaseUntil ?? "") > now)) return { label: "Working", active: true };
  if (work.some(j => j.status === "queued" && (!j.input.notBefore || Date.parse(String(j.input.notBefore)) <= now))) return { label: "Queued", active: true };
  const waits = work.filter(j => j.input.notBefore).map(j => Date.parse(String(j.input.notBefore))).filter(n => n > now);
  if (waits.length) return { label: "Waiting", until: Math.min(...waits), active: false };
  const actions = campActions(camp);
  if (actions.length) return { label: actions.every(a => a.target === "publications") ? "Ready for review" : "Needs you", active: false };
  if (camp.cultural?.tasks.some(t => t.status === "ready")) return { label: "Queued", active: true };
  return { label: "Idle", active: false };
}
export function agentBubble(camp: Camp, agentId: string, now: number): { text: string; kind: "activity" | "dialogue" | "waiting" } | null {
  const message = camp.messages.filter(m => m.senderId === agentId && now - Date.parse(m.at) >= 0 && now - Date.parse(m.at) < 30000).at(-1);
  if (message) return { text: message.text, kind: "dialogue" };
  const job = camp.jobs.filter(j => j.agentId === agentId && j.status === "leased" && Date.parse(j.leaseUntil ?? "") > now).at(-1);
  if (job) {
    const event = camp.events.filter(e => e.actorId === agentId && e.refs.includes(job.id) && e.type === "tool.start").at(-1);
    const names: Record<string, string> = { finder: "Reading sources", referencer: "Connecting the passages", writer: "Drafting the report", marketer: "Preparing outreach" };
    return { text: event?.detail.startsWith("camp_tool:") ? "Using a research tool" : names[agentId] ?? "Working on the mission", kind: "activity" };
  }
  const task = camp.cultural?.tasks.find(t => t.role === agentId && t.status !== "done");
  if (task?.status === "waiting_quota") return { text: "Waiting for model allowance", kind: "waiting" };
  if (task?.status === "waiting_review") return { text: "Waiting for your report review", kind: "waiting" };
  if (task?.status === "waiting_input") return { text: task.dependsOn.length ? "Waiting for the previous agent" : "Needs your attention", kind: "waiting" };
  return null;
}
