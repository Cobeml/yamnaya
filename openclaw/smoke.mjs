// Run inside the defender container. Exercises real OpenClaw tools without a model call.
import assert from "node:assert/strict";
async function invoke(tool, args) {
  const response = await fetch("http://127.0.0.1:18789/tools/invoke", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENCLAW_GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool, args }),
    signal: AbortSignal.timeout(45000),
  });
  const body = await response.json();
  assert(
    response.ok && body.ok && !body.result?.isError,
    `${tool} failed (${response.status})`,
  );
  const text = body.result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  if (body.result.details) return { ...body.result.details, text };
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}
// Browser startup can need one retry after a container restart to clear stale locks.
try { await invoke("browser", { action: "start" }); }
catch { await invoke("browser", { action: "start" }); }
const state = await invoke("yamnaya_observe", { resource: "state" });
assert(
  state.id && !state.physical,
  "Observation view must omit evaluator ground truth",
);
const ticket = await invoke("yamnaya_admin_browser", { run_id: state.id });
assert(ticket.result?.url, "Browser ticket must be available");
const tab = await invoke("browser", {
  action: "open",
  targetUrl: ticket.result.url,
});
assert(tab.targetId, "Browser must open an authenticated tab");
let authenticated = false;
for (let attempt = 0; attempt < 10; attempt++) {
  const snapshot = await invoke("browser", {
    action: "snapshot",
    targetId: tab.targetId,
  });
  const content = JSON.stringify(snapshot);
  if (
    content.includes("Hold the mission.") &&
    content.includes("Access & identity")
  ) {
    authenticated = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
assert(authenticated, "Authenticated utility dashboard must be visible");
await invoke("browser", { action: "close", targetId: tab.targetId });
console.log(
  "PASS: OpenClaw plugin observation, one-use browser sign-in, Chromium navigation, and dashboard snapshot. No model request made.",
);
