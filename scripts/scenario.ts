import "dotenv/config";
import { randomUUID } from "node:crypto";
const base = process.env.YAMNAYA_URL ?? "http://localhost:3100";
const scenario =
  process.argv.find((a) => a.startsWith("--scenario="))?.split("=")[1] ??
  "contractor";
const login = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    role: "security",
    password: process.env.DEMO_SECURITY_PASSWORD,
  }),
});
if (!login.ok)
  throw new Error(
    "Commander sign-in failed; run setup and verify the app environment.",
  );
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
async function read() {
  const r = await fetch(`${base}/api/state`, { headers: { cookie } });
  if (!r.ok) throw new Error("Could not read the run");
  return r.json();
}
async function post(route: string, body: Record<string, unknown>) {
  const state = await read();
  const r = await fetch(`${base}/api/${route}`, {
    method: "POST",
    headers: {
      cookie,
      origin: new URL(base).origin,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ runId: state.id, ...body }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}
await post("runs/reset", { scenario, mode: "simulation" });
await post("runs/attack", {
  action: {
    kind: "deploy_mapping",
    credentialId: "cred-contractor",
    variant: "wrong-sdp",
  },
});
for (let i = 0; i < 5; i++) await post("runs/tick", {});
console.log(
  `Prepared ${scenario} in simulation mode. Open ${base} to investigate and recover.`,
);
