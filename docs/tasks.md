# Camp implementation and verification

Yamnaya provides general-purpose and research camps with one mission ontology: observe, contextualize, propose, rehearse, authorize, maneuver and verify.

## Implemented

- 3D camps with analysts, horses, tents and the operator's black cube; creation, cloning, missions, pause/archive, scoped tools, conversations and games.
- Deterministic camp policy, transactional PostgreSQL state/events, idempotency, leases, concurrency and consumption reservations.
- Pinned Hermes runtime with private profiles, configuration checkpoints, guarded tools, invocation journals, cancellation and a credential-isolating provider gateway.
- Public research fetch/search/browser, isolated Python/JavaScript and Quarto execution, digest-bound previews, GitHub source PRs and reviewed GitHub Pages publication.
- Slack Socket Mode instructions, staged skill candidates, structural evaluation, operator promotion and agent lineage. MCP has a documented extension boundary.
- A single camp application and deployment configuration, with setup, migration, build and CI workflows.

## Validation

All 10 camp policy, persistence and publication regressions pass, along with TypeScript and ESLint. Production container builds, the camp browser workflow and pinned Hermes runtime contract are being checked against this revision.

## Live integration gates and limits

1. Configure the camp model provider and run a bounded real Hermes mission. The runtime contract uses a fake streaming model; provider-specific transport behavior needs a configured live trial.
2. Configure Slack and verify delivery, instruction routing and exact-build approval with authorized participants in a bound channel/thread.
3. Provision a GitHub repository with the required permissions, Actions and Pages settings. Review a real source PR and approve its exact rendered output before testing publication. Connector regressions use mocked GitHub responses.
4. Establish task-specific training benchmarks before interpreting promoted skills or derived agents as measurable improvement. Candidate evaluation is structural, followed by operator review.

Public browser access is unauthenticated and GET-only. Quarto execution has no external network; bundle assets and supply source data through the project. Interrupted external effects remain indeterminate until inspected. File persistence is for single-process local development. MCP is an extension contract, not an active connector.

Run the application at **http://localhost:3110**; signed previews use **http://127.0.0.1:4112**. Configuration is in the private `.env.camps` file. See [operations](camps.md) and [architecture](architecture.md).
