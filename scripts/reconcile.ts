import "dotenv/config";
import { randomUUID } from "node:crypto";
const planId = process.argv.find((a) => a.startsWith("--plan="))?.slice(7);
const note = process.argv.find((a) => a.startsWith("--note="))?.slice(7);
if (!planId || !note || note.length < 20)
  throw new Error(
    'Usage: pnpm reconcile --plan=PLAN-3 --note="Evidence checked and why the pending effect can be retried"',
  );
const base = process.env.YAMNAYA_URL ?? "http://localhost:3100";
const login = await fetch(`${base}/api/session`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    role: "security",
    password: process.env.DEMO_SECURITY_PASSWORD,
  }),
});
if (!login.ok) throw new Error("Commander sign-in failed");
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const state = await (
  await fetch(`${base}/api/state`, { headers: { cookie } })
).json();
const response = await fetch(
  `${base}/api/plans/${encodeURIComponent(planId)}/reconcile`,
  {
    method: "POST",
    headers: {
      cookie,
      origin: new URL(base).origin,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({ runId: state.id, note }),
  },
);
const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(
  `${planId} requeued at its persisted step after commander reconciliation.`,
);
