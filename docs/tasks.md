# Implementation and remaining integration work

The local implementation includes the utility model, source adapters, four-domain graph, authority service, durable PostgreSQL execution, role-based dashboard, isolated mapper service, corrective PR adapter, Slack identity bridge, Docker OpenClaw tools/browser, and persistent bounded agent drivers.

## Verified locally on 2026-09-10

TypeScript, ESLint and the Docker production build pass. All 29 unit/regression tests, three Playwright tests and six deterministic scenario evaluations pass. The browser recovery reaches 9/9 mission checks using the actual worker and isolated mapper service. Desktop/mobile screenshots were inspected. The OpenClaw observation → one-use sign-in → Chromium snapshot smoke test passes without a model call; the attacker gateway rejects browser, shell and defender tools. Incident state, plans, messages and audit evidence retain the same digest after web/worker/agent recreation. GitHub ancestry and retry behavior are tested with a mocked connector; no live PR has been created.

CI defines the unit/build/evaluation and Docker browser suites. The user pushed the deployment/CI fixes and confirmed the GitHub Action succeeded. [Verification record](verification.md) lists earlier local evidence and limits.

## Credential checks completed on 2026-09-10

The supplied credentials pass preflight. Two actual Astra requests through the Docker OpenClaw gateways returned the correct live observation views (20 service points for the defender, three for the attacker). Slack bot authentication, app Socket Mode authorization, the worker's Socket Mode connection, GitHub repository access with reported push permission, and the configured PostgreSQL `SELECT 1` check pass. The authenticated Chromium smoke test also passes with the credential configuration. Tests load credentials internally; `.env` contents and secret values were not displayed or inspected by the assistant.

These checks used observation tools and authenticated read-only integration probes. They did not exercise a full agentic recovery, deliver Slack messages, create a real PR, or deploy hosted infrastructure.

## Hosted setup and CI repair on 2026-09-10

- Migrated the supplied Neon demo database through its direct endpoint, then reran the migration successfully. The app uses the pooled TLS endpoint.
- Created `cobemls-projects/yamnaya` through the logged-in Vercel CLI, configured the `apps/web` monorepo root and production app secrets, connected `Cobeml/yamnaya`, and deployed **https://yamnaya.vercel.app**. Kept Vercel Standard Protection on preview/deployment aliases and used the accessible production domain for the runtime.
- Kept `.env` contents and values out of tool output. Added a name-only, stdin-based production environment sync helper. OpenAI, Slack and GitHub execution keys remain local; hosted badges use non-secret configuration flags. `.env.hosted` contains only URL overrides and remains ignored.
- Reconnected the existing Docker executor and both Astra/OpenClaw containers to the hosted API. Nine hosted checks pass: database-backed health, anonymous denial, three role/password sessions, three service identities, and attacker/defender separation. Docker OpenClaw's observation → one-use browser ticket → authenticated Chromium dashboard smoke test passes over HTTPS; Slack Socket Mode reconnects successfully.
- Two actual Astra observation turns also pass against the hosted Neon-backed run `RUN-7D5E0078`: defender sees 20 service points (8.7 seconds), attacker sees only three (9.0 seconds). These are read-tool checks, not complete agentic recovery trials.
- Fixed `pnpm setup` → `pnpm run setup`, the `lib/` ignore rule hiding authentication/persistence source files, and Next.js standalone output incompatibility with Vercel's adapter. Both previously ignored files must accompany the next commit. Added Vercel/Docker upload exclusions for credentials and runtime material.
- Validation: typecheck, lint, 29 regression tests, a successful Vercel production build, and all three browser tests against a separately built Docker stack with disposable credentials. Browser recovery reached all mission checks. The temporary CI stack was stopped afterward; its evidence remains at `/tmp/yamnaya-ci-q0ox2U`.

The hosted run remains a clean monitoring simulation. Full recovery was tested on isolated local infrastructure, not on the credential-enabled hosted runtime. Live Slack delivery, corrective PR creation, approval conversations, and complete agentic recovery remain the next workflow gates. No extra GitHub Actions secrets are needed for current CI or the connected Vercel Git integration; deployment.md contains the full credential breakdown.

## Acceptance checks

### Recording implementation

The authenticated `/present` view is deployed with four domain panels, current plan/approval state, an audit feed, continuity counters, and independent mission checks. It uses existing read APIs; no authority or database schema changes were needed. It distinguishes live agents from simulation/replay, rejects stale approval display, pauses on a pinned-run mismatch, and labels connection loss.

`pnpm demo:record` records actual 1920×1080 Chromium video with run-bound, wall-clock state/event markers. It authenticates before recording and blocks browser mutation requests. It creates edit suggestions and preserves interrupted/incomplete takes. `pnpm demo:edit` renders labeled clips and silent MP4 exports with FFprobe verification; it refuses a live-final label without the recorded live recovery evidence. `pnpm demo:run` provides explicit presenter start/stop commands and a read-only status summary; it cannot approve plans. [Recording runbook](recording.md) contains participant instructions, commands, shot timing, narration, and Slack-insert guidance.

Checks completed: 33 unit/regression tests, typecheck, lint, Docker and Vercel builds, both new presentation browser tests, and the existing three isolated recovery/browser tests. A real 14-second camera preview was captured and exported from the isolated simulation. Its label explicitly identifies it as a preview, not a live recovery. The hosted API authentication checks and Docker OpenClaw browser smoke test also pass after deployment. Full participant-assisted live recording is the next gate.

