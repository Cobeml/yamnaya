# Yamnaya

A runnable cyber-defense demo across code, data, personnel, and meter installations. A compromised contractor mapping revision corrupts meter-to-service-point relationships. The defender must contain the exposed identity, preserve unaffected processing, mobilize the platform sponsor and meter operations, repair code and data under approval, and verify recovery.

This is a fictional utility segment inspired by the integration structure in `con_ed_infra_interview.md`. It connects to no Con Edison system. The scenario models meter operations; it does not model grid control, power flow, or SCADA.

## Run locally

Prerequisites: Docker Compose, Node 22.19+ for host development, and pnpm 10.32.1. Docker supplies Node and OpenClaw for runtime services.

```bash
npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.32.1 -- pnpm setup
docker compose --profile local --profile agents up -d --build
```

Open **http://localhost:3100**. Select a role in **Sign in** and use its generated password from the untracked `.env` file (`DEMO_SECURITY_PASSWORD`, `DEMO_PLATFORM_PASSWORD`, or `DEMO_OPERATIONS_PASSWORD`). Setup preserves existing values. OpenClaw's defender gateway is at `http://localhost:18789`, authenticated with `OPENCLAW_GATEWAY_TOKEN`.

The local stack works without external keys in **Simulation** mode. Both OpenClaw gateways start, but their model drivers wait for an API key and a **Live** run. Manual candidate buttons are explicitly labeled; simulation recovery is not evidence of live model performance.

Follow [the demo runbook](docs/demo-runbook.md) for the complete incident, and [deployment instructions](docs/deployment.md) for Astra, Slack, GitHub, Vercel, and Neon. Those live integrations require your accounts and credentials; the repository does not provision them automatically.

## Validate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm evaluate
pnpm test:e2e
pnpm preflight
docker compose exec -T openclaw-agent node /opt/yamnaya/smoke.mjs
```

Use the `npm exec --yes --package=pnpm@10.32.1 -- pnpm` prefix if pnpm is not installed on the host. Browser tests require `pnpm exec playwright install chromium` and the running local stack. Tests reset the active synthetic run; run them before presenting.

`pnpm evaluate` writes deterministic scenario results to `runtime/evaluations/latest.json`. Browser tests save desktop/mobile screenshots under `runtime/screenshots/`. No evaluation calls a model unless you explicitly start a live run.

## Development map

| Area                | Responsibility                                                                        |
| ------------------- | ------------------------------------------------------------------------------------- |
| `packages/core`     | Typed utility state, ingestion, ontology, policy, rehearsal, independent verification |
| `apps/web`          | Next.js dashboard, authenticated API, PostgreSQL transactions and audit projections   |
| `services/worker`   | Durable job executor, simulation clock, Slack and GitHub connectors                   |
| `services/code-lab` | Isolated compilation, mapping regression tests, deployed artifact execution           |
| `openclaw`          | Defender/adversary runtime configuration, plugins, prompts, persistent turn drivers   |
| `tests`             | Policy, parsing, code execution, identity boundaries, and browser recovery            |

Read [architecture](docs/architecture.md), [data dictionary](docs/data-dictionary.md), [response policy](docs/response-policy.md), and [development tasks](docs/tasks.md) before changing behavior. The original ontology and hackathon documents provide product intent; the implementation contract and documented simplifications are in these files.

Stop services with `docker compose --profile local --profile agents stop`. Persistent volumes retain incidents, receipts, artifacts, and OpenClaw state. [Recovery procedures](docs/recovery-runbook.md) cover interrupted jobs and agent turns.
