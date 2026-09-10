# Ownership and boundaries

| Owner                                    | Decision / module boundary                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security commander                       | Incident scope, accepting containment, final closure; `DEMO_SECURITY_PASSWORD` / `SLACK_SECURITY_USER_ID`                                               |
| Platform engineer and contractor sponsor | Contractor authorization context, code provenance, deployment and reserve readiness; `DEMO_PLATFORM_PASSWORD` / `SLACK_PLATFORM_USER_ID`                |
| Meter operations lead                    | Physical installation acknowledgement, asset-data repair, replay and release of held exchanges; `DEMO_OPERATIONS_PASSWORD` / `SLACK_OPERATIONS_USER_ID` |
| Yamnaya defender                         | Investigates, writes candidates, rehearses, requests human decisions, executes granted authority; cannot approve                                        |
| Bounded adversary                        | Chooses synthetic mapping deployment, stale exchange, forged support note or work-order update through existing credential permissions                  |
| Core development                         | State schemas, reducers, policy, verification and ontology stay together in `packages/core`                                                             |
| Web development                          | Authentication, bounded API, storage transactions and human UI stay in `apps/web`                                                                       |
| Runtime development                      | External effects and receipts in `services/worker`; pure code evaluation in `services/code-lab`; agent setup in `openclaw`                              |

Develop dependency-ordered vertical slices and keep each change reviewable. Any change to action semantics must update its schema, authority check, independent verification where relevant, and meaningful regression tests together. Run the targeted checks first, then the repository checks before handoff. Preserve private interview material and evaluator truth outside runtime workspaces and Docker build context.
