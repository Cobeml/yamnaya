import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
config({ path: ".env.camps", quiet: true });
if (!process.env.CAMP_DATABASE_URL)
  throw new Error("CAMP_DATABASE_URL required");
const db = postgres(process.env.CAMP_DATABASE_URL, {
  max: 1,
  onnotice: () => {},
});
try {
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(642102)`;
    await tx.unsafe(await readFile("migrations/0002_camps.sql", "utf8"));
  });
  console.log("Camp database migrated.");
} finally {
  await db.end();
}
