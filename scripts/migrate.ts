import "dotenv/config";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
const connection = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL is required");
let url: URL;
try { url = new URL(connection); }
catch { throw new Error("Invalid database connection URL (value withheld)"); }
// Neon recommends bypassing its transaction pooler for schema migrations.
if (!process.env.DIRECT_DATABASE_URL && url.hostname.endsWith(".neon.tech"))
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
const db = postgres(url.toString(), { max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  await db`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const exists =
    await db`SELECT id FROM schema_migrations WHERE id = '0001_initial'`;
  if (!exists.length)
    await db.begin(async (tx) => {
      await tx.unsafe(await readFile("migrations/0001_initial.sql", "utf8"));
      await tx`INSERT INTO schema_migrations(id) VALUES ('0001_initial')`;
    });
  console.log("Database schema is current.");
} catch (error) {
  // Driver errors may contain connection details; never log the raw exception.
  const code = (error as { code?: string }).code;
  console.error(`Database migration failed (${code && /^[A-Z0-9_]+$/.test(code) ? code : "DATABASE_ERROR"}).`);
  process.exitCode = 1;
} finally {
  await db.end();
}
