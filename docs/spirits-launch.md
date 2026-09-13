# Discovering Spirits: first issue

America and China each retain four Hermes residents. Their mission is to inspire awe through spirits described in specific religious/esoteric traditions and through cultural forces, distinguishing source assertions, historical evidence, interpretation and original art. Each issue answers who the spirits are, how they are known, where to learn from them and what they command. Three profiles, an introductory essay, annotated sources, a connection map and corrections form each Quarto site. The source evidence determines the subjects.

## Model and budget contract

The source finder and cross-referencer use `gpt-6-astra` with high reasoning. The writer uses `gemini-3.8-flash` with medium reasoning and the marketer uses Flash with low reasoning. The gateway selects models from the authenticated job's configuration and launch membership; model-supplied selections cannot override them. Hermes keeps its Chat Completions checkpoint format. The gateway translates Astra requests to the Responses API, which Astra requires for tool calling, and translates results back into Chat-compatible tool calls. Encrypted reasoning is stored locally by camp, agent and call ID and returned only to Astra with the matching tool results. Flash uses Chat Completions directly. Requests are text-only and expose only camp function tools and private memory.

`CAMP_MODEL_API_KEY` supplies OpenAI, `CAMP_GEMINI_API_KEY` supplies Gemini, and `CAMP_SPIRIT_LAUNCH_ENABLED=true` enables the prepared launch. These belong in the private executor environment, never Vercel browser configuration, agent profiles or publications. The existing OpenAI key passed a read-only Astra model lookup; that is not a completed reasoning test.

The `spirits-first-issue` row in the existing `camp_quota` table owns the shared $50 OpenAI allowance. Each request reserves under `SELECT FOR UPDATE`. Input is conservatively charged as serialized UTF-8 bytes plus 8,192 overhead tokens, at the higher $12.50/million cache-write price; output/thinking reserves 16,384 tokens at $50/million. Context is limited to 180 KB, below the long-context pricing threshold. Standard service is forced; additional completions, provider-hosted tools, images, premium service and unsupported parameters are not passed upstream.

Reservations are never refunded, including errors, missing usage, or worker crashes. Provider-reported tokens are stored separately and receipt replays do not double count. These are application accounting records, not an account-wide invoice. The ledger is not reset at calendar boundaries. When another Astra request would cross $50, a persistent fallback switches both camps' research to Flash. The next request retains the Hermes conversation and completed tool results. The existing separate Gemini monthly $10 ledger then governs all Flash requests. Exhaustion persists a wait; it does not purchase more credit. Recheck prices before 2027; paid calls stop at that boundary.

The initial live trial rejected the Chat Completions configuration; this corrected transport follows the [Astra migration guide](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra). The corrected live smoke completed both providers' tool calls with usage receipts. At the provider switch, tool-call groups imported from Astra receive Google's documented `skip_thought_signature_validator` migration marker; existing Gemini signatures remain intact. See [Google's guidance for transferring traces between models](https://ai.google.dev/gemini-api/docs/generate-content/thought-signatures).

Official model and price references: [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [Gemini](https://ai.google.dev/gemini-api/docs/pricing). Prices checked September 13, 2026. Images remain an operator handoff through the Gemini/AI Studio website.

## Preparation and release

1. Run `bash scripts/camps/backup.sh`; it verifies a temporary database restore and artifact hashes.
2. Run `pnpm exec tsx scripts/camps/prepare-spirits.ts`. It configures the two existing paused pilots idempotently, preserves their source/workflow history, records the mission, adds versioned profiles and grants the writer scoped source-PR access. It does not start paid work.
3. Install the Discord bot, enable Message Content Intent, synchronize its private token/operator IDs to production and verify both saved channel bindings. Restart web, worker and Hermes after rebuilding changed services; deploy the console to Vercel.
4. Verify a live command, acknowledgement and notification in each bound destination, followed by bounded Astra/Flash Hermes turns. A bot API readback proves message existence, not operator receipt.
5. Run the two existing workflows. Source finders retain at least six passages across three profiles. Cross-referencers post one sourced synthesis thread per camp and at most one substantive sister-camp response when available. Reading another camp must not block the issue or recursively create work.
6. Review rendered previews, source PRs and exact digests. Only the operator approves publication. Deploy those reviewed bytes to the existing GitHub Pages repositories and verify the public release marker.
7. Marketers prepare up to three forum contributions with documented venue rules. Exact drafts retain approval and manual posting. MXroute SMTP automation remains outside this issue; no outreach email is enabled.

The scheduler pauses a launch once all role handoffs and public site deployments are complete and no jobs remain active. Recurring research, social turns and paid training are disabled for this issue. Discord receives milestones, failures, review notices, fallback updates and the existing daily digest. Editorial acceptance remains the operator's assessment of surprise, depth, prose and visual force. Later cheaper-model comparisons can use that baseline; no measured learning improvement is claimed.

## Tests and recovery

`pnpm test`, `pnpm typecheck`, `pnpm lint`, production builds and the pinned Hermes contract tests precede live work. `pnpm exec tsx scripts/camps/test-launch-ledger.ts` creates a temporary PostgreSQL database to check 60 concurrent reservations, a single fallback transition, usage receipt replay and persistence through a fresh connection. It removes only that temporary database. Gateway regressions use fake providers and exercise actual HTTP routing, authentication and continuation without API spend.

Pause camps before rollback. Preserve budget and delivery records and reconcile uncertain external effects; never reset ledgers or blindly resend. The local executor host, PostgreSQL, tunnel, browser, sandbox and Hermes services must remain available even though the console is on Vercel. Hosted browser tests use simulation camps and archive them afterward.

After diagnosing and fixing a failed role, `pnpm exec tsx scripts/camps/resume-spirit-task.ts america finder 'Recovery instruction'` resumes its existing waiting task with retained checkpoints (substitute the focus and role). It does not approve a build or reset a budget. The one-time `resume-spirits-finders.ts` records the earlier clean-context recovery after the external-job envelope bug; do not rerun it as routine recovery.

Live verification results are recorded in [tasks](tasks.md). Configuration presence alone is not provider authentication, successful generation, public deployment or reader impact.
