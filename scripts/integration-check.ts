// Credentials are loaded by dotenv for requests; only allowlisted diagnostic fields are emitted.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

const checks: { name: string; passed: boolean; detail: string }[] = [];
function record(name: string, passed: boolean, detail: string) {
  checks.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}
const errorCode = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9_ -]{1,100}$/i.test(value)
    ? value
    : "request_failed";
async function slack(method: string, token: string | undefined, body = {}) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    data: (await response.json()) as Record<string, unknown>,
  };
}
async function guarded(name: string, run: () => Promise<void>) {
  try {
    await run();
  } catch {
    record(name, false, "network_or_protocol_error (raw error suppressed)");
  }
}
await guarded("Slack bot authentication", async () => {
  const { status, data } = await slack(
    "auth.test",
    process.env.SLACK_BOT_TOKEN,
  );
  record(
    "Slack bot authentication",
    data.ok === true,
    data.ok ? `HTTP ${status}` : errorCode(data.error),
  );
});
await guarded("Slack app Socket Mode authorization", async () => {
  const { status, data } = await slack(
    "apps.connections.open",
    process.env.SLACK_APP_TOKEN,
  );
  record(
    "Slack app Socket Mode authorization",
    data.ok === true && typeof data.url === "string",
    data.ok ? `HTTP ${status}; connection URL withheld` : errorCode(data.error),
  );
});
const personas = ["SECURITY", "PLATFORM", "OPERATIONS"].map(
  (r) => process.env[`SLACK_${r}_USER_ID`] ?? "",
);
record(
  "Slack persona mapping",
  personas.every((id) => /^[UW][A-Z0-9]{8,}$/.test(id)) &&
    new Set(personas).size === 3,
  "three distinct Slack user IDs required; values withheld",
);
await guarded("GitHub repository access", async () => {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    record("GitHub repository access", false, "invalid_repository_setting");
    return;
  }
  const response = await fetch(`https://api.github.com/repos/${repository}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ""}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = (await response.json()) as { permissions?: { push?: boolean } };
  record(
    "GitHub repository access",
    response.ok,
    `HTTP ${response.status}; push permission ${data.permissions?.push === true ? "present" : "not established"}`,
  );
});
await guarded("Configured PostgreSQL connection", async () => {
  if (!process.env.DATABASE_URL) {
    record("Configured PostgreSQL connection", false, "missing_database_url");
    return;
  }
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    connect_timeout: 8,
    onnotice: () => undefined,
  });
  try {
    const rows = await client`select 1 as healthy`;
    record(
      "Configured PostgreSQL connection",
      rows[0]?.healthy === 1,
      "SELECT 1 succeeded; connection URI withheld",
    );
  } finally {
    await client.end({ timeout: 3 });
  }
});
if (process.env.VERCEL_TOKEN) {
  await guarded("Vercel account authentication", async () => {
    const response = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(15000),
    });
    record(
      "Vercel account authentication",
      response.ok,
      `HTTP ${response.status}; account details withheld`,
    );
  });
}
if (
  process.argv.includes("--slack-message") &&
  checks.filter((c) => c.name.startsWith("Slack")).every((c) => c.passed)
) {
  await guarded("Slack test message delivery", async () => {
    const { data } = await slack(
      "chat.postMessage",
      process.env.SLACK_BOT_TOKEN,
      {
        channel: process.env.SLACK_CHANNEL_ID,
        text: `Yamnaya integration smoke test ${randomUUID().slice(0, 8)}: credential and channel delivery check. No incident action or human approval is requested.`,
        unfurl_links: false,
        unfurl_media: false,
      },
    );
    record(
      "Slack test message delivery",
      data.ok === true && typeof data.ts === "string",
      data.ok ? "confirmed by Slack timestamp" : errorCode(data.error),
    );
  });
}
await mkdir("runtime/verification", { recursive: true });
await writeFile(
  "runtime/verification/integrations.json",
  JSON.stringify({ time: new Date().toISOString(), checks }, null, 2),
);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
