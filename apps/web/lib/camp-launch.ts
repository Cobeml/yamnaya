import {
  emptyLaunchLedger,
  launchSummary,
  spiritLaunchId,
  pacificDay,
  type LaunchLedger,
  type QuotaState,
} from "@yamnaya/core";
import { campDatabase } from "./camp-store";

export async function readLaunchSummary() {
  if (process.env.CAMP_STORAGE === "file")
    return launchSummary(emptyLaunchLedger());
  const rows =
    await campDatabase()`SELECT id,state FROM camp_quota WHERE id IN (${spiritLaunchId},'google-free')`;
  const quota = rows.find((r) => r.id === "google-free")?.state as
    QuotaState | undefined;
  const month = pacificDay(Date.now()).slice(0, 7);
  const reservedUsd =
    quota?.spend?.month === month ? quota.spend.reservedMicros / 1000000 : 0;
  const configured = Number(process.env.CAMP_GEMINI_MONTHLY_USD ?? 0);
  const limitUsd = Number.isFinite(configured)
    ? Math.min(10, Math.max(0, configured))
    : 0;
  return {
    ...launchSummary(
      (rows.find((r) => r.id === spiritLaunchId)?.state as LaunchLedger) ??
        emptyLaunchLedger(),
    ),
    gemini: {
      month,
      reservedUsd,
      limitUsd,
      remainingUsd: Math.max(0, limitUsd - reservedUsd),
    },
  };
}
