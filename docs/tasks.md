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

Verified locally on 2026-09-11:

- All 10 camp policy, persistence and publication regressions pass; TypeScript and ESLint pass.
- Every production container builds, the PostgreSQL migration succeeds, and all six persistent camp services run successfully.
- The browser workflow passes against the rebuilt stack: a general-purpose camp receives a mission, edits a Quarto site, executes Python during rendering, opens the preview, approves the build, invalidates approval on edit, scopes an agent grant and plays a legal game.
- The actual pinned Hermes runtime passes observation, checkpoint and restricted-tool checks against a fake streaming model. Its supervisor passes process launch, durable completion and idempotent resubmission checks. No paid model call is claimed.
- The production route manifest contains the camp page, camp API and standard not-found page. Source references, imports and deployment dependencies were checked.
- Desktop and mobile camp screenshots and the Quarto preview are saved under `runtime/screenshots`; the desktop layout was visually inspected.

CI runs the unit/build checks and container-backed runtime/browser workflows. Remote CI and live external connector operations have not been exercised for this revision.

## Live integration gates and limits

1. Configure the camp model provider and run a bounded real Hermes mission. The runtime contract uses a fake streaming model; provider-specific transport behavior needs a configured live trial.
2. Configure Slack and verify delivery, instruction routing and exact-build approval with authorized participants in a bound channel/thread.
3. Provision a GitHub repository with the required permissions, Actions and Pages settings. Review a real source PR and approve its exact rendered output before testing publication. Connector regressions use mocked GitHub responses.
4. Establish task-specific training benchmarks before interpreting promoted skills or derived agents as measurable improvement. Candidate evaluation is structural, followed by operator review.

Public browser access is unauthenticated and GET-only. Quarto execution has no external network; bundle assets and supply source data through the project. Interrupted external effects remain indeterminate until inspected. File persistence is for single-process local development. MCP is an extension contract, not an active connector.

Run the application at **http://localhost:3110**; signed previews use **http://127.0.0.1:4112**. Configuration is in the private `.env.camps` file. See [operations](camps.md) and [architecture](architecture.md).

## Hosted deployment and image tools

Implemented database-backed artifact previews on a separate hostname and an operator-assisted Google website image workflow. All 12 policy, persistence, publication, image-import and preview-origin regressions pass. Vercel deployment and the hosted browser/runtime checks are in progress.
