import { parse } from "dotenv";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { localObjects } from "../../services/worker/camp-objects";
import { verifyArtifact } from "../../services/worker/camp-artifact-database";
const production = parse(await readFile(".env.camps.production"));
const local = parse(await readFile(".env.camps"));
const target = postgres(local.CAMP_DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  onnotice: () => {},
});
const source = postgres(production.CAMP_DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  onnotice: () => {},
});
await mkdir("runtime/backups", { recursive: true, mode: 0o700 });
try {
  let snapshot:
    | {
        camps: Record<string, unknown>[];
        events: Record<string, unknown>[];
        artifacts: Record<string, unknown>[];
      }
    | undefined;
  try {
    const [row] =
      await source`SELECT (SELECT coalesce(jsonb_agg(c),'[]') FROM camps c) camps,(SELECT coalesce(jsonb_agg(e),'[]') FROM camp_events e) events,(SELECT coalesce(jsonb_agg(a),'[]') FROM camp_artifacts a) artifacts`;
    snapshot = row as typeof snapshot;
    await writeFile(
      "runtime/backups/neon-camps.json",
      JSON.stringify(snapshot),
      { mode: 0o600 },
    );
  } catch {
    await writeFile(
      "runtime/backups/neon-migration-status.json",
      JSON.stringify({
        status: "unavailable",
        at: new Date().toISOString(),
        detail:
          "Neon export unavailable. Existing remote data is retained; local pilots are separate.",
      }),
      { mode: 0o600 },
    );
    console.log(
      "Neon export unavailable; no remote data deleted. Local storage is available for separate pilots.",
    );
  }
  if (snapshot) {
    await target.begin(async (tx) => {
      for (const row of snapshot.camps) {
        const existing =
          await tx`SELECT state FROM camps WHERE id=${String(row.id)}`;
        if (
          existing.length &&
          JSON.stringify(existing[0].state) !== JSON.stringify(row.state)
        )
          throw new Error("Camp identity conflict; target was not overwritten");
        await tx`INSERT INTO camps(id,revision,state) VALUES(${String(row.id)},${Number(row.revision)},${tx.json(row.state as never)}) ON CONFLICT DO NOTHING`;
      }
      for (const row of snapshot.events)
        await tx`INSERT INTO camp_events(camp_id,sequence,event) VALUES(${String(row.camp_id)},${Number(row.sequence)},${tx.json(row.event as never)}) ON CONFLICT DO NOTHING`;
    });
    for (const row of snapshot.artifacts) {
      const value = verifyArtifact({
        digest: String(row.digest),
        files: row.files as Record<string, string>,
      });
      const object = await localObjects.put(Buffer.from(JSON.stringify(value)));
      const camp = String(row.camp_id),
        build = String(row.build_id);
      if (!/^[\w-]+$/.test(camp + build))
        throw new Error("Invalid artifact identity");
      await mkdir(`runtime/imported-artifacts/${camp}`, {
        recursive: true,
        mode: 0o700,
      });
      await writeFile(
        `runtime/imported-artifacts/${camp}/${build}.json`,
        JSON.stringify({ object }),
        { mode: 0o600 },
      );
    }
    const [count] =
      await target`SELECT count(*)::int n FROM camps WHERE id=ANY(${snapshot.camps.map((c) => String(c.id))})`;
    if (count.n !== snapshot.camps.length)
      throw new Error("Migration count mismatch");
    await writeFile(
      "runtime/backups/neon-migration-status.json",
      JSON.stringify({
        status: "verified",
        camps: snapshot.camps.length,
        events: snapshot.events.length,
        artifacts: snapshot.artifacts.length,
        at: new Date().toISOString(),
      }),
      { mode: 0o600 },
    );
    console.log(
      `Verified ${snapshot.camps.length} camps and ${snapshot.artifacts.length} artifact hashes; original Neon data retained.`,
    );
  }
} finally {
  await source.end();
  await target.end();
}
