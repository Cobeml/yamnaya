import {
  emptyLaunchLedger,
  launchSummary,
  spiritLaunchId,
  type LaunchLedger,
} from "@yamnaya/core";
import { campDatabase } from "./camp-store";

export async function readLaunchSummary() {
  if (process.env.CAMP_STORAGE === "file")
    return launchSummary(emptyLaunchLedger());
  const rows =
    await campDatabase()`SELECT state FROM camp_quota WHERE id=${spiritLaunchId}`;
  return launchSummary((rows[0]?.state as LaunchLedger) ?? emptyLaunchLedger());
}
