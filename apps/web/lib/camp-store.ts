import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import {
  createCamp,
  claimCampJob,
  type Camp,
  type CampJob,
  DomainError,
} from "@yamnaya/core";

const globalStore = globalThis as typeof globalThis & {
  campDb?: ReturnType<typeof postgres>;
  campFileLock?: Promise<unknown>;
};
const directory = () =>
  path.resolve(
    process.env.CAMP_DATA_DIR ??
      (process.cwd().endsWith("apps/web")
        ? "../../runtime/camps"
        : "runtime/camps"),
  );
function fileMode() {
  if (process.env.CAMP_STORAGE === "file" && process.env.VERCEL)
    throw new DomainError(
      "File storage is unavailable on hosted deployments",
      "SETUP_REQUIRED",
      503,
    );
  return process.env.CAMP_STORAGE === "file";
}
export function campDatabase() {
  if (!process.env.CAMP_DATABASE_URL)
    throw new DomainError(
      "Camp database is not configured. Run camps:setup.",
      "SETUP_REQUIRED",
      503,
    );
  return (globalStore.campDb ??= postgres(process.env.CAMP_DATABASE_URL, {
    max: 6,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  }));
}
function validId(id: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id))
    throw new DomainError("Invalid camp ID", "INVALID_INPUT", 400);
  return id;
}
async function lock<T>(fn: () => Promise<T>) {
  const work = (globalStore.campFileLock ?? Promise.resolve())
    .catch(() => undefined)
    .then(fn);
  globalStore.campFileLock = work;
  return work;
}
async function readFileCamp(id: string): Promise<Camp> {
  try {
    return JSON.parse(
      await readFile(path.join(directory(), `${validId(id)}.json`), "utf8"),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      throw new DomainError("Camp not found", "NOT_FOUND", 404);
    throw e;
  }
}
async function saveFile(camp: Camp) {
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  const dest = path.join(directory(), `${validId(camp.id)}.json`);
  const tmp = `${dest}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(camp), { mode: 0o600 });
  await rename(tmp, dest);
}
export async function listCamps(): Promise<Camp[]> {
  if (fileMode()) {
    await mkdir(directory(), { recursive: true, mode: 0o700 });
    return Promise.all(
      (await readdir(directory()))
        .filter((f) => /^camp-[\w-]+\.json$/.test(f))
        .map((f) => readFileCamp(f.slice(0, -5))),
    );
  }
  return (await campDatabase()`SELECT state FROM camps ORDER BY id`).map(
    (r) => r.state as Camp,
  );
}
export async function readCamp(id: string): Promise<Camp> {
  validId(id);
  if (fileMode()) return lock(() => readFileCamp(id));
  const rows = await campDatabase()`SELECT state FROM camps WHERE id=${id}`;
  if (!rows.length) throw new DomainError("Camp not found", "NOT_FOUND", 404);
  return rows[0].state as Camp;
}
export async function insertCamp(
  input: unknown,
  ownerId: string,
): Promise<Camp> {
  const camp = createCamp(
    `camp-${randomUUID().slice(0, 8)}`,
    input,
    ownerId,
    new Date().toISOString(),
  );
  if (fileMode())
    return lock(async () => {
      await saveFile(camp);
      return camp;
    });
  const db = campDatabase();
  await db`INSERT INTO camps(id,revision,state) VALUES(${camp.id},0,${db.json(camp as never)})`;
  return camp;
}
export async function mutateCamp<T>(
  id: string,
  fn: (camp: Camp) => T,
  options: { expectedRevision?: number; key?: string } = {},
): Promise<{ camp: Camp; result: T }> {
  validId(id);
  function transform(original: Camp) {
    if (options.key && Object.hasOwn(original.idempotency, options.key))
      return { camp: original, result: original.idempotency[options.key] as T };
    if (
      options.expectedRevision !== undefined &&
      original.revision !== options.expectedRevision
    )
      throw new DomainError("Camp changed; reload and retry", "CONFLICT", 409);
    const camp = structuredClone(original);
    const result = fn(camp);
    if (!options.key && JSON.stringify(camp) === JSON.stringify(original))
      return { camp: original, result };
    camp.revision++;
    if (options.key) camp.idempotency[options.key] = result ?? null;
    return { camp, result };
  }
  if (fileMode())
    return lock(async () => {
      const result = transform(await readFileCamp(id));
      await saveFile(result.camp);
      return result;
    });
  const db = campDatabase();
  const result = await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id},642100))`;
    const rows = await tx`SELECT state FROM camps WHERE id=${id} FOR UPDATE`;
    if (!rows.length) throw new DomainError("Camp not found", "NOT_FOUND", 404);
    const changed = transform(rows[0].state as Camp);
    if (changed.camp === rows[0].state) return changed;
    await tx`UPDATE camps SET revision=${changed.camp.revision},state=${tx.json(changed.camp as never)} WHERE id=${id}`;
    const events = changed.camp.events.filter(
      (e) => e.sequence > (rows[0].state as Camp).events.length,
    );
    for (const event of events)
      await tx`INSERT INTO camp_events(camp_id,sequence,event) VALUES(${id},${event.sequence},${tx.json(event as never)}) ON CONFLICT DO NOTHING`;
    return changed;
  });
  return result as unknown as { camp: Camp; result: T };
}
export async function claimNextCampJob(
  owner: string,
): Promise<{ camp: Camp; job: CampJob } | null> {
  const now = new Date().toISOString();
  if (fileMode())
    return lock(async () => {
      const camps = await listCamps();
      const slots =
        2 -
        camps
          .flatMap((c) => c.jobs)
          .filter(
            (j) =>
              j.kind !== "tool" &&
              j.status === "leased" &&
              Date.parse(j.leaseUntil ?? "") > Date.now(),
          ).length;
      for (const camp of camps) {
        const before = JSON.stringify(camp);
        const job = claimCampJob(
          camp,
          owner,
          now,
          slots,
          camps.some((c) =>
            c.jobs.some(
              (j) =>
                j.status === "leased" &&
                Date.parse(j.leaseUntil ?? "") > Date.now() &&
                ["publication.render", "code.execute"].includes(
                  String(j.input.capability),
                ),
            ),
          )
            ? 0
            : 1,
        );
        if (JSON.stringify(camp) !== before) {
          camp.revision++;
          await saveFile(camp);
        }
        if (job) return { camp, job };
      }
      return null;
    });
  const db = campDatabase();
  const result = await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(642101)`;
    const rows =
      await tx`SELECT id,state FROM camps WHERE next_work_at <= now() OR state @? '$.jobs[*] ? (@.status == "leased")' ORDER BY last_claim_at NULLS FIRST, id FOR UPDATE`;
    const camps = rows.map((r) => r.state as Camp);
    const slots =
      2 -
      camps
        .flatMap((c) => c.jobs)
        .filter(
          (j) =>
            j.kind !== "tool" &&
            j.status === "leased" &&
            Date.parse(j.leaseUntil ?? "") > Date.now(),
        ).length;
    for (const camp of camps) {
      const sequence = camp.events.length;
      const before = JSON.stringify(camp);
      const job = claimCampJob(
        camp,
        owner,
        now,
        slots,
        camps.some((c) =>
          c.jobs.some(
            (j) =>
              j.status === "leased" &&
              Date.parse(j.leaseUntil ?? "") > Date.now() &&
              ["publication.render", "code.execute"].includes(
                String(j.input.capability),
              ),
          ),
        )
          ? 0
          : 1,
      );
      if (before === JSON.stringify(camp)) continue;
      camp.revision++;
      await tx`UPDATE camps SET revision=${camp.revision},state=${tx.json(camp as never)} WHERE id=${camp.id}`;
      for (const event of camp.events.slice(sequence))
        await tx`INSERT INTO camp_events(camp_id,sequence,event) VALUES(${camp.id},${event.sequence},${tx.json(event as never)}) ON CONFLICT DO NOTHING`;
      if (job) {
        await tx`UPDATE camps SET last_claim_at=now() WHERE id=${camp.id}`;
        return { camp, job };
      }
    }
    return null;
  });
  return result as unknown as { camp: Camp; job: CampJob } | null;
}
