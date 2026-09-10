import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("simple containment uses authenticated Slack role replies and the real executor", async ({ page }) => {
  test.skip(process.env.YAMNAYA_SLACK_TEST_FIXTURE !== "1", "Requires disposable setup --slack-fixture; never use real Slack users for this test");
  const origin = new URL(process.env.YAMNAYA_URL ?? "http://127.0.0.1:3100").origin;
  const post = (request: APIRequestContext, route: string, runId: string, data: Record<string, unknown> = {}, token?: string, key = randomUUID()) => request.post(`/api/${route}`, {
    headers: { origin, "Idempotency-Key": key, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, data: { runId, ...data },
  });
  expect((await page.request.post("/api/session", { data: { role: "security", password: process.env.DEMO_SECURITY_PASSWORD } })).ok()).toBe(true);
  const prior = await (await page.request.get("/api/state")).json();
  expect((await post(page.request, "runs/reset", prior.id, { scenario: "credential-leak", mode: "simulation" })).ok()).toBe(true);
  const state = () => page.request.get("/api/state").then(r => r.json());
  const runId = (await state()).id;
  expect((await post(page.request, "runs/attack", runId, { action: { kind: "use_leaked_access", credentialId: "cred-integration", sdpId: "SDP-001" } })).ok()).toBe(true);
  await expect.poll(async () => (await state()).metrics.healthyProcessed).toBeGreaterThan(0);
  const planResponse = await post(page.request, "plans/suggest", runId, { kind: "containment" });
  expect(planResponse.ok()).toBe(true);
  const plan = (await planResponse.json()).result;
  expect((await post(page.request, `plans/${plan.id}/rehearse`, runId)).ok()).toBe(true);
  expect((await post(page.request, `plans/${plan.id}/execute`, runId)).ok()).toBe(false);
  const worker = process.env.WORKER_TOKEN;
  expect((await post(page.request, "worker/thread", runId, { threadTs: "ci-thread" }, worker)).ok()).toBe(true);
  const reply = { channelId: "ci-channel", threadTs: "ci-thread", userId: "ci-security", text: `approve ${plan.id} v1` };
  expect((await post(page.request, "worker/slack", runId, { ...reply, userId: "unknown" }, worker)).status()).toBe(403);
  expect((await post(page.request, "worker/slack", runId, { ...reply, channelId: "another-channel" }, worker)).status()).toBe(403);
  expect((await post(page.request, "worker/slack", runId, { ...reply, threadTs: "old-thread" }, worker)).ok()).toBe(false);
  expect((await post(page.request, "worker/slack", runId, reply, process.env.DEFENDER_TOKEN)).status()).toBe(403);
  expect((await post(page.request, "worker/slack", runId, { ...reply, text: "I think this plan looks good" }, worker)).ok()).toBe(true);
  expect((await state()).plans[0].approvals).toHaveLength(0);
  expect((await post(page.request, "worker/slack", runId, { ...reply, text: `approve ${plan.id} v2` }, worker)).ok()).toBe(false);
  const key = randomUUID();
  expect((await post(page.request, "worker/slack", runId, reply, worker, key)).ok()).toBe(true);
  expect((await post(page.request, "worker/slack", runId, reply, worker, key)).ok()).toBe(true);
  expect((await state()).plans[0].approvals).toHaveLength(1);
  for (const userId of ["ci-platform", "ci-operations"])
    expect((await post(page.request, "worker/slack", runId, { ...reply, userId, text: `\`approve ${plan.id} v1\`` }, worker)).ok()).toBe(true);
  expect((await post(page.request, `plans/${plan.id}/execute`, runId, {}, process.env.DEFENDER_TOKEN)).ok()).toBe(true);
  await expect.poll(async () => (await state()).status, { timeout: 30000 }).toBe("verified");
  const final = await state();
  expect(final.checks.every((c: { passed: boolean }) => c.passed)).toBe(true);
  expect(final.plans[0].approvals.every((a: { channel: string }) => a.channel === "slack")).toBe(true);
  expect(final.workOrders[0].status).toBe("held");
  expect(final.quarantinedSdps).toEqual(["SDP-001"]);
  expect(final.credentials.find((c: { id: string }) => c.id === "cred-operator").status).toBe("active");
  expect((await post(page.request, "worker/slack", runId, reply, worker)).ok()).toBe(false);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/present");
  await expect(page.getByTestId("mission-status")).toContainText("CONTAINMENT VERIFIED");
  await expect(page.getByText("1 affected work orders held", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: "runtime/screenshots/containment-verified.png" });
});
