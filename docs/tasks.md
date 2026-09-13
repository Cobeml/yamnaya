# Camp implementation and verification

### Astra usage attribution audit — September 13, 2026

Audited the production first-issue ledger after the operator reported only $0.41 in today's provider dashboard. The $48.120893 local total consists of 29 cumulative maximum reservations, with 27 token receipts reporting 368,645 input and 4,875 output tokens. No duplicate request IDs or imported earlier-day charges were found. The guard never settles reservations after receipt, and the adapter discards cache billing details. Both read-only OpenAI billing/usage endpoint checks returned 403; actual billed spend remains unverified. Corrected the console wording for both providers and recorded the evidence and proposed settlement approach in [the audit](model-usage-audit.md). No budget or research state changed. Targeted ESLint and whitespace checks pass; this change only alters wording and documentation.

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

Discord sends suppress mentions/embeds, use bounded message bodies, and verify a separate message readback. Notifications and acknowledgements reserve durable delivery keys and retain receipts; uncertain effects are not automatically resent. Added a browser bind/disconnect regression and five unit regressions covering authorization, exact builds, replay, changed bindings, readback mismatch and lost send responses. All 25 unit tests, TypeScript, ESLint and production container builds pass. [Discord setup](discord.md) documents the operator steps.

Deployed the replacement to the local web/worker services and Vercel production; both public domains point to the ready deployment. Both hosted browser workflows pass, including the new Discord bind/disconnect flow. The initial browser run was interrupted to correct test navigation back to the Cube tab; the final complete run passed. Test camps were archived. Authenticated worker reads return 200, both research pilots remain paused, and Discord is disabled pending bot credentials. No live Discord connection, message or command has been exercised. Removed the private Slack environment variables and added blank Discord fields; no secrets were committed. Implementation and verification changes are on master.

### Discovering Spirits launch implementation

Prepared the America and China missions with versioned Astra research and Flash writing/marketing profiles, preserving the existing paused pilots and workflows. Added a server-controlled model router, text-only bounded provider requests, a persistent shared $50 Astra reservation ledger, separate usage receipts, automatic all-Flash fallback, an operator budget view and an idempotent launch runbook. Training and scheduled repeat work remain disabled for this first issue. The existing Gemini $10 monthly ceiling remains independent.

All 30 unit regressions, TypeScript, ESLint and web/worker/Hermes production builds pass. A temporary PostgreSQL test exercised 60 concurrent reservations, exactly one fallback transition, 26 deduplicated usage receipts and fresh-connection persistence without touching the production spending ledger. A backup restored 17 camps into a temporary database and verified six artifact objects and their references. Discord bot authentication, server membership and both channel reads now return 200. Both GitHub repositories return 200 with write/admin permissions and workflow-based Pages. Private OpenAI/Discord credentials were synchronized into production; no secrets were committed.

Deployment, live provider reasoning, Discord send/command verification and reviewed site publication are the next gates. No paid model generation or public issue release is claimed at this stage. See [the launch runbook](spirits-launch.md).

### Live transport corrections

The first paid smoke test completed its Flash observation/cultural tool calls and resumed from a saved quota checkpoint, but Astra failed before tools. A second test captured HTTP 400 on `reasoning_effort`. The earlier Chat Completions assumption was incomplete: the official Astra migration guide requires Responses for tool calling. Added a gateway adapter that preserves Hermes's existing checkpoint format while using Astra Responses, retaining encrypted reasoning locally by camp/agent/call ID. An additive table migration succeeded. The adapter does not send that reasoning to Gemini.

The live Flash test also exposed a stream-finalization bug: early consumer closure could leave quota reservations active and omit provider usage. The gateway now drains bounded provider responses independently and records usage/release even after downstream closure. The regression exercises this case plus sanitized provider errors and the Responses/Flash routing boundary. All 32 regressions, TypeScript and ESLint pass; the temporary database test also verifies encrypted-context isolation between camps and agents.

The initial launch console is ready on both Vercel aliases and both hosted browser workflows pass. The pinned deployed Hermes contract passes with a fake provider. Both live Discord connection messages have separate verified readback receipts. Operator-originated Discord test commands remain pending. Failed smoke camps are archived; their conservative OpenAI reservations remain in the ledger. Both actual research pilots remain paused while the corrected Astra adapter receives a live test.

### Live research continuation fixes

The corrected live smoke completed both Astra and Flash observation/cultural tool calls with provider usage receipts; its temporary camp is archived. Both research pilots then started and retained primary-source evidence. This exposed a Hermes API-envelope bug: completed external-job reads were incorrectly unwrapped as mutation responses, losing the job status. Only POST mutation envelopes are now unwrapped. The deployed contract test verifies a real external-job round trip, saved tool results, quota suspension/resumption, denied fabricated delegation and supervisor idempotency using a fake provider.

