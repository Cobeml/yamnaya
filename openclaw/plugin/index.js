import { randomUUID } from "node:crypto";
const object = (properties) => ({
  type: "object",
  properties,
  additionalProperties: false,
});
const string = { type: "string" };
export default {
  id: "yamnaya",
  name: "Yamnaya mission tools",
  register(api) {
    const role = process.env.YAMNAYA_AGENT_ROLE ?? "defender";
    const token = process.env[`${role.toUpperCase()}_TOKEN`];
    const base = process.env.YAMNAYA_URL;
    async function call(route, payload) {
      const response = await fetch(`${base}/api/${route}`, {
        method: payload ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(30000),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? `HTTP ${response.status}`);
      return value;
    }
    function tool(name, description, parameters, execute) {
      api.registerTool({
        name,
        description,
        parameters,
        async execute(_id, input) {
          try {
            const result = await execute(input);
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
            };
          } catch (e) {
            return {
              content: [
                { type: "text", text: JSON.stringify({ error: String(e) }) },
              ],
              isError: true,
            };
          }
        },
      });
    }
    if (role === "attacker") {
      tool(
        "yamnaya_red_observe",
        "Observe only the contractor-accessible synthetic attack surface. No defender plans or ground truth.",
        object({}),
        () => call("red/observe"),
      );
      tool(
        "yamnaya_red_action",
        "Perform one bounded synthetic adversary action. action_json encodes deploy_mapping (credentialId, variant wrong-sdp), submit_stale_exchange (credentialId, sdpId), forge_support (credentialId, text), or alter_work_order (credentialId, workOrderId). Include kind. The server enforces current permissions and a 12-action limit.",
        object({ run_id: string, action_json: string }),
        (p) =>
          call("red/action", {
            runId: p.run_id,
            action: JSON.parse(p.action_json),
          }),
      );
      return;
    }
    tool(
      "yamnaya_observe",
      "Read current incident state and source evidence, the operational ontology, or the capability catalog.",
      object({
        resource: {
          type: "string",
          enum: ["state", "terrain", "capabilities"],
        },
      }),
      (p) => call(p.resource ?? "state"),
    );
    tool(
      "yamnaya_standing_action",
      "Standing authority permits observed-scope quarantine, targeted notification, field-verification assignment, and independent verification. Credential revocation uses the browser. This tool cannot grant approvals.",
      object({ run_id: string, action_json: string }),
      (p) =>
        call("actions", { runId: p.run_id, action: JSON.parse(p.action_json) }),
    );
    tool(
      "yamnaya_plan",
      "Create, revise, rehearse, inspect, or execute a maneuver. plan_json contains title, rationale, evidenceIds, steps, alternatives. The backend checks prerequisites and human approvals. You cannot approve your plan.",
      object({
        run_id: string,
        operation: {
          type: "string",
          enum: ["create", "revise", "rehearse", "inspect", "execute"],
        },
        plan_id: string,
        plan_json: string,
      }),
      (p) => {
        if (p.operation === "inspect") return call(`plans/${p.plan_id}`);
        if (p.operation === "create")
          return call("plans", {
            runId: p.run_id,
            plan: JSON.parse(p.plan_json),
          });
        return call(`plans/${p.plan_id}/${p.operation}`, {
          runId: p.run_id,
          ...(p.operation === "revise"
            ? { plan: JSON.parse(p.plan_json) }
            : {}),
        });
      },
    );
    tool(
      "yamnaya_admin_browser",
      "Issue a one-use, short-lived sign-in link for the Yamnaya browser operator. Open its URL with the browser, then use Access & identity to revoke a proven leaked credential.",
      object({ run_id: string }),
      (p) => call("browser/ticket", { runId: p.run_id }),
    );
  },
};
