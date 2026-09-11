import { z } from "zod";
import { DomainError } from "./errors";
import {
  campEvent,
  requireCampActor,
  requireCampOperator,
  queueCampTurn,
  type Camp,
  type CampActor,
} from "./camps";
export const culturalRoles = [
  "finder",
  "referencer",
  "writer",
  "marketer",
] as const;
export type CulturalRole = (typeof culturalRoles)[number];
export type TaskState =
  | "ready"
  | "working"
  | "waiting_input"
  | "waiting_quota"
  | "waiting_review"
  | "done";
export interface WorkflowTask {
  id: string;
  publicationId: string;
  role: CulturalRole;
  dependsOn: string[];
  status: TaskState;
  jobId?: string;
  output?: string;
  notBefore?: string;
  createdAt: string;
}
export interface SourceDossier {
  id: string;
  evidenceId: string;
  kind: "primary" | "secondary";
  author: string;
  edition: string;
  date: string;
  language: string;
  translation: string;
  locator: string;
  quote: string;
  relevance: string;
  limitations: string;
  createdBy: string;
  at: string;
}
export interface Connection {
  id: string;
  sourceIds: string[];
  kind: "documented_transmission" | "analogy" | "contradiction";
  claim: string;
  support: string;
  counterexample: string;
  at: string;
}
export interface Venue {
  id: string;
  url: string;
  name: string;
  rules: string;
  relevance: string;
  contact?: string;
  contactSource?: string;
  at: string;
}
export interface Outbound {
  id: string;
  publicationId: string;
  version: number;
  buildDigest: string;
  channel: "gmail" | "forum";
  destination: string;
  subject: string;
  text: string;
  status:
    "draft" | "approved" | "sending" | "sent" | "indeterminate" | "cancelled";
  approval?: { actorId: string; at: string };
  receipt?: { ref: string; detail: string; at: string };
  createdAt: string;
}
export interface Influence {
  id: string;
  publicationId: string;
  kind: "citation" | "discussion" | "reuse" | "followup";
  url: string;
  detail: string;
  internal: boolean;
  at: string;
  recordedBy: string;
}
export interface EvaluationExample {
  id: string;
  role: CulturalRole;
  split: "development" | "heldout";
  prompt: string;
  expected: string;
  reviewed: boolean;
}
export interface Evaluation {
  id: string;
  candidateId: string;
  configurationId: string;
  cases: {
    exampleId: string;
    baseline: number;
    candidate: number;
    baselineOutput: string;
    candidateOutput: string;
    notes: string;
  }[];
  at: string;
  actorId: string;
}
export interface CulturalState {
  version: 1;
  focus: "america" | "china";
  tasks: WorkflowTask[];
  sources: SourceDossier[];
  connections: Connection[];
  venues: Venue[];
  outbox: Outbound[];
  suppressed: string[];
  influence: Influence[];
  examples: EvaluationExample[];
  evaluations: Evaluation[];
}
export const culturalFocus = {
  america: {
    name: "American Cultural Mimetics",
    description:
      "Study cultural transmission in America: specific Indigenous nations, Scots-Irish traditions, religious movements, frontier narratives and contemporary subcultures. Compare specific texts, institutions and periods; preserve differences within and between communities.",
  },
  china: {
    name: "Chinese Cultural Mimetics",
    description:
      "Study cultural transmission in China: Han and Manchu histories, classical traditions, religious and esoteric movements, imperial institutions and contemporary cultural forms. Distinguish documented influence from retrospective analogy.",
  },
};
const procedures: Record<CulturalRole, string> = {
  finder:
    "1. Find original texts and verified editions; contemporary secondary analysis is restricted to jamestown.org and palladiummag.com.\n2. Fetch evidence and retain exact passages, authorship, edition, original date, language, translation and locators.\n3. Register source dossiers with limitations. A search snippet is not evidence; a primary text's claims are not established facts.\n4. Handoff at least two documented sources. If blocked, report what is missing and wait.",
  referencer:
    "1. Read the source dossiers and retrieve only relevant passages.\n2. Trace transmission, analogy and contradiction as distinct relationships.\n3. Register at least one connection between different sources, with supporting passages and a counterexample or rival explanation.\n4. Propose an original thesis while clearly identifying inference. Do not convert an analogy into a claim of historical influence.",
  writer:
    "1. Read the documented sources and argument map.\n2. Write theory and experimental art in Quarto: essays, conceptual vocabularies, manifestos, annotated texts and interactive experiments.\n3. Separate source evidence, interpretation and original creative propositions. Preserve citations and source notes.\n4. Render in the sandbox and hand the exact revision to the operator for review. Use image briefs for operator-generated Google website images.",
  marketer:
    "1. Read the reviewed work and understand its specific contribution.\n2. Find relevant discussions, beginning with Sofiechan, and public editorial/research contacts. Record venue rules and contact provenance.\n3. Prepare substantive, venue-specific contributions or send-only Gmail drafts. Every destination and exact message requires operator approval. Forums use manual final posting.\n4. Record verified public responses, independent citations and reuse; unknown readership stays unknown. Never invent delivery or repeat an uncertain send.",
};
export function initializeCulturalCamp(
  camp: Camp,
  focus: "america" | "china",
  now: string,
) {
  camp.cultural = {
    version: 1,
    focus,
    tasks: [],
    sources: [],
    connections: [],
    venues: [],
    outbox: [],
    suppressed: [],
    influence: [],
    examples: [],
    evaluations: [],
  };
  const names = ["Ada", "Noor", "Ivo", "Theo"];
  camp.agents = culturalRoles.map((role, i) => ({
    id: role,
    name: names[i],
    role: {
      finder: "Source finder",
      referencer: "Cross-referencer",
      writer: "Writer",
      marketer: "Marketer",
    }[role],
    activity: "idle",
    configurationId: `${role}-v1`,
    configurations: [
      {
        id: `${role}-v1`,
        version: 1,
        persona: culturalFocus[focus].description,
        skills: [{ name: `${role} procedure`, content: procedures[role] }],
        parentRefs: [],
        createdAt: now,
        modelProfile: {
          model: "gemini-3.8-flash",
          reasoning:
            role === "finder" || role === "referencer"
              ? "high"
              : role === "writer"
                ? "medium"
                : "low",
        },
      },
    ],
    turns: 0,
  }));
  camp.schedule.socialEnabled = false;
  camp.schedule.refreshMinutes = 0;
  camp.budgets.socialLimit = 0;
}
function state(camp: Camp) {
  if (!camp.cultural) throw new DomainError("Cultural camp required");
  return camp.cultural;
}
function id(camp: Camp, prefix: string) {
  return `${prefix}-${camp.events.length + 1}`;
}
function event(
  camp: Camp,
  kind: string,
  detail: string,
  actor: CampActor,
  now: string,
  refs: string[] = [],
) {
  campEvent(camp, kind, detail, actor.agentId ?? actor.id, now, refs);
}
function role(camp: Camp, actor: CampActor, allowed: CulturalRole[]) {
  requireCampActor(camp, actor);
  if (
    actor.kind === "agent" &&
    !allowed.includes(actor.agentId as CulturalRole)
  )
    throw new DomainError(
      "This task belongs to another camp role",
      "FORBIDDEN",
      403,
    );
}
const text = z.string().trim().min(3).max(6000);
const url = z
  .string()
  .url()
  .max(2000)
  .refine((v) => /^https?:\/\//.test(v), "HTTP URL required");
const fold = (s: string) => s.replace(/\s+/g, " ").trim();
export function addSourceDossier(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  role(camp, actor, ["finder"]);
  const s = state(camp);
  const input = z
    .object({
      evidenceId: z.string(),
      kind: z.enum(["primary", "secondary"]),
      author: text,
      edition: text,
      date: text,
      language: text,
      translation: text,
      locator: text,
      quote: text,
      relevance: text,
      limitations: text,
    })
    .parse(raw);
  const evidence = camp.evidence.find((e) => e.id === input.evidenceId);
  if (!evidence || !fold(evidence.excerpt).includes(fold(input.quote)))
    throw new DomainError(
      "The quoted passage must occur in retained source evidence",
    );
  const hostname = new URL(evidence.url).hostname.replace(/^www\./, "");
  if (
    input.kind === "secondary" &&
    !["jamestown.org", "palladiummag.com"].includes(hostname)
  )
    throw new DomainError(
      "Contemporary secondary sources are limited to Jamestown and Palladium",
    );
  if (
    s.sources.some(
      (d) => d.evidenceId === input.evidenceId && d.locator === input.locator,
    )
  )
    throw new DomainError("This passage is already documented");
  const dossier = {
    id: id(camp, "source"),
    ...input,
    createdBy: actor.agentId ?? actor.id,
    at: now,
  };
  s.sources.push(dossier);
  event(camp, "source.documented", input.author, actor, now, [dossier.id]);
  return dossier;
}
export function addConnection(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  role(camp, actor, ["referencer"]);
  const s = state(camp);
  const input = z
    .object({
      sourceIds: z.array(z.string()).min(2).max(8),
      kind: z.enum(["documented_transmission", "analogy", "contradiction"]),
      claim: text,
      support: text,
      counterexample: text,
    })
    .parse(raw);
  if (
    new Set(input.sourceIds).size !== input.sourceIds.length ||
    input.sourceIds.some((id) => !s.sources.some((d) => d.id === id))
  )
    throw new DomainError("Select distinct documented sources");
  const connection = { id: id(camp, "connection"), ...input, at: now };
  s.connections.push(connection);
  event(camp, "connection.proposed", input.claim, actor, now, [connection.id]);
  return connection;
}
export function startWorkflow(
  camp: Camp,
  publicationId: string,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const s = state(camp);
  if (!camp.publications.some((p) => p.id === publicationId))
    throw new DomainError("Publication not found");
  if (
    s.tasks.some(
      (t) => t.publicationId === publicationId && t.status !== "done",
    )
  )
    throw new DomainError("This publication already has active work");
  let previous = "";
  for (const r of culturalRoles) {
    const task: WorkflowTask = {
      id: `${id(camp, "task")}-${r}`,
      publicationId,
      role: r,
      dependsOn: previous ? [previous] : [],
      status: previous ? "waiting_input" : "ready",
      createdAt: now,
    };
    s.tasks.push(task);
    previous = task.id;
  }
  event(
    camp,
    "workflow.created",
    "Research → cross-reference → Quarto → distribution",
    actor,
    now,
    [publicationId],
  );
  return s.tasks.filter((t) => t.publicationId === publicationId);
}
export function advanceWorkflow(camp: Camp, now: string) {
  const s = camp.cultural;
  if (!s || camp.status !== "running") return;
  for (const t of s.tasks) {
    if (
      t.status === "waiting_input" &&
      t.dependsOn.length > 0 &&
      t.dependsOn.every((id) => {
        const prev = s.tasks.find((x) => x.id === id);
        return (
          prev?.status === "done" &&
          camp.jobs.find((j) => j.id === prev.jobId)?.status === "done"
        );
      })
    )
      t.status = "ready";
    if (t.status === "waiting_review") {
      const p = camp.publications.find((p) => p.id === t.publicationId);
      if (
        p?.build &&
        p.approval?.digest === p.build.digest &&
        p.approval.version === p.version
      )
        t.status = "ready";
    }
    if (t.status === "ready") {
      const p = camp.publications.find((p) => p.id === t.publicationId);
      if (
        t.role === "marketer" &&
        (!p?.build ||
          p.approval?.digest !== p.build.digest ||
          p.approval?.version !== p.version)
      ) {
        t.status = "waiting_review";
        continue;
      }
      const job = queueCampTurn(
        camp,
        t.role,
        `Workflow task ${t.id} for publication ${t.publicationId}. ${procedures[t.role]}\nRead cultural/resources and previous task outputs. Submit your handoff using camp_workflow_submit with this task ID. If inputs are insufficient, use camp_workflow_wait and explain the missing input.`,
        "agent",
        now,
      );
      job.input.taskId = t.id;
      t.jobId = job.id;
      t.status = "working";
    }
  }
}
export function submitWorkflow(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampActor(camp, actor);
  const s = state(camp);
  const input = z
    .object({ id: z.string(), output: text, wait: z.boolean().optional() })
    .parse(raw);
  const t = s.tasks.find((t) => t.id === input.id);
  if (!t || t.status !== "working")
    throw new DomainError("Task is not working");
  role(camp, actor, [t.role]);
  if (!input.wait) {
    if (t.role === "finder" && s.sources.length < 2)
      throw new DomainError(
        "At least two documented source passages are required",
      );
    if (t.role === "referencer" && !s.connections.length)
      throw new DomainError("An evidence-linked connection is required");
    if (t.role === "writer") {
      const p = camp.publications.find((p) => p.id === t.publicationId);
      if (!p?.build || p.build.sourceVersion !== p.version)
        throw new DomainError(
          "Render the current Quarto revision before handoff",
        );
    }
    if (
      t.role === "marketer" &&
      !s.outbox.some((o) => o.publicationId === t.publicationId)
    )
      throw new DomainError("Prepare a distribution draft before handoff");
  }
  t.output = input.output;
  t.status = input.wait ? "waiting_input" : "done";
  if (input.wait) t.dependsOn = [];
  event(
    camp,
    input.wait ? "workflow.waiting" : "workflow.submitted",
    input.output,
    actor,
    now,
    [t.id],
  );
  return t;
}
export function resumeWorkflow(
  camp: Camp,
  taskId: string,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const t = state(camp).tasks.find((t) => t.id === taskId);
  if (!t || !["waiting_input", "waiting_quota"].includes(t.status))
    throw new DomainError("Task cannot be resumed");
  if (
    t.jobId &&
    camp.jobs.some(
      (j) => j.id === t.jobId && ["leased", "queued"].includes(j.status),
    )
  )
    throw new DomainError("Task already has scheduled work");
  t.status = "ready";
  event(camp, "workflow.resumed", "Operator supplied new input", actor, now, [
    taskId,
  ]);
}
export function addVenue(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  role(camp, actor, ["marketer"]);
  const input = z
    .object({
      name: text,
      url,
      rules: text,
      relevance: text,
      contact: z.string().email().optional(),
      contactSource: url.optional(),
    })
    .parse(raw);
  if (input.contact && !input.contactSource)
    throw new DomainError("Email contact provenance is required");
  const v = { id: id(camp, "venue"), ...input, at: now };
  state(camp).venues.push(v);
  event(camp, "venue.recorded", v.name, actor, now, [v.id]);
  return v;
}
export function draftOutbound(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  role(camp, actor, ["marketer"]);
  const s = state(camp);
  const input = z
    .object({
      publicationId: z.string(),
      channel: z.enum(["gmail", "forum"]),
      destination: z.string().max(2000),
      subject: z
        .string()
        .trim()
        .min(3)
        .max(200)
        .refine((s) => !/[\r\n]/.test(s)),
      text: text,
    })
    .parse(raw);
  const p = camp.publications.find((p) => p.id === input.publicationId);
  if (
    !p?.build ||
    p.approval?.digest !== p.build.digest ||
    p.approval.version !== p.version
  )
    throw new DomainError(
      "Review the publication before preparing distribution",
    );
  if (input.channel === "gmail") {
    z.string().email().parse(input.destination);
    if (
      !s.venues.some(
        (v) => v.contact?.toLowerCase() === input.destination.toLowerCase(),
      )
    )
      throw new DomainError(
        "Record this contact and its public provenance first",
      );
  } else url.parse(input.destination);
  const draft: Outbound = {
    id: id(camp, "outbound"),
    ...input,
    version: p.version,
    buildDigest: p.build.digest,
    status: "draft",
    createdAt: now,
  };
  s.outbox.push(draft);
  event(camp, "outbound.drafted", draft.subject, actor, now, [draft.id]);
  return draft;
}
export function checkOutbound(camp: Camp, o: Outbound) {
  const p = camp.publications.find((p) => p.id === o.publicationId);
  if (
    !p?.build ||
    p.version !== o.version ||
    p.build.digest !== o.buildDigest ||
    p.approval?.digest !== o.buildDigest ||
    p.approval.version !== p.version
  )
    throw new DomainError(
      "Publication approval changed; prepare a new outbound draft",
    );
  if (state(camp).suppressed.includes(o.destination.toLowerCase()))
    throw new DomainError("Destination is suppressed");
}
export function approveOutbound(
  camp: Camp,
  id: string,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const o = state(camp).outbox.find((o) => o.id === id);
  if (!o || o.status !== "draft")
    throw new DomainError("Draft is not available");
  checkOutbound(camp, o);
  o.status = "approved";
  o.approval = { actorId: actor.id, at: now };
  event(camp, "outbound.approved", o.subject, actor, now, [o.id]);
  return o;
}
export function suppressDestination(
  camp: Camp,
  destination: string,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  z.string().min(3).max(2000).parse(destination);
  const s = state(camp);
  s.suppressed = [...new Set([...s.suppressed, destination.toLowerCase()])];
  for (const o of s.outbox)
    if (
      o.destination.toLowerCase() === destination.toLowerCase() &&
      ["draft", "approved"].includes(o.status)
    )
      o.status = "cancelled";
  event(camp, "outbound.suppressed", destination, actor, now);
}
export function recordInfluence(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const input = z
    .object({
      publicationId: z.string(),
      kind: z.enum(["citation", "discussion", "reuse", "followup"]),
      url,
      detail: text,
      internal: z.boolean(),
    })
    .parse(raw);
  if (!camp.publications.some((p) => p.id === input.publicationId))
    throw new DomainError("Publication not found");
  const item = {
    id: id(camp, "influence"),
    ...input,
    at: now,
    recordedBy: actor.id,
  };
  state(camp).influence.push(item);
  event(camp, "influence.recorded", input.detail, actor, now, [item.id]);
  return item;
}
export function recordEvaluation(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const s = state(camp);
  const input = z
    .object({
      candidateId: z.string(),
      cases: z
        .array(
          z.object({
            exampleId: z.string(),
            baseline: z.number().min(0).max(5),
            candidate: z.number().min(0).max(5),
            baselineOutput: text,
            candidateOutput: text,
            notes: text,
          }),
        )
        .min(4)
        .max(12),
    })
    .parse(raw);
  const candidate = camp.candidates.find((c) => c.id === input.candidateId);
  if (!candidate) throw new DomainError("Candidate not found");
  const agent = camp.agents.find((a) => a.id === candidate.agentId)!;
  if (
    new Set(input.cases.map((c) => c.exampleId)).size !== input.cases.length ||
    input.cases.some(
      (c) =>
        !s.examples.some(
          (e) =>
            e.id === c.exampleId &&
            e.role === agent.id &&
            e.split === "heldout" &&
            e.reviewed,
        ),
    )
  )
    throw new DomainError(
      "Use distinct operator-reviewed held-out examples for this role",
    );
  const e = {
    id: id(camp, "evaluation"),
    ...input,
    configurationId: agent.configurationId,
    at: now,
    actorId: actor.id,
  };
  s.evaluations.push(e);
  event(
    camp,
    "skill.compared",
    "Operator recorded held-out comparison",
    actor,
    now,
    [e.id],
  );
  return e;
}
export function addEvaluationExample(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const input = z
    .object({
      role: z.enum(culturalRoles),
      split: z.enum(["development", "heldout"]),
      prompt: text,
      expected: text,
    })
    .parse(raw);
  const e = { id: id(camp, "example"), ...input, reviewed: true };
  state(camp).examples.push(e);
  event(camp, "example.reviewed", "Evaluation example recorded", actor, now, [
    e.id,
  ]);
  return e;
}
export function culturalResources(camp: Camp, actor: CampActor) {
  requireCampActor(camp, actor);
  const s = structuredClone(state(camp));
  if (actor.kind === "agent") {
    s.examples = s.examples.filter(
      (e) => e.split === "development" && e.role === actor.agentId,
    );
    s.evaluations = [];
  }
  return s;
}
