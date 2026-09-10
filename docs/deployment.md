# Deployment and external integrations

The prepared deployment is Next.js on Vercel, PostgreSQL on Neon, and OpenClaw plus the executor/code lab in Docker on this machine. Local Compose is fully usable first; hosted resources and live credentials still need provisioning.

## Astra in Docker

Put `OPENAI_API_KEY` in the untracked `.env`. Keep the generated gateway and defender/attacker tokens distinct. Recreate the agent containers to load changed environment values:

```bash
docker compose --profile agents up -d --build openclaw-agent attacker-agent
pnpm preflight --check-model
docker compose exec -T openclaw-agent node /opt/yamnaya/smoke.mjs
```

The smoke test uses real OpenClaw plugin and browser calls, without a model. The catalog check verifies account visibility of `gpt-6-astra`; an actual live tool turn is still required. No silent model fallback is configured. Driver limits are controlled by `DEFENDER_TURN_LIMIT` and `ATTACKER_TURN_LIMIT`, with persistent consumed-turn counters per run.

## Slack personas

Create a dedicated demo Slack app with Socket Mode enabled. The app-level `SLACK_APP_TOKEN` needs `connections:write`. Install a bot with `chat:write` and channel-history access for the chosen channel (`channels:history` for public, `groups:history` for private). Subscribe to `message.channels` or `message.groups` as appropriate, and invite the bot to the channel. See [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/) and [Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/getting-started/).

Set `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID`, and three **different** user IDs: `SLACK_SECURITY_USER_ID`, `SLACK_PLATFORM_USER_ID`, `SLACK_OPERATIONS_USER_ID`. The worker posts an incident root, sends owner notifications into its thread, and accepts only that channel/thread and those users. Configuration presence is labeled configured; successful delivery is recorded separately. Recreate the worker after editing `.env`.

## GitHub corrective PR

Set `GITHUB_REPOSITORY=owner/repository` and a repository-scoped `GITHUB_TOKEN` with Contents and Pull requests write access. The worker creates `demo/incidents/<run>` as an isolated base, writes `demo/mapping.ts` with the synthetic compromised source, branches the repair from that incident commit, and opens a PR targeting the incident base. It never merges into the application's deployment branch. Retries reconcile existing branches, content and PRs; source digests and test receipts remain attached to the run. No GitHub action occurs until an authorized corrective-code step executes.

## Neon and Vercel

1. Create a separate Neon demo database and obtain its pooled TLS connection URI. Set that URI as `DATABASE_URL` in the deployment environment and migrate it with `pnpm db:migrate` from a terminal configured for that database. Local Compose deliberately overrides its web/migration database to the local PostgreSQL container.
2. Import this repository into Vercel. Set the root directory to `apps/web`, enable including files outside that directory, choose Next.js, and use the included `vercel.json` build/install commands. The workspace dependency resolves `packages/core`. See [Vercel monorepos](https://vercel.com/docs/monorepos).
3. Set `DATABASE_URL`, `YAMNAYA_STORAGE=postgres`, `SESSION_SECRET`, all three `DEMO_*_PASSWORD` values, and `DEFENDER_TOKEN`, `ATTACKER_TOKEN`, `WORKER_TOKEN` to match this machine. Set `YAMNAYA_PUBLIC_URL` to the canonical Vercel HTTPS origin. Add Slack channel/persona IDs for identity checks. External-key presence controls configuration badges; API execution keys themselves are only needed by the local runtime services.
4. Set local `.env` values `YAMNAYA_URL`, `YAMNAYA_DOCKER_URL`, and `YAMNAYA_PUBLIC_URL` to that same HTTPS origin. The first is used by host scripts, the second by the Docker worker/agents, and the third fixes the canonical browser origin. Keep the local credential values synchronized with Vercel.
5. Start only the remote-connected services: `docker compose --profile agents up -d --build worker openclaw-agent attacker-agent`. The worker automatically starts code-lab. Stop local `web`, `postgres`, and `migrate` services if they are no longer needed; named volumes can remain for local development.
6. Run preflight and browser tests against the hosted demo, then perform a live trial. Deployment protection must allow the authenticated API clients to reach the app; a Vercel login page is not the utility API. Use a dedicated accessible demo deployment with the application's role authentication.

On the local deployment leave `YAMNAYA_PUBLIC_URL` empty so both `localhost:3100` and the in-container `web:3100` browser origin work. Do not change local `YAMNAYA_DOCKER_URL` away from `http://web:3100` until a hosted API exists.

Runtime state lives in PostgreSQL and Docker volumes, not Vercel's filesystem. Worker artifacts and Slack delivery checkpoints survive container recreation. No inbound Slack webhook, publicly exposed OpenClaw port, or tunnel to this machine is required.
