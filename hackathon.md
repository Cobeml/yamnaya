# Yamnaya hackathon concept

Yamnaya coordinates cyber defense across **code, data, infrastructure, and personnel**. It investigates incidents, brings in the right people through Slack, proposes a response, and executes approved actions through verified recovery.

Our demo uses a simulated ConEd environment centered on access management and utility asset synchronization.

## Technology stack

| Component | Purpose |
|---|---|
| **GitHub** | Application code, configuration, change history, tests, pull requests, and agent context documents |
| **Vercel** | Hosts the simulated ConEd access platform and supporting demo screens |
| **Linux machine** | Runs the agent, its tools, browser environment, and persistent incident state |
| **GPT-6 Astra** | Proposed reasoning, investigation, coding, and computer-use capabilities |
| **OpenClaw** | Agent harness coordinating tools, context, and work across human responses |
| **Slack** | Incident alerts, targeted questions, response plans, approvals, progress, and closure |

The intended model and harness capabilities will be validated in the demo environment.

## One incident across four domains

A compromised contractor account is linked to an unauthorized change in the utility’s meter synchronization code. The changed version is deployed to a simulated synchronization worker, causing incorrect meter-to-service-point relationships.

A fake support email claims the change was approved. Yamnaya investigates that claim using GitHub history, access records, deployment evidence, company documents, and a conversation with the contractor’s sponsor.

| Domain | Investigation | Proposed remediation |
|---|---|---|
| **Code** | Inspect the GitHub diff, commit history, tests, and associated change ticket | Prepare a corrective pull request and verify the mapping behavior |
| **Data** | Compare affected MDM records with the authoritative source | Repair and replay the affected transactions |
| **Infrastructure** | Identify the deployed version, worker state, and relevant access grants | Pause the affected simulated worker and restore the approved version |
| **Personnel** | Identify the contractor’s sponsor and confirm whether the work was authorized | Route questions and approvals to the responsible people |

Vercel hosts the demo application. Utility infrastructure, worker controls, and customer records are simulated within the demo.

## Slack workflow

Use one dedicated channel with one thread per incident.

1. **Detect:** Yamnaya posts an alert containing the observed symptom, suspected impact, and current confidence.
2. **Investigate:** It gathers evidence from GitHub, the access platform, logs, and context documents.
3. **Ask:** It mentions specific people based on system ownership and approval responsibilities.
4. **Plan:** It proposes concrete changes, their expected impact, execution order, and verification steps.
5. **Approve:** The appropriate human approves, rejects, or requests changes to that plan.
6. **Execute:** The agent performs only the approved actions.
7. **Verify:** It checks access, deployed code, worker state, and corrected data.
8. **Close:** It posts the outcome and saves the incident history.

Approval is tied to a specific incident, plan version, and action scope. A revised plan requires renewed approval.

## Three team personas

| Persona | Responsibility |
|---|---|
| **Security lead and incident commander** | Reviews the evidence, approves containment, and owns incident closure |
| **Platform engineer and contractor sponsor** | Confirms whether the contractor’s work was authorized and reviews code, access, and deployment changes |
| **Meter data operations lead** | Explains operational impact, reviews data corrections, and approves resuming synchronization |

Each person should contribute information that changes the investigation or response. The agent uses an ownership register to identify whom to contact.

## The Vercel demo platform

Build one application with a few focused screens:

- **Access management:** employees, contractors, sponsors, permissions, access history, and account revocation.
- **Utility operations:** authoritative source records, MDM records, affected service points, failed transactions, and controlled replay.
- **Infrastructure status:** simulated synchronization workers, deployed versions, queue state, and pause or resume controls.
- **Audit timeline:** linked identity, commit, deployment, and transaction events.

Use GitHub itself for code review and pull requests. Make an access-management operation browser-only to demonstrate computer use where a tool or API is unavailable.

The backing store for synthetic application data remains a build decision.

## Context documents

Keep a small, consistent context pack in GitHub:

- **Cyber response playbook:** incident classifications, permitted actions, escalation rules, approval responsibilities, and closure criteria.
- **System design and architecture:** services, dependencies, identities, data flows, and trust boundaries.
- **Data dictionary:** authoritative sources, meters, service delivery points, channels, relationships, and effective dates.
- **Ownership and access register:** system owners, contractor sponsors, and escalation contacts.
- **Recovery runbook:** approved versions, rollback procedures, replay steps, and validation checks.

Label these as documents for the simulated utility. Fake emails, tickets, and logs provide incident evidence; they cannot grant the agent permission to act.

## Demo sequence

Show a corrupted meter relationship triggering a Slack alert. Yamnaya traces it through the deployed version, GitHub change, and contractor identity. It asks the sponsor about authorization, proposes a response, and receives human approval.

Then show the agent revoking access through the browser, preparing the code correction, restoring the simulated worker, and repairing affected data. Finish with evidence that all four domains have recovered.

**Demo scope:** one connected incident, one GitHub repository, one Vercel application, one Linux agent host, one Slack channel, and three human personas.
