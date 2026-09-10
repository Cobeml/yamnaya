import "dotenv/config";
const required = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "DEFENDER_TOKEN",
  "ATTACKER_TOKEN",
  "WORKER_TOKEN",
];
const live = [
  "OPENAI_API_KEY",
  "GITHUB_TOKEN",
  "GITHUB_REPOSITORY",
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "SLACK_CHANNEL_ID",
  "SLACK_SECURITY_USER_ID",
  "SLACK_PLATFORM_USER_ID",
  "SLACK_OPERATIONS_USER_ID",
];
for (const key of [...required, ...live])
  console.log(`${process.env[key] ? "READY  " : "MISSING"} ${key}`);
for (const [name, url] of [
  [
    "Utility API",
    `${process.env.YAMNAYA_URL ?? "http://localhost:3100"}/api/health`,
  ],
  ["OpenClaw gateway", "http://127.0.0.1:18789/healthz"],
]) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    console.log(`${r.ok ? "HEALTHY" : "FAILED "} ${name} (${r.status})`);
  } catch {
    console.log(`OFFLINE ${name}`);
  }
}
if (process.argv.includes("--check-model") && process.env.OPENAI_API_KEY) {
  const response = await fetch("https://api.openai.com/v1/models/gpt-6-astra", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  console.log(
    `${response.ok ? "READY" : "FAILED"} Astra account catalog access (${response.status}); tool execution still needs a live smoke test.`,
  );
}
if (
  required.some((key) => !process.env[key]) ||
  (process.argv.includes("--live") && live.some((key) => !process.env[key]))
)
  process.exitCode = 1;
