# Computer maneuver camps

Yamnaya's default experience is a world of mission-oriented camps. The same cycle applies across purposes: observe, contextualize, propose, rehearse, authorize, maneuver, verify. A camp combines a mission, agent configurations, resources, tool grants, evidence, publications and an append-only event history. The black cube represents the operator's authority; it is not itself an autonomous agent.

```mermaid
flowchart LR
  Human[Operator / bound Slack identity] --> API[Authenticated camp API]
  Scene[3D campsite and inspectors] <--> API
  API --> Core[Deterministic camp and domain policy]
  API --> DB[(PostgreSQL state, jobs and events)]
  Worker[Durable camp worker] <--> API
  Worker --> Hermes[Hermes supervisor / private profiles]
  Hermes --> API
  Hermes --> Proxy[Model gateway / request reservations]
  Proxy --> Provider[Configured model provider]
  Worker --> Research[Public research browser and fetch]
  Worker --> Sandbox[Isolated Quarto / code sandbox]
  Sandbox --> Artifacts[Digest-bound artifacts / separate preview origin]
  Worker --> GitHub[Source PR / reviewed Pages artifact]
  Worker --> Slack[Slack Socket Mode]
```

## Ownership and boundaries

- `packages/core/src/camps.ts`: schemas and deterministic transitions, camp authority, expiring grants, publication revisions, job eligibility, daily budgets, training candidates, lineage and legal games. No effects or model calls.
- `packages/core/src/domains/cyber`: the retained utility model, ontology, policy, ingestion, rehearsal and independent verification. Compatibility reexports preserve existing callers.
- `apps/web`: signed operator sessions and camp/job-scoped agent identities; bounded JSON requests; PostgreSQL transactions, revisions, idempotency and audit projections; 3D view and review controls. Browser/model approval claims have no authority.
- `services/worker/camps.ts`: scheduler, connector effects, runtime supervision and independently checked results. Web requests queue work rather than waiting for models, renders or deployments.
- `services/hermes`: pinned upstream runtime, a private supervisor, one child process per invocation, persistent per-camp/per-agent home and versioned conversation checkpoints. Only explicit cube tools and private memory are exposed. No built-in shell, filesystem editing, unbounded delegation or direct provider credentials.
- `services/sandbox` and `services/browser`: constrained execution and public research. Publication/code execution has a read-only container filesystem, temporary workspace, no external network and no credentials. Its process namespace is recycled after each job. The browser exposes only mediated public GET requests. Neither mounts the development checkout.

## State and execution

Camp mutations clone state, apply deterministic transitions and commit under a per-camp PostgreSQL advisory/row lock. State and event rows commit together. Idempotency keys return the original result. File storage is an explicit single-process development option with serialized atomic writes; it is not a hosted fallback.

Claims reserve daily reasoning budgets atomically across camps, permit two reasoning turns globally and one writer per agent, and issue a six-minute lease. External tool jobs can run while their parent Hermes turn awaits a result. Capability scope, grant expiry, camp status and configuration are checked at request, claim and execution. Publication operations also bind a source version and approved artifact digest. The model gateway reserves a bounded request allowance in camp state before provider access and records reported token usage when available.

A paused camp cancels queued work; its active agent tokens can no longer mutate state or reserve model calls. The worker cancels the corresponding Hermes invocation on its next check. Expired leases become indeterminate and are not automatically replayed. Already delivered remote effects require reconciliation, not an invented failure/success receipt.

The campsite animation projects persisted agent activities. Analysts approach the cube during external tool jobs, and social turns occupy the table area. It is a visualization of runtime activity, not evidence that work succeeded. Simulation turns, mechanical verification, and operator mission acceptance remain distinct.

## Quarto publication contract

A publication binds a repository, default branch, project directory, source files and monotonically increasing revision. The worker sends a source snapshot to the Quarto sandbox. Source references, bibliography keys, source digest and the rendered homepage are checked; the complete rendered artifact receives a digest. These mechanical checks do not prove factual accuracy.

The operator reviews the preview and approves that exact digest. Source edits and rollbacks create a new revision; rendering different bytes invalidates old approval. GitHub receives a source PR with the managed publication workflow. Before publication the worker verifies source bytes at the recorded PR head, merges that head under GitHub's protections, writes the reviewed output to an artifact branch, verifies its Git tree/blob hashes and dispatches Pages. Publication code is never re-executed in the credential-bearing deployment worker. Completion requires the expected public release marker; delayed or uncertain delivery remains indeterminate.

Reports should be concise, retain citations, distinguish evidence from inference, and use graphics or client-side interactivity only when useful. Quarto is the document and website system; GitHub provides version control and review. MCP remains a future connector boundary using these same grants, jobs and receipt verifiers.

## Preserved cyber behavior

New camp agents use Hermes, including the synthetic defender and adversary. Original utility authorizations, plan versions, rehearsal and independently checked action receipts remain in the cyber domain. Synthetic adversaries receive only the restricted observation/action view. Their contexts omit physical ground truth and the private interview. Cyber code recovery retains isolated mapping tests and the incident PR adapter.

The old dashboard/API/deployment is available separately for rollback and regression, with its detailed contract in [cyber architecture](cyber-architecture.md). Its running OpenClaw deployment was not migrated in place. New default Compose services are named `yamnaya-camps` and use independent ports and volumes.

See [camp operations](camps.md) for configuration and known limits, and [tasks](tasks.md) for the actual validation record.
