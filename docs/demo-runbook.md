# Demo runbook

## Simulation walkthrough (no external credentials)

1. Start the local stack from the README and sign in as **Incident commander**. Reset to the contractor scenario in Simulation mode. Select **Inject incident**. Within a few worker ticks, three service points disagree with the source of record. The Data pipeline view shows the compromised source and transaction lineage.
2. Open **Access & identity** and revoke the contractor credential with the exact leak fingerprint. The access probe confirms denial; authorized operator access remains active.
3. Open **Response room**. Select **Compare shutdown**, then **Rehearse** on that candidate. It is blocked because pausing the primary without a validated alternative interrupts unaffected work.
4. Select **Prepare containment**, rehearse that plan and execute it. The executor quarantines affected relationships, holds exchanges, assigns field verification and notifies owners. The rest of the segment and bulk AMI feed continue.
5. Sign in as **Meter operations lead**. In **Physical assets**, acknowledge each assigned field installation. In the response room, explain the installation evidence. The platform persona can separately confirm that the contractor deployment was unauthorized.
6. Select **Prepare recovery** and rehearse it. Sign in as each required role to approve the exact candidate: operations, platform and security. Execute it. The real worker compiles/tests a corrective mapper in the code lab, promotes the tested artifact, repairs source-aligned relationships/cache, reconciles pending messages, releases held work, and runs independent checks.
7. Show the verified mission, action receipts, surviving operator access, restored relationships, physical acknowledgements and continued healthy throughput. The corrective source and isolated test receipt are retained even when GitHub is unconfigured.

The candidate buttons are a manual demonstration and test aid. They do not invoke Astra. In live mode the defender writes its own plan via the plugin; it cannot use the manual-candidate endpoint or approve its plan.

## Live rehearsal

Complete [deployment configuration](deployment.md) and run `pnpm preflight --live --check-model`. Start the agent profile, then reset to a **Live** contractor run. The bounded attacker initiates and adapts; do not inject a scripted action unless you intend to label the run as operator-steered.

The defender investigates evidence and can use standing containment immediately. The browser operator uses its one-use ticket to revoke exposed access. Human personas answer in the current Slack incident thread. Approve with `approve PLAN-3 v1`, substituting the actual plan/version. Operations can acknowledge assigned installations with `confirm field SDP-001 SDP-002 SDP-003`, or use the dashboard. A free-text assertion alone does not approve a plan or confirm field work.

When the defender waits for people, add the required evidence or decision and let the persisted driver resume. A revised plan needs fresh approvals. The code step must retain a real corrective PR link in live mode. Do not call a run recovered until its mission status is verified and every independent check passes.

## Variants and evidence

The scenario selector supports a stale-exchange pivot, unavailable reserve, reserve with shared dependencies, legitimate maintenance, and forged support context. `pnpm scenario --scenario=pivot` stages a deterministic simulation incident. `pnpm evaluate` runs all six fixture cases and writes the report.

Record scenario, mode, run ID, runtime/model identity, approvals, selected alternatives, action receipts, healthy throughput and failures. A screenshot or model narration alone is not recovery evidence. Keep fixture results distinct from live trials.

Use **Stop** to reject further attacker actions and executor steps. A stop cannot undo an external PR or Slack message already sent; inspect the receipts. Reset creates a fresh synthetic run while PostgreSQL retains previous run records.
