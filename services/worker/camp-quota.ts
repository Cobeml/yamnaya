import { randomUUID } from "node:crypto";
import { campDatabase } from "../../apps/web/lib/camp-store";
import { reserveQuota, type QuotaState } from "@yamnaya/core";
export async function reserveGoogleQuota(
  tokens: number,
  training: boolean,
  outputTokens = 8192,
) {
  const id = randomUUID();
  const db = campDatabase();
  const result = await db.begin(async (tx) => {
    await tx`INSERT INTO camp_quota(id,state) VALUES('google-free',${tx.json({ requests: [] })}) ON CONFLICT DO NOTHING`;
    const [row] =
      await tx`SELECT state FROM camp_quota WHERE id='google-free' FOR UPDATE`;
    const state = row.state as QuotaState;
    // Reserve UTF-8 input bytes as tokens, plus the full output/thinking limit.
    // No refunds for errors or missing usage receipts: this is a conservative ledger.
    // Prices are verified through 2026; stop paid calls when the published promotion expires.
    const paid = process.env.CAMP_GEMINI_FREE_TIER !== "true";
    if (paid && Date.now() >= Date.parse("2027-01-01T00:00:00Z"))
      return {
        allowed: false,
        retryAt: Date.now() + 86400000,
        reason: "Review Gemini pricing before resuming paid calls",
      };
    const result = reserveQuota(
      state,
      {
        rpm: Number(process.env.CAMP_GEMINI_RPM),
        tpm: Number(process.env.CAMP_GEMINI_TPM),
        rpd: Number(process.env.CAMP_GEMINI_RPD),
        freeTierConfirmed: !paid,
        monthlyBudgetMicros: Math.round(
          Number(process.env.CAMP_GEMINI_MONTHLY_USD ?? 0) * 1000000,
        ),
      },
      {
        id,
        tokens,
        training,
        costMicros: Math.ceil(tokens * 0.75 + outputTokens * 3.75),
      },
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
