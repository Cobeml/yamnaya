import { test, expect } from "@playwright/test";
test("two cultural camps share bounded correspondence and review exact publication outreach", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  await page
    .getByLabel("Operator password", { exact: true })
    .fill(process.env.CAMP_OPERATOR_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create camp", exact: true }),
  ).toBeVisible();
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post("/api/camps/" + path, {
      headers: { Origin: baseURL! },
      data,
    });
    expect(r.ok(), await r.text()).toBeTruthy();
    const v = await r.json();
    return v.result ?? v;
  };
  const ids: string[] = [];
  try {
    const a = await post("", {
      name: "Cultural test America " + Date.now(),
      focus: "america",
      mode: "simulation",
    });
    ids.push(a.id);
    const b = await post("", {
      name: "Cultural test China " + Date.now(),
      focus: "china",
      mode: "simulation",
    });
    ids.push(b.id);
    expect(a.agents.map((a: { id: string }) => a.id)).toEqual([
      "finder",
      "referencer",
      "writer",
      "marketer",
    ]);
    expect(
      a.cultural.examples.filter((e: { reviewed: boolean }) => e.reviewed),
    ).toHaveLength(0);
    const privateThread = await post(a.id + "/board", {
      title: "Private research note",
      text: "An unfinished argument stays within this camp.",
      visibility: "camp",
    });
    const sharedThread = await post(a.id + "/board", {
      title: "Comparative reading",
      text: "A public text can be compared without assuming direct transmission.",
      visibility: "shared",
    });
    const read = await page.request.get("/api/camps/" + b.id + "/board");
    const board = await read.json();
    expect(
      board.threads.some((t: { id: string }) => t.id === privateThread.id),
    ).toBe(false);
    expect(
      board.threads.some((t: { id: string }) => t.id === sharedThread.id),
    ).toBe(true);
    await post(b.id + "/board", {
      threadId: sharedThread.id,
      text: "We should retain a rival explanation for the resemblance.",
    });
    const p = await post(a.id + "/publications", {
      title: "Cultural evidence workshop",
      repository: "example/cultural-fixture",
    });
    await post(a.id + "/status", { status: "running" });
    const job = await post(a.id + "/tools", {
      capability: "publication.render",
      arguments: { publicationId: p.id },
    });
    await expect
      .poll(
        async () => {
          const r = await page.request.get(
            "/api/camps/" + a.id + "/jobs/" + job.id,
          );
          return (await r.json()).status;
        },
        { timeout: 90000 },
      )
      .toBe("done");
    await post(a.id + "/publications/approve", {
      id: p.id,
      version: p.version,
    });
    const outbound = await post(a.id + "/cultural/outbound", {
      publicationId: p.id,
      channel: "forum",
      destination: "https://sofiechan.com/",
      subject: "Fixture contribution",
      text: "This is a local test draft and will never be posted externally.",
    });
    await post(a.id + "/cultural/approve", { id: outbound.id });
    await post(a.id + "/publications/edit", {
      id: p.id,
      version: p.version,
      files: {
        "index.qmd":
          "---\ntitle: Revised evidence\n---\n\nA changed argument requires a new review.\n",
      },
    });
    const stale = await page.request.post(
      "/api/camps/" + a.id + "/cultural/forum-receipt",
      {
        headers: { Origin: baseURL! },
        data: { id: outbound.id, url: "https://sofiechan.com/fixture" },
      },
    );
    expect(stale.ok()).toBe(false);
    await page.reload();
    await page
      .getByRole("button", { name: new RegExp("Cultural test America") })
      .click();
    await page
      .getByRole("button", { name: "Research", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "American research workshop" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Boards", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Comparative reading" }),
    ).toBeVisible();
    await page.screenshot({
      path: "runtime/screenshots/cultural-workspace.png",
      fullPage: true,
    });
  } finally {
    for (const id of ids) await post(id + "/status", { status: "archived" });
  }
});
