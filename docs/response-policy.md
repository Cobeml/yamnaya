# Response authority

| Action                           | Required authority and prerequisites                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Revoke credential                | Standing authority with trusted proof of the exact leaked credential; defender must use the admin browser; negative access probe follows |
| Quarantine                       | Standing authority, limited to observed affected SDPs                                                                                    |
| Notify / assign field / verify   | Standing authority; registered recipient or valid asset scope                                                                            |
| Prepare corrective patch         | Rehearsed plan and isolated test receipt; real GitHub PR required in live mode                                                           |
| Promote artifact / route reserve | Platform approval; tested/trusted artifact, available worker and independent reserve identity/configuration                              |
| Pause worker                     | Security and platform approval; another trusted validated running path must already exist                                                |
| Repair / replay / resume         | Operations approval; trusted execution, quarantined scope and field acknowledgement; repair precedes replay and resumption               |
| Close incident                   | Security approval and all independent mission checks passing                                                                             |

Approvals expire after 15 wall-clock minutes and bind to a plan version and threat version. Rehearsal clears previous approvals. Plan revisions and new attacker actions require renewed authorization. The executor checks remaining-step authority before every effect.

The three human personas use distinct web passwords or distinct allowlisted Slack user IDs. Slack approval syntax is exactly `approve PLAN-3 v1` or `reject PLAN-3 v1` inside the current incident thread. The backend obtains the role from authenticated identity. Support notes, contractor assertions, model text, and copied approval phrases from unregistered users cannot grant authority.

Standing actions and approvals are separate mechanisms. A successful containment receipt does not mean the incident is closed. The mission closes only after access, code, data, physical acknowledgement, queue disposition, and unaffected processing checks all pass.

Operations can acknowledge an assigned field check in the dashboard or send `confirm field SDP-001 SDP-002 SDP-003` in the active Slack incident thread. The backend checks the mapped operations identity; this is a separate action from approving a recovery plan.
