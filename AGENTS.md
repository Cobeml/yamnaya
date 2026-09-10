# Working on Yamnaya

Build one complete meter-operations mission across code, data, personnel, and digitally managed physical assets. Read docs/architecture.md and docs/tasks.md before changing behavior. The user's decisions supersede draft examples in ontology.md and hackathon.md. Preserve con_ed_infra_interview.md as source material; derived fixtures are fictional.

## Boundaries

- packages/core owns deterministic utility behavior, schemas, policy, plans, and independent verification. No model calls, filesystem, or network effects in reducers.
- apps/web owns authentication, persistence, bounded API requests, and the dashboard. Never trust client-supplied roles or model-generated approval claims.
- services/worker owns long-running jobs and external connectors. Each effect needs an idempotency key and an independently checked receipt.
- Runtime agents can investigate and propose; they cannot alter policy or grant themselves approval. Attacker access is limited to synthetic capabilities and observations.
- Runtime workspaces and incident branches must not edit this development checkout. Never put real tokens, private interview content, or evaluator ground truth in attacker context.

## Workflow

Use small dependency-ordered tasks; update docs/tasks.md with tests and limitations. Do not delegate unless the user explicitly requests delegation. Keep schema changes, migrations, and their callers together. Inspect git status before editing; preserve unrelated work.

## Commands

`pnpm run setup`, `pnpm db:migrate`, `pnpm dev`, `pnpm worker`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm evaluate`, `pnpm preflight`.

Use invariant and regression tests for transaction semantics, access control, approvals, replay, and partial execution. Do not write tests that merely repeat constants. A green command receipt is not verified recovery. Report missing credentials and unavailable live integrations accurately.
