import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

// Load credentials internally. Never print values or pass them as CLI arguments.
const local: Record<string, string> = {};
config({ quiet: true, processEnv: local });
const link = JSON.parse(await readFile(".vercel/project.json", "utf8"));
if (link.projectName !== "yamnaya")
  throw new Error("Link the Yamnaya Vercel project before synchronizing credentials.");
const secretKeys = [
  "DATABASE_URL", "SESSION_SECRET", "DEMO_SECURITY_PASSWORD",
  "DEMO_PLATFORM_PASSWORD", "DEMO_OPERATIONS_PASSWORD",
  "DEFENDER_TOKEN", "ATTACKER_TOKEN", "WORKER_TOKEN",
];
const missing = secretKeys.filter(key => !local[key]);
if (missing.length) throw new Error(`Missing configuration: ${missing.join(", ")}`);
const urlArgument = process.argv.find(arg => arg.startsWith("--url="))?.slice(6);
if (!urlArgument) throw new Error("Supply --url=https://your-canonical-demo-origin");
const url = new URL(urlArgument);
if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
  throw new Error("The hosted URL must be a credential-free HTTPS origin.");
const values: Record<string, string> = {
  ...Object.fromEntries(secretKeys.map(key => [key, local[key]])),
  YAMNAYA_STORAGE: "postgres",
  YAMNAYA_PUBLIC_URL: url.origin,
  YAMNAYA_OPENAI_CONFIGURED: String(!!local.OPENAI_API_KEY),
  YAMNAYA_SLACK_CONFIGURED: String(!!(local.SLACK_APP_TOKEN && local.SLACK_BOT_TOKEN && local.SLACK_CHANNEL_ID)),
  YAMNAYA_GITHUB_CONFIGURED: String(!!(local.GITHUB_TOKEN && local.GITHUB_REPOSITORY)),
};
for (const key of ["SLACK_CHANNEL_ID", "SLACK_SECURITY_USER_ID", "SLACK_PLATFORM_USER_ID", "SLACK_OPERATIONS_USER_ID"])
  if (local[key]) values[key] = local[key];
for (const [key, value] of Object.entries(values)) {
  const args = ["env", "add", key, "production", "--force"];
  if (secretKeys.includes(key)) args.push("--sensitive");
  const result = spawnSync("vercel", args, {
    input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 60000,
  });
  if (result.status !== 0) {
    // CLI/provider errors are deliberately withheld because they can echo input.
    console.error(`Failed to configure ${key}; check Vercel login/project access (exit ${result.status ?? "timeout"}).`);
    process.exit(1);
  }
  console.log(`Configured ${key} for production.`);
}
console.log("Vercel configuration synchronized. Runtime API keys were not uploaded. Redeploy to apply.");
