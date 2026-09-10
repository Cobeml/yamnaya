# Recording the one-minute Yamnaya demo

Use https://yamnaya.vercel.app/present for the camera and the ordinary dashboard for operator controls. Sign in through the dashboard first if using your own browser. The presentation page has no incident controls; it displays authenticated state and labels live agents, simulation, and replay separately. A `?run=RUN-...` query pins a viewer to that incident and pauses on reset.

## Prepare the participants

Three real people use the configured security, platform, and operations Slack identities in the dedicated channel. Use the incident's current thread; unrelated messages do not authorize actions. Record only that thread locally at 1080p, with unrelated notifications hidden. Narration is added afterward. The server captures the dashboard independently, so a remote desktop is unnecessary.

- Platform sponsor: answer whether this contractor deployment was authorized. Inspect the actual corrective mapping/PR when requested; approve only the current plan/version.
- Meter operations: inspect assigned simulated installation records; acknowledge the listed service points with `confirm field SDP-001 SDP-002 SDP-003`, substituting the actual assignments. This is a digital acknowledgement in a synthetic utility, not a claim about physical field work at Con Edison.
- Security: review scope, remaining exposure, continuity, and closure. Each role approves with `approve PLAN-3 v1`, substituting the actual requested plan/version. New threat evidence can invalidate prior authority; respond to the renewed request.

Neither the capture script nor the development assistant submits human approvals. The runtime chooses plans. Do not use manual candidate buttons or Inject incident during the live take.

## Capture a take

The existing Docker runtime must use `.env.hosted` and remain running. Commands load credentials internally without printing their values. From the repository root:

```bash
pnpm demo:record --url=https://yamnaya.vercel.app --with-terminal
```

Wait for `RECORDER ARMED`. Then the presenter can reset the dashboard to a fresh **Live contractor** run, or use the explicit presenter command in another terminal:

```bash
pnpm demo:run --start
pnpm demo:run
```

`demo:run` without flags is a sanitized status check. `--start` creates a fresh live synthetic incident; the existing attacker driver initiates the offense. It does not inject a predetermined attack. `--stop` invokes the existing operator stop control and preserves evidence. A stop cannot undo external effects; reconcile active/indeterminate jobs before another take.

The recorder waits for a new live run, binds its ID, records 1920×1080 browser video and state/event markers, and stops eight seconds after verified recovery. With `--with-terminal`, it also checks the Docker activity readers before arming and records a second video of the same output printed in the terminal. Default limit is 20 minutes (`--max-seconds=1200`). Ctrl-C saves the footage, but **does not stop the incident**. Raw video and an incrementally written manifest survive an ordinary stop; forced process termination may leave unfinished video. No cookies, passwords, code sources, or evaluator truth are written into the manifest.

For an explicit observation-only camera test of the existing simulation:

```bash
pnpm demo:record --url=https://yamnaya.vercel.app --current --allow-simulation --max-seconds=12
```

Output is `runtime/recordings/<run-id>/<UTC-take-time>/`: `raw.webm`, `manifest.json`, `evidence.json`, and an editable `edit.json`. Terminal takes additionally retain `terminal.webm`, `terminal.png`, `terminal.log`, and sanitized `activity.jsonl`. Marker offsets use a shared recording wall clock; simulation timestamps are recorded separately. Track metadata records each browser page's creation offset and probed video duration. Browser startup/frame timing and polling can cause small alignment differences; use the visible UTC clocks when reviewing cuts. Keep the original footage to verify cuts.

## Agent decisions and terminal activity

The recording shows published plan rationales and completed-turn summaries, actual requested/returned tools (including Chromium browser actions), human decision receipts, tested artifacts/PR references, execution receipts, and independent checks. It does not extract private model reasoning or simulate a shell session. Agent shell access remains disabled. `REQUESTED`, `TOOL RETURNED`, `ACTION.RECEIPT`, and `MISSION.CHECKS` are distinct evidence levels; a completed tool call alone does not prove recovery.

The OpenClaw driver selects a stable explicit session per role/run. Read-only plugin hooks match that session to its current turn, write allowlisted metadata to each container's existing state volume, and never change tool arguments/results or authority. The host merges those separate files with the dashboard's existing plan/receipt/check state. Combined telemetry is never fed back to either runtime agent. Browser targets, sign-in tickets, snapshots, tool result bodies, hidden reasoning fields, and raw provider logs are omitted. Agent-authored public statements are bounded and sanitized before capture; inspect all footage before sharing.

