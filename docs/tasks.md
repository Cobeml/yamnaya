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

20 unit regressions, TypeScript, ESLint and production container builds pass. Dedicated local origin, search and tunnel deployment are being verified. GitHub returned 401 and Slack returned not_authed in read-only account probes; no external message was sent. Gemini and Gmail credentials remain missing. Live model/publication/outreach success is not claimed.

### Local production verification

The cultural workspace is deployed to https://yamnaya.vercel.app, relaying API and isolated previews through the dedicated `yamnaya-api.cobe.dev` tunnel. Local PostgreSQL and immutable file artifacts are active. An unauthenticated origin request returns 403; authenticated health and worker reads return 200. SearXNG returned 36 results for a Jamestown query (one upstream engine unavailable).

Both hosted Playwright workflows passed: the existing Quarto/image/review flow and a two-camp cultural workflow covering private/shared boards, rendering, exact outbound approval and invalidation after source changes. The cultural screenshot was visually inspected. Test camps were archived; no external forum post or email was sent.

The actual pinned Hermes child passed observation, restricted-tool denial, durable checkpoints and a 429 pause/resume test: completed tool calls were retained and not repeated. Tests use a fake provider. Backups restored PostgreSQL into a temporary database and verified every archived artifact object's SHA-256 and index references. Hermes profiles are also included. A nightly 02:15 host-time cron job is installed; copies remain on the same machine.

The two four-agent pilots are provisioned and paused with Quarto scaffolds, 48 unreviewed examples each, workflows and scoped research/render tools. Live reasoning requires the Gemini key. The final private configuration check found Gemini, GitHub and Slack keys absent; Gmail OAuth and Slack destinations are also missing. Remote publication repositories, actual email delivery, actual Google image generation, independent audience impact, and measured learning improvement remain unverified. Full configuration and limitations are in [cultural camps](cultural-camps.md).

Final cutover check: all eight persistent services are running. Both hosted browser workflows passed again after removing unused database/authentication credentials from Vercel; login, local persistence, Quarto rendering and isolated previews continue through the origin relay. The final unit suite has 20 passing regressions; TypeScript, ESLint, production builds and the pinned Hermes supervisor contract pass. Implementation commits are pushed on master. The working pilots remain paused pending private credentials.

### GitHub repository provisioning

On September 11, 2026, the operator supplied a working GitHub token in `.env.camps` and explicitly requested repository creation/setup. Authentication returned Cobeml with repository and workflow scopes. The token was copied privately into production configuration, and the web/worker services were refreshed.

Created public `Cobeml/yamnaya-america` and `Cobeml/yamnaya-china` repositories and uploaded each pilot's 13 scaffold/metadata/workflow files. Every uploaded file was read back at its commit and compared byte-for-byte. Both repositories use `main`, GitHub-owned Actions, read-only default workflow tokens, and GitHub Pages `build_type=workflow`. No Pages workflow was dispatched; public site deployment still uses reviewed camp artifacts.

Added an idempotent provisioning script sharing the worker's exact Pages workflow. TypeScript, targeted ESLint and the existing GitHub publication regression pass. Gemini's dedicated key was not found in the inspected environment files; its location was requested separately. Gmail and Slack setup remain pending.

### Gemini configuration and MXroute research

The operator subsequently added `CAMP_GEMINI_API_KEY` to `.env.camps`. Copied that value privately into `.env.camps.production` and recreated the web and worker services. The running worker confirms key presence, and its authenticated camp read returns 200 with both research pilots paused. No model request was made; provider authentication and paid reasoning remain unverified.

Researched official MXroute SMTP/API documentation and sending policies. The [MXroute proposal](mxroute-email.md) describes account setup, a worker SMTP adapter, durable low-volume limits, approval preservation and live verification. MXroute prohibits unsolicited outreach; conflicting newsletter documentation needs provider clarification before publication mailing lists. The connector is not implemented and no email was sent. This update changes documentation only; no application regression suite was rerun.

