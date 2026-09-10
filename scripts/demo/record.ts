import "dotenv/config";
import { chromium, request } from "@playwright/test";
import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { sample, suggestedEdit, evidenceGates, type Manifest } from "./evidence";
import type { PresentationState } from "../../apps/web/lib/presentation";
import { ActivityFeed } from "./activity";
import { TerminalView } from "./terminal-view";

const arg = (name: string) => process.argv.find(s => s.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  let origin: string;
  try {
    const url = new URL(arg("url") ?? process.env.YAMNAYA_URL ?? "https://yamnaya.vercel.app");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error();
    origin = url.origin;
  } catch { throw new Error("Use a credential-free HTTPS origin or localhost URL."); }
  const max = Number(arg("max-seconds") ?? 1200);
  if (!Number.isFinite(max) || max < 5 || max > 3600) throw new Error("max-seconds must be 5–3600.");
  if (!process.env.DEFENDER_TOKEN) throw new Error("DEFENDER_TOKEN is required (value withheld).");
  const allowSimulation = process.argv.includes("--allow-simulation");
  const current = process.argv.includes("--current");
  const api = await request.newContext({ baseURL: origin });
  const auth = await api.post("/api/session", { data: { role: "defender", password: process.env.DEFENDER_TOKEN }, maxRedirects: 0 });
  if (!auth.ok()) { await api.dispose(); throw new Error("Recorder sign-in failed; check deployment origin and service credentials."); }
  const initialResponse = await api.get("/api/state", { maxRedirects: 0 });
  if (!initialResponse.ok()) { await api.dispose(); throw new Error("Recorder cannot read state."); }
  const initial: PresentationState = await initialResponse.json();
  const storageState = await api.storageState();
  await api.dispose();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const root = path.resolve("runtime/recordings");
  const working = path.join(root, `take-${stamp}`);
  await mkdir(working, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState, viewport: { width: 1920, height: 1080 }, recordVideo: { dir: working, size: { width: 1920, height: 1080 } } });
  // Authentication is complete. The camera cannot click through a mutation endpoint.
  await context.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== origin || !["GET", "HEAD"].includes(req.method()) ||
      (url.pathname.startsWith("/api/") && !["/api/state", "/api/session"].includes(url.pathname))) return route.abort();
    await route.continue();
  });
  const started = Date.now();
  const manifest: Manifest = { version: 1, origin, startedAt: new Date(started).toISOString(), video: "raw.webm", reason: "recording", timing: "Offsets are wall-clock seconds from browser page creation; state observations may lag by one polling interval. Simulation timestamps are separate.", samples: [], interruptions: [] };
  let stop = false, verifiedAt = 0;
  const interrupt = () => { stop = true; manifest.reason = "operator_stopped_recording"; };
  process.on("SIGINT", interrupt); process.on("SIGTERM", interrupt);
  const dashboardOffset = (Date.now() - started) / 1000;
  const page = await context.newPage();
  const video = page.video()!;
  manifest.tracks = { dashboard: { video: "raw.webm", startedOffset: dashboardOffset } };
  const terminal = process.argv.includes("--with-terminal") ? new TerminalView(working, started) : undefined;
  let activity: ActivityFeed | undefined;
  let pending = Promise.resolve();
  const persist = () => writeFile(path.join(working, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  const failure = (kind: string) => { manifest.interruptions.push({ offset: (Date.now() - started) / 1000, kind }); };
  page.on("response", response => {
    if (new URL(response.url()).pathname !== "/api/state") return;
    pending = pending.then(async () => {
      if (stop) return;
      if (!response.ok()) { failure(`state_http_${response.status()}`); return; }
      const state: PresentationState = await response.json();
      if (!manifest.runId) {
        if (!current && state.id === initial.id) return;
        if (!allowSimulation && state.mode !== "live") return;
        if (!/^RUN-[A-Z0-9-]+$/.test(state.id)) throw new Error("Unexpected run identifier.");
        manifest.runId = state.id; manifest.mode = state.mode;
        if (terminal) activity = new ActivityFeed(state.id, event => terminal.add(event, state.mode));
        console.log(`CAPTURING ${state.id} (${state.mode}). Human participants act in their own sessions.`);
      }
      if (state.id !== manifest.runId || state.mode !== manifest.mode) { failure("run_changed"); manifest.reason = "run_changed"; stop = true; return; }
      activity?.observe(state);
      const next = sample(state, (Date.now() - started) / 1000);
      if (manifest.samples.at(-1)?.revision !== state.revision || next.missionVerified) {
        manifest.samples.push(next);
        // Keep event markers only on first observation, avoiding quadratic manifests.
        const seen = new Set(manifest.samples.slice(0, -1).flatMap(s => s.events.map(e => e.id)));
        next.events = next.events.filter(e => !seen.has(e.id));
        await persist();
      }
      if (next.missionVerified && !verifiedAt) verifiedAt = Date.now();
      if (state.status === "stopped") { manifest.reason = "run_stopped"; stop = true; }
    }).catch(() => { failure("observation_failed"); });
  });
  page.on("requestfailed", req => { if (new URL(req.url()).pathname === "/api/state") failure("state_network_failure"); });
  try {
    if (terminal) {
      await terminal.open(browser);
      manifest.tracks.terminal = { video: "terminal.webm", startedOffset: terminal.startedOffset };
      const check = new ActivityFeed(initial.id, () => {});
      await check.poll();
      if (!check.summary().readersConnected) throw new Error("Terminal readers unavailable");
    }
    await page.goto(`${origin}/present`, { waitUntil: "networkidle" });
    await page.getByTestId("presentation").waitFor();
    console.log(`RECORDER ARMED at ${origin}/present${terminal ? " + TERMINAL" : ""}. ${current ? "Observing the current run." : "Start a fresh Live contractor run in the dashboard."}`);
    console.log("Ctrl-C ends recording and saves footage; it does not stop incident execution.");
    await persist();
    while (!stop && Date.now() - started < max * 1000) {
      if (activity) await activity.poll();
      if (terminal) await terminal.tick();
      if (verifiedAt && Date.now() - verifiedAt >= 8000) { manifest.reason = "mission_verified"; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (manifest.reason === "recording") manifest.reason = "time_limit";
  } catch { failure("capture_failed"); manifest.reason = "capture_failed"; process.exitCode = 1; }
  finally {
    await pending;
    if (activity) { await activity.poll(); manifest.activity = activity.summary(); }
    if (terminal) {
      try { await terminal.close(); if (terminal.failed) failure("terminal_write_failed"); }
      catch { failure("terminal_capture_failed"); }
    }
    manifest.finishedAt = new Date().toISOString();
    await context.close();
    await video.saveAs(path.join(working, "raw.webm"));
    await browser.close();
    process.off("SIGINT", interrupt); process.off("SIGTERM", interrupt);
    const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(working, "raw.webm")], { encoding: "utf8" });
    manifest.duration = Number(probe.stdout.trim()) || (Date.now() - started) / 1000;
    manifest.tracks.dashboard!.duration = manifest.duration;
    if (manifest.tracks.terminal) {
      const p = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(working, "terminal.webm")], { encoding: "utf8" });
      const duration = Number(p.stdout?.trim());
      if (!duration) failure("terminal_video_unavailable");
      manifest.tracks.terminal.duration = duration || 0;
    }
    await persist();
    await writeFile(path.join(working, "edit.json"), JSON.stringify(suggestedEdit(manifest, manifest.duration), null, 2));
    await writeFile(path.join(working, "evidence.json"), JSON.stringify(evidenceGates(manifest), null, 2));
    const destination = path.join(root, manifest.runId ?? "unbound", stamp);
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(working, destination);
    console.log(`SAVED ${destination} (${manifest.reason}). Raw footage, event manifest, evidence checks, and edit suggestion retained.`);
    if (!manifest.runId) process.exitCode = 1;
  }
}
main().catch(() => { console.error("Recording could not complete. Check browser installation, origin, service credentials, and output permissions. Raw errors are withheld."); process.exitCode = 1; });