### Agent and terminal recording

Added session/turn-correlated OpenClaw tool observers, including native browser calls; host-only terminal collection; published plan rationale and executor/approval/check projections; and a synchronized terminal track in `demo:record --with-terminal`. The read-only monitor is also available through `demo:terminal`. Capture metadata is allowlisted and text is sanitized before recording; browser sign-in links, snapshots, raw results, and hidden reasoning are not captured. Runtime agents retain their existing capabilities and cannot access the combined stream.

Named dashboard/terminal tracks share the recording clock, retain separate raw videos and structured/text activity, and are selectable in the editor. Existing dashboard-only takes remain compatible. Missing/unmatched tool activity or reader gaps prevent a terminal take from being labeled a successful live final. Recorder health checks run before arming. `demo:check-terminal` exercises actual model tools only on a simulation under separate smoke capture IDs.

Validation: 38 unit/regression tests, typecheck and lint pass; both rebuilt OpenClaw containers are healthy. Actual Astra smoke requests captured two defender calls (observation and browser) and one attacker observation with matched starts/completions and no gaps. The authenticated Chromium sign-in smoke also passes. A synchronized dashboard/terminal camera take was captured on the unchanged hosted simulation. A separate live observation-only capture check recorded actual tool starts and returns into video, structured events, and terminal text; its 13.47-second labeled preview exported successfully with FFprobe verification (1920×1080, H.264, 30 fps, yuv420p, silent). Terminal screenshots were visually inspected. No live attack, Slack delivery, plan approvals, or incident PR has been initiated by these checks.

The editor also passed a two-track dashboard/terminal export check (7.00 seconds, labeled preview). No application API, database, or Vercel deployment change was needed for terminal capture; the instrumentation runs in the two rebuilt Docker agent containers and the host recorder.

Limitations: explanations are the agent's published statements, not hidden reasoning; action receipts and independent checks remain separate. Browser video start/frame timing and polling can cause small sync differences, so review the visible UTC clocks. Full participant-assisted live recording remains pending readiness.

### Mission checks

- TypeScript, lint, production build and invariant tests.
- Contractor recovery: exposed access denied, mapping tested/promoted, relationships/cache repaired, field confirmed, queue reconciled and unaffected work preserved.
- Policy: blanket shutdown rejected, reserve failure/shared dependency blocked, no forged approval, expiration and threat-change invalidation, stop control.
- Input: CSV/XML agreement, effective dates/DST, group rejection and duplicates.
- Runtime: actual isolated mapper tests/execution, browser sign-in/revocation, tool observations and persistent storage.
- Six deterministic scenarios: contractor, pivot, reserve unavailable, shared reserve, benign maintenance and injection. These are fixture checks, not live model benchmarks.

## Next credential-dependent gates

### First participant-assisted live take: RUN-828589B0

Live recording captured the attacker deploying the compromised mapping, altering work orders and forging a support claim; the defender investigated, quarantined three SDPs, assigned field checks, revised/rehearsed plans, and obtained actual human approvals through the dashboard. Stakeholder statements and the three operations field confirmations arrived through Slack. Healthy AMI and unaffected processing continued. Browser navigation initially timed out; a subsequent operator observation/sign-in probe passed. The operator supplied that diagnostic for a human to relay, without revoking credentials or granting plan approvals.

The first approved execution failed before any applied step because the GitHub connector requested `/repos/owner/repo/` instead of `/repos/owner/repo`. Read-only probes confirmed 404 versus 200 with the same credentials; repository, default-branch and PR read access passed from both host and executor. Fixed URL construction, tightened the existing ancestry/retry regression to reproduce GitHub's strict endpoint behavior, and rebuilt/redeployed the executor after that test passed. The take retains an operator-interventions sidecar; its exports are labeled OPERATOR ASSISTED and must not be represented as unassisted recovery. Full mission recovery remains unverified at this point.

The rehearsal was stopped at 6/9 checks with three field confirmations and healthy processing preserved. It also exposed OpenClaw's 64,000-character truncation of large tool responses: the accumulated state exceeded 220 KB and reached the model as invalid JSON. Added a bounded adapter projection (current checks/authority/recent human input, selected evidence/history, explicit per-artifact/observation/transaction reads) while keeping the full server state and audit. A 500-observation regression and background-wakeup regression pass; unchanged throughput/anomaly repetitions no longer trigger new defender turns. The supplied current state projected to about 35 KB. Turn limits remain unchanged. A fresh take is being prepared after these fixes and browser warm-up.

1. Extend the successful Astra read-tool smoke checks into an actual OpenClaw plan → browser → recovery trial.
2. Verify Slack notification delivery, exact plan/version approvals, field confirmation, and unauthorized-user rejection with the configured channel/personas.
3. Verify a corrective PR, correct incident base, source digest and commit provenance, including retry reconciliation, using the validated GitHub credentials.
4. Provision an isolated hosted test environment with its own database and executor before running the destructive browser recovery suite there. Production Neon/Vercel provisioning and role/tool/browser smoke checks are complete.
5. Record three live trials and one pivot trial. Compare with the explicit manual shutdown baseline using recovery time, healthy throughput, scope, authority violations and failed attempts. Report all failed/indeterminate runs rather than presenting fixture scores as live success.

Credentials and hosted connectivity are validated; the remaining gates need live workflow trials and an isolated hosted recovery-test environment. See deployment and recovery runbooks. No production utility integration is part of this project.
