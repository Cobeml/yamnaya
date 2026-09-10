import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import { seedRun, terrain, DomainError, type Run, type Scenario, type Mode } from '@yamnaya/core';
import * as schema from '../../../packages/core/src/storage-schema';

const globals = globalThis as typeof globalThis & { yamnayaDb?: ReturnType<typeof drizzle>; yamnayaLock?: Promise<unknown> };
const root = process.env.YAMNAYA_ROOT ?? (process.cwd().endsWith('/apps/web') ? path.resolve(process.cwd(), '../..') : process.cwd());
const dataFile = () => path.join(process.env.YAMNAYA_DATA_DIR ?? path.join(root, 'runtime'), 'state.json');
function database() {
  if (!process.env.DATABASE_URL) throw new DomainError('DATABASE_URL is not configured. Run setup and start PostgreSQL.', 'SETUP_REQUIRED', 503);
  globals.yamnayaDb ??= drizzle(postgres(process.env.DATABASE_URL, { max: 5, prepare: false, connect_timeout: 5 }));
  return globals.yamnayaDb;
}
function seeded(scenario: Scenario = 'contractor', mode: Mode = 'simulation') {
  const run = seedRun(`RUN-${randomUUID().slice(0, 8).toUpperCase()}`, scenario, mode);
  for (const a of run.artifacts) a.digest = createHash('sha256').update(a.source).digest('hex');
  return run;
}
async function fileRead(): Promise<Run> {
  try { return JSON.parse(await readFile(dataFile(), 'utf8')) as Run; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; const run = seeded(); await fileSave(run); return run; }
}
async function fileSave(run: Run) {
  await mkdir(path.dirname(dataFile()), { recursive: true });
  const tmp = `${dataFile()}.${randomUUID()}.tmp`; await writeFile(tmp, JSON.stringify(run)); await rename(tmp, dataFile());
}
function fileMode() {
  if (process.env.YAMNAYA_STORAGE === 'file' && process.env.VERCEL) throw new DomainError('File storage is for single-process local development only', 'SETUP_REQUIRED', 503);
  return process.env.YAMNAYA_STORAGE === 'file';
}
export async function readRun(): Promise<Run> {
  if (fileMode()) { const work = (globals.yamnayaLock ?? Promise.resolve()).catch(() => undefined).then(fileRead); globals.yamnayaLock = work; return work; }
  const db = database(); const [pointer] = await db.select().from(schema.control).where(eq(schema.control.key, 'active'));
  if (!pointer) return mutateRun(() => undefined).then(r => r.run);
  const [row] = await db.select().from(schema.runs).where(eq(schema.runs.id, pointer.runId));
  if (!row) throw new DomainError('Active run is missing', 'STORAGE_ERROR', 503); return row.state;
}
export async function mutateRun<T>(fn: (run: Run) => T, options: { key?: string; expectedRunId?: string; expectedRevision?: number; reset?: { scenario: Scenario; mode: Mode } } = {}): Promise<{ run: Run; result: T }> {
  function transform(original: Run) {
    if (options.expectedRunId && options.expectedRunId !== original.id) throw new DomainError('The scenario was reset; reload the current run');
    if (options.expectedRevision !== undefined && options.expectedRevision !== original.revision) throw new DomainError('State changed during the operation; read and retry');
    const run = options.reset ? seeded(options.reset.scenario, options.reset.mode) : structuredClone(original);
    if (options.key && Object.hasOwn(run.idempotency, options.key)) return { run, result: run.idempotency[options.key] as T };
    const result = fn(run); run.revision++;
    if (options.key) run.idempotency[options.key] = result ?? null;
    return { run, result };
  }
  if (fileMode()) {
    const work = (globals.yamnayaLock ?? Promise.resolve()).catch(() => undefined).then(async () => { const result = transform(await fileRead()); await fileSave(result.run); return result; });
    globals.yamnayaLock = work; return work;
  }
  const db = database();
  return db.transaction(async tx => {
    // A transaction-scoped advisory lock also serializes first-run initialization.
    await tx.execute(sql`select pg_advisory_xact_lock(82471421)`);
    const [pointer] = await tx.select().from(schema.control).where(eq(schema.control.key, 'active'));
    const old = pointer ? (await tx.select().from(schema.runs).where(eq(schema.runs.id, pointer.runId)))[0]?.state : undefined;
    const result = transform(old ?? seeded()); const run = result.run;
    await tx.insert(schema.runs).values({ id: run.id, revision: run.revision, state: run }).onConflictDoUpdate({ target: schema.runs.id, set: { revision: run.revision, state: run } });
    await tx.insert(schema.control).values({ key: 'active', runId: run.id }).onConflictDoUpdate({ target: schema.control.key, set: { runId: run.id } });
    if (run.events.length) await tx.insert(schema.audit).values(run.events.map(e => ({ runId: run.id, id: e.id, sequence: e.sequence, event: e }))).onConflictDoNothing();
    const graph = terrain(run);
    await tx.delete(schema.objects).where(eq(schema.objects.runId, run.id));
    await tx.insert(schema.objects).values(graph.objects.map(o => ({ runId: run.id, id: o.id, type: o.type, value: o })));
    await tx.delete(schema.relationships).where(eq(schema.relationships.runId, run.id));
    if (graph.relations.length) await tx.insert(schema.relationships).values(graph.relations.map((r, i) => ({ runId: run.id, id: String(i), value: r })));
    const approvals = run.plans.flatMap(p => p.approvals);
    if (approvals.length) await tx.insert(schema.approvals).values(approvals.map(a => ({ runId: run.id, id: a.id, role: a.role, actor: a.actorId, value: a }))).onConflictDoNothing();
    return result;
  });
}
