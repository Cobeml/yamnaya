# Computer maneuver implementation record

The default application is now the multi-camp computer maneuver experience. Historical utility work and its live-demo evidence are preserved in [cyber-tasks.md](cyber-tasks.md); those older live results do not establish that the new Hermes integrations have passed live trials.

## Completed

- Preserved `archive/cyber-maneuver` at `f45a3f5`, created `pivot/computer-maneuver`, and saved checkout, Git and PostgreSQL backups under `runtime/backups`. The old utility deployment remains separate. The new `yamnaya-camps` Compose project has independent credentials, ports and volumes.
- Built the 3D campsite with suited analysts, horses, tents and the operator's black cube. Agent movement reflects persisted activity. Added camp creation, cloning, pause/archive, missions, scoped tool grants, schedules, conversations, legal games and desktop/mobile controls.
- Added deterministic camp policy, PostgreSQL transactional state/events, idempotent mutations, revision checks, bounded jobs, lease expiry, consumption reservations and per-agent concurrency. Retained the tested utility ontology and verification under `packages/core/src/domains/cyber`.
- Replaced OpenClaw with pinned Hermes for new camp agents, including synthetic cyber agents. Added private profiles, configuration checkpoints, guarded tools, durable invocation journals, cancellation, provider proxy and explicit simulation mode. The preserved old deployment still uses its original runtime.
- Added public research fetch/search/browser, isolated Python/JavaScript and Quarto execution, digest-bound preview artifacts, GitHub source PRs, exact-build approval and GitHub Pages deployment. Reports and sites use versioned Quarto sources; no Notion or Home Assistant integration was added.
- Retained Slack through a camp-bound Socket Mode adapter with operator identity checks. Added staged skill candidates, structural evaluation, operator promotion, configuration restoration and agent lineage. MCP is documented as a future capability adapter.
- Added camp cyber plans, rehearsals, role approvals and durable execution using the retained domain policy, mapping sandbox and incident PR connector.
- Updated CI, setup/migration scripts, [architecture](architecture.md), [operations](camps.md) and [Hermes research notes](hermes.md).

## Verified locally

The following checks were run against this implementation. CI has been configured but has not been run remotely for these changes.

| Check | Result and scope |
| --- | --- |
| Unit and regression suite | 55 tests pass, including the original 45 utility regressions and new camp policy, transaction and GitHub artifact tests. |
| Deterministic evaluations | All six original scenarios pass. These are fixture evaluations, not live model benchmarks. |
| TypeScript and ESLint | Pass. |
| Production containers | All new service images build; PostgreSQL migration and local Compose startup succeed. |
| Camp Playwright workflow | Passes against the actual web, PostgreSQL, worker and sandbox services: creates a camp, scopes grants, starts a mission, edits a publication, plays a legal game, renders Python through Quarto, checks the preview, approves it, and verifies editing invalidates approval. |
| Hermes runtime contract | Actual pinned Hermes executes an observation against a fake streaming model, saves a checkpoint and rejects a fabricated delegation tool. The real supervisor launches an invocation, records completion and reconciles idempotent resubmission. No paid model request is made. |
| Sandbox isolation | A job-created file and detached process are removed by recycling the container namespace before the next job. The Quarto browser test also passes with recycling enabled. |
| Public browser | A private-address navigation is rejected; a subsequent public navigation in the same identity succeeds and yields the expected page snapshot. |
| GitHub publication | Mocked API test covers source PR creation/reconciliation, reviewed artifact publication and tampered artifact rejection. No live PR or Pages deployment is claimed. |
| Visual review | Desktop campsite and rendered preview screenshots inspected; desktop/mobile evidence saved under `runtime/screenshots`. |

New local application: **http://localhost:3110**. Signed document previews use **http://127.0.0.1:4112**. The previous utility service remains on port 3100. Generated credentials are in the ignored private `.env.camps` file and are not copied from the previous environment.

## Remaining live integration gates and limits

1. Configure the new camp's model provider and run a bounded real Hermes mission. Chat Completions has a fake-provider contract test; provider-specific Responses behavior and paid model usage need a configured live trial.
2. Configure Slack, bind an existing channel/thread and verify real delivery, instruction routing and exact-build approval with authorized participants. This implementation did not send Slack messages.
3. Provision a GitHub repository with the required permissions, Actions and Pages settings. Review a real source PR and approve its exact rendered output before testing publication. Existing repository protections remain authoritative; the test suite uses a mocked connector.
4. Run full cyber containment and advanced recovery through the new Hermes camp wrapper. The original domain regressions and deterministic scenarios pass, but historical OpenClaw live success must not be attributed to the new runtime.
5. Establish task-specific training benchmarks before interpreting promoted skills or derived agents as measurable improvement. Current candidate evaluation is structural, followed by operator review.

Public browser access is unauthenticated and GET-only. Quarto execution has no external network; bundle needed assets and supply source data through the project. Interrupted external effects remain indeterminate until inspected; they are not blindly replayed. File persistence is restricted to single-process local development. MCP remains an extension contract, not an active connector.
