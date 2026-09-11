import { randomUUID } from "node:crypto";
import { campDatabase } from "../../apps/web/lib/camp-store";
import { reserveQuota, type QuotaState } from "@yamnaya/core";
export async function reserveGoogleQuota(tokens: number, training: boolean) {
  const id = randomUUID();
  const db = campDatabase();
  const result = await db.begin(async (tx) => {
    await tx`INSERT INTO camp_quota(id,state) VALUES('google-free',${tx.json({ requests: [] })}) ON CONFLICT DO NOTHING`;
    const [row] =
      await tx`SELECT state FROM camp_quota WHERE id='google-free' FOR UPDATE`;
    const state = row.state as QuotaState;
    const result = reserveQuota(
      state,
      {
        rpm: Number(process.env.CAMP_GEMINI_RPM),
        tpm: Number(process.env.CAMP_GEMINI_TPM),
        rpd: Number(process.env.CAMP_GEMINI_RPD),
        freeTierConfirmed: process.env.CAMP_GEMINI_FREE_TIER === "true",
      },
      { id, tokens, training },
      Date.now(),
    );
    await tx`UPDATE camp_quota SET state=${tx.json(state as never)} WHERE id='google-free'`;
    return result;
  });
  return { ...result, id };
}
export async function releaseGoogleQuota(id: string, blockedUntil?: number) {
  const db = campDatabase();
  await db.begin(async (tx) => {
    const [row] =
      await tx`SELECT state FROM camp_quota WHERE id='google-free' FOR UPDATE`;
    if (!row) return;
    const s = row.state as QuotaState;
    if (s.active?.id === id) delete s.active;
    if (blockedUntil)
      s.blockedUntil = Math.max(s.blockedUntil ?? 0, blockedUntil);
    await tx`UPDATE camp_quota SET state=${tx.json(s as never)} WHERE id='google-free'`;
  });
}
