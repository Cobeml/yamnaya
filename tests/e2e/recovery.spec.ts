import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
async function signIn(page: Page, role: string) {
  const password =
    role === "defender"
      ? process.env.DEFENDER_TOKEN
      : process.env[`DEMO_${role.toUpperCase()}_PASSWORD`];
  await page.request.post("/api/session", { data: { role, password } });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hold the mission. Move the defense." }),
  ).toBeVisible();
}
async function post(
  request: APIRequestContext,
  route: string,
  data: Record<string, unknown> = {},
) {
  const state = await (await request.get("/api/state")).json();
  const response = await request.post(`/api/${route}`, {
    headers: {
      "Idempotency-Key": randomUUID(),
      origin: new URL(process.env.YAMNAYA_URL ?? "http://127.0.0.1:3100")
        .origin,
    },
    data: { runId: state.id, ...data },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).result;
}
test("complete meter incident through browser containment, field acknowledgement, approvals, and actual worker recovery", async ({
  page,
}) => {
  await signIn(page, "security");
  await post(page.request, "runs/reset", {
    scenario: "contractor",
    mode: "simulation",
  });
  await page.reload();
  await page.getByRole("button", { name: "Inject incident" }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).affected.length,
    )
    .toBe(3);
  await page.getByRole("button", { name: "Access & identity" }).click();
  await page.getByRole("button", { name: "Revoke credential" }).first().click();
  await expect(
    page.getByText("Credential revoked; negative access probe passed."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Response room" }).click();
  await page.getByRole("button", { name: "Compare shutdown" }).click();
  await page
    .locator(".plan-card")
    .first()
    .getByRole("button", { name: "Rehearse", exact: true })
    .click();
  await expect(
    page
      .locator(".inline-warning")
      .filter({ hasText: "Pausing the only validated processing path" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Prepare containment" }).click();
  const containment = page
    .locator(".plan-card")
    .filter({ hasText: "Contain exposure and mobilize owners" });
  await containment
    .getByRole("button", { name: "Rehearse", exact: true })
    .click();
  await containment
    .getByRole("button", { name: "Execute", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).workOrders.filter(
          (w: { type: string }) => w.type === "field-verification",
        ).length,
    )
    .toBe(3);
  await signIn(page, "operations");
  await page
    .getByRole("button", { name: "Physical assets", exact: true })
    .click();
  const assigned = (
    await (await page.request.get("/api/state")).json()
  ).workOrders.filter((w: { type: string }) => w.type === "field-verification");
  for (const order of assigned) {
    await page
      .locator("tr")
      .filter({ hasText: order.id })
      .getByRole("button", { name: "Confirm installation" })
      .click();
    await expect(
      page
        .locator("tr")
        .filter({ hasText: order.id })
        .getByText("confirmed", { exact: true }),
    ).toBeVisible();
  }
  const plan = await post(page.request, "plans/suggest", { kind: "recovery" });
  await post(page.request, `plans/${plan.id}/rehearse`);
  for (const role of ["operations", "platform", "security"]) {
    await signIn(page, role);
    await post(page.request, `plans/${plan.id}/approve`, {
      version: plan.version,
      decision: "approved",
    });
  }
  await post(page.request, `plans/${plan.id}/execute`);
  await expect
    .poll(
      async () => (await (await page.request.get("/api/state")).json()).status,
      { timeout: 60000 },
    )
    .toBe("verified");
  const state = await (await page.request.get("/api/state")).json();
  expect(state.checks.every((c: { passed: boolean }) => c.passed)).toBe(true);
  expect(
    state.artifacts.find((a: { id: string }) => a.id === "repair-candidate")
      .validation,
  ).toBe("tested");
  await page.reload();
  await mkdir("runtime/screenshots", { recursive: true });
  await page.screenshot({
    path: "runtime/screenshots/verified-overview.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "runtime/screenshots/mobile-overview.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("agent boundaries, one-use browser ticket, and stale-run rejection", async ({
  page,
  playwright,
}) => {
  await signIn(page, "security");
  await post(page.request, "runs/reset", {
    scenario: "contractor",
    mode: "simulation",
  });
  const state = await (await page.request.get("/api/state")).json();
  const baseURL = process.env.YAMNAYA_URL ?? "http://127.0.0.1:3100";
  const red = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${process.env.ATTACKER_TOKEN}` },
  });
  expect((await red.get("/api/state")).status()).toBe(403);
  const redView = await (await red.get("/api/red/observe")).json();
  expect(redView).not.toHaveProperty("plans");
  expect(redView).not.toHaveProperty("physical");
  const defender = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${process.env.DEFENDER_TOKEN}`,
      "Idempotency-Key": randomUUID(),
    },
  });
  const ticketResponse = await defender.post("/api/browser/ticket", {
    data: { runId: state.id },
  });
  expect(ticketResponse.ok()).toBe(true);
  const ticket = (await ticketResponse.json()).result.url;
  await page.goto(ticket);
  expect(
    (await (await page.request.get("/api/session")).json()).actor.role,
  ).toBe("defender");
  expect((await page.request.get(ticket, { maxRedirects: 0 })).status()).toBe(
    403,
  );
  expect(
    (
      await defender.post("/api/access/revoke", {
        data: { runId: state.id, credentialId: "cred-contractor" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await defender.post("/api/actions", {
        data: { runId: "old-run", action: { kind: "verify" } },
      })
    ).status(),
  ).toBe(409);
  await red.dispose();
  await defender.dispose();
});
test("PostgreSQL serializes concurrent effects and rejects forged approvals", async ({
  page,
  playwright,
}) => {
  await signIn(page, "security");
  await post(page.request, "runs/reset", {
    scenario: "contractor",
    mode: "simulation",
  });
  const state = await (await page.request.get("/api/state")).json();
  const key = randomUUID(),
    origin = new URL(process.env.YAMNAYA_URL ?? "http://127.0.0.1:3100").origin;
  const send = (id: string, text: string) =>
    page.request.post("/api/messages", {
      headers: { origin, "Idempotency-Key": id },
      data: { runId: state.id, text },
    });
  const duplicate = await Promise.all(
    Array.from({ length: 6 }, () =>
      send(key, "One authenticated operational statement"),
    ),
  );
  expect(duplicate.every((r) => r.ok())).toBe(true);
  const distinct = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      send(randomUUID(), `Independent statement ${i}`),
    ),
  );
  expect(distinct.every((r) => r.ok())).toBe(true);
  const persisted = await (await page.request.get("/api/state")).json();
  expect(persisted.chat).toHaveLength(9);
  expect(
    persisted.events.filter(
      (e: { type: string }) => e.type === "message.received",
    ),
  ).toHaveLength(9);
  const plan = await post(page.request, "plans", {
    plan: {
      title: "Independent check",
      rationale:
        "Check the operational state before proposing any material effects.",
      evidenceIds: ["OBS-1"],
      steps: [{ kind: "verify" }],
      alternatives: [],
    },
  });
  await post(page.request, `plans/${plan.id}/rehearse`);
  const defender = await playwright.request.newContext({
    baseURL: process.env.YAMNAYA_URL ?? "http://127.0.0.1:3100",
    extraHTTPHeaders: {
      Authorization: `Bearer ${process.env.DEFENDER_TOKEN}`,
      "Idempotency-Key": randomUUID(),
      "x-role": "security",
    },
  });
  expect(
    (
      await defender.post(`/api/plans/${plan.id}/approve`, {
        data: { runId: state.id, version: 1, decision: "approved" },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (await (await page.request.get(`/api/plans/${plan.id}`)).json()).approvals,
  ).toEqual([]);
  await defender.dispose();
});
