import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
config({ path: process.env.CAMP_ENV_FILE ?? ".env.camps", quiet: true });
if (!process.env.CAMP_DATABASE_URL)
  throw new Error("CAMP_DATABASE_URL required");
const db = postgres(process.env.CAMP_DATABASE_URL, {
  max: 1,
  onnotice: () => {},
});
try {
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(642102)`;
    for (const file of ["0001_camps.sql", "0002_artifacts.sql"])
      await tx.unsafe(await readFile(`migrations/${file}`, "utf8"));
  });
  console.log("Camp database migrated.");
} finally {
  await db.end();
}