The shared Astra guard switched persistently to Flash at $48.120893 reserved. This is conservative maximum-request accounting, not the provider bill; no reservations were refunded. Gemini rejected the imported Astra tool history until the documented migration signature marker was added. Existing authentic Gemini signatures and parallel-call ordering are preserved. Recovery scripts explicitly resume waiting workflow tasks without changing policy, approvals or spending records. The initial finder recovery used a new versioned checkpoint after the envelope error; subsequent recovery retains that checkpoint and its tool results.

All 32 unit regressions, TypeScript and ESLint pass. The gateway test required local socket access outside the filesystem sandbox. Web/worker production builds and the deployed Hermes contract pass. Both camps resumed from retained evidence. Source handoffs, rendered issue previews, exact operator approval, public releases and inbound operator Discord commands remain live verification gates.

### Source-tool and incoming Discord verification

Both operator Discord instructions are persisted and both acknowledgements have independently verified readback receipts. The live finder then exposed missing source-tool required-field declarations and validation errors that hid the field name. Source registration now advertises all required fields, including translation provenance, and the API/bridge return bounded field-specific validation feedback. The real Hermes fake-provider contract verifies this failed-request feedback as well as its existing external-job, checkpoint, quota and supervisor cases. TypeScript, ESLint and production builds pass. Camps were briefly paused to prevent repeated invalid requests during deployment; their saved evidence, histories and budget reservations were retained. Launch start now checks current state rather than replaying the original start receipt after a later pause.

### First live issue checkpoint and budget stop

Both camps retained six verified source passages. America completed its finder handoff and recorded three connections plus a shared synthesis around Emerson's Over-Soul, Melville's White Whale and Moroni. China's passages cover the Queen Mother of the West, the Mountain Spirit and spirit officials governing lifespan. America's cross-referencer reached its bounded turn limit before handoff. Its proposed historical transmission from Emerson to Melville is not established by the retained passages; an explicit correction instruction is saved for continuation. These are research candidates and drafts, not accepted scholarship or measured influence.

The Gemini monthly guard stopped continuation at $9.952743 reserved, after the earlier persistent Astra fallback at $48.120893. These conservative nonrefunded reservations are not actual provider bills. Saved jobs wait for quota availability, with the monthly reset at October 1, 07:00 UTC; no budget was raised or reset. The dashboard now exposes the live Gemini monthly reservation and remaining balance alongside Astra. Neither issue has a rendered preview, source PR or public release. Editorial approval and the live publication/marketing stages remain untested for this issue. Previously verified simulation publication workflows are separate evidence.

The latest console deployment is ready on both Vercel domains, and the authenticated live budget view returns 200. All runtime/code fixes are committed on master. Both Discord instruction acknowledgements are verified. No outreach or email was sent. The executor must remain running for the saved jobs and notifications.

### Expanded analytical sources

Added Jain Family Institute (`jfiresearch.org`) and Phenomenal World (`phenomenalworld.org`) alongside Jamestown and Palladium. A shared core policy supplies the hostname check, new finder/mission instructions and dashboard labels. Each cultural Hermes invocation also receives the current policy explicitly superseding older saved source lists. Historical profiles and conversation checkpoints remain intact. The idempotent `scripts/camps/update-analytical-sources.ts` records an operator instruction in both existing camps without waking agents or changing their saved budget waits.

Ten targeted cultural/launch regressions, TypeScript, ESLint and web/worker/Hermes production builds pass. Source registration accepts both new publishers with or without `www`, rejects lookalike/userinfo hostnames, and still rejects unretained quotations. Live readback confirms both policy instructions, zero active jobs, unchanged October 1 resume dates and the unchanged $9.952743 Gemini reservation. No paid research or publication was triggered by this update.

### Discord disconnect CI failure and hosting diagnosis

Downloaded the failing GitHub browser traces. Their requests target only `localhost:3110`, so this failure cannot come from Vercel limits. The disconnect mutation returned 200, revision advanced to 2 and repeated camp reads had no Discord binding, while the UI retained the old button. Another run similarly failed to display a successfully created publication. The fixed-interval refresh invalidated in-flight reads every three seconds; a slow CI browser could discard every completed result. Polls now schedule their successor after completion, retaining the existing stale-selection guard. Camp-list calls also avoid a trailing-slash redirect.

The requested plain `pnpm test:e2e` initially failed because `.env.camps` selects localhost while this machine's production server requires the hosted browser origin. The matching production configuration passed both original workflows. Added a 1.1-second delay per API GET around Discord disconnect: it reproduced the exact reported failure on the old deployment, then both workflows passed against the fixed temporary local frontend (1.1 minutes). TypeScript, ESLint and a local production build pass. Test camps were archived; provider spending was not needed. The origin restriction was preserved.

Vercel reported Hobby/active, no soft block, 20 recent READY deployments and HTTP 200 on the live homepage/session endpoint. The billing usage API returned `costs_not_found`; remaining allowance percentages were not verified. Git and manual deployments duplicated several revisions. Updated operations guidance to use one Git-triggered deployment per commit. [Hosting options](hosting-options.md) explains temporary Discord operation with the local API retained, a Cloud Run console and a separate full-stack VM migration. No hosting plan or Google Cloud resources were changed.
