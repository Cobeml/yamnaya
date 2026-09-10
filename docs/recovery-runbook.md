# Recovery and restart procedures

## Inspect first

Use the dashboard plan receipts and audit timeline, `docker compose ps`, and scoped logs for `worker`, `openclaw-agent`, and `attacker-agent`. Never infer success from an HTTP timeout. The active run is durable in PostgreSQL; historical runs survive resets. OpenClaw conversations and consumed-turn checkpoints live in separate role volumes.

## Interrupted executor plan

A job has a two-minute lease renewed after each step. A lost lease becomes `INDETERMINATE`. Completed effects keep their action IDs and step cursor. Deterministic failures become `FAILED`. The worker does not blindly retry either state.

Inspect the current step and its external evidence. For a patch, check the local artifact/test receipt and the exact incident branches/PR. The GitHub adapter can safely reconcile a matching existing commit/PR. As commander, record what was checked and requeue at the existing cursor:

```bash
pnpm reconcile --plan=PLAN-3 --note="Confirmed the incident PR and source digest; current patch step can reconcile the existing artifact."
```

The server requires commander identity, a substantive note and still-valid remaining-step approvals. It does not accept model-supplied authority. If the threat changed or approvals expired, revise/rehearse the remaining response and obtain fresh approvals. Existing data effects remain visible; do not assume revising a plan rolls them back.

## Ambiguous Slack delivery

The worker writes a pending marker under `/app/runtime/slack` before sending. If the process dies after sending but before saving the Slack timestamp, it stops duplicate delivery. Inspect the incident thread and the marker identified by the SHA-256 of `runId:notificationId` (or `incident-runId` for the root).

After finding the actual message, record its `ts` in that marker as `{"pending":false,"ts":"actual.slack.timestamp"}`. Do not clear a pending marker merely to make an error disappear. A failed notification can be reissued as a new targeted notification after the actual delivery state is established; old failure evidence remains. There is no automatic Slack history reconciliation in this MVP.

## Interrupted OpenClaw turn

`/home/node/.openclaw/yamnaya-driver.json` stores per-run turn count, observed-state fingerprint and `pending`. A timeout or process interruption retains `pending:true`, since a model/tool effect may have completed. Inspect the OpenClaw session and utility audit before clearing pending. Preserve `turns`; clear the fingerprint only when a new turn is warranted. Recreate/restart the affected container after reconciliation. A normal completed turn clears pending automatically.

Gateway heartbeats and cron are disabled; the persisted driver owns scheduled mission turns. Stop controls reject subsequent utility mutations, although a model request already in flight can still finish. For immediate shutdown of model requests, stop the two agent containers.

## Reset and retained evidence

Use the commander Reset control for a new synthetic run. Stale tool calls carry the previous run ID and are rejected. Use `docker compose --profile local --profile agents stop` to preserve all volumes. Removing volumes destroys local incidents and receipts and is not required for normal development.

The single-process file storage fallback is for development only. It has atomic rename and an in-process mutation queue, but no cross-process lock; PostgreSQL is required for the Docker/hosted demo.
