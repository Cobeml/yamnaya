import { test, expect } from "@playwright/test";

test("presentation requires authentication and observes without incident mutations", async ({ page }) => {
  await page.goto("/present");
  await expect(page.getByTestId("presentation").getByRole("alert")).toContainText("Sign in");
  await expect(page.getByText("BULK AMI READS", { exact: true })).toHaveCount(0);
  const login = await page.request.post("/api/session", { data: { role: "defender", password: process.env.DEFENDER_TOKEN } });
  expect(login.ok()).toBe(true);
  const writes: string[] = [];
  page.on("request", r => { if (!["GET", "HEAD"].includes(r.method())) writes.push(new URL(r.url()).pathname); });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/present");
  await expect(page.getByTestId("ami-count")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Physical assets", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: "runtime/screenshots/presentation.png" });
  await page.route("**/api/state", route => route.abort());
  await expect(page.getByTestId("presentation").getByRole("alert")).toContainText("stale");
  await expect(page.getByTestId("mission-status")).toContainText("CONNECTION PAUSED");
  expect(writes).toEqual([]);
});

test("a run-bound presentation never switches to another incident", async ({ page }) => {
  await page.request.post("/api/session", { data: { role: "defender", password: process.env.DEFENDER_TOKEN } });
  await page.goto("/present?run=RUN-NOT-ACTIVE");
  await expect(page.getByTestId("presentation").getByRole("alert")).toContainText("active run changed");
  await expect(page.getByTestId("ami-count")).toHaveCount(0);
});
