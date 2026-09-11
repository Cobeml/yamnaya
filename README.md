# Yamnaya

A mission-oriented world of Hermes agents: suited analysts, horses and camps around a black cube that you operate. Establish camps for different purposes, give agents tools and instructions, review their work, and grow their configurations through training and lineage.

The first general-purpose workflow is research into professional Quarto reports and websites. Sources live in GitHub repositories; reviewed sites publish to GitHub Pages. Slack remains an instruction and discussion channel. The original cyber mission remains a deterministic domain module and regression suite.

```bash
npm exec --yes --package=pnpm@10.32.1 -- pnpm install --frozen-lockfile
npm exec --yes --package=pnpm@10.32.1 -- pnpm camps:setup
docker compose --env-file .env.camps up -d --build
```

Open **http://localhost:3110**. Sign in with `CAMP_OPERATOR_PASSWORD` from the private `.env.camps` file. Configure model and connector credentials there to run live agents. Simulation mode and local Quarto rendering work without provider credentials. See [camp setup and operation](docs/camps.md) for grants, publications, training, Slack, and recovery.

The runtime uses separate PostgreSQL, Hermes-profile and artifact volumes. The archived utility deployment is preserved in `docker-compose.cyber.yml` and branch `archive/cyber-maneuver`; its historical documentation is in [the cyber architecture](docs/cyber-architecture.md). The `/cyber` dashboard accesses that separate utility state.

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm evaluate
pnpm camps:test:e2e  # complete camp stack must be running
```

Read [architecture](docs/architecture.md), [implementation status](docs/tasks.md), and [Hermes integration notes](docs/hermes.md) before changing behavior. Quarto/GitHub replace Notion; MCP is reserved for future tool integration. No Home Assistant integration is included.