For an additional read-only terminal over SSH:

```bash
pnpm demo:terminal --url=https://yamnaya.vercel.app
```

This binds to the current run, labels its mode, and stops if its ID changes. Recording does not require this extra monitor. The recorder itself prints the same activity and can run in a dedicated tmux session, allowing read-only attachment with `tmux attach -r -t yamnaya-recording`. It records dashboard and terminal on the server while participants record Slack locally. If `pnpm` is not on PATH, use `node_modules/.bin/tsx scripts/demo/record.ts` or `scripts/demo/terminal.ts` with the same flags.

`pnpm demo:check-terminal` records actual observation-only Astra calls on the hosted **simulation**: defender observation plus browser status, and attacker observation. It refuses a live run, uses separate `SMOKE-*` capture files, and cannot count as incident recovery. It saves a terminal video, screenshot, and verification under `runtime/recordings/terminal-check/`, suitable for a labeled preview export. This check uses model credentials internally and makes billable model requests. Full browser sign-in can be checked separately with the existing Docker smoke script.

## Edit and export

```bash
pnpm demo:edit --manifest=runtime/recordings/RUN-.../TAKE/manifest.json
```

The exporter uses FFmpeg/FFprobe and DejaVu Sans installed on this Linux host. It emits individually labeled H.264 clips, a silent MP4, the exact edit list, and a duration verification file. Output is 1920×1080, 30 fps, yuv420p, with fast-start metadata. Existing exports and raw footage are preserved.

For a successful recorded live run, the suggested edit has six segments totaling 60 seconds. Review every cut; automated markers provide starting points, not editorial judgment. In `edit.json`, `start`/`end` are source seconds and `seconds` is output duration. Acceleration or slowdown is labeled automatically. Clip titles are plain text. Source windows stay in chronological order.

For named tracks, `start`/`end` use the manifest's shared clock. Set `"track": "terminal"` or `"track": "dashboard"`; the exporter subtracts that track's creation offset to locate its video frames. Without a track, dashboard is the default. Do not combine `track` with an external `source`. Existing dashboard-only manifests remain supported. Suggested terminal cuts cover the attack onset, defender investigation/containment, and tested recovery. If terminal capture has gaps, unmatched calls/turns, or lacks either agent's recorded tools, a final live export is refused and a labeled preview remains available.

To insert the Slack recording, supply a segment's optional `source` as a relative path to your local Slack video, with its own `start`/`end`. Use footage from the same incident and match the run/plan ID and timestamp to the manifest. Keep total output duration at 60 seconds. Transfer the external clip using the same SSH host you already use over Tailscale; credential files are not needed.

An incomplete or simulation recording defaults to a **CAPTURE PREVIEW** export. Removing that label is refused unless recorded evidence includes a fresh live incident, both runtime agents, containment, human decisions/field acknowledgement, confirmed Slack delivery, a tested corrective PR, advancing continuity counters, and independently verified closure without capture interruptions. These gates check recorded state; reviewers must still inspect the receipts and footage. A green plan alone is not mission recovery.

## Six-beat edit and narration outline

| Final time | Picture | Narration |
| --- | --- | --- |
| 0–6s | Mission and advancing intake | Cyber defense must preserve the mission as the situation changes. |
| 6–14s | Actual attacker tool action, then affected meter records | A compromised contractor changes synchronization code. Its effects reach operational data. |
| 14–28s | Defender rationale/tools, exposed access blocked, selective quarantine | Yamnaya follows the dependencies and contains affected work while healthy operations continue. Include an actual attacker pivot only if clearly captured. |
| 28–40s | Slack decisions and field confirmations | It mobilizes the sponsor, security lead, and meter operations. Human authority and field evidence shape the response. |
| 40–52s | Terminal test/PR/execution receipts, then source-aligned data | The approved maneuver restores trusted code and reconciles meter relationships and the operator cache. |
| 52–60s | Verified mission and continuing processing | Independent checks establish recovery. The mission holds; the defense moves. |

Keep the run ID and synthetic/live labels legible. Do not splice different takes into a single claimed recovery. Show the actual result if a prerequisite or live integration fails; resolve it before filming a successful closing shot.

If an operator fixes infrastructure during a take, retain the details and actual UTC times in `operator-interventions.jsonl` alongside its manifest. The exporter preserves this sidecar and labels the footage **OPERATOR ASSISTED**. A successful repair after such intervention is not an unassisted trial; use a fresh take after the infrastructure fix for that claim.
