import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { addGrant, prepareSpiritLaunch } from "@yamnaya/core";
import { campDatabase, mutateCamp } from "../../apps/web/lib/camp-store";

// Run locally: use the local host's DB address, never a container hostname.
const local = parse(await readFile(".env.camps"));
process.env.CAMP_DATABASE_URL = local.CAMP_DATABASE_URL;
try {
  for (const focus of ["america", "china"]) {
    const { camp } = await mutateCamp(
      `camp-cultural-${focus}`,
      (camp) => {
        const actor = { kind: "operator" as const, id: camp.ownerId };
        const now = new Date().toISOString();
        prepareSpiritLaunch(camp, actor, now);
        const repository = camp.publications[0].repository;
        if (
          !camp.grants.some(
            (g) =>
              g.agentId === "writer" &&
              g.capability === "github.propose" &&
              !g.revoked &&
              g.scope === repository,
          )
        )
          addGrant(
            camp,
            {
              agentId: "writer",
              capability: "github.propose",
              scope: repository,
              expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            },
            actor,
            now,
          );
        return { prepared: true };
      },
      { key: "prepare-spirits-first-issue-v1" },
    );
    console.log(
      `${camp.name}: ${camp.status}, mission and four versioned profiles prepared`,
    );
  }
} finally {
  await campDatabase().end();
}
