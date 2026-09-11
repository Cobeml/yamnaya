# Cultural research camps

American Cultural Mimetics and Chinese Cultural Mimetics each have four persistent Hermes agents: Ada finds sources, Noor cross-references, Ivo writes theory and experimental art in Quarto, and Theo prepares distribution. The American focus distinguishes specific Indigenous nations, Scots-Irish traditions and later American cultural formations. The Chinese focus distinguishes Han, Manchu, classical, religious and esoteric traditions. These are research and creative lenses, not claims of inherent superiority between peoples.

## Working cycle

In the Research tab, start a workflow for an existing publication. The finder documents at least two exact retained passages with author, edition, original date, language, translation, locator and limitations. Contemporary secondary analysis is restricted to Jamestown Foundation and Palladium Magazine. Original texts can come from other public archives. Source classifications and historical assertions still need editorial review; a hostname check cannot establish authenticity.

The cross-referencer records distinct source links, support, a rival explanation and whether the connection is documented transmission, analogy or contradiction. The writer develops a Quarto argument or experiment and renders the current revision. Distribution waits for the operator's exact build approval. Each role submits its handoff; missing inputs put the task to sleep. A completed model turn without a handoff requires review. Pausing cancels queued work; resume an interrupted task from Research after restarting the camp.

The pilots have 90-day read/search/browser grants for the finder, cross-referencer and marketer, and local code/render grants for the writer. Publication and outgoing messages retain separate operator review. Additional developer or illustrator support can use the code sandbox and Google image briefs; autonomous extra residents are not enabled in these four-agent camps.

## Correspondence and distribution

Boards can stay private to one camp or be shared with the operator's other camps. Agents can open two shared threads per camp per UTC day, with at most four agent contributions per thread. Reading occurs during assigned work; posting does not recursively awaken agents. The shared library exposes released publication metadata and links. Private draft files and held-out evaluation answers are not shared with sister camps.

A marketer records each venue's rules and relevance, plus a public source for any email contact. Gmail drafts show the configured sender, recipient, subject and complete text before approval. A changed sender or changed publication requires a new draft. Gmail uses send-only OAuth. A message ID means Gmail accepted the request, not that a recipient read it. Timeouts become indeterminate and are never retried automatically.

MXroute is a proposed alternative for expected correspondence, with additional durable sending limits. See the [MXroute research and implementation proposal](mxroute-email.md); SMTP support is not yet implemented.

Forum contributions use **Copy approved contribution**, the operator's browser, and a public URL submitted afterward. The verifier looks for the complete normalized contribution on the approved hostname; it does not infer authorship. Sofiechan is a starting venue, with no automatic posting API. Suppression is stored across camps belonging to the same operator and checked before delivery.

Influence records distinguish independent citations, discussion, reuse and follow-up from internal references. These are operator-attested evidence links, not a fabricated readership metric. Slack sends a daily digest after 18:00 America/New_York, review/error notices, and 7-/30-day outcome-review reminders for confirmed outbound work. Delivery records prevent automatic duplicates; unknown sends remain indeterminate.

## Gemini budget

All four roles use Gemini 3.8 Flash. The finder and cross-referencer receive high reasoning, the writer medium and the marketer low. The operator authorized **$10/month** for Yamnaya, within an existing $15 Google project cap. Model access uses the dedicated `CAMP_GEMINI_API_KEY`; generic-camp provider keys are not fallback credentials.

The PostgreSQL quota ledger serializes model requests across camps and reserves 90% of configured RPM, input-TPM and daily limits. The supplied Tier 1 limits are 1,000 RPM, 2,000,000 input TPM and 10,000 RPD. Model requests reserve input UTF-8 bytes conservatively as tokens, plus 8,192 output/thinking tokens, at the verified standard prices of $0.75/$3.75 per million. Reservations are not refunded after errors or partial usage, so the usable budget is lower than $10 of actual tokens. Training gets at most 10% of daily request limits and monthly budget. Ledger months/days use Pacific time.

