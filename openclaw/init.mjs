import { mkdir, writeFile, readFile } from "node:fs/promises";
const state = "/home/node/.openclaw",
  workspace = "/home/node/workspace";
const role = process.env.YAMNAYA_AGENT_ROLE ?? "defender";
await mkdir(state, { recursive: true });
await mkdir(workspace, { recursive: true });
const tools =
  role === "attacker"
    ? ["yamnaya_red_observe", "yamnaya_red_action"]
    : [
        "browser",
        "yamnaya_observe",
        "yamnaya_standing_action",
        "yamnaya_plan",
        "yamnaya_admin_browser",
      ];
const config = {
  // OpenClaw rejects a config rewritten without metadata when a last-good backup exists.
  meta: { lastTouchedVersion: "2026.9.3", lastTouchedAt: new Date().toISOString() },
  gateway: {
    mode: "local",
    bind: "lan",
    port: 18789,
    auth: { mode: "token", token: process.env.OPENCLAW_GATEWAY_TOKEN },
    controlUi: {
      allowedOrigins: ["http://localhost:18789", "http://127.0.0.1:18789"],
    },
    http: { endpoints: { chatCompletions: { enabled: true } } },
  },
  agents: {
    defaults: {
      workspace,
      heartbeat: { every: "0m" },
      model: { primary: "openai/gpt-6-astra" },
      thinkingDefault: role === "attacker" ? "low" : "medium",
      models: { "openai/gpt-6-astra": { agentRuntime: { id: "openclaw" } } },
    },
  },
  cron: { enabled: false },
  plugins: {
    slots: { memory: "none" },
    load: { paths: ["/opt/yamnaya/plugin"] },
    entries: { yamnaya: { enabled: true } },
    allow: ["yamnaya", "browser", "openai"],
  },
  tools: {
    profile: "full",
    allow: tools,
    deny: [
      "exec",
      "read",
      "write",
      "edit",
      "apply_patch",
      "web_fetch",
      "web_search",
      "sessions_spawn",
    ],
  },
  browser: {
    enabled: role !== "attacker",
    evaluateEnabled: false,
    headless: true,
    noSandbox: true,
    defaultProfile: "openclaw",
    ssrfPolicy: {
      allowedHostnames: [new URL(process.env.YAMNAYA_URL).hostname],
    },
  },
};
if (process.env.OPENAI_API_KEY)
  config.models = {
    providers: {
      openai: {
        baseUrl: "https://api.openai.com/v1",
        api: "openai-responses",
        apiKey: "${OPENAI_API_KEY}",
        models: [
          {
            id: "gpt-6-astra",
            name: "GPT-6 Astra",
            reasoning: true,
            input: ["text", "image"],
            contextWindow: 1050000,
            maxTokens: 128000,
          },
        ],
      },
    },
  };
await writeFile(`${state}/openclaw.json`, JSON.stringify(config, null, 2), {
  mode: 0o600,
});
await writeFile(
  `${workspace}/AGENTS.md`,
  await readFile(`/opt/yamnaya/${role}.md`, "utf8"),
);
console.log(
  `Configured ${role}: Astra ${process.env.OPENAI_API_KEY ? "key present; access unverified" : "not configured"}.`,
);
