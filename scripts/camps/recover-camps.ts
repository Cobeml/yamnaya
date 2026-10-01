import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { campDatabase, mutateCamp, readCamp } from "../../apps/web/lib/camp-store";
import { astraReservation, campEvent, launchBudgetMicros, missionReady, runCamp, spiritLaunchId, type LaunchLedger } from "@yamnaya/core";
// One-time deployment repair. Unknown historical provider outcomes keep their full holds.
const local = parse(await readFile(".env.camps"));
process.env.CAMP_DATABASE_URL = local.CAMP_DATABASE_URL;
const apply = process.argv.includes("--apply");
try {
  const db = campDatabase();
  await db.begin(async tx => {
    const [row] = await tx`SELECT state FROM camp_quota WHERE id=${spiritLaunchId} FOR UPDATE`;
    if (!row) return;
    const s = row.state as LaunchLedger & { settlementRepairAt?: string; priorFallbackAt?: number };
    const before = s.reservedMicros;
    for (const r of s.requests) {
      if (r.settledMicros !== undefined || !r.usage || ![r.usage.inputTokens, r.usage.outputTokens].every(n => Number.isSafeInteger(n) && n >= 0)) continue;
      r.settledMicros = Math.ceil(r.usage.inputTokens * 12.5 + r.usage.outputTokens * 50);
      s.reservedMicros += r.settledMicros - r.reservedMicros;
    }
    if (!s.settlementRepairAt) {
      if (s.fallbackAt && s.reservedMicros + astraReservation(180000) < launchBudgetMicros) {
        s.priorFallbackAt = s.fallbackAt;
        delete s.fallbackAt;
      }
      s.settlementRepairAt = new Date().toISOString();
    }
    if (apply) await tx`UPDATE camp_quota SET state=${tx.json(s as never)} WHERE id=${spiritLaunchId}`;
    console.log(JSON.stringify({ apply, beforeReservedUsd: before / 1e6, estimatedChargesAndHoldsUsd: s.reservedMicros / 1e6, unknownRequests: s.requests.filter(r => !r.usage).length, fallback: !!s.fallbackAt }));
  });
  for (const focus of ["america", "china"]) {
    const id = `camp-cultural-${focus}`;
    const repair = (c: Awaited<ReturnType<typeof readCamp>>) => {
      if (c.cultural?.launch !== spiritLaunchId) throw new Error("Unexpected camp mission");
      const actor = { kind: "operator" as const, id: c.ownerId };
      const now = new Date().toISOString();
      for (const m of c.missions) if (m.status === "accepted" && !missionReady(c, m.id)) {
        m.status = "active";
        delete m.acceptedBy;
        campEvent(c, "mission.reopened", "Corrected premature outcome acceptance; operator requested continuation to a rendered issue.", actor.id, now, [m.id]);
      }
      runCamp(c, actor, now);
      return { camp: id, status: c.status, tasks: c.cultural.tasks.map(t => ({ role: t.role, status: t.status, recoveries: t.recoveryAttempts ?? 0 })) };
    };
    console.log(JSON.stringify(apply ? await mutateCamp(id, repair, { key: "campsite-handoff-recovery-v1" }) : repair(await readCamp(id))));
  }
} finally { await campDatabase().end(); }
