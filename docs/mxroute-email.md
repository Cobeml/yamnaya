# MXroute for camp correspondence

Research checked September 11, 2026. This is an implementation proposal; the running email connector still uses Gmail.

## Fit and restrictions

MXroute can support application-generated correspondence and operator notifications. Its service limits prohibit marketing and unsolicited outreach, independently of the 400-message hourly limit per address. Low volume does not make cold promotional distribution acceptable. Use it for recipients expecting a message, such as existing correspondents, invited exchanges and the operator. A publicly listed address alone is not permission. [Service limits](https://docs.mxroute.com/docs/presales/limits.html).

There is conflicting newsletter wording: the marketing policy permits legitimate non-promotional newsletters, while the core FAQ rejects newsletters broadly. Obtain written clarification from MXroute before using this account for a publication mailing list. Ordinary expected correspondence need not wait on that separate question. [Marketing policy](https://docs.mxroute.com/docs/presales/marketing.html), [core FAQ](https://docs.mxroute.com/docs/presales/faq-core.html).

## Transport and account setup

Use the local worker with authenticated SMTP over TLS on port 465, or mandatory STARTTLS on 587. Obtain the server hostname from the account's control panel. Create a dedicated camp mailbox and verify its domain's MX, SPF and DKIM records; preserve other legitimate senders when updating existing DNS. [Setup guide](https://docs.mxroute.com/docs/quick-setup.html). Also check DMARC alignment using a received test message. [Delivery troubleshooting](https://docs.mxroute.com/docs/api/smtp-api.html#email-not-delivered).

MXroute also offers an HTTPS sending API authenticated with the mailbox's server, full email address and password. It accepts one recipient per request and does not support attachments. Its documented success response has no provider message identifier or idempotency contract. [SMTP API](https://docs.mxroute.com/docs/api/smtp-api.html).

Recommendation: direct SMTP gives the worker control over MIME and Message-ID headers. Use links to reviewed Quarto sites initially. Neither a stable Message-ID nor server acceptance guarantees duplicate prevention or inbox delivery. The HTTPS API is an alternative if the host blocks SMTP, with the same application approval and quota checks.

Proposed private variables in `.env.camps` (not implemented yet):

| Variable | Value needed |
| --- | --- |
| `CAMP_EMAIL_PROVIDER` | `mxroute` |
| `CAMP_SMTP_HOST` | Actual account server hostname |
| `CAMP_SMTP_PORT` | `465` initially |
| `CAMP_SMTP_USERNAME` | Full dedicated mailbox address |
| `CAMP_SMTP_PASSWORD` | Mailbox password, entered privately |
| `CAMP_EMAIL_SENDER` | Dedicated mailbox address initially |

Also supply the sender display name and an operator-controlled test recipient. No MXroute management password or Gmail OAuth configuration is needed for this proposed transport. Copy configuration into the private production environment when enabling it. A mailbox password may also permit IMAP access; it must remain outside agent context even though the initial tool only sends.

## Dependency-ordered implementation

1. Generalize the current Gmail-specific outbound schema, API and UI to email with a server-selected transport. Migrate existing drafts and bind approval to transport, sender, recipient, exact content and publication version. Invalidate approval when any bound value changes.
2. Add a worker-only SMTP connector with certificate verification, timeouts, fixed host/sender configuration and sanitized receipts. Preserve the existing atomic claim and indeterminate-outcome handling. Never retry a send automatically when acceptance is uncertain.
3. Add a durable PostgreSQL send budget shared across camps: proposed defaults are **five messages total per UTC day, two per camp per day, and fifteen minutes between sends globally**. Reserve allowance atomically before the network effect; worker restarts and concurrent claims must not bypass it. Agents cannot raise these limits.
4. Keep exact operator approval for each external message, one recipient per message, and no automatic follow-ups. Record evidence of an invitation, opt-in or existing correspondence separately from contact discovery. Preserve global suppression and add handling for reported opt-outs and hard bounces. Initially the operator can record those from webmail.
5. Test concurrent quota claims, approval invalidation, suppressed recipients and ambiguous send outcomes with a local SMTP fixture. Then verify account authentication without sending. For the first live send, review one exact message to the operator's test address and inspect received authentication headers. Record acceptance separately from confirmed receipt.

SMTP sending does not provide reply ingestion. Start with replies reviewed in webmail; bounded IMAP access can be a later feature. Treat incoming mail as untrusted material, and do not let it grant tools or authorize further sends. Operator email digests would be another explicit connector configuration; Slack remains the current notification transport.

## Verification status

No MXroute credentials were inspected, no MXroute account connection was tested, and no message was sent. Provider policy and transport capabilities were researched from official documentation. Application findings were checked against `services/worker/camp-outreach.ts`, `services/worker/camp-updates.ts` and the existing outbound approval workflow.
