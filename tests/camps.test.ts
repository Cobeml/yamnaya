import { describe, it, expect } from "vitest";
import {
  createCamp,
  setCampStatus,
  addGrant,
  revokeGrant,
  requestCampTool,
  claimCampJob,
  checkCampJob,
  requireCampActor,
  campView,
  createPublication,
  editPublication,
  approvePublication,
  instructCamp,
  breedAgent,
  addSkillCandidate,
  evaluateSkillCandidate,
  promoteSkillCandidate,
  playCampGame,
  completeCampJob,
  type CampActor,
} from "../packages/core/src/index";
import { publicAddress } from "../services/worker/public-network";
import { checkPublicationSources } from "../services/worker/quarto";
const now = "2026-09-10T12:00:00.000Z",
  later = "2026-09-11T12:00:00.000Z";
const operator: CampActor = { id: "owner", kind: "operator" },
  agent: CampActor = {
    id: "ada",
    kind: "agent",
    campId: "camp-test",
    agentId: "ada",
  };
function setup() {
  const camp = createCamp(
    "camp-test",
    { name: "Test institute" },
    "owner",
    now,
  );
  setCampStatus(camp, "running", operator, now);
  return camp;
}
describe("camp authority and execution", () => {
  it("isolates camps, rejects self-grants and limits agents to their own grants", () => {
    const camp = setup();
    expect(() =>
      requireCampActor(camp, { ...agent, campId: "camp-other" }),
    ).toThrow();
    expect(() => addGrant(camp, {}, agent, now)).toThrow();
    addGrant(
      camp,
      {
        agentId: "noor",
        capability: "research.fetch",
        scope: "example.org",
        expiresAt: later,
      },
      operator,
      now,
    );
    const view = campView(camp, agent);
    expect(view).not.toHaveProperty("idempotency");
    expect(view.grants).toEqual([]);
    expect(campView(camp, operator).grants).toHaveLength(1);
  });
  it("checks revocation and expiry again after a tool is queued", () => {
    const camp = setup();
    const grant = addGrant(
      camp,
      {
        agentId: "ada",
        capability: "research.fetch",
        scope: "example.org",
        expiresAt: later,
      },
      operator,
      now,
    );
    expect(() =>
      requestCampTool(
        camp,
        {
          capability: "research.fetch",
          arguments: { url: "https://other.org" },
        },
        agent,
        now,
      ),
    ).toThrow();
    const job = requestCampTool(
      camp,
      {
        capability: "research.fetch",
        arguments: { url: "https://example.org" },
      },
      agent,
      now,
    );
    revokeGrant(camp, grant.id, operator, now);
    expect(() => checkCampJob(camp, job, now)).toThrow();
    expect(claimCampJob(camp, "worker", now, 2)).toBeNull();
    expect(job.status).toBe("cancelled");
  });
  it("binds publication approval to a passing current artifact and invalidates queued publication on edit", () => {
    const camp = setup();
    const p = createPublication(
      camp,
      { title: "Field report", repository: "owner/reports" },
      operator,
      now,
    );
    expect(() => approvePublication(camp, p.id, 1, operator, now)).toThrow();
    p.build = {
      id: "build",
      sourceVersion: 1,
      digest: "render1",
      sourceDigest: "source1",
      inputDigest: "evidence1",
      createdAt: now,
      checks: [{ name: "render", passed: true, detail: "checked" }],
      files: ["index.html"],
    };
    expect(() => approvePublication(camp, p.id, 1, agent, now)).toThrow();
    approvePublication(camp, p.id, 1, operator, now);
    const job = requestCampTool(
      camp,
      { capability: "publication.publish", arguments: { publicationId: p.id } },
      operator,
      now,
    );
    editPublication(
      camp,
      p.id,
      { "index.qmd": "Revised finding" },
      1,
      agent,
      now,
    );
    expect(p.approval).toBeUndefined();
    expect(p.build).toBeUndefined();
    expect(() => checkCampJob(camp, job, now)).toThrow();
    expect(() =>
      editPublication(camp, p.id, { "index.qmd": "stale" }, 1, agent, now),
    ).toThrow();
    expect(() =>
      editPublication(camp, p.id, { "../secret.md": "leak" }, 2, agent, now),
    ).toThrow();
  });
  it("reserves daily turns, serializes each agent and does not replay expired effects", () => {
    const camp = setup();
    camp.budgets.missionLimit = 1;
    instructCamp(camp, { text: "Investigate the mission" }, operator, now);
    const job = claimCampJob(camp, "worker", now, 2)!;
    expect(camp.budgets.missionTurns).toBe(1);
    expect(claimCampJob(camp, "worker2", now, 2)).toBeNull();
    expect(() =>
      completeCampJob(
        camp,
        job.id,
        "other",
        { outcome: "verified", detail: "forged" },
        null,
        now,
      ),
    ).toThrow();
    claimCampJob(camp, "worker", "2026-09-10T12:07:00.000Z", 2);
    expect(job.status).toBe("indeterminate");
    expect(job.attempts).toBe(1);
  });
  it("pauses queued work and revokes execution authority for leased work", () => {
    const camp = setup();
    instructCamp(camp, { text: "Investigate" }, operator, now);
    const job = claimCampJob(camp, "worker", now, 2)!;
    setCampStatus(camp, "paused", operator, now);
    expect(camp.jobs.filter((j) => j.status === "queued")).toHaveLength(0);
    expect(() => checkCampJob(camp, job, now)).toThrow();
  });
  it("avoids recursive broadcast wakeups and versions derived skills without inherited grants", () => {
    const camp = setup();
    instructCamp(
      camp,
      { text: "Useful observation", recipientId: "camp" },
      agent,
      now,
    );
    expect(camp.jobs).toHaveLength(0);
    const candidate = addSkillCandidate(
      camp,
      "ada",
      "Source review",
      "Procedure:\n1. Inspect primary evidence.\n2. Verify the result.",
      agent,
      now,
    );
    expect(() =>
      promoteSkillCandidate(camp, candidate.id, agent, now),
    ).toThrow();
    evaluateSkillCandidate(camp, candidate.id, operator, now);
    promoteSkillCandidate(camp, candidate.id, operator, now);
    const child = breedAgent(camp, ["ada", "noor"], "Rhea", operator, now);
    expect(child.configurations[0].parentRefs).toContain("camp-test/ada-v2");
    expect(child.configurations[0].skills).toHaveLength(1);
    expect(camp.grants.filter((g) => g.agentId === child.id)).toHaveLength(0);
  });
  it("enforces legal games and source references", () => {
    const camp = setup();
    for (const cell of [0, 3, 1, 4, 2]) playCampGame(camp, cell, operator, now);
    expect(camp.game.winner).toBe("X");
    expect(() => playCampGame(camp, 5, operator, now)).toThrow();
    const checks = checkPublicationSources({
      "_quarto.yml": "project: {}",
      "index.qmd": "A claim [@missing]. [Details](absent.qmd)",
      "references.bib": "",
    });
    expect(checks.filter((c) => !c.passed).map((c) => c.name)).toEqual([
      "Citation keys resolve",
      "Source links resolve",
    ]);
  });
  it("rejects local, metadata and reserved research addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "169.254.169.254",
      "172.17.0.1",
      "192.168.1.1",
      "::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
    ])
      expect(publicAddress(ip)).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
});
