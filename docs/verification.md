# Local verification record — 2026-09-10

| Check | Result / evidence |
| --- | --- |
| TypeScript and ESLint | Pass |
| Production build | Pass inside `Dockerfile.app`; standalone Next.js serving on localhost:3100 |
| Unit/regression suite | 29 passed: authority, adaptation, data/time parsing, isolated execution, storage concurrency/rollback, GitHub branch ancestry/retry |
| Playwright | Three passed: complete worker recovery; identity/browser-ticket boundaries; concurrent PostgreSQL writes and forged-approval rejection |
| Mission recovery | 9/9 independent checks; test runs real local mapper compilation/tests, authorized deployment, data/cache repair and queue reconciliation |
| Deterministic evaluation | Six scenarios pass; report and replay states in `runtime/evaluations/latest.json` |
| OpenClaw defender | Plugin observation, one-use browser sign-in and actual Chromium dashboard snapshot pass after container recreation |
| OpenClaw adversary | Bounded observation succeeds; browser, shell and defender tools return unavailable |
| Persistence | Identical SHA-256 over run ID, events, chat, plans, MDM, cache and credentials before/after web/worker/agent restart |
| Visual check | Desktop and mobile screenshots inspected; mobile has no page-width overflow |

Screenshots: `runtime/screenshots/verified-overview.png`, `runtime/screenshots/mobile-overview.png`. Playwright HTML results: `playwright-report/index.html`. These generated files are local and excluded from Git.

The utility and OpenClaw gateway health endpoints return 200. Both agent containers, PostgreSQL, web and code lab are healthy; the worker is running. The OpenClaw image is pinned to official 2026.9.3 browser content, and the configured model is `openai/gpt-6-astra` with the explicit OpenClaw runtime.

## Credential-backed checks

After credentials were supplied, all preflight fields were configured and Astra account catalog access returned HTTP 200. Two real requests through the OpenClaw Chat Completions gateway passed: the defender used its observation surface and returned the current run ID with 20 service points (about 11 seconds); the attacker returned the same run ID with its permitted three-point view (about 10 seconds). The requests were constrained to observation only. The model remained `openai/gpt-6-astra` in the explicit OpenClaw configuration, with no fallback configured.

Slack bot authentication and app Socket Mode authorization returned HTTP 200, the worker connected through Socket Mode, and all three persona identifiers passed distinct-ID validation. GitHub repository access returned HTTP 200 with push permission reported. The configured PostgreSQL connection passed `SELECT 1`. No authentication or rate-limit failure appeared in the sanitized runtime diagnostics. The existing authenticated Chromium smoke check also passed after reloading credentials.

Credential values and `.env` contents were not displayed or inspected by the assistant. Programs loaded credentials internally for their intended requests and emitted allowlisted status fields. Results are retained in `runtime/verification/integrations.json` and the agent containers' `yamnaya-verification` directories.

No real Slack delivery, corrective PR write, Vercel deployment, or hosted Neon provisioning was performed by these credential checks. A successful model observation turn does not establish full agentic recovery performance. Human Slack acknowledgements/approvals and live corrective PR execution remain to be tested. The deterministic shutdown/pivot comparisons remain fixture tests, not a measured live-agent benchmark.
