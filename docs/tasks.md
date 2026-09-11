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

- All 12 camp policy, persistence, publication, image-import and preview-origin regressions pass; TypeScript and ESLint pass.
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

Deployed the camp application to https://yamnaya.vercel.app with database-backed report artifacts on https://yamnaya-camps-preview.vercel.app. Both hostnames are production project domains. The production schema migration and Vercel build succeeded; all executor containers were rebuilt and started with the hosted configuration.

The hosted browser workflow passed on 2026-09-11: create and start a simulation camp, edit Quarto, prepare an image brief, import a synthetic image fixture, execute Python during rendering, view the image in the isolated preview, approve the build, invalidate approval on edit, grant scoped tools and play a legal game. Desktop/mobile screenshots and the report preview are in `runtime/screenshots`. The test caught a stale refresh overwriting a newly selected camp; refresh results now apply only to the current selection and request generation. Test camps are archived after each run.

The pinned Hermes runtime and supervisor checks passed using the fake streaming model, including durable checkpoints, restricted tools and idempotent completion. All 12 unit regressions, TypeScript and ESLint pass. The main app responds successfully and unauthenticated camp API access returns 401.

Google image generation is an operator handoff through the signed-in Gemini/AI Studio website. No Google API, billing connection, credit purchase or paid fallback is configured. The import check used a synthetic local fixture; actual Google generation and the account's remaining allowance were not tested. Live model, Slack and GitHub credentials remain unconfigured. The executor host must stay running for queued work.

## Cultural-mimetics implementation

In progress: local origin relay, content-addressed file artifacts, and indexed work projections. Existing 12 regressions pass. The production cutover, durable quota scheduler, two research pilots, boards, outreach approvals, and evaluations are being implemented and are not yet claimed live.

### Cultural workflow and budget stage

Implemented two four-role focus templates, source provenance and exact quotation checks, typed argument connections, sequential publication workflows, shared internal boards, exact Gmail/forum drafts and approvals, manual forum receipts, Slack digests/alerts, and reviewed development/held-out example sets. Quota pauses retain the transcript, release the worker, and resume without spending another mission turn. Paused workflows require explicit resumption; camp broadcasts record direction without waking every role.

The operator approved a $10 monthly Gemini budget on 2026-09-11, within their $15 Google account cap. The gateway reserves conservative input plus maximum output/thinking cost in PostgreSQL before requesting Gemini 3.8 Flash. Reservations are not refunded; paid calls stop when verified prices expire. This bounds this application's requests, not other applications using the Google account. Images remain a website handoff.

20 unit regressions, TypeScript, ESLint and production container builds pass. Dedicated local origin, search and tunnel deployment are being verified. GitHub returned 401 and Slack returned not_authed in read-only credential checks; no external message was sent. Gemini and Gmail credentials remain missing. Live model/publication/outreach success is not claimed.
