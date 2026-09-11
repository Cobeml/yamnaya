import { expect, it } from "vitest";
import {
  createCamp,
  createPublication,
  requestImage,
  importImage,
  approvePublication,
  cancelImage,
  type CampActor,
} from "../packages/core/src/index";
const now = "2026-09-11T12:00:00.000Z";
const operator: CampActor = { id: "owner", kind: "operator" };
it("keeps Google image generation a human handoff and invalidates approval on import", () => {
  const camp = createCamp(
    "camp-media",
    { name: "Design institute" },
    operator.id,
    now,
  );
  const p = createPublication(
    camp,
    { title: "Fieldnotes", repository: "example/reports" },
    operator,
    now,
  );
  const actor: CampActor = {
    id: "ada",
    kind: "agent",
    campId: camp.id,
    agentId: "ada",
  };
  const brief = requestImage(
    camp,
    {
      publicationId: p.id,
      prompt: "An architectural study with warm natural light",
      caption: "Light & <shade>",
    },
    actor,
    now,
  );
  expect(brief.status).toBe("awaiting_operator");
  expect(camp.jobs).toHaveLength(0);
  p.build = {
    id: "build",
    sourceVersion: p.version,
    digest: "verified",
    sourceDigest: "source",
    inputDigest: "input",
    createdAt: now,
    checks: [{ name: "render", passed: true, detail: "ok" }],
    files: ["index.html"],
  };
  approvePublication(camp, p.id, p.version, operator, now);
  const upload = {
    id: brief.id,
    version: p.version,
    data: "/9j/2Q==",
    width: 1,
    height: 1,
  };
  expect(() => importImage(camp, upload, actor, now)).toThrow(
    "Only the operator",
  );
  expect(() =>
    importImage(camp, { ...upload, version: 0 }, operator, now),
  ).toThrow("Publication changed");
  expect(brief.status).toBe("awaiting_operator");
  importImage(camp, upload, operator, now);
  expect(p.approval).toBeUndefined();
  expect(p.build).toBeUndefined();
  expect(p.files[brief.file!]).toContain("Light &amp; &lt;shade&gt;");
  expect(p.files["index.qmd"]).toContain(
    "AI-generated illustration; not source evidence",
  );
  expect(() =>
    importImage(camp, { ...upload, version: p.version }, operator, now),
  ).toThrow("no longer awaiting");
  const second = requestImage(
    camp,
    {
      publicationId: p.id,
      prompt: "A quiet landscape under morning skies",
      caption: "Landscape",
    },
    operator,
    now,
  );
  expect(() =>
    importImage(
      camp,
      { ...upload, id: second.id, version: p.version, data: "PHN2Zz4=" },
      operator,
      now,
    ),
  ).toThrow("JPEG");
  cancelImage(camp, second.id, operator, now);
  expect(() =>
    importImage(
      camp,
      { ...upload, id: second.id, version: p.version },
      operator,
      now,
    ),
  ).toThrow("no longer awaiting");
});
