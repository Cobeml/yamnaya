import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await db`CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const exists = await db`SELECT id FROM schema_migrations WHERE id = '0001_initial'`;
  if (!exists.length) await db.begin(async tx => { await tx.unsafe(await readFile('migrations/0001_initial.sql', 'utf8')); await tx`INSERT INTO schema_migrations(id) VALUES ('0001_initial')`; });
  console.log('Database schema is current.');
} finally { await db.end(); }
