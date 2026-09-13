import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { analyticalSourcePolicy, instructCamp } from "@yamnaya/core";
import {
  campDatabase,
  listCamps,
  mutateCamp,
} from "../../apps/web/lib/camp-store";

process.env.CAMP_DATABASE_URL = parse(
  await readFile(".env.camps"),
).CAMP_DATABASE_URL;
try {
  for (const camp of (await listCamps()).filter(
    (c) => c.cultural && c.status !== "archived",
  )) {
    await mutateCamp(
      camp.id,
      (c) => {
        instructCamp(
          c,
          {
            recipientId: "camp",
            text: `Operator source-policy update: ${analyticalSourcePolicy} Jain Family Institute and Phenomenal World are now additional analytical sources to consider when relevant to this camp's discovery mission. This replaces earlier two-publisher restrictions. Continue from saved evidence when the existing budget allows.`,
          },
          { kind: "operator", id: c.ownerId },
          new Date().toISOString(),
        );
        return { updated: true };
      },
      { key: "analytical-sources-jfi-phenomenal-world-v1" },
    );
    console.log(
      `${camp.id}: source-policy instruction recorded; work and budget waits preserved`,
    );
  }
} finally {
  await campDatabase().end();
}
