# Data dictionary

| Entity              | Meaning and authority                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Service point (SDP) | Stable fictional premise/customer delivery location; owns effective-dated meter associations                                  |
| Meter               | MRID, serial, installation status and read channels; separate from the location                                               |
| Association         | `meterId`, `sdpId`, UTC `from`, nullable `to`; replacement closes the outgoing link and opens the incoming link               |
| SOR                 | Collapsed utility source snapshot; authoritative expected asset relationship                                                  |
| MDM                 | Derived operator-facing relationship store; deliberately corruptible through the simulated mapper                             |
| Cache               | Active meter IDs per SDP; must match repaired MDM after invalidation                                                          |
| Physical            | Evaluator-only installed-meter relationships; exposed as trusted field evidence only after operations acknowledgement         |
| Sync request        | Message ID, source/verb, SDP, meter/outgoing meter, effective/received times, credential and optional manual read             |
| Transaction         | Request, status, mapping artifact/worker provenance, attempted stages, history and exception                                  |
| Credential          | Synthetic identity capability; `leakProven` requires a trusted exact-fingerprint observation for standing revocation          |
| Worker              | Artifact, identity, configuration, availability, validation and execution status; reserve dependencies are explicitly checked |
| Artifact            | Mapping source, SHA-256, commit reference, test/fixture label and optional real GitHub PR                                     |
| Person              | Owner role and sponsor relationship; IDs `security`, `platform`, `operations`, `contractor`                                   |
| Work order          | Exchange or field-verification assignment; only the operations actor can acknowledge trusted field verification               |
| Observation         | Source, affected resources, observed/inferred/simulation status, and trusted-content flag                                     |
| Plan                | Evidence, rationale, ordered actions, alternatives, version, threat version, rehearsal, required roles and step cursor        |
| Approval            | Authenticated human actor, role, exact plan/version, decision, wall-clock expiry (15 minutes)                                 |
| Job / receipt       | Leased executor work, idempotent action key, result and external evidence                                                     |

The graph derives ownership, sponsorship, credential access, deployment, source-to-derived state, meter installation, and recovery dependencies from these objects. It is an operational projection of the Yamnaya ontology rather than a generic inventory graph.

CSV headers are case-sensitive. Required inputs are `sdpId,meterId,effectiveAt`; exchanges also need `oldMeterId`. Optional headers include `messageId,source,verb,timezone,manualRead`. XML uses the same field names inside each `Record`. Consecutive records with the same SDP form an input-validation group. Invalid groups generate exceptions; duplicate message IDs do not write twice. UTC or explicit offsets are preferred; ambiguous/nonexistent local DST times are rejected.

Bulk AMI traffic is represented separately as throughput. Manual reads can travel in sync requests, but the MVP does not implement billing, VEE, interval storage, or power calculations.
