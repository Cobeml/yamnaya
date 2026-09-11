# Running the camps

Yamnaya now opens on a 3D campsite. Analysts in suits represent persistent Hermes agents; horses and tents establish the setting. The black cube represents operator instructions, tool grants, and approval. Movement follows persisted job activity. A simulation turn is explicitly identified and makes no model call.

## Start

Use Node 22.19+ and pnpm 10.32.1 for host development, or Docker Compose for the complete runtime:

```bash
pnpm install --frozen-lockfile
pnpm camps:setup
pnpm camps:up
```

Open **http://localhost:3110** and use `CAMP_OPERATOR_PASSWORD` from the private `.env.camps` file. Setup preserves existing configuration. The database, Hermes profiles, and rendered artifacts use separate `yamnaya-camps` volumes.

`pnpm camps:down` stops the new stack while retaining its volumes. Run `pnpm camps:up` after changing runtime credentials or code. On hosts without pnpm, prefix commands with `npm exec --yes --package=pnpm@10.32.1 -- pnpm`.

For host UI development, stop the Docker web service first and run `pnpm camps:dev`. Host file storage is explicitly selected by `CAMP_STORAGE=file`; it supports one web process and is refused on Vercel. Docker overrides this to PostgreSQL. Use a distinct `CAMP_ENV_FILE` to keep test and development configurations separate. The worker requires reachable API, runtime, sandbox and model gateway URLs; Docker supplies these automatically.

## A research-to-publication mission

1. Create a research or general-purpose camp. Both use the same agents and scoped tools; give each camp a mission suited to its purpose. Live mode uses Hermes; Simulation records bounded turns without reasoning. Start the camp.
2. Under **Sites**, create a publication bound to an existing GitHub repository and its default branch. The project directory can place Quarto sources in a repository subfolder.
3. Under **Setup**, grant the agents the tools they need. Give the camp a concrete mission through the cube. Agents can inspect evidence, exchange internal messages, edit provisioned Quarto projects, request renders, and propose a PR.
4. Review the rendered preview and GitHub PR. Approve the current build, then publish. Publication merges the exact source PR and deploys the already-rendered artifact through GitHub Pages. Editing or restoring sources creates a new revision and invalidates the previous approval.

No GitHub repository is created automatically. Repository access, Actions, Pages and any repository environment approvals must already permit the requested operation. A configured required GitHub review is still enforced by GitHub. One Pages site exists per repository.

| Capability | Scope | Arguments |
| --- | --- | --- |
| research.search | public-web | query |
| research.fetch | public hostname or * | url |
| browser.navigate | public hostname or * | url |
| browser.snapshot | current hostname | hostname |
| browser.click | current hostname | hostname, selector |
| browser.type | current hostname | hostname, selector, text |
| code.execute | camp ID | language: python or javascript, source |
| publication.render | owner/repository | publicationId |
| github.propose | owner/repository | publicationId |
| publication.publish | owner/repository | publicationId; a current build approval is also required |
| slack.send | bound channel ID | text |

Browser actions are currently for public, unauthenticated research: GET requests only, no downloads, popup browsing, service workers, WebSockets, or form submissions. Each resource and redirect is checked against public IP ranges and granted hostnames, with DNS resolution pinned for the fetch. Cross-host resources require corresponding grants. Browser sessions expire after ten idle minutes.

## Credentials and resources

- `CAMP_MODEL_API_KEY`, `CAMP_MODEL_BASE_URL`, `CAMP_MODEL`, `CAMP_MODEL_API_MODE`: an OpenAI-compatible provider. Default transport is `chat_completions`; the gateway also exposes Responses. Provider compatibility beyond the tested fixture must be verified with the configured model.
- `CAMP_GITHUB_TOKEN`: access to contents, pull requests, workflows/Actions and Pages on provisioned repositories. The worker creates a source branch, a PR, and an artifact branch. It never pushes into this checkout.
- `CAMP_SLACK_BOT_TOKEN`, `CAMP_SLACK_APP_TOKEN`, `CAMP_SLACK_OPERATOR_IDS`: Socket Mode and a comma-separated allowlist of operator user IDs. Bind each camp to a channel and existing thread under Setup. Bot access needs message writing and thread history scopes. Unbound threads and other users cannot instruct the camp.
- `CAMP_SEARCH_URL`: an optional SearXNG server permitting JSON search. Direct fetch works independently. No search service or paid search subscription is created.
- `CAMP_PREVIEW_URL`: a separate preview origin, default `http://127.0.0.1:4112`. Preview URLs are signed bearer links; keep them private when their content is private. Rotate `CAMP_PREVIEW_SECRET` to invalidate existing links.

Secrets live in the worker environment. Hermes children receive only a short-lived, camp-and-job-bound token; the model gateway holds the provider key. New containers do not mount the development checkout or Docker socket.

## Camp life, training and lineage

The scheduler supports a bounded social turn every fifteen minutes and an optional publication-review interval. Defaults are 40 mission turns and four social turns per UTC day, two simultaneous reasoning turns globally, one reasoning writer per agent, twelve Hermes iterations and at most 24 provider requests per invocation. Each request caps output at 4,096 tokens. These are consumption bounds, not a promised dollar budget.

Training is an actual Hermes exercise when credentials are configured. Agents propose reusable procedures. Structural checks flag missing verification and obvious authority/credential problems; the operator reviews and promotes a candidate into an immutable configuration version. Those checks do not establish measured skill improvement. Old configurations remain selectable.

Deriving an agent combines one or two selected active configurations and their approved skills, records parent references, and creates an apprentice. It does not inherit private conversation history or explicit agent grants. A camp-wide wildcard grant applies to new members of that camp. Cloning a camp copies configurations into a paused camp with no copied grants or publications. Private Hermes memory persists per camp and agent.

## Failures and recovery

Pausing cancels queued jobs and denies new agent actions and model reservations. Running Hermes invocations are cancelled when the worker next checks their leases. A remote effect already delivered cannot be undone by pausing.

Leases expire after six minutes. An interrupted effect becomes indeterminate and is not automatically retried. Inspect the camp journal, the corresponding GitHub branch/PR/Pages release or Slack thread, and the Hermes invocation journal before issuing new work. PR and artifact branches are reconciled by deterministic names and byte checks; Slack sends must not be blindly repeated. There is no universal retry button for an uncertain external effect.

Hermes invocation journals and per-configuration conversation checkpoints live in the private `camp-hermes` volume. Artifacts are bound to source and output digests in `camp-artifacts`; no publication code runs with GitHub credentials. Quarto runs on an internal Docker network, with a read-only root filesystem, temporary job files, CPU/memory/process limits and no provider secrets. The entire sandbox container is recycled after each job to remove detached descendants; sandbox jobs are serialized. HTML previews are served on the separate origin under a restrictive sandbox CSP. Sites can contain client-side JavaScript; externally hosted libraries are blocked in previews, so prefer bundled assets.

## Extension boundary

Future MCP servers belong behind the same worker capability interface: declare a tool schema, resource scope, standing-grant policy, idempotency strategy and independent receipt verifier. A model discovering a tool must not implicitly receive permission to call it. MCP is an extension contract in this version, not an enabled connector.

Further useful integrations include scholarly metadata/search, public dataset/object storage, and read-only issue trackers through this same boundary.
