// Capture logs inside this process and emit only fixed diagnostic labels/booleans.
import { execFileSync } from "node:child_process";
for (const service of ["worker", "openclaw-agent", "attacker-agent"]) {
  try {
    const logs = execFileSync(
      "docker",
      ["compose", "logs", "--tail", "100", service],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
    );
    console.log(
      JSON.stringify({
        service,
        slackConnected:
          service === "worker"
            ? logs.includes("Slack Socket Mode connected.")
            : undefined,
        astraConfigured:
          service !== "worker"
            ? logs.includes("agent model: openai/gpt-6-astra")
            : undefined,
        authenticationFailure:
          /invalid_auth|not_authed|invalid_api_key|Incorrect API key|HTTP 401/.test(
            logs,
          ),
        rateLimit: /rate_limit|HTTP 429/.test(logs),
        modelFailure:
          /OpenClaw turn failed|tool execution failed|embedded run agent end.*error/.test(
            logs,
          ),
      }),
    );
  } catch {
    console.log(
      JSON.stringify({
        service,
        diagnostic: "unavailable; raw logs suppressed",
      }),
    );
    process.exitCode = 1;
  }
}
