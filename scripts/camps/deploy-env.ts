import { readFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";
const file = process.env.CAMP_ENV_FILE ?? ".env.camps.production";
const values = parse(await readFile(file));
const allowed = [
  "CAMP_STORAGE",
  "CAMP_DATABASE_URL",
  "CAMP_OPERATOR_ID",
  "CAMP_OPERATOR_PASSWORD",
  "CAMP_SESSION_SECRET",
  "CAMP_WORKER_TOKEN",
  "CAMP_SLACK_OPERATOR_IDS",
  "CAMP_PUBLIC_URL",
  "CAMP_PREVIEW_URL",
  "CAMP_PREVIEW_SECRET",
  "CAMP_ARTIFACT_STORAGE",
];
for (const name of allowed) {
  const value = values[name];
  if (!value && name !== "CAMP_SLACK_OPERATOR_IDS")
    throw new Error(`${name} is missing`);
  if (!value) continue;
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--force"],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(`Vercel environment update failed for ${name}`);
  console.log(`Configured ${name}`);
}
// Keep deployment configuration private even if the file was copied manually.
await chmod(file, 0o600);