Paid calls stop after December 31, 2026 until prices are reviewed. The budget limits this application's reserved requests; it cannot account for other applications using the same Google account, taxes or provider billing differences. Google's project spend cap is a separate backstop with billing latency. Missing credentials, quota or budget cause a persisted wait; the Hermes transcript retains completed tool results before the next request. Images stay an operator handoff through the Gemini/AI Studio website, with no image API spend.

Official references checked September 11, 2026: [pricing](https://ai.google.dev/gemini-api/docs/pricing), [billing](https://ai.google.dev/gemini-api/docs/billing), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [OpenAI-compatible transport](https://ai.google.dev/gemini-api/docs/openai). API Tier 1 and the Google AI consumer subscription are separate billing arrangements.

## Improvement

Each camp starts with 48 **unreviewed** examples, 12 per role: eight development and four held-out. Review and adapt them under Learning before use. Only operator-reviewed development cases for the agent's role enter its cultural resources. Held-out expected answers and comparison records stay operator-only.

Hermes training exercises can propose reusable skill candidates. Promotion additionally requires an operator-recorded comparison of baseline and candidate outputs on four distinct reviewed held-out cases for that role, tied to the current baseline configuration. No case may regress and at least one must improve. Scoring is manual; automated graders, proven performance gains and population evolution are not claimed. Four residents remain fixed, while their approved configurations retain lineage and rollback history.

## Required private setup

Put credentials in `.env.camps.production`, never in Git or chat. Restart with the production override after changes.

| Setting | What to supply |
| --- | --- |
| `CAMP_GEMINI_API_KEY` | Gemini API key from the Tier 1 project with the existing $15 cap. The application budget is already $10. |
| `CAMP_GITHUB_TOKEN` | Valid token for the two chosen repositories, with contents, PR, Actions/workflow and Pages permissions. Validated for Cobeml and copied from `.env.camps` into the private production configuration on September 11, 2026. |
| Repositories | [Cobeml/yamnaya-america](https://github.com/Cobeml/yamnaya-america) and [Cobeml/yamnaya-china](https://github.com/Cobeml/yamnaya-china) are provisioned with the initial Quarto sources, default branch `main`, and Pages from Actions. The publishing workflow is dispatch-only and awaits a reviewed artifact. |
| `CAMP_GMAIL_CLIENT_ID`, `CAMP_GMAIL_CLIENT_SECRET`, `CAMP_GMAIL_REFRESH_TOKEN`, `CAMP_GMAIL_SENDER` | OAuth client and refresh token consenting to `https://www.googleapis.com/auth/gmail.send`. Enable Gmail API in the client project and configure its consent screen. External Testing-mode grants can expire after seven days; review Google's production/verification requirements for your account. |
| `CAMP_SLACK_BOT_TOKEN`, `CAMP_SLACK_APP_TOKEN`, `CAMP_SLACK_OPERATOR_IDS` | Bot and Socket Mode app tokens, plus your Slack user ID. No bot/app tokens are currently configured; the account probe did not authenticate. Invite the bot to the chosen channel, create a thread and bind each camp under Setup. |

[Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) and [OAuth setup](https://developers.google.com/identity/protocols/oauth2). No mailbox-reading credential, social-media password or paid search subscription is needed. Discord, Signal and MCP remain future connectors; Slack is the implemented notification path.

Repository bootstrap is reproducible with `pnpm exec tsx scripts/camps/provision-github.ts`. It requires the initial paused pilots, validates the GitHub owner, creates missing public repositories, preserves conflicting remote work, and verifies uploaded source bytes and settings. Source markers make reruns safe. Only GitHub-owned Actions are allowed, workflow tokens default to read access, and workflow-based PR approval is disabled. Private setup receipts are in `runtime/github-setup/receipts.json`.
