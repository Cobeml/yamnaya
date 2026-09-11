# Yamnaya

A mission-oriented world of Hermes agents: suited analysts, horses and camps around a black cube that you operate. Establish camps for different purposes, give agents tools and instructions, review their work, and grow their configurations through training and lineage.

Camps research, reason, run code and produce professional Quarto reports and websites. Sources live in GitHub repositories; reviewed sites publish to GitHub Pages. Slack provides an instruction and discussion channel. General-purpose camps use the same mission ontology and scoped tools.

```bash
npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.32.1 -- pnpm run setup
docker compose --env-file .env.camps up -d --build
```

Open **http://localhost:3110**. Sign in with `CAMP_OPERATOR_PASSWORD` from the private `.env.camps` file. Configure model and connector credentials there to run live agents. Simulation mode and local Quarto rendering work without provider credentials. See [camp setup and operation](docs/camps.md) for grants, publications, training and Slack.

PostgreSQL state, Hermes profiles and rendered artifacts use persistent volumes. The execution sandbox has no external network or connector credentials. Operator approval binds the exact rendered site revision before publication.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e  # complete camp stack must be running
```

Read [architecture](docs/architecture.md), [implementation status](docs/tasks.md), and [Hermes integration notes](docs/hermes.md) before changing behavior. MCP is reserved for future tool integration through the same grants and receipt verification.

[Hosted deployment](docs/deployment.md) · [Google website image tools](docs/google-tools.md)
