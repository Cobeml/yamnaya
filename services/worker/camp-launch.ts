import { randomUUID } from "node:crypto";
import { campDatabase } from "../../apps/web/lib/camp-store";
import {
  emptyLaunchLedger,
  recordLaunchUsage,
  reserveLaunchRequest,
  spiritLaunchId,
  type LaunchLedger,
  type LaunchRequest,
} from "@yamnaya/core";

export async function reserveAstra(
  campId: string,
  jobId: string,
  inputBytes: number,
) {
  const id = randomUUID();
  const db = campDatabase();
  const result = await db.begin(async (tx) => {
    await tx`INSERT INTO camp_quota(id,state) VALUES(${spiritLaunchId},${tx.json(emptyLaunchLedger() as never)}) ON CONFLICT DO NOTHING`;
    const [row] =
      await tx`SELECT state FROM camp_quota WHERE id=${spiritLaunchId} FOR UPDATE`;
    const state = row.state as LaunchLedger;
    const before = state.fallbackAt;
    const result = reserveLaunchRequest(
      state,
      { id, campId, jobId, inputBytes },
      Date.now(),
    );
    await tx`UPDATE camp_quota SET state=${tx.json(state as never)} WHERE id=${spiritLaunchId}`;
    return {
      ...result,
      switched: before === undefined && state.fallbackAt !== undefined,
    };
  });
  return { ...result, id };
}
export async function recordAstraUsage(
  id: string,
  usage: LaunchRequest["usage"],
) {
  const db = campDatabase();
  await db.begin(async (tx) => {
    const [row] =
      await tx`SELECT state FROM camp_quota WHERE id=${spiritLaunchId} FOR UPDATE`;
    if (!row) throw new Error("Launch reservation missing");
    const state = row.state as LaunchLedger;
    recordLaunchUsage(state, id, usage);
    await tx`UPDATE camp_quota SET state=${tx.json(state as never)} WHERE id=${spiritLaunchId}`;
  });
}
