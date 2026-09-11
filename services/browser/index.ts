import { createServer } from "node:http";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { publicFetch } from "../worker/public-network";
if (process.env.CAMP_BROWSER_ISOLATED !== "1")
  throw new Error("Run browser in its isolated container");
const browser = await chromium.launch({ headless: true });
const sessions = new Map<
  string,
  {
    context: BrowserContext;
    page: Page;
    hosts: string[];
    busy: boolean;
    used: number;
  }
>();
createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  let claimed = false;
  let session:
    | {
        context: BrowserContext;
        page: Page;
        hosts: string[];
        busy: boolean;
        used: number;
      }
    | undefined;
  try {
    if (req.method !== "POST" || req.url !== "/action")
      throw new Error("Unknown browser action");
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 40000) throw new Error("Request too large");
    }
    const input = JSON.parse(raw);
    if (
      !/^[\w-]+\/[\w-]+$/.test(input.identity) ||
      !Array.isArray(input.allowedHosts) ||
      input.allowedHosts.some((s: unknown) => typeof s !== "string")
    )
      throw new Error("Invalid browser identity or hosts");
    for (const [id, s] of sessions)
      if (!s.busy && Date.now() - s.used > 600000) {
        await s.context.close();
        sessions.delete(id);
      }
    session = sessions.get(input.identity)!;
    if (!session) {
      if (sessions.size >= 8) throw new Error("Browser capacity exhausted");
      const context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: "block",
        viewport: { width: 1280, height: 800 },
      });
      session = {
        context,
        page: await context.newPage(),
        hosts: [],
        busy: false,
        used: Date.now(),
      };
      const bound = session;
      await context.routeWebSocket("**/*", (route) => route.close());
      await context.route("**/*", async (route) => {
        try {
          if (route.request().method() !== "GET")
            throw new Error("Only read requests are enabled");
          const result = await publicFetch(
            route.request().url(),
            0,
            bound.hosts,
          );
          await route.fulfill({
            status: result.status,
            body: result.body,
            headers: {
              "content-type":
                result.headers["content-type"] ?? "application/octet-stream",
            },
          });
        } catch {
          await route.abort("blockedbyclient");
        }
      });
      context.on("page", page=>{void page.opener().then(opener=>{if(opener)void page.close();});});
      sessions.set(input.identity, session);
    }
    if (session.busy) throw new Error("Browser session occupied");
    session.busy = true;
    claimed = true;
    session.hosts = input.allowedHosts;
    session.used = Date.now();
    const args = input.arguments ?? {};
    if (input.capability === "browser.navigate") {await session.page.close();session.page=await session.context.newPage();}
    const page = session.page;
    const checkHost = (raw: string) => {
      const url = new URL(raw);
      if (
        !input.allowedHosts.includes("*") &&
        !input.allowedHosts.includes(url.hostname)
      )
        throw new Error("Page host is outside the current grant");
    };
    if (input.capability === "browser.navigate") {
      checkHost(String(args.url));
      await page.goto(String(args.url), {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
    } else {
      checkHost(page.url());
      if (args.hostname !== new URL(page.url()).hostname)
        throw new Error("Requested host does not match browser session");
      if (input.capability === "browser.click")
        await page
          .locator(String(args.selector))
          .first()
          .click({ timeout: 5000 });
      else if (input.capability === "browser.type")
        await page
          .locator(String(args.selector))
          .first()
          .fill(String(args.text ?? "").slice(0, 5000), { timeout: 5000 });
      else if (input.capability !== "browser.snapshot")
        throw new Error("Unsupported browser action");
    }
    checkHost(page.url());
    const snapshot = (
      await page.locator("body").ariaSnapshot({ timeout: 5000 })
    ).slice(0, 24000);
    res.end(
      JSON.stringify({
        url: page.url(),
        title: await page.title(),
        snapshot,
        readOnly: true,
      }),
    );
  } catch (error) {
    res.writeHead(422).end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Browser failed",
      }),
    );
  } finally {
    if (session && claimed) session.busy = false;
  }
}).listen(4113, "0.0.0.0");