### MXroute credential and delivery setup check

Corrected the private SMTP username to the full configured mailbox address. Live certificate-verified SMTP authentication succeeded on port 465 (235). The operator explicitly requested a setup check and supplied their personal test recipient; exactly one test message was accepted by MXroute (250). A durable local receipt records acceptance without claiming Gmail inbox delivery. No camp campaign or automatic retries were enabled.

Public DNS still uses registrar forwarding MX records and SPF, with no DKIM at MXroute's documented selector and no DMARC record. The [MXroute setup notes](mxroute-email.md#verification-status) list the required changes; DNS was not changed. Gmail receipt/authentication, inbound delivery to MXroute and the production camp SMTP adapter remain unverified or pending. Only configuration and documentation changed; validation consisted of live TLS/authentication, one authorized SMTP send, public DNS checks and documentation whitespace checks.

### MXroute DNS correction verification

On September 12, the operator reported non-receipt of the first test and completed DNS changes. Public MX, SPF, DKIM and DMARC checks now pass; the DKIM public key parses as 2048-bit RSA and both MX hosts resolve. TLS and SMTP authentication passed, and exactly one fresh test was accepted at 17:22 UTC (250). The operator confirmed receipt in the Gmail inbox, and the local test receipt records this confirmation. A read-only IMAP check found no bounce matching the earlier message in recent INBOX delivery-status candidates. Received authentication headers were not inspected. No DNS or application behavior was changed; results are recorded in the MXroute setup notes. Production camp SMTP integration and sending limits remain pending.

### MXroute management configuration review

Confirmed presence of the newly supplied `CAMP_MX_API_KEY` without exposing its value. Read the official management API specification: account queries also require a DirectAdmin username and API server, requested as `CAMP_MX_USERNAME` and `CAMP_MX_SERVER`. Neither variable was configured, so no management API request was attempted. The user-supplied SMTP/IMAP reference settings match the tested host and TLS ports. After clarification, verified the operator's updated sender `camp@yamnaya.tv` in `.env.camps`; the authenticated mailbox remains `mailperi@yamnaya.tv`. The new sender's mailbox/forwarder configuration and delivery remain unverified. No message, account customization or production connector change occurred. Documentation whitespace checks pass.

### MXroute management access verified

The operator supplied the remaining management fields. Read-only mailbox, forwarder and DNS requests returned HTTP 200. Confirmed that `camp@yamnaya.tv` is a non-suspended mailbox with a provider daily limit of 100, zero sends reported at check time, and no corresponding forwarder. Public MX records match the panel. DKIM public keys match after removing TXT formatting differences and parse as 2048-bit RSA. The private receipt records both the initial literal comparison and the successful key comparison. No credentials were exposed, account settings changed or messages sent. The new mailbox's SMTP login/delivery and production camp connector remain unverified or pending. Documentation whitespace checks pass.

### Discord replaces Slack

Replaced the Slack runtime dependency, capability, API operation, dashboard binding and environment settings with Discord. A Gateway bot handles explicitly prefixed commands from allowlisted humans in an exact server/channel binding. The API independently checks identity and destination; publication approval additionally requires the exact build digest. Duplicate command IDs reuse persisted results, queued sends fail if their binding changes, bot/webhook messages are ignored, and destinations shared by multiple active camps reject commands. Existing historical Slack state is not converted into Discord grants or bindings; the optional JSON binding needs no relational migration.

Discord sends suppress mentions/embeds, use bounded message bodies, and verify a separate message readback. Notifications and acknowledgements reserve durable delivery keys and retain receipts; uncertain effects are not automatically resent. Added a browser bind/disconnect regression and five unit regressions covering authorization, exact builds, replay, changed bindings, readback mismatch and lost send responses. All 25 unit tests, TypeScript, ESLint and the initial production container builds pass. Final deployment and hosted browser validation are in progress. No Discord bot credentials are configured or live Discord delivery claimed. [Discord setup](discord.md) documents the operator steps.
