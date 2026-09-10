// Record actual observation-only model tools, under a separate SMOKE capture ID.
import "dotenv/config";
import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ActivityFeed } from "./activity";
import { TerminalView } from "./terminal-view";
const exec = promisify(execFile);
async function main() {
  const response = await fetch("https://yamnaya.vercel.app/api/state", { headers: { Authorization: `Bearer ${process.env.DEFENDER_TOKEN}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error();
  const state = await response.json();
  if (state.mode !== "simulation" || !/^RUN-[A-Z0-9-]+$/.test(state.id)) throw new Error();
  const id = `SMOKE-${randomUUID().toUpperCase()}`;
  const directory = path.resolve("runtime/recordings/terminal-check", id);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const started = Date.now();
  const browser = await chromium.launch();
  const terminal = new TerminalView(directory, started);
  let results: boolean[] = [];
  const feed = new ActivityFeed(state.id, e => terminal.add(e, "simulation / capture check"), id);
  try {
    await terminal.open(browser);
    feed.report("capture.check", "Live observation-only smoke: no attack, approvals, notifications, or recovery actions.");
    let finished = false;
    const checks = Promise.all(["openclaw-agent", "attacker-agent"].map(async service => {
      try {
        const { stdout } = await exec("docker", ["compose", "exec", "-T", service, "node", "/opt/yamnaya/capture-smoke.mjs", id], { timeout: 195000, maxBuffer: 16000 });
        return JSON.parse(stdout.trim()).passed === true;
      } catch { return false; }
    })).then(value => { results = value; finished = true; });
    while (!finished) {
      await feed.poll(); await terminal.tick();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    await checks; await feed.poll();
    await new Promise(resolve => setTimeout(resolve, 1500));
  } finally { await terminal.close(); await browser.close(); }
  const summary = feed.summary();
  const passed = results.length === 2 && results.every(Boolean) && !terminal.failed && summary.gaps === 0 && summary.unmatched === 0 && summary.defenderTools && summary.attackerTools;
  const probe = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(directory, "terminal.webm")]);
  const duration = Number(probe.stdout.trim());
  await writeFile(path.join(directory, "verification.json"), JSON.stringify({ passed, ...summary, recordingId: id, runId: state.id, mode: "simulation", duration }, null, 2));
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ version: 1, origin: "https://yamnaya.vercel.app", startedAt: new Date(started).toISOString(), runId: state.id, mode: "simulation", video: "terminal.webm", duration, reason: "observation_only_capture_check", timing: "Live capture, wall clock; no incident recovery", samples: [], interruptions: passed ? [] : [{ offset: 0, kind: "capture_check_failed" }] }, null, 2));
  await writeFile(path.join(directory, "edit.json"), JSON.stringify({ runId: state.id, preview: true, segments: [{ title: "Actual Astra tools - observation-only capture check", start: 0, end: duration, seconds: Math.min(duration, 15) }] }, null, 2));
  console.log(JSON.stringify({ passed, directory, ...summary }));
  if (!passed) process.exitCode = 1;
}
main().catch(() => { console.error("Terminal camera check failed; raw responses withheld."); process.exitCode = 1; });
