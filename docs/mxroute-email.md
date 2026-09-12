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

### Optional management API access

The operator supplied `CAMP_MX_API_KEY` for account queries and customization. MXroute's management API requires three headers: `X-API-Key`, `X-Username` (DirectAdmin username), and `X-Server` (server shown on the API Keys page). Map these from `CAMP_MX_API_KEY`, `CAMP_MX_USERNAME`, and `CAMP_MX_SERVER` respectively. The latter two variables were absent when checked on September 12; management authentication is not yet verified. [Official API specification](https://api.mxroute.com/openapi.yaml).

The management API supports mailbox/forwarder administration, quota queries, spam settings and read-only DNS information. It does not replace the mailbox password for SMTP or IMAP. Keep management credentials out of camp agent context; begin with read-only queries and scope any later customization to an explicit operator request. Receiving mail uses `shadow.mxrouting.net:993` with TLS; sending uses `shadow.mxrouting.net:465` with TLS, as supplied by the operator.

The operator subsequently updated `CAMP_EMAIL_SENDER` to `camp@yamnaya.tv`, verified in `.env.camps`. `CAMP_SMTP_USERNAME` remains `mailperi@yamnaya.tv`; the envelope/header sender and authenticated mailbox are separate settings. Existence of the new address as a mailbox or forwarder and sending from it remain unverified pending management access. The earlier confirmed Gmail delivery was from the old sender. No additional message was sent during this configuration check.

After the operator supplied `CAMP_MX_USERNAME` and `CAMP_MX_SERVER`, read-only management requests succeeded (HTTP 200). `camp@yamnaya.tv` exists as a non-suspended mailbox; the API reports a daily sending limit of 100 and zero messages sent at the time of the check. It has no matching forwarding rule. Published MX records match the panel, and the published DKIM public key matches the panel's 2048-bit RSA key after normalizing TXT formatting. Results are saved privately in `runtime/mxroute-management-check.json`. No account setting was changed or email sent. The SMTP login still uses the previously tested mailbox; SMTP authentication and delivery specifically using the new mailbox remain unverified. The proposed application's five-message daily cap is still pending implementation and is separate from this provider limit.

## Dependency-ordered implementation

1. Generalize the current Gmail-specific outbound schema, API and UI to email with a server-selected transport. Migrate existing drafts and bind approval to transport, sender, recipient, exact content and publication version. Invalidate approval when any bound value changes.
2. Add a worker-only SMTP connector with certificate verification, timeouts, fixed host/sender configuration and sanitized receipts. Preserve the existing atomic claim and indeterminate-outcome handling. Never retry a send automatically when acceptance is uncertain.
3. Add a durable PostgreSQL send budget shared across camps: proposed defaults are **five messages total per UTC day, two per camp per day, and fifteen minutes between sends globally**. Reserve allowance atomically before the network effect; worker restarts and concurrent claims must not bypass it. Agents cannot raise these limits.
4. Keep exact operator approval for each external message, one recipient per message, and no automatic follow-ups. Record evidence of an invitation, opt-in or existing correspondence separately from contact discovery. Preserve global suppression and add handling for reported opt-outs and hard bounces. Initially the operator can record those from webmail.
5. Test concurrent quota claims, approval invalidation, suppressed recipients and ambiguous send outcomes with a local SMTP fixture. Then verify account authentication without sending. For the first live send, review one exact message to the operator's test address and inspect received authentication headers. Record acceptance separately from confirmed receipt.

SMTP sending does not provide reply ingestion. Start with replies reviewed in webmail; bounded IMAP access can be a later feature. Treat incoming mail as untrusted material, and do not let it grant tools or authorize further sends. Operator email digests would be another explicit connector configuration; Slack remains the current notification transport.

## Verification status

On September 11, 2026, the operator supplied mailbox credentials and authorized a single setup test to their personal address. Corrected `CAMP_SMTP_USERNAME` in the private `.env.camps` from a local mailbox name to the full configured sender address. The configured `shadow.mxrouting.net:465` connection passed certificate verification and negotiated TLS; SMTP authentication returned 235.

One message with subject `Yamnaya MXroute setup test` was accepted with SMTP 250 at 22:26 UTC. The local receipt is `runtime/mxroute-setup-test.json`; it was reserved exclusively before sending to prevent an accidental repeat of this setup test. Server acceptance is verified; Gmail inbox placement and received authentication headers are not. No automatic retries or camp sends were started.

The public DNS check found registrar forwarding MX records, an SPF record authorizing only that forwarding service, and no records at `x._domainkey.yamnaya.tv` or `_dmarc.yamnaya.tv`. Required setup work:

- Add `include:mxroute.com` to the existing single SPF record, preserving other senders that are still used. Do not create a second SPF record.
- Copy the domain-specific DKIM TXT name and full public value from the MXroute control panel into authoritative DNS. The mailbox password does not provide this DNS key. [DKIM setup](https://docs.mxroute.com/docs/dns/dkim.html).
- Add a monitoring DMARC TXT record at `_dmarc`, initially `v=DMARC1; p=none;`, then assess received authentication before using enforcement. [DMARC setup](https://docs.mxroute.com/docs/dns/dmarc.html).
- To receive replies at MXroute, replace forwarding MX records with the exact records supplied by its control panel, after recreating any needed mailboxes/aliases there. Existing MX records currently route replies to the registrar's forwarding service. [MX setup](https://docs.mxroute.com/docs/quick-setup.html).

DNS was inspected but not modified. The credentials remain in `.env.camps`; the application still requires the SMTP connector and durable sending controls described above. This setup test does not establish production camp email readiness.

### September 12 DNS recheck

The operator reported that the first test did not arrive and that they had corrected DNS. Public lookups now return `shadow.mxrouting.net` (priority 10) and `shadow-relay.mxrouting.net` (20), a single SPF record `v=spf1 include:mxroute.com -all`, a valid 2048-bit RSA public key at `x._domainkey`, and DMARC `v=DMARC1; p=none;`. Both MX hostnames resolve. This verifies published configuration; it does not verify that a delivered message carries a matching DKIM signature.

One fresh message, `Yamnaya MXroute DNS retest - September 12`, was accepted at 17:22 UTC with SMTP 250. Its independent receipt is `runtime/mxroute-dns-retest-2026-09-12.json`. Certificate verification and mailbox authentication passed again. A bounded, read-only IMAP check of recent delivery-status senders in INBOX found no bounce matching the earlier test; the earlier non-delivery remains unexplained. The operator confirmed receipt of the fresh test in the Gmail inbox; that confirmation is recorded in the local receipt. Received SPF/DKIM/DMARC authentication headers were not inspected. No further messages or automated campaign were started.
