import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  actionSchema,
  planInputSchema,
  scenarioSchema,
  attackSchema,
  DomainError,
  advance,
  attack,
  affectedSdps,
  defenderView,
  attackerView,
  terrain,
  event,
  observe,
  confirmField,
  standaloneAction,
  createPlan,
  revisePlan,
  rehearse,
  approve,
  enqueuePlan,
  executeStep,
  getPlan,
  suggestedPlan,
  verify,
  parseSyncInput,
  addInput,
  type Actor,
  type Association,
  type EffectProof,
} from "@yamnaya/core";
import { readRun, mutateRun } from "../../../lib/store";
import {
  authenticate,
  requireActor,
  login,
  integrationStatus,
  issueBrowserTicket,
  readBrowserTicket,
  signSession,
  requestOrigin,
} from "../../../lib/auth";
import { reconcilePlan } from "@yamnaya/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
type Context = { params: Promise<{ path: string[] }> };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
async function body(request: NextRequest): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > 1100000)
    throw new DomainError("Request is too large", "INVALID_INPUT", 413);
  const text = await request.text();
  if (text.length > 1100000)
    throw new DomainError("Request is too large", "INVALID_INPUT", 413);
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}
function failure(e: unknown) {
  if (e instanceof DomainError)
    return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return json({ error: "Invalid request", details: e.message }, 400);
  console.error(
    "Yamnaya API error:",
    e instanceof Error ? e.message : "unknown",
  );
  return json(
    {
      error:
        "The backend is unavailable. Check database configuration and service logs.",
      code: "SERVICE_ERROR",
    },
    503,
  );
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const route = (await context.params).path.join("/");
    if (route === "browser/enter") {
      const ticket = readBrowserTicket(
        request.nextUrl.searchParams.get("ticket") ?? "",
      );
      await mutateRun(
        (run) => {
          if (run.idempotency[`browser-used:${ticket.nonce}`])
            throw new DomainError(
              "Browser ticket was already used",
              "FORBIDDEN",
              403,
            );
          run.idempotency[`browser-used:${ticket.nonce}`] = true;
        },
        { expectedRunId: ticket.runId },
      );
      const response = NextResponse.redirect(
        new URL("/", requestOrigin(request)),
      );
      response.cookies.set("yamnaya_session", signSession("defender"), {
        httpOnly: true,
        sameSite: "strict",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 3600,
      });
      response.headers.set("Referrer-Policy", "no-referrer");
      return response;
    }
    if (route === "session") return json({ actor: authenticate(request) });
    if (route === "health") {
      const r = await readRun();
      return json({ ok: true, runId: r.id, revision: r.revision });
    }
    if (route === "integrations") return json(integrationStatus());
    const run = await readRun();
    if (route === "red/observe") {
      requireActor(request, ["attacker"]);
      return json(attackerView(run));
    }
    if (route === "worker/state") {
      requireActor(request, ["worker"]);
      return json(run);
    }
    if (route === "state") {
      const actor = requireActor(request, [
        "defender",
        "security",
        "platform",
        "operations",
      ]);
      return json({
        ...defenderView(run),
        affected: affectedSdps(run),
        checks: verify(run),
        integrations: integrationStatus(),
        ...(actor.role !== "defender" ? { scenarioLabel: run.scenario } : {}),
        actor,
      });
    }
    if (route === "terrain") {
      requireActor(request, ["defender", "security", "platform", "operations"]);
      return json(terrain(run));
    }
    if (route === "capabilities") {
      requireActor(request, ["defender", "security", "platform", "operations"]);
      return json({
        standing: ["quarantine", "notify", "assign_field", "verify"],
        browserOnly: ["revoke_credential"],
        platformApproval: ["promote_worker", "route_reserve"],
        operationsApproval: ["repair_data", "replay", "resume"],
        securityApproval: ["close_incident"],
        pauseWorkerApproval: ["security", "platform"],
      });
    }
    if (route.startsWith("plans/")) {
      requireActor(request, ["defender", "security", "platform", "operations"]);
      return json(getPlan(run, route.split("/")[1]));
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const segments = (await context.params).path,
      route = segments.join("/");
    const input = await body(request);
    if (route === "session") {
      const parsed = z
        .object({ role: z.string(), password: z.string() })
        .parse(input);
      const token = login(parsed.role, parsed.password);
      const response = json({ ok: true });
      response.cookies.set("yamnaya_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: request.nextUrl.protocol === "https:",
        path: "/",
        maxAge: 8 * 3600,
      });
      return response;
    }
    if (route === "logout") {
      const response = json({ ok: true });
      response.cookies.delete("yamnaya_session");
      return response;
    }
    const actor = requireActor(request);
    const key = request.headers.get("idempotency-key");
    if (!key || key.length > 200)
      throw new DomainError(
        "A bounded Idempotency-Key is required",
        "INVALID_INPUT",
        400,
      );
    const expectedRunId = z.string().min(1).parse(input.runId);
    const result = await mutateRun(
      (run) => {
        const allow = (roles: Actor["role"][]) => {
          if (!roles.includes(actor.role))
            throw new DomainError(
              "This identity cannot perform the requested operation",
              "FORBIDDEN",
              403,
            );
        };
        if (route === "browser/ticket") {
          allow(["defender"]);
          const ticket = issueBrowserTicket(run.id);
          return {
            url: new URL(
              `/api/browser/enter?ticket=${encodeURIComponent(ticket)}`,
              requestOrigin(request),
            ).href,
            expiresInSeconds: 60,
          };
        }
        if (route === "agent/progress") {
          allow(["defender", "attacker"]);
          const data = z
            .object({
              summary: z.string().max(3000),
              turn: z.number().int().min(1).max(40),
            })
            .parse(input);
          event(
            run,
            "agent.turn",
            actor.id,
            actor.role === "attacker"
              ? `Bounded adversary completed turn ${data.turn}`
              : data.summary,
          );
          return { recorded: true };
        }
        if (route === "runs/reset") {
          allow(["security"]);
          return { reset: true };
        }
        if (route === "runs/stop") {
          allow(["security"]);
          run.status = "stopped";
          for (const j of run.jobs)
            if (["queued", "leased"].includes(j.status)) {
              j.status = "failed";
              j.error = "Presenter stopped execution";
            }
          event(
            run,
            "run.stopped",
            actor.id,
            "Presenter stopped agents, scheduling, and execution",
          );
          return { stopped: true };
        }
        if (route === "runs/tick") {
          allow(["security"]);
          if (run.mode === "live")
            throw new DomainError(
              "Live simulation clock is owned by the worker",
            );
          advance(run);
          return { clock: run.clock };
        }
        if (route === "runs/attack" || route === "red/action") {
          allow(route === "red/action" ? ["attacker"] : ["security"]);
          const parsed = attackSchema.parse(input.action);
          // Denied attack attempts remain in the audit even though the operation failed.
          try {
            attack(run, parsed, actor);
            return { accepted: true };
          } catch (e) {
            if (e instanceof DomainError && e.code === "ACCESS_DENIED")
              return { accepted: false, error: e.message };
            throw e;
          }
        }
        if (route === "actions") {
          allow(["defender", "security", "platform", "operations"]);
          return {
            message: standaloneAction(
              run,
              actionSchema.parse(input.action),
              actor,
            ),
          };
        }
        if (route === "access/revoke") {
          allow(["defender", "security", "platform"]);
          if (actor.channel !== "web")
            throw new DomainError(
              "Use the access administration browser",
              "FORBIDDEN",
              403,
            );
          return {
            message: standaloneAction(
              run,
              {
                kind: "revoke_credential",
                credentialId: z.string().parse(input.credentialId),
              },
              actor,
            ),
          };
        }
        if (route === "field/confirm") {
          allow(["operations"]);
          confirmField(
            run,
            z.array(z.string()).min(1).max(20).parse(input.sdpIds),
            actor,
          );
          return { confirmed: true };
        }
        if (route === "ingest") {
          allow(["operations"]);
          const data = z
            .object({
              format: z.enum(["csv", "xml"]),
              content: z.string().max(1000000),
              filename: z.string().max(120),
            })
            .parse(input);
          const groups = parseSyncInput(
            data.content,
            data.format,
            data.filename,
            run.clock,
            "trusted-field",
          );
          addInput(run, groups);
          return {
            groups: groups.length,
            errors: groups.filter((g) => g.error),
          };
        }
        if (route === "messages") {
          allow(["security", "platform", "operations"]);
          const text = z.string().min(1).max(4000).parse(input.text);
          run.chat.push({
            actor: actor.id,
            role: actor.role,
            text,
            time: run.clock,
          });
          observe(
            run,
            "stakeholder-statement",
            `Authenticated ${actor.role}`,
            text,
            [actor.id],
          );
          event(run, "message.received", actor.id, text);
          return { posted: true };
        }
        if (route === "plans") {
          allow(["defender", "security", "platform", "operations"]);
          return createPlan(run, planInputSchema.parse(input.plan), actor);
        }
        if (route === "plans/suggest") {
          allow(["security", "platform", "operations"]);
          return createPlan(
            run,
            suggestedPlan(
              run,
              z
                .enum(["containment", "recovery", "disruptive"])
                .parse(input.kind),
            ),
            actor,
          );
        }
        if (segments[0] === "plans" && segments.length === 3) {
          allow(["defender", "security", "platform", "operations"]);
          const id = segments[1];
          if (segments[2] === "revise")
            return revisePlan(
              run,
              id,
              planInputSchema.parse(input.plan),
              actor,
            );
          if (segments[2] === "rehearse") return rehearse(run, id, actor);
          if (segments[2] === "approve")
            return approve(
              run,
              id,
              z.number().int().parse(input.version),
              z.enum(["approved", "rejected"]).parse(input.decision),
              actor,
            );
          if (segments[2] === "execute") return enqueuePlan(run, id, actor);
          if (segments[2] === "reconcile") {
            allow(["security"]);
            return reconcilePlan(
              run,
              id,
              z.string().min(20).max(2000).parse(input.note),
              actor,
            );
          }
        }
        if (route === "worker/tick") {
          allow(["worker"]);
          advance(run, input.mapping as Association[] | undefined);
          return { clock: run.clock };
        }
        if (route === "worker/slack") {
          allow(["worker"]);
          const data = z
            .object({
              userId: z.string(),
              text: z.string(),
              threadTs: z.string(),
              channelId: z.string(),
            })
            .parse(input);
          if (data.channelId !== process.env.SLACK_CHANNEL_ID)
            throw new DomainError(
              "Slack channel is outside scope",
              "FORBIDDEN",
              403,
            );
          const role = (["security", "platform", "operations"] as const).find(
            (r) =>
              process.env[`SLACK_${r.toUpperCase()}_USER_ID`] === data.userId,
          );
          if (!role)
            throw new DomainError(
              "Slack user is not in the ownership register",
              "FORBIDDEN",
              403,
            );
          if (!run.slackThreadTs || data.threadTs !== run.slackThreadTs)
            throw new DomainError(
              "Message must belong to the active incident thread",
            );
          run.chat.push({
            actor: data.userId,
            role,
            text: data.text,
            time: run.clock,
          });
          observe(
            run,
            "stakeholder-statement",
            `Slack ${role}: ${data.userId}`,
            data.text,
            [role],
          );
          const match = /^(approve|reject) (PLAN-\d+) v(\d+)$/i.exec(
            data.text.trim(),
          );
          if (match)
            return approve(
              run,
              match[2].toUpperCase(),
              Number(match[3]),
              match[1].toLowerCase() === "approve" ? "approved" : "rejected",
              { id: data.userId, role, channel: "slack" },
            );
          const field = /^confirm field (SDP-\d{3}(?: SDP-\d{3})*)$/i.exec(
            data.text.trim(),
          );
          if (field) {
            confirmField(run, field[1].toUpperCase().split(" "), {
              id: data.userId,
              role,
              channel: "slack",
            });
            return { confirmed: true };
          }
          return { posted: true };
        }
        if (route === "worker/thread") {
          allow(["worker"]);
          run.slackThreadTs = z.string().parse(input.threadTs);
          return { saved: true };
        }
        if (route === "worker/claim") {
          allow(["worker"]);
          if (run.status === "stopped") return null;
          const now = Date.now();
          for (const j of run.jobs)
            if (j.status === "leased" && Date.parse(j.leaseUntil ?? "") < now) {
              j.status = "indeterminate";
              j.error =
                "Executor lease expired; reconcile external effects before retry";
              if (j.kind === "plan") {
                const p = getPlan(run, j.targetId);
                p.status = "INDETERMINATE";
                p.error = j.error;
              }
            }
          const job = run.jobs.find((j) => j.status === "queued");
          if (!job) return null;
          job.status = "leased";
          job.leaseOwner = z.string().parse(input.owner);
          job.leaseUntil = new Date(now + 120000).toISOString();
          job.attempts++;
          return {
            job,
            plan: job.kind === "plan" ? getPlan(run, job.targetId) : undefined,
            notification: run.notifications.find((n) => n.id === job.targetId),
          };
        }
        if (
          route === "worker/step" ||
          route === "worker/complete" ||
          route === "worker/fail"
        ) {
          allow(["worker"]);
          const job = run.jobs.find((j) => j.id === input.jobId);
          if (
            !job ||
            job.status !== "leased" ||
            job.leaseOwner !== input.owner ||
            Date.parse(job.leaseUntil ?? "") <= Date.now()
          )
            throw new DomainError("Executor does not hold a valid job lease");
          if (route === "worker/fail") {
            job.status = input.indeterminate ? "indeterminate" : "failed";
            job.error = z.string().parse(input.error);
            if (job.kind === "plan") {
              const p = getPlan(run, job.targetId);
              p.status = input.indeterminate ? "INDETERMINATE" : "FAILED";
              p.error = job.error;
            }
            return { failed: true };
          }
          if (route === "worker/complete") {
            job.status = "done";
            const n = run.notifications.find((n) => n.id === job.targetId);
            if (n) {
              n.status = "delivered";
              n.deliveredVia = input.slackTs ? "slack" : "internal";
              n.slackTs = input.slackTs as string | undefined;
            }
            return { completed: true };
          }
          const proof = input.proof as EffectProof | undefined;
          const p = getPlan(run, job.targetId);
          const action = p.steps[p.stepIndex];
          if (
            action?.kind === "prepare_patch" &&
            proof?.sourceDigest !==
              createHash("sha256").update(action.source).digest("hex")
          )
            throw new DomainError(
              "Patch receipt does not match the proposed source",
            );
          const plan = executeStep(run, p.id, actor, proof);
          job.leaseUntil = new Date(Date.now() + 120000).toISOString();
          if (plan.stepIndex === plan.steps.length) job.status = "done";
          return plan;
        }
        throw new DomainError("Unknown operation", "NOT_FOUND", 404);
      },
      {
        key: `${actor.id}:${route}:${key}`,
        expectedRunId,
        expectedRevision:
          route === "worker/tick"
            ? z.number().int().parse(input.expectedRevision)
            : undefined,
        reset:
          route === "runs/reset" && actor.role === "security"
            ? {
                scenario: scenarioSchema.parse(input.scenario),
                mode: z
                  .enum(["simulation", "live", "replay"])
                  .parse(input.mode),
              }
            : undefined,
      },
    );
    return json({
      runId: result.run.id,
      revision: result.run.revision,
      result: result.result,
    });
  } catch (e) {
    return failure(e);
  }
}
