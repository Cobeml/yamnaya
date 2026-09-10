# Deployment and external integrations

The deployment is Next.js on Vercel, PostgreSQL on Neon, and OpenClaw plus the executor/code lab in Docker on this machine. The production project is `cobemls-projects/yamnaya`, connected to `Cobeml/yamnaya`, at **https://yamnaya.vercel.app**. Production app secrets are configured in Vercel; external execution keys stay on this machine.

## Astra in Docker

Put `OPENAI_API_KEY` in the untracked `.env`. Keep the generated gateway and defender/attacker tokens distinct. Recreate the agent containers to load changed environment values:

```bash
docker compose --env-file .env --env-file .env.hosted --profile agents up -d --build openclaw-agent attacker-agent
YAMNAYA_URL=https://yamnaya.vercel.app pnpm preflight --check-model
docker compose exec -T openclaw-agent node /opt/yamnaya/smoke.mjs
```

The smoke test uses real OpenClaw plugin and browser calls, without a model. The catalog check verifies account visibility of `gpt-6-astra`; an actual live tool turn is still required. No silent model fallback is configured. Driver limits are controlled by `DEFENDER_TURN_LIMIT` and `ATTACKER_TURN_LIMIT`, with persistent consumed-turn counters per run.

## Slack personas

Create a dedicated demo Slack app with Socket Mode enabled. The app-level `SLACK_APP_TOKEN` needs `connections:write`. Install a bot with `chat:write` and channel-history access for the chosen channel (`channels:history` for public, `groups:history` for private). Subscribe to `message.channels` or `message.groups` as appropriate, and invite the bot to the channel. See [Slack Socket Mode](https://docs.slack.dev/apis/events-api/using-socket-mode/) and [Bolt for JavaScript](https://docs.slack.dev/tools/bolt-js/getting-started/).

Set `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_CHANNEL_ID`, and three **different** user IDs: `SLACK_SECURITY_USER_ID`, `SLACK_PLATFORM_USER_ID`, `SLACK_OPERATIONS_USER_ID`. The worker posts an incident root, sends owner notifications into its thread, and accepts only that channel/thread and those users. Configuration presence is labeled configured; successful delivery is recorded separately. Recreate the worker after editing `.env`.

## GitHub corrective PR

Set `GITHUB_REPOSITORY=owner/repository` and a repository-scoped `GITHUB_TOKEN` with Contents and Pull requests write access. The worker creates `demo/incidents/<run>` as an isolated base, writes `demo/mapping.ts` with the synthetic compromised source, branches the repair from that incident commit, and opens a PR targeting the incident base. It never merges into the application's deployment branch. Retries reconcile existing branches, content and PRs; source digests and test receipts remain attached to the run. No GitHub action occurs until an authorized corrective-code step executes.

## Neon and Vercel

1. Set the dedicated Neon demo database's pooled TLS URI as `DATABASE_URL` in `.env`. Run `pnpm db:migrate`. The migration script derives the direct Neon endpoint internally, or uses optional `DIRECT_DATABASE_URL`; it never prints the URI. Local Compose deliberately overrides its web/migration database to the local PostgreSQL container. The supplied Neon database has been migrated.
2. Import this repository into Vercel. Set the root directory to `apps/web`, enable including files outside that directory, choose Next.js, and use the included `vercel.json` build/install commands. The workspace dependency resolves `packages/core`. See [Vercel monorepos](https://vercel.com/docs/monorepos).
3. From the repository root, run `vercel link --project yamnaya --scope cobemls-projects` if not already linked. Run `pnpm deploy:env --url=https://yamnaya.vercel.app` to transfer the allowlisted app settings from `.env` to **production**, with secrets supplied via stdin and marked sensitive. The helper prints names only and refuses a different linked project name. Run `vercel deploy --prod --yes --scope cobemls-projects` to apply changes. Next.js uses Vercel's function packaging there and standalone output for Docker.
4. Keep `.env` intact and create an untracked `.env.hosted` containing only the three URL overrides below. It is already created on this machine. Load it after `.env` when running remote-connected Docker services. Host scripts can use their explicit `--url` option or the corresponding environment override.
5. Start the remote-connected runtime with the command below. The worker automatically starts code-lab. Local PostgreSQL/web can remain available independently; their database and run are separate from Neon. Keep session/service credentials synchronized when rotating them.
6. Run `pnpm exec tsx scripts/hosted-smoke.ts --url=https://yamnaya.vercel.app` and the OpenClaw browser smoke test. Use **the production domain above**: the project-scope and deployment-specific aliases redirect unauthenticated clients to Vercel login under Standard Protection. Preview deployments retain that protection; the production app enforces its own role authentication.

```dotenv
# .env.hosted — URL overrides only, no credentials
YAMNAYA_URL=https://yamnaya.vercel.app
YAMNAYA_DOCKER_URL=https://yamnaya.vercel.app
YAMNAYA_PUBLIC_URL=https://yamnaya.vercel.app
```

```bash
docker compose --env-file .env --env-file .env.hosted --profile agents up -d worker openclaw-agent attacker-agent
docker compose exec -T openclaw-agent node /opt/yamnaya/smoke.mjs
```

Only production environment variables are provisioned. Before running destructive browser recovery tests on a hosted preview, provision a **separate** database and isolated executor without live external credentials. The recovery suite resets the active run and can deliver Slack messages if its executor has live credentials. Use `hosted-smoke.ts` for role/session/service checks without incident actions.

## What belongs in GitHub, Vercel, and local Docker

| Location | Required configuration |
| --- | --- |
| GitHub Actions, current validation workflow | **No manually supplied secrets or variables.** `pnpm run setup` generates disposable passwords and service tokens; Compose supplies local PostgreSQL. OpenAI, Slack, Neon, and deployment credentials are unnecessary for these tests. |
| Vercel production sensitive variables | `DATABASE_URL`, `SESSION_SECRET`, `DEMO_SECURITY_PASSWORD`, `DEMO_PLATFORM_PASSWORD`, `DEMO_OPERATIONS_PASSWORD`, `DEFENDER_TOKEN`, `ATTACKER_TOKEN`, `WORKER_TOKEN`. The CLI helper has configured them. |
| Vercel production ordinary variables | `YAMNAYA_STORAGE=postgres`, `YAMNAYA_PUBLIC_URL`, `SLACK_CHANNEL_ID`, the three `SLACK_*_USER_ID` values, and `YAMNAYA_OPENAI_CONFIGURED`, `YAMNAYA_SLACK_CONFIGURED`, `YAMNAYA_GITHUB_CONFIGURED` flags. Flags describe configuration, not verified integration success. |
| Local untracked `.env` / Docker | `OPENAI_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `OPENCLAW_GATEWAY_TOKEN`, and the shared role/service credentials and Slack IDs. Do not upload this file to GitHub. |

The original Actions failure came from `pnpm setup`, which invokes [pnpm's own setup command](https://pnpm.io/cli/setup), not the package script. Use **`pnpm run setup`**. A broad `lib/` Git ignore rule also hid `apps/web/lib/auth.ts` and `store.ts`; the corrected rule allows both application files into the next commit. Commit/push the fixes together, including those files, before rerunning Actions.

The connected **Vercel Git integration** deploys repository pushes without an Actions deployment token. If you later choose an Actions-based deployment workflow instead, put `VERCEL_TOKEN` in repository Actions **Secrets** and `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` in Actions **Variables**. Their IDs are available in local `.vercel/project.json`; IDs are not credentials. A migration job would additionally need a dedicated demo `DATABASE_URL` secret. No such deployment/migration workflow is installed currently. See [Vercel Git integration](https://vercel.com/docs/git).

GitHub provides its workflow `GITHUB_TOKEN` automatically. The runtime's repository-scoped PAT is a separate credential that stays local. If a future workflow needs that PAT, name its Actions secret `DEMO_GITHUB_TOKEN` and explicitly map it to the process environment; GitHub reserves the `GITHUB_` secret-name prefix. This is unnecessary for current CI. See [GitHub secret naming rules](https://docs.github.com/en/actions/reference/security/secrets).

On the local deployment leave `YAMNAYA_PUBLIC_URL` empty so both `localhost:3100` and the in-container `web:3100` browser origin work. Do not change local `YAMNAYA_DOCKER_URL` away from `http://web:3100` until a hosted API exists.

Runtime state lives in PostgreSQL and Docker volumes, not Vercel's filesystem. Worker artifacts and Slack delivery checkpoints survive container recreation. No inbound Slack webhook, publicly exposed OpenClaw port, or tunnel to this machine is required.
