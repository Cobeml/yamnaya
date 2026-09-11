import { expect, it } from "vitest";
import {
  createCamp,
  addSourceDossier,
  addConnection,
  startWorkflow,
  advanceWorkflow,
  submitWorkflow,
  createPublication,
  approveOutbound,
  draftOutbound,
  addVenue,
  checkOutbound,
  culturalResources,
  recordEvaluation,
  promoteSkillCandidate,
  type CampActor,
} from "../packages/core/src";
const now = "2026-09-11T12:00:00.000Z",
  operator: CampActor = { kind: "operator", id: "operator" };
function fixture() {
  const c = createCamp(
    "camp-test",
    { name: "Cultural test", focus: "america" },
    "operator",
    now,
  );
  c.evidence.push({
    id: "e1",
    title: "Original text",
    url: "https://archive.example/text",
    excerpt: "An exact original passage about transmitting a tradition.",
    digest: "a",
    fetchedAt: now,
    source: "connector",
  });
  return c;
}
const dossier = {
  evidenceId: "e1",
  kind: "primary",
  author: "Example author",
  edition: "First edition",
  date: "1900",
  language: "English",
  translation: "Original",
  locator: "Page 10",
  quote: "An exact original passage",
  relevance: "Transmission of a tradition",
  limitations: "A claim by the author, not independent confirmation",
};
it("checks passages, secondary provenance and role authority", () => {
  const c = fixture();
  expect(() =>
    addSourceDossier(
      c,
      { ...dossier, quote: "Invented quotation" },
      operator,
      now,
    ),
  ).toThrow("quoted passage");
  expect(() =>
    addSourceDossier(c, { ...dossier, kind: "secondary" }, operator, now),
  ).toThrow("Jamestown");
  expect(() =>
    addSourceDossier(
      c,
      dossier,
      { kind: "agent", id: "writer", agentId: "writer", campId: c.id },
      now,
    ),
  ).toThrow("another");
  const a = addSourceDossier(c, dossier, operator, now);
  expect(() =>
    addConnection(
      c,
      {
        sourceIds: [a.id, a.id],
        kind: "analogy",
        claim: "Similar forms",
        support: "Shared passage",
        counterexample: "Different histories",
      },
      operator,
      now,
    ),
  ).toThrow("distinct");
});
it("queues only ready dependencies and keeps explicit input waits asleep", () => {
  const c = fixture();
  c.status = "running";
  const p = createPublication(
    c,
    { title: "Test publication", repository: "example/research" },
    operator,
    now,
  );
  const tasks = startWorkflow(c, p.id, operator, now);
  advanceWorkflow(c, now);
  expect(c.jobs).toHaveLength(1);
  expect(tasks.map((t) => t.status)).toEqual([
    "working",
    "waiting_input",
    "waiting_input",
    "waiting_input",
  ]);
  submitWorkflow(
    c,
    {
      id: tasks[0].id,
      output: "Need an accessible verified edition",
      wait: true,
    },
    operator,
    now,
  );
  advanceWorkflow(c, now);
  expect(c.jobs).toHaveLength(1);
  expect(tasks[0].status).toBe("waiting_input");
});
it("binds outbound approval to reviewed bytes and documented contacts", () => {
  const c = fixture();
  const p = createPublication(
    c,
    { title: "Test publication", repository: "example/research" },
    operator,
    now,
  );
  p.build = {
    id: "build",
    sourceVersion: p.version,
    sourceDigest: "source",
    inputDigest: "input",
    digest: "digest",
    createdAt: now,
    checks: [],
    files: [],
  };
  p.approval = {
    actorId: "operator",
    version: p.version,
    digest: "digest",
    at: now,
  };
  const raw = {
    publicationId: p.id,
    channel: "gmail",
    destination: "reader@example.org",
    subject: "Research correspondence",
    text: "A substantive contribution to the discussion",
  };
  expect(() => draftOutbound(c, raw, operator, now)).toThrow("provenance");
  addVenue(
    c,
    {
      name: "Research group",
      url: "https://example.org",
      rules: "Contact about relevant work",
      relevance: "Studies cultural transmission",
      contact: raw.destination,
      contactSource: "https://example.org/contact",
    },
    operator,
    now,
  );
  const o = draftOutbound(c, raw, operator, now);
  expect(() =>
    approveOutbound(
      c,
      o.id,
      { kind: "agent", id: "marketer", agentId: "marketer", campId: c.id },
      now,
    ),
  ).toThrow();
  approveOutbound(c, o.id, operator, now);
  p.version++;
  expect(() => checkOutbound(c, o)).toThrow("changed");
});
it("keeps held-out answers private and requires comparative evidence for promotion", () => {
  const c = fixture();
  c.cultural!.examples.push({
    id: "heldout",
    role: "finder",
    split: "heldout",
    prompt: "Test prompt",
    expected: "Secret evaluation answer",
    reviewed: true,
  });
  const view = culturalResources(c, {
    kind: "agent",
    id: "finder",
    agentId: "finder",
    campId: c.id,
  });
  expect(view.examples).toEqual([]);
  c.candidates.push({
    id: "candidate",
    agentId: "finder",
    name: "Better procedure",
    content: "1. Verify evidence\n2. Check sources",
    status: "evaluated",
    checks: [{ name: "structural", passed: true }],
    createdAt: now,
  });
  expect(() => promoteSkillCandidate(c, "candidate", operator, now)).toThrow(
    "held-out",
  );
  expect(() =>
    recordEvaluation(
      c,
      {
        candidateId: "candidate",
        cases: Array(4).fill({
          exampleId: "heldout",
          baseline: 1,
          candidate: 2,
          baselineOutput: "Old output",
          candidateOutput: "New output",
          notes: "Reviewed improvement",
        }),
      },
      operator,
      now,
    ),
  ).toThrow("distinct");
});
