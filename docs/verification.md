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

No actual model request has been made. `OPENAI_API_KEY`, GitHub token and Slack tokens/channel/persona IDs are absent. No real Slack delivery, real corrective PR, Vercel deployment, Neon instance, or live model trial is claimed. Model selection in configuration and no-model tool smoke tests do not prove live Astra access or agentic performance. The deterministic shutdown/pivot comparisons are fixture tests, not a measured live-agent benchmark.
