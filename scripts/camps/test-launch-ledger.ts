import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { parse } from "dotenv";
import {
  astraModel,
  flashModel,
  launchBudgetMicros,
  spiritLaunchId,
  type LaunchLedger,
} from "@yamnaya/core";
import {
  reserveAstra,
  recordAstraUsage,
} from "../../services/worker/camp-launch";
import { campDatabase } from "../../apps/web/lib/camp-store";

// Real transaction test in a temporary database; never touches the launch ledger.
const local = parse(await readFile(".env.camps"));
const admin = postgres(local.CAMP_DATABASE_URL, { max: 1, onnotice: () => {} });
const name = `camps_launch_test_${randomUUID().replaceAll("-", "")}`;
const url = new URL(local.CAMP_DATABASE_URL);
url.pathname = `/${name}`;
let created = false;
try {
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  created = true;
  process.env.CAMP_DATABASE_URL = url.toString();
  const db = campDatabase();
  await db`CREATE TABLE camp_quota(id text PRIMARY KEY,state jsonb NOT NULL)`;
  const results = await Promise.all(
    Array.from({ length: 60 }, (_, i) =>
      reserveAstra(i % 2 ? "china" : "america", `job-${i}`, 80000),
    ),
  );
  const astra = results.filter((r) => r.model === astraModel);
  const [row] =
    await db`SELECT state FROM camp_quota WHERE id=${spiritLaunchId}`;
  const state = row.state as LaunchLedger;
  assert(state.reservedMicros <= launchBudgetMicros);
  assert.equal(state.requests.length, astra.length);
  assert.equal(
    state.reservedMicros,
    astra.reduce((n, r) => n + r.reservedMicros, 0),
  );
  assert.equal(results.filter((r) => r.switched).length, 1);
  assert(results.some((r) => r.model === flashModel));
  await Promise.all(
    astra.map((r) =>
      recordAstraUsage(r.id, { inputTokens: 100, outputTokens: 50 }),
    ),
  );
  await recordAstraUsage(astra[0].id, { inputTokens: 999, outputTokens: 999 });
  const fresh = postgres(url.toString(), { max: 1 });
  try {
    const [r] =
      await fresh`SELECT state FROM camp_quota WHERE id=${spiritLaunchId}`;
    const restored = r.state as LaunchLedger;
    assert.equal(restored.reservedMicros, state.reservedMicros);
    assert.equal(
      restored.requests.reduce((n, r) => n + (r.usage?.inputTokens ?? 0), 0),
      astra.length * 100,
    );
    assert(restored.fallbackAt);
  } finally {
    await fresh.end();
  }
  console.log(
    `Verified 60 concurrent reservations, one durable fallback, ${astra.length} deduplicated usage receipts, and fresh-connection persistence.`,
  );
} finally {
  if (created) {
    await campDatabase().end();
    await admin.unsafe(`DROP DATABASE "${name}"`);
  }
  await admin.end();
}
