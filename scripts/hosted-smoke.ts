import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";

const origin = new URL(process.argv.find(arg => arg.startsWith("--url="))?.slice(6) ?? process.env.YAMNAYA_URL ?? "http://localhost:3100").origin;
const checks: { name: string; passed: boolean }[] = [];
function check(name: string, passed: boolean) {
  checks.push({ name, passed });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}
async function request(route: string, init: RequestInit = {}) {
  return fetch(`${origin}/api/${route}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(20000) });
}
try {
  const health = await request("health");
  check("Hosted API reaches PostgreSQL", health.ok && (await health.json()).ok === true);
  check("Anonymous state access denied", (await request("state")).status === 401);
  for (const role of ["security", "platform", "operations"]) {
    const response = await request("session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, password: process.env[`DEMO_${role.toUpperCase()}_PASSWORD`] }),
    });
    const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
    const identity = await request("session", { headers: { cookie } });
    check(`${role} password and signed session`, response.ok && !!cookie && (await identity.json()).actor?.role === role);
  }
  for (const [role, route] of [["defender", "state"], ["attacker", "red/observe"], ["worker", "worker/state"]]) {
    const response = await request(route, { headers: { Authorization: `Bearer ${process.env[`${role.toUpperCase()}_TOKEN`]}` } });
    check(`${role} service authentication`, response.ok);
  }
  check("Attacker cannot access defender state", (await request("state", {
    headers: { Authorization: `Bearer ${process.env.ATTACKER_TOKEN}` },
  })).status === 403);
} catch {
  check("Network/protocol check (raw response withheld)", false);
}
await mkdir("runtime/verification", { recursive: true });
await writeFile("runtime/verification/hosted.json", JSON.stringify({ time: new Date().toISOString(), origin, checks }, null, 2));
if (checks.some(c => !c.passed)) process.exitCode = 1;
