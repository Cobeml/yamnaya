import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import postgres from "postgres";
import {
  createCamp,
  createPublication,
  startWorkflow,
  culturalFocus,
  type CampActor,
  type Camp,
  addGrant,
} from "@yamnaya/core";
const local = parse(await readFile(".env.camps")),
  production = parse(await readFile(".env.camps.production"));
const db = postgres(local.CAMP_DATABASE_URL, { max: 1, onnotice: () => {} });
const owner = production.CAMP_OPERATOR_ID ?? "operator";
const actor: CampActor = { kind: "operator", id: owner };
function provisionGrants(camp: Camp) {
  const now = new Date().toISOString(),
    expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
  for (const agentId of ["finder", "referencer", "marketer"]) {
    for (const capability of [
      "research.fetch",
      "research.search",
      "browser.navigate",
    ] as const) {
      if (
        !camp.grants.some(
          (g) =>
            g.agentId === agentId && g.capability === capability && !g.revoked,
        )
      )
        addGrant(
          camp,
          {
            agentId,
            capability,
            scope: capability === "research.search" ? "public-web" : "*",
            expiresAt,
          },
          actor,
          now,
        );
    }
  }
  for (const capability of ["publication.render", "code.execute"] as const)
    if (
      !camp.grants.some(
        (g) =>
          g.agentId === "writer" && g.capability === capability && !g.revoked,
      )
    )
      addGrant(
        camp,
        {
          agentId: "writer",
          capability,
          scope:
            capability === "code.execute"
              ? camp.id
              : camp.publications[0].repository,
          expiresAt,
        },
        actor,
        now,
      );
}
try {
  for (const focus of ["america", "china"] as const) {
    const id = `camp-cultural-${focus}`;
    const exists = await db`SELECT state FROM camps WHERE id=${id}`;
    if (exists.length) {
      const camp = exists[0].state as Camp;
      const before = camp.events.length;
      provisionGrants(camp);
      if (camp.events.length > before)
        await db.begin(async (tx) => {
          camp.revision++;
          await tx`UPDATE camps SET state=${tx.json(camp as never)},revision=${camp.revision} WHERE id=${id}`;
          for (const e of camp.events.slice(before))
            await tx`INSERT INTO camp_events(camp_id,sequence,event) VALUES(${id},${e.sequence},${tx.json(e as never)}) ON CONFLICT DO NOTHING`;
        });
      console.log(
        `${focus}: paused pilot provisioned with scoped research tools`,
      );
      continue;
    }
    const now = new Date().toISOString();
    const camp = createCamp(
      id,
      {
        name: culturalFocus[focus].name,
        focus,
        domain: "research",
        mode: "live",
      },
      owner,
      now,
    );
    const repository =
      process.env[
        focus === "america"
          ? "CAMP_AMERICA_REPOSITORY"
          : "CAMP_CHINA_REPOSITORY"
      ] ?? `cobeml/yamnaya-${focus}`;
    const p = createPublication(
      camp,
      { title: culturalFocus[focus].name, repository },
      actor,
      now,
    );
    p.files["index.qmd"] =
      `---\ntitle: ${culturalFocus[focus].name}\n---\n\n${culturalFocus[focus].description}\n\n## The workshop\n\nTheory and experimental art investigating how cultural forms persist, combine, and change.\n\nOur work distinguishes retained source evidence, interpretation, and original creative propositions.\n\n- [Annotated library](library.qmd)\n- [Experiments](experiments.qmd)\n- [Corrections](corrections.qmd)\n`;
    p.files["library.qmd"] =
      "---\ntitle: Annotated library\n---\n\nSource dossiers will identify editions, languages, translations, passages, and limitations.\n";
    p.files["experiments.qmd"] =
      "---\ntitle: Experiments\n---\n\nOriginal theory, visual essays, and interactive cultural experiments.\n";
    p.files["corrections.qmd"] =
      "---\ntitle: Corrections\n---\n\nMaterial changes and corrected attributions will be recorded here.\n";
    p.files["essays/index.qmd"] =
      "---\ntitle: Essays\nlisting:\n  contents: '*.qmd'\n  feed: true\n---\n\nResearch and original arguments from the camp.\n";
    startWorkflow(camp, p.id, actor, now);
    provisionGrants(camp);
    await db.begin(async (tx) => {
      await tx`INSERT INTO camps(id,revision,state) VALUES(${camp.id},${camp.revision},${tx.json(camp as never)})`;
      for (const e of camp.events)
        await tx`INSERT INTO camp_events(camp_id,sequence,event) VALUES(${camp.id},${e.sequence},${tx.json(e as never)})`;
    });
    console.log(
      `${camp.name}: four agents, 48 unreviewed evaluation examples, paused workflow, repository target ${repository}`,
    );
  }
} finally {
  await db.end();
}
