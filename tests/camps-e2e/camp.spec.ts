import { test, expect } from "@playwright/test";
let campName = "";
test.afterEach(async ({ page, baseURL }) => {
  if (!campName) return;
  const response = await page.request.get("/api/camps");
  if (!response.ok()) return;
  const { camps } = await response.json();
  const camp = camps.find((c: { name: string }) => c.name === campName);
  if (camp) {
    const result = await page.request.post(`/api/camps/${camp.id}/status`, {
      headers: { Origin: baseURL!, "Idempotency-Key": `archive-${camp.id}` },
      data: { status: "archived" },
    });
    expect(result.ok()).toBeTruthy();
  }
});
test("operator builds a camp, scopes authority and edits a Quarto publication", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByLabel("Operator password", { exact: true })
    .fill(process.env.CAMP_OPERATOR_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create camp", exact: true }).click();
  campName = "Fieldnotes " + Date.now();
  await page.getByLabel("Camp name", { exact: true }).fill(campName);
  await page.locator('select[name="domain"]').selectOption("general");
  await page.locator('select[name="mode"]').selectOption("simulation");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create camp" })
    .click();
  await expect(
    page.getByRole("heading", { name: "The black cube" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page
    .getByText("Bind a Discord channel or thread", { exact: true })
    .click();
  await page
    .getByLabel("Server ID", { exact: true })
    .fill("123456789012345678");
  await page
    .getByLabel("Channel or thread ID", { exact: true })
    .fill("234567890123456789");
  await page.getByRole("button", { name: "Bind Discord", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Disconnect Discord", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Disconnect Discord", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Disconnect Discord", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Start camp", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause camp", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("form", { name: "Create mission" })
    .getByRole("textbox")
    .fill("Develop an evidence-linked report about public infrastructure.");
  await page.getByRole("button", { name: "Set mission", exact: true }).click();
  await expect(page.locator(".camp-mission-bar")).toContainText(
    "public infrastructure",
  );
  await page.getByRole("button", { name: "Sites", exact: true }).click();
  await page.getByLabel("Publication title").fill("Infrastructure fieldnotes");
  await page
    .getByLabel("Existing GitHub repository")
    .fill("example/fieldnotes");
  await page
    .getByRole("button", { name: "Create publication", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Infrastructure fieldnotes" }),
  ).toBeVisible();
  await page
    .getByLabel("Quarto source")
    .fill(
      "---\ntitle: Infrastructure fieldnotes\n---\n\nA concise initial report.\n\n```{python}\nprint('Verified calculation:', 6 * 7)\n```\n",
    );
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(page.locator(".camp-tag")).toContainText("v2");
  await expect(
    page.getByRole("button", { name: "Publish to GitHub Pages" }),
  ).toBeDisabled();
  await page.getByText("Google image studio", { exact: true }).click();
  await page
    .getByLabel("Image brief", { exact: true })
    .fill("Create a simple geometric illustration for the camp report.");
  await page
    .getByLabel("Image caption", { exact: true })
    .fill("Camp illustration");
  await page
    .getByRole("button", { name: "Prepare Google image brief" })
    .click();
  await expect(
    page.getByText("Awaiting your Google generation", { exact: true }),
  ).toBeVisible();
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#d5bd80";
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Import image: Camp illustration", { exact: true })
    .setInputFiles({
      name: "fixture.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture, "base64"),
    });
  await expect(
    page.getByText("Imported into Quarto", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Render site", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open rendered preview" }),
  ).toBeVisible({ timeout: 180000 });
  const previewUrl = await page
    .getByRole("link", { name: "Open rendered preview" })
    .getAttribute("href");
  const preview = await page.context().newPage();
  await preview.goto(previewUrl!);
  await expect(
    preview.getByRole("heading", {
      name: "Infrastructure fieldnotes",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    preview.getByText("Verified calculation: 42", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("figure", { name: "Camp illustration" }).getByRole("img"),
  ).toBeVisible();
  await expect(
    preview.getByRole("figure", { name: "Camp illustration" }).getByRole("img"),
  ).toHaveJSProperty("naturalWidth", 32);
  await preview.screenshot({
    path: "runtime/screenshots/quarto-preview.png",
    fullPage: true,
  });
  await preview.close();
  await page
    .getByRole("button", { name: "Approve this build", exact: true })
    .click();
  await page
    .getByLabel("Quarto source")
    .fill(
      "---\ntitle: Infrastructure fieldnotes\n---\n\nAn updated conclusion.\n",
    );
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(page.locator(".camp-tag")).toContainText("v4");
  await expect(
    page.getByRole("button", { name: "Publish to GitHub Pages" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page
    .locator('select[name="capability"]')
    .selectOption("research.fetch");
  await page.getByLabel("Scope:", { exact: false }).fill("example.org");
  await page.getByRole("button", { name: "Grant through cube" }).click();
  await expect(
    page.locator(".camp-card").filter({ hasText: "research.fetch" }),
  ).toContainText("example.org");
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page.getByRole("button", { name: "Square 1", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Square 1", exact: true }),
  ).toHaveText("X");
  await page.getByRole("button", { name: "Cube", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: "runtime/screenshots/camps-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "runtime/screenshots/camps-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
