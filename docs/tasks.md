# Implementation and remaining integration work

The local implementation includes the utility model, source adapters, four-domain graph, authority service, durable PostgreSQL execution, role-based dashboard, isolated mapper service, corrective PR adapter, Slack identity bridge, Docker OpenClaw tools/browser, and persistent bounded agent drivers.

## Verified locally on 2026-09-10

TypeScript, ESLint and the Docker production build pass. All 29 unit/regression tests, three Playwright tests and six deterministic scenario evaluations pass. The browser recovery reaches 9/9 mission checks using the actual worker and isolated mapper service. Desktop/mobile screenshots were inspected. The OpenClaw observation → one-use sign-in → Chromium snapshot smoke test passes without a model call; the attacker gateway rejects browser, shell and defender tools. Incident state, plans, messages and audit evidence retain the same digest after web/worker/agent recreation. GitHub ancestry and retry behavior are tested with a mocked connector; no live PR has been created.

CI now runs the unit/build/evaluation and Docker browser suites; the remote CI workflow itself has not been run in this session. External live preflight intentionally fails until credentials are supplied. [Verification record](verification.md) lists evidence and limits.

## Acceptance checks

- TypeScript, lint, production build and invariant tests.
- Contractor recovery: exposed access denied, mapping tested/promoted, relationships/cache repaired, field confirmed, queue reconciled and unaffected work preserved.
- Policy: blanket shutdown rejected, reserve failure/shared dependency blocked, no forged approval, expiration and threat-change invalidation, stop control.
- Input: CSV/XML agreement, effective dates/DST, group rejection and duplicates.
- Runtime: actual isolated mapper tests/execution, browser sign-in/revocation, tool observations and persistent storage.
- Six deterministic scenarios: contractor, pivot, reserve unavailable, shared reserve, benign maintenance and injection. These are fixture checks, not live model benchmarks.

## Next credential-dependent gates

1. Configure Astra access and run an actual OpenClaw read → plan → browser tool turn. Record runtime/model identity and tool receipts; the no-model smoke test cannot prove model compatibility.
2. Configure a dedicated Slack channel and three different persona users. Verify notification delivery, exact plan/version approvals, field confirmation, and unauthorized-user rejection.
3. Configure the GitHub repository/token. Verify a corrective PR, correct incident base, source digest and commit provenance, including retry reconciliation.
4. Provision Neon and deploy the prepared Next.js project to Vercel. Run the same browser tests against the deployment using a separate demo environment.
5. Record three live trials and one pivot trial. Compare with the explicit manual shutdown baseline using recovery time, healthy throughput, scope, authority violations and failed attempts. Report all failed/indeterminate runs rather than presenting fixture scores as live success.

These gates are pending external credentials/provisioning. See deployment and recovery runbooks. No production utility integration is part of this project.
