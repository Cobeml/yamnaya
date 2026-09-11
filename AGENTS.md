# Working on Yamnaya

Build mission-oriented camps of Hermes agents, represented by analysts in a 3D campsite around an operator-controlled black cube. Read docs/architecture.md and docs/tasks.md before changing behavior. The user's decisions supersede examples and drafts.

## Boundaries

- packages/core owns deterministic camp behavior, schemas, policy, grants, jobs and verification. No model calls, filesystem or network effects in reducers.
- apps/web owns authentication, persistence, bounded API requests and the camp interface. Never trust client-supplied roles or model-generated approval claims.
- services/worker owns long-running jobs and external connectors. Each effect needs an idempotency key and an independently checked receipt.
- Runtime agents investigate and propose; they cannot alter policy or grant themselves approval. Executable documents run in the isolated sandbox, without connector credentials.
- Runtime workspaces and publication branches must not edit this development checkout. Keep private credentials out of agent contexts and published artifacts.

## Workflow

Use small dependency-ordered tasks and commit completed changes on master. Update docs/tasks.md with tests and limitations. Do not delegate unless the user explicitly requests delegation. Keep schema changes, migrations and callers together. Inspect git status before editing; preserve unrelated work.

## Commands

`pnpm run setup`, `pnpm db:migrate`, `pnpm up`, `pnpm dev`, `pnpm worker`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.

Use invariant and regression tests for transaction semantics, access control, approvals, replay and partial execution. Do not write tests that merely repeat constants. Tool completion is separate from mission acceptance. Report missing credentials and unavailable live integrations accurately.
