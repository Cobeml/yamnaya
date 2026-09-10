import type { Browser, BrowserContext, Page } from "@playwright/test";
import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatActivity, type Activity } from "./activity";

export const terminalHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#090e12;color:#d9e4ea;font-family:monospace;padding:52px 58px;height:1080px;overflow:hidden}header{border-bottom:1px solid #35444f;padding-bottom:22px;display:flex;justify-content:space-between;font-size:25px;color:#87efb5}h1{font-size:30px;margin:0 0 10px;color:white}#meta{font-size:20px;color:#94a5b1}pre{font:23px/30px monospace;white-space:pre-wrap;height:780px;overflow:hidden;margin:24px 0}footer{position:absolute;bottom:48px;color:#94a5b1;font-size:20px}#status{color:#f2ce81}
</style></head><body><header><div><h1>YAMNAYA / Agent decisions &amp; tool activity</h1><div id="meta">Armed · waiting for a fresh live run</div></div><div id="status">READ-ONLY MONITOR</div></header><pre id="output">The terminal will show actual tool requests and results.\nAgent explanations are published statements, not private reasoning.\nA tool returning successfully does not establish mission recovery.</pre><footer>SYNTHETIC UTILITY · OpenClaw / GPT-6 Astra · UTC wall clock · Terminal output mirrored live</footer></body></html>`;

export class TerminalView {
  private context!: BrowserContext;
  private page!: Page;
  private lines: string[] = [];
  private pending = Promise.resolve();
  private label = "Armed · waiting for a fresh live run";
  failed = false;
  startedOffset = 0;
  constructor(private directory: string, private started: number) {}
  async open(browser: Browser) {
    this.context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: this.directory, size: { width: 1920, height: 1080 } } });
    await this.context.route("**/*", route => route.abort());
    this.startedOffset = (Date.now() - this.started) / 1000;
    this.page = await this.context.newPage();
    await this.page.setContent(terminalHtml);
    await writeFile(path.join(this.directory, "terminal.log"), "YAMNAYA / read-only live activity monitor\n", { mode: 0o600 });
    await writeFile(path.join(this.directory, "activity.jsonl"), "", { mode: 0o600 });
  }
  add(event: Activity, mode: string) {
    this.label = `${event.runId} · ${mode.toUpperCase()}`;
    const observedAt = new Date().toISOString();
    const offset = (Date.now() - this.started) / 1000;
    const text = formatActivity(event);
    process.stdout.write(text + "\n");
    this.pending = this.pending.then(async () => {
      await appendFile(path.join(this.directory, "activity.jsonl"), JSON.stringify({ ...event, observedAt, offset }) + "\n");
      await appendFile(path.join(this.directory, "terminal.log"), text + "\n");
      this.lines.push(...text.split("\n"));
      this.lines = this.lines.slice(-25);
      await this.page.evaluate(({ text, meta, warning }) => {
        document.getElementById("output")!.textContent = text;
        document.getElementById("meta")!.textContent = meta;
        if (warning) document.getElementById("status")!.textContent = "CAPTURE GAP RECORDED";
      }, { text: this.lines.join("\n"), meta: `${this.label} · ${observedAt}`, warning: event.kind === "capture.gap" });
    }).catch(() => { this.failed = true; });
  }
  async tick() {
    try {
      await this.page.evaluate(meta => { document.getElementById("meta")!.textContent = meta; }, `${this.label} · ${new Date().toISOString()}`);
    } catch { this.failed = true; }
  }
  async close() {
    await this.pending;
    const video = this.page.video()!;
    await this.page.screenshot({ path: path.join(this.directory, "terminal.png") });
    await this.context.close();
    await video.saveAs(path.join(this.directory, "terminal.webm"));
  }
}
