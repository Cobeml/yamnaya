import {
  suppressContact,
  contactSuppressed,
} from "../../../../lib/camp-suppression";
import { checkOutbound } from "@yamnaya/core";
import {
  readBoard,
  postBoard,
  sharedLibrary,
} from "../../../../lib/camp-boards";
import {
  addSourceDossier,
  addConnection,
  startWorkflow,
  advanceWorkflow,
  submitWorkflow,
  resumeWorkflow,
  addVenue,
  draftOutbound,
  approveOutbound,
  suppressDestination,
  recordInfluence,
  recordEvaluation,
  addEvaluationExample,
  culturalResources,
} from "@yamnaya/core";
import { relayCampRequest } from "../../../../lib/camp-relay";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  DomainError,
  requestImage,
  importImage,
  cancelImage,
  campView,
  requireCampActor,
  requireCampOperator,
  setCampStatus,
  instructCamp,
  addMission,
  addGrant,
  revokeGrant,
  createPublication,
  editPublication,
  approvePublication,
  requestCampTool,
  addSkillCandidate,
  evaluateSkillCandidate,
  promoteSkillCandidate,
  breedAgent,
  playCampGame,
  queueCampTurn,
  campEvent,
  requireCampLease,
  checkCampJob,
  completeCampJob,
  type Camp,
  type CampActor,
} from "@yamnaya/core";
import {
  listCamps,
  readCamp,
  insertCamp,
  mutateCamp,
  claimNextCampJob,
} from "../../../../lib/camp-store";
import {
  campActor,
  campLogin,
  signCampToken,
  verifyCampToken,
  requireWorker,
  requireOperator,
} from "../../../../lib/camp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Context = { params: Promise<{ path?: string[] }> };
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
async function body(req: NextRequest): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  if (reader)
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1000000) {
        await reader.cancel();
        throw new DomainError("Request exceeds 1 MB", "INVALID_INPUT", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
  text += decoder.decode();
  return z.record(z.string(), z.unknown()).parse(text ? JSON.parse(text) : {});
}
function failure(e: unknown) {
  if (e instanceof DomainError)
    return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return json(
      {
        error: "Invalid request",
        details:
          e instanceof z.ZodError
            ? e.issues.map((i) => i.message).join("; ")
            : "Invalid JSON",
      },
      400,
    );
  console.error("Camp request failed", e instanceof Error ? e.name : "unknown");
  return json(
    { error: "Camp service unavailable", code: "SERVICE_ERROR" },
    503,
  );
}
async function activeActor(req: NextRequest, camp: Camp) {
  const actor = campActor(req);
  requireCampActor(camp, actor);
  if (actor.kind === "agent") {
    const token = verifyCampToken(
      req.headers.get("authorization")!.replace(/^Bearer /, ""),
    );
    const j = camp.jobs.find((j) => j.id === token?.jobId);
    if (
      !j ||
      j.status !== "leased" ||
      j.agentId !== actor.agentId ||
      camp.status !== "running" ||
      Date.parse(j.leaseUntil ?? "") <= Date.now()
    )
      throw new DomainError(
        "Agent invocation is no longer active",
        "FORBIDDEN",
        403,
      );
  }
  return actor;
}

export async function GET(req: NextRequest, context: Context) {
  const relayed = await relayCampRequest(req);
  if (relayed) return relayed;
  try {
    const parts = (await context.params).path ?? [];
    if (parts[0] === "session") {
      try {
        return json({ actor: campActor(req) });
      } catch {
        return json({ actor: null });
      }
    }
    if (parts[0] === "health")
      return json({
        ok: true,
        runtime: "hermes",
        storage: process.env.CAMP_STORAGE === "file" ? "file" : "postgres",
        configured: !!(
          process.env.CAMP_OPERATOR_PASSWORD &&
          (process.env.CAMP_DATABASE_URL || process.env.CAMP_STORAGE === "file")
        ),
      });
    if (parts[0] === "configuration") {
      requireOperator(req);
      return json({
        storage: "local PostgreSQL",
        migration: process.env.CAMP_NEON_MIGRATION ?? "not recorded",
        gemini: {
          key: !!process.env.CAMP_GEMINI_API_KEY,
          confirmed: process.env.CAMP_GEMINI_FREE_TIER === "true",
          monthlyUsd: Number(process.env.CAMP_GEMINI_MONTHLY_USD ?? 0),
          rpm: Number(process.env.CAMP_GEMINI_RPM ?? 0),
          tpm: Number(process.env.CAMP_GEMINI_TPM ?? 0),
          rpd: Number(process.env.CAMP_GEMINI_RPD ?? 0),
        },
        gmailSender: process.env.CAMP_GMAIL_SENDER ?? null,
        gmail: !!(
          process.env.CAMP_GMAIL_CLIENT_ID &&
          process.env.CAMP_GMAIL_CLIENT_SECRET &&
          process.env.CAMP_GMAIL_REFRESH_TOKEN &&
          process.env.CAMP_GMAIL_SENDER
        ),
        github: !!process.env.CAMP_GITHUB_TOKEN,
        slack: !!(
          process.env.CAMP_SLACK_BOT_TOKEN && process.env.CAMP_SLACK_APP_TOKEN
        ),
      });
    }
    if (!parts.length) {
      const actor = requireOperator(req);
      return json({
        camps: (await listCamps())
          .filter((c) => c.ownerId === actor.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
            status: c.status,
            mode: c.mode,
            agents: c.agents.length,
            updatedAt: c.updatedAt,
          })),
      });
    }
    if (parts[0] === "worker") {
      requireWorker(req);
      return json({ camps: await listCamps() });
    }
    const camp = await readCamp(parts[0]);
    const actor = await activeActor(req, camp);
    if (parts[1] === "revision") return json({ revision: camp.revision });
    if (parts[1] === "board") return json({ threads: await readBoard(camp) });
    if (parts[1] === "library")
      return json({ publications: await sharedLibrary(camp) });
    if (parts[1] === "cultural") return json(culturalResources(camp, actor));
    if (parts[1] === "resources") {
      const query = req.nextUrl.searchParams;
      if (query.get("resource") === "evidence") {
        const evidence = camp.evidence.find((e) => e.id === query.get("id"));
        if (!evidence)
          throw new DomainError("Source not found", "NOT_FOUND", 404);
        return json(evidence);
      }
      const publication = camp.publications.find(
        (p) => p.id === query.get("id"),
      );
      if (!publication)
        throw new DomainError("Publication not found", "NOT_FOUND", 404);
      const name = query.get("file") ?? "index.qmd";
      if (!Object.hasOwn(publication.files, name))
        throw new DomainError("Source file not found", "NOT_FOUND", 404);
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .parse(query.get("offset") ?? 0);
      const text = publication.files[name];
      return json({
        id: publication.id,
        version: publication.version,
        file: name,
        text: text.slice(offset, offset + 16000),
        offset,
        nextOffset: offset + 16000 < text.length ? offset + 16000 : null,
      });
    }
    if (parts[1] === "events") {
      const after = Number(req.nextUrl.searchParams.get("after") ?? 0);
      return json({
        revision: camp.revision,
        events: camp.events.filter((e) => e.sequence > after).slice(0, 200),
      });
    }
    if (parts[1] === "jobs" && parts[2]) {
      const job = camp.jobs.find((j) => j.id === parts[2]);
      if (!job || (actor.kind === "agent" && actor.agentId !== job.agentId))
        throw new DomainError("Job not found", "NOT_FOUND", 404);
      return json(job);
    }
    return json(campView(camp, actor));
  } catch (e) {
    return failure(e);
  }
}

export async function POST(req: NextRequest, context: Context) {
  const relayed = await relayCampRequest(req);
  if (relayed) return relayed;
  try {
    const parts = (await context.params).path ?? [];
    const input = await body(req);
    const now = new Date().toISOString();
    if (parts[0] === "session") {
      const response = json({ ok: true });
      response.cookies.set(
        "yamnaya_camp_session",
        campLogin(z.string().parse(input.password)),
        {
          httpOnly: true,
          sameSite: "strict",
          secure: req.nextUrl.protocol === "https:",
          path: "/",
          maxAge: 8 * 3600,
        },
      );
      return response;
    }
    if (parts[0] === "logout") {
      requireOperator(req);
      const response = json({ ok: true });
      response.cookies.delete("yamnaya_camp_session");
      return response;
    }
    if (!parts.length) {
      const actor = requireOperator(req);
      return json(await insertCamp(input, actor.id), 201);
    }
    if (parts[0] === "worker" && parts[1] === "claim") {
      requireWorker(req);
      const owner = z.string().min(3).max(120).parse(input.owner);
      const result = await claimNextCampJob(owner);
      if (!result) return json({ work: null });
      const { camp, job } = result;
      const token = signCampToken({
        id: job.agentId,
        kind: "agent",
        campId: camp.id,
        agentId: job.agentId,
        jobId: job.id,
        exp: Date.now() + 360000,
      });
      return json({ work: { camp, job, token } });
    }
    const id = parts[0];
    const current = await readCamp(id);
    const actor = await activeActor(req, current);
    const operation = parts.slice(1).join("/");
    if (
      operation === "status" &&
      input.status === "archived" &&
      current.cultural
    ) {
      requireCampOperator(current, actor);
      await archiveCampThreads(current);
    }
    if (operation === "cultural/suppress") {
      requireCampOperator(current, actor);
      await suppressContact(
        current.ownerId,
        z.string().min(3).max(2000).parse(input.destination),
      );
    }
    const blockedDestinations = new Set<string>();
    if (operation === "worker/outbound-claim") {
      requireWorker(req);
      for (const o of current.cultural?.outbox ?? [])
        if (
          o.status === "approved" &&
          (await contactSuppressed(current.ownerId, o.destination))
        )
          blockedDestinations.add(o.destination);
    }
    if (operation === "board")
      return json(await postBoard(current, actor, input));
    if (
      operation === "worker/check" ||
      (operation === "worker/model-reserve" && input.inspect === true)
    ) {
      requireWorker(req);
      const job =
        operation === "worker/check"
          ? requireCampLease(
              current,
              String(input.jobId),
              String(input.owner),
              now,
            )
          : current.jobs.find(
              (j) =>
                j.id === input.jobId &&
                j.agentId === input.agentId &&
                j.kind !== "tool" &&
                j.status === "leased" &&
                Date.parse(j.leaseUntil ?? "") > Date.now(),
            );
      if (!job)
        throw new DomainError(
          "Active model invocation required",
          "FORBIDDEN",
          403,
        );
      checkCampJob(current, job, now);
      if (operation === "worker/check") return json(job);
      const agent = current.agents.find((a) => a.id === job.agentId)!;
      return json({
        cultural: !!current.cultural,
        training: job.kind === "training",
        profile: agent.configurations.find((c) => c.id === job.configurationId)
          ?.modelProfile,
      });
    }
    if (operation === "worker/outbound-claim") {
      requireWorker(req);
      if (
        current.status !== "running" ||
        current.mode !== "live" ||
        !current.cultural?.outbox.some(
          (o) =>
            o.status === "approved" &&
            ((o.channel === "gmail" && input.gmail === true) ||
              (o.channel === "forum" && o.postedUrl)),
        )
      )
        return json({ draft: null });
    }

    if (operation === "clone") {
      requireCampOperator(current, actor);
      const cloned = await insertCamp(
        {
          name: input.name ?? `${current.name} II`,
          domain: current.domain,
          mode: current.mode,
        },
        actor.id,
      );
      return json(
        (
          await mutateCamp(cloned.id, (camp) => {
            camp.agents = structuredClone(current.agents).map((a) => ({
              ...a,
              activity: "idle",
              turns: 0,
              lastSummary: undefined,
            }));
            campEvent(
              camp,
              "camp.cloned",
              `Configurations copied from ${current.name}; resources and authority must be provisioned.`,
              actor.id,
              now,
            );
            return camp;
          })
        ).result,
      );
    }
    const key = req.headers.get("idempotency-key");
    const result = await mutateCamp(
      id,
      (camp) => {
        requireCampActor(camp, actor);
        if (actor.kind === "agent") {
          const token = verifyCampToken(
            req.headers.get("authorization")!.replace(/^Bearer /, ""),
          );
          const job = camp.jobs.find((j) => j.id === token?.jobId);
          if (
            !job ||
            job.status !== "leased" ||
            job.agentId !== actor.agentId ||
            camp.status !== "running" ||
            Date.parse(job.leaseUntil ?? "") <= Date.now()
          )
            throw new DomainError(
              "Agent invocation is no longer active",
              "FORBIDDEN",
              403,
            );
        }
        if (operation === "cultural/sources")
          return addSourceDossier(camp, input, actor, now);
        if (operation === "cultural/connections")
          return addConnection(camp, input, actor, now);
        if (operation === "cultural/workflow")
          return startWorkflow(camp, String(input.publicationId), actor, now);
        if (operation === "cultural/submit")
          return submitWorkflow(camp, input, actor, now);
        if (operation === "cultural/resume") {
          resumeWorkflow(camp, String(input.id), actor, now);
          return { ok: true };
        }
        if (operation === "cultural/venues")
          return addVenue(camp, input, actor, now);
        if (operation === "cultural/outbound") {
          const draft = draftOutbound(camp, input, actor, now);
          if (draft.channel === "gmail")
            draft.sender = process.env.CAMP_GMAIL_SENDER;
          return draft;
        }
        if (operation === "cultural/approve") {
          const o = camp.cultural?.outbox.find((o) => o.id === input.id);
          if (
            o?.channel === "gmail" &&
            (!o.sender ||
              o.sender !==
                z.string().email().parse(process.env.CAMP_GMAIL_SENDER))
          )
            throw new DomainError(
              "Sender changed or missing; create a new draft to review the exact sender",
            );
          return approveOutbound(camp, String(input.id), actor, now);
        }
        if (operation === "cultural/forum-receipt") {
          requireCampOperator(camp, actor);
          const o = camp.cultural?.outbox.find((o) => o.id === input.id);
          if (!o || o.channel !== "forum" || o.status !== "approved")
            throw new DomainError("Approved forum draft required");
          checkOutbound(camp, o);
          const url = z.string().url().parse(input.url);
          if (new URL(url).hostname !== new URL(o.destination).hostname)
            throw new DomainError("Use the approved forum hostname");
          o.postedUrl = url;
          return o;
        }
        if (operation === "worker/outbound-claim") {
          requireWorker(req);
          if (camp.mode !== "live" || camp.status !== "running")
            return { draft: null };
          for (const draft of camp.cultural?.outbox ?? [])
            if (
              blockedDestinations.has(draft.destination) &&
              draft.status === "approved"
            ) {
              draft.status = "cancelled";
              campEvent(
                camp,
                "outbound.cancelled",
                "Destination suppressed across camps",
                "worker",
                now,
                [draft.id],
              );
            }
          const o = camp.cultural?.outbox.find(
            (o) =>
              o.status === "approved" &&
              ((o.channel === "gmail" && input.gmail === true) ||
                (o.channel === "forum" && o.postedUrl)),
          );
          if (!o) return { draft: null };
          checkOutbound(camp, o);
          o.status = "sending";
          o.attemptedAt = now;
          campEvent(camp, "outbound.started", o.subject, "worker", now, [o.id]);
          return { draft: o };
        }
        if (operation === "worker/outbound-result") {
          requireWorker(req);
          const o = camp.cultural?.outbox.find((o) => o.id === input.id);
          if (!o || o.status !== "sending")
            throw new DomainError("Delivery is not in progress");
          o.status = input.ok === true ? "sent" : "indeterminate";
          o.receipt = {
            ref: z
              .string()
              .max(2000)
              .parse(input.ref ?? ""),
            detail: z.string().max(2000).parse(input.detail),
            at: now,
          };
          campEvent(
            camp,
            "outbound." + o.status,
            o.receipt.detail,
            "worker",
            now,
            [o.id],
          );
          return o;
        }
        if (operation === "cultural/suppress") {
          suppressDestination(camp, String(input.destination), actor, now);
          return { ok: true };
        }
        if (operation === "cultural/influence")
          return recordInfluence(camp, input, actor, now);
        if (operation === "cultural/examples/review") {
          requireCampOperator(camp, actor);
          const e = camp.cultural?.examples.find((e) => e.id === input.id);
          if (!e) throw new DomainError("Example not found");
          e.prompt = z.string().min(3).max(6000).parse(input.prompt);
          e.expected = z.string().min(3).max(6000).parse(input.expected);
          e.reviewed = true;
          campEvent(
            camp,
            "example.reviewed",
            "Evaluation example reviewed",
            actor.id,
            now,
            [e.id],
          );
          return e;
        }
        if (operation === "cultural/examples")
          return addEvaluationExample(camp, input, actor, now);
        if (operation === "cultural/evaluations")
          return recordEvaluation(camp, input, actor, now);
        if (operation === "status") {
          setCampStatus(
            camp,
            z.enum(["running", "paused", "archived"]).parse(input.status),
            actor,
            now,
          );
          return { status: camp.status };
        }
        if (operation === "instructions")
          return instructCamp(camp, input, actor, now);
        if (operation === "missions")
          return addMission(
            camp,
            z.string().parse(input.objective),
            actor,
            now,
          );
        if (operation === "missions/accept") {
          requireCampOperator(camp, actor);
          const m = camp.missions.find((m) => m.id === input.id);
          if (!m) throw new DomainError("Mission not found", "NOT_FOUND", 404);
          m.status = "accepted";
          m.acceptedBy = actor.id;
          campEvent(camp, "mission.accepted", m.objective, actor.id, now, [
            m.id,
          ]);
          return m;
        }
        if (operation === "grants") return addGrant(camp, input, actor, now);
        if (operation === "grants/revoke") {
          revokeGrant(camp, z.string().parse(input.id), actor, now);
          return { ok: true };
        }
        if (operation === "images/request")
          return requestImage(camp, input, actor, now);
        if (operation === "images/import")
          return importImage(camp, input, actor, now);
        if (operation === "images/cancel") {
          cancelImage(camp, String(input.id), actor, now);
          return { ok: true };
        }
        if (operation === "publications")
          return createPublication(camp, input, actor, now);
        if (operation === "publications/edit")
          return editPublication(
            camp,
            z.string().parse(input.id),
            input.files,
            z.number().int().parse(input.version),
            actor,
            now,
          );
        if (operation === "publications/approve")
          return approvePublication(
            camp,
            z.string().parse(input.id),
            z.number().int().parse(input.version),
            actor,
            now,
          );
        if (operation === "publications/rollback") {
          requireCampOperator(camp, actor);
          const p = camp.publications.find((p) => p.id === input.id);
          const snapshot = p?.history.find((h) => h.version === input.version);
          if (!p || !snapshot)
            throw new DomainError("Revision not found", "NOT_FOUND", 404);
          const files = snapshot.files;
          p.history.push({
            version: p.version,
            files: { ...p.files },
            at: now,
          });
          p.files = { ...files };
          p.version++;
          p.status = "draft";
          delete p.build;
          delete p.approval;
          delete p.pullRequest;
          campEvent(
            camp,
            "publication.restored",
            `Restored revision ${snapshot.version} as ${p.version}`,
            actor.id,
            now,
            [p.id],
          );
          return p;
        }
        if (operation === "tools")
          return requestCampTool(camp, input, actor, now);
        if (operation === "skills")
          return addSkillCandidate(
            camp,
            z.string().parse(input.agentId ?? actor.agentId),
            z.string().parse(input.name),
            z.string().parse(input.content),
            actor,
            now,
          );
        if (operation === "skills/evaluate")
          return evaluateSkillCandidate(
            camp,
            z.string().parse(input.id),
            actor,
            now,
          );
        if (operation === "skills/promote") {
          promoteSkillCandidate(camp, z.string().parse(input.id), actor, now);
          return { ok: true };
        }
        if (operation === "agents/breed")
          return breedAgent(
            camp,
            z.array(z.string()).parse(input.parentIds),
            z.string().parse(input.name),
            actor,
            now,
          );
        if (operation === "agents/configuration") {
          requireCampOperator(camp, actor);
          const a = camp.agents.find((a) => a.id === input.agentId);
          if (
            !a ||
            !a.configurations.some((v) => v.id === input.configurationId)
          )
            throw new DomainError("Configuration not found", "NOT_FOUND", 404);
          if (
            camp.jobs.some((j) => j.agentId === a.id && j.status === "leased")
          )
            throw new DomainError("Wait for the active turn", "CONFLICT", 409);
          a.configurationId = String(input.configurationId);
          campEvent(
            camp,
            "agent.configuration",
            `${a.name}: configuration restored`,
            actor.id,
            now,
          );
          return a;
        }
        if (operation === "agents/train") {
          requireCampOperator(camp, actor);
          return queueCampTurn(
            camp,
            z.string().parse(input.agentId),
            `Training exercise: ${z.string().max(6000).parse(input.exercise)}. Work through the exercise, verify your outcome, and propose a reusable skill with the camp skill tool. Do not claim measured improvement from structural checks alone.`,
            "training",
            now,
          );
        }
        if (operation === "game") {
          playCampGame(camp, z.number().int().parse(input.cell), actor, now);
          return camp.game;
        }
        if (operation === "game/reset") {
          requireCampOperator(camp, actor);
          camp.game = { board: Array(9).fill(null), next: "X", winner: null };
          return camp.game;
        }
        if (operation === "settings") {
          requireCampOperator(camp, actor);
          if (input.missionLimit !== undefined)
            camp.budgets.missionLimit = z
              .number()
              .int()
              .min(1)
              .max(500)
              .parse(input.missionLimit);
          if (input.socialLimit !== undefined)
            camp.budgets.socialLimit = z
              .number()
              .int()
              .min(0)
              .max(50)
              .parse(input.socialLimit);
          if (input.socialEnabled !== undefined)
            camp.schedule.socialEnabled = z
              .boolean()
              .parse(input.socialEnabled);
          if (input.refreshMinutes !== undefined)
            camp.schedule.refreshMinutes = z
              .number()
              .int()
              .min(0)
              .max(10080)
              .parse(input.refreshMinutes);
          if (input.slack)
            camp.slack = z
              .object({
                channelId: z.string().regex(/^[CG][A-Z0-9]+$/),
                threadTs: z.string().regex(/^\d+\.\d+$/),
              })
              .parse(input.slack);
          campEvent(
            camp,
            "camp.configured",
            "Camp schedule and resources updated",
            actor.id,
            now,
          );
          return { ok: true };
        }
        if (operation === "worker/schedule") {
          requireWorker(req);
          if (camp.status !== "running") return { ok: true };
          advanceWorkflow(camp, now);
          for (const o of camp.cultural?.outbox ?? [])
            if (
              o.status === "sending" &&
              Date.parse(o.attemptedAt ?? now) < Date.now() - 600000
            ) {
              o.status = "indeterminate";
              o.receipt = {
                ref: "",
                detail:
                  "Delivery interrupted; inspect the external account before sending again",
                at: now,
              };
            }

          if (
            camp.schedule.socialEnabled &&
            Date.parse(camp.schedule.nextSocialAt) <= Date.now() &&
            !camp.jobs.some(
              (j) =>
                ["leased", "queued"].includes(j.status) && j.kind === "social",
            )
          ) {
            const a =
              camp.agents[camp.budgets.socialTurns % camp.agents.length];
            queueCampTurn(
              camp,
              a.id,
              "You have a quiet moment in camp. Make one useful, brief remark to a colleague or play one legal move of tic-tac-toe. Silence is fine. Do not invent completed mission work.",
              "social",
              now,
            );
            camp.schedule.nextSocialAt = new Date(
              Date.now() + 15 * 60000,
            ).toISOString();
          }
          if (
            camp.schedule.refreshMinutes > 0 &&
            Date.parse(camp.schedule.nextRefreshAt) <= Date.now() &&
            !camp.jobs.some((j) => j.status === "queued" && j.input.refresh)
          ) {
            const job = queueCampTurn(
              camp,
              camp.agents[0].id,
              "Scheduled review: check whether new evidence warrants updating active publications. Propose a revision only when something material changed. Use the usual review and publication workflow.",
              "agent",
              now,
            );
            job.input.refresh = true;
            camp.schedule.nextRefreshAt = new Date(
              Date.now() + camp.schedule.refreshMinutes * 60000,
            ).toISOString();
          }
          return { ok: true };
        }
        if (operation === "worker/model-result") {
          requireWorker(req);
          const job = camp.jobs.find((j) => j.id === input.jobId);
          const number = z
            .number()
            .int()
            .min(1)
            .max(24)
            .parse(input.requestNumber);
          if (!job || number > Number(job.input.modelRequests ?? 0))
            throw new DomainError("Model reservation missing", "CONFLICT", 409);
          const receipts = (job.input.modelReceipts ?? {}) as Record<
            string,
            unknown
          >;
          if (Object.hasOwn(receipts, String(number))) return { ok: true };
          const usage = input.usage
            ? z
                .object({
                  inputTokens: z.number().int().nonnegative(),
                  outputTokens: z.number().int().nonnegative(),
                })
                .parse(input.usage)
            : null;
          receipts[String(number)] = usage;
          job.input.modelReceipts = receipts;
          campEvent(
            camp,
            "model.usage",
            usage
              ? "Model usage: " +
                  usage.inputTokens +
                  " input / " +
                  usage.outputTokens +
                  " output tokens"
              : "Model response completed; provider usage unavailable",
            job.agentId,
            now,
            [job.id],
          );
          return { ok: true };
        }
        if (operation === "worker/model-reserve") {
          requireWorker(req);
          const j = camp.jobs.find((j) => j.id === input.jobId);
          if (
            !j ||
            j.kind === "tool" ||
            j.agentId !== input.agentId ||
            j.status !== "leased" ||
            Date.parse(j.leaseUntil ?? "") <= Date.now()
          )
            throw new DomainError(
              "Model invocation is no longer active",
              "FORBIDDEN",
              403,
            );
          checkCampJob(camp, j, now);
          if (input.inspect === true) {
            const a = camp.agents.find((a) => a.id === j.agentId)!;
            return {
              cultural: !!camp.cultural,
              training: j.kind === "training",
              profile: a.configurations.find((c) => c.id === j.configurationId)
                ?.modelProfile,
            };
          }
          const count = Number(j.input.modelRequests ?? 0);
          if (count >= 24)
            throw new DomainError(
              "Model request budget exhausted",
              "CONFLICT",
              429,
            );
          j.input.modelRequests = count + 1;
          campEvent(
            camp,
            "model.reserved",
            `Model request ${count + 1} of 24`,
            j.agentId,
            now,
            [j.id],
          );
          const agent = camp.agents.find((a) => a.id === j.agentId)!;
          return {
            remaining: 23 - count,
            requestNumber: count + 1,
            cultural: !!camp.cultural,
            training: j.kind === "training",
            profile: agent.configurations.find(
              (c) => c.id === j.configurationId,
            )?.modelProfile,
          };
        }
        if (operation === "worker/defer") {
          requireWorker(req);
          const j = requireCampLease(
            camp,
            String(input.jobId),
            String(input.owner),
            now,
          );
          const at = z.string().datetime().parse(input.retryAt);
          if (Date.parse(at) <= Date.now())
            throw new DomainError("Future resume time required");
          j.status = "queued";
          j.input.notBefore = at;
          j.input.waitReason = z.string().max(500).parse(input.reason);
          delete j.leaseOwner;
          delete j.leaseUntil;
          const task = camp.cultural?.tasks.find((t) => t.jobId === j.id);
          if (task) {
            task.status = "waiting_quota";
            task.notBefore = at;
          }
          camp.agents.find((a) => a.id === j.agentId)!.activity = "idle";
          campEvent(
            camp,
            "workflow.quota",
            String(input.reason),
            j.agentId,
            now,
            [j.id],
          );
          return { ok: true };
        }
        if (operation === "worker/activity") {
          requireWorker(req);
          const j = requireCampLease(
            camp,
            String(input.jobId),
            String(input.owner),
            now,
          );
          const type = z
            .enum([
              "tool.start",
              "tool.end",
              "turn.progress",
              "capture.gap",
              "model.usage",
            ])
            .parse(input.type);
          campEvent(
            camp,
            type,
            z.string().max(2000).parse(input.detail),
            j.agentId,
            now,
            [j.id],
          );
          const agent = camp.agents.find((a) => a.id === j.agentId)!;
          if (type === "tool.start")
            agent.activity = String(input.detail).startsWith("camp_tool:")
              ? "cube"
              : String(input.detail).startsWith("camp_message:")
                ? "talking"
                : String(input.detail).startsWith("camp_game:")
                  ? "playing"
                  : j.kind === "training"
                    ? "training"
                    : "thinking";
          if (type === "tool.end")
            agent.activity =
              j.kind === "social"
                ? "talking"
                : j.kind === "training"
                  ? "training"
                  : "thinking";
          return { ok: true };
        }
        if (operation === "worker/complete") {
          requireWorker(req);
          const j = requireCampLease(
            camp,
            String(input.jobId),
            String(input.owner),
            now,
          );
          const receipt = z
            .object({
              outcome: z.enum(["verified", "failed", "indeterminate"]),
              detail: z.string().max(6000),
              externalRef: z.string().optional(),
            })
            .parse(input.receipt);
          const output = input.result as Record<string, unknown> | undefined;
          // Persist externally checked results only when the worker still holds the lease and the target revision is unchanged.
          if (receipt.outcome === "verified" && j.kind === "tool") {
            checkCampJob(camp, j, now);
            const args = j.input.arguments as Record<string, unknown>;
            const p = camp.publications.find(
              (p) => p.id === args.publicationId,
            );
            if (output?.evidence) {
              const evidence = z
                .object({
                  id: z.string(),
                  title: z.string(),
                  url: z.string().url(),
                  excerpt: z.string().max(30000),
                  fetchedAt: z.string(),
                  digest: z.string(),
                  source: z.literal("connector"),
                })
                .parse(output.evidence);
              if (
                !camp.evidence.some(
                  (e) => e.digest === evidence.digest && e.url === evidence.url,
                )
              )
                camp.evidence.push(evidence);
            }
            if (p && output?.build) {
              const build = output.build as NonNullable<typeof p.build>;
              if (build.sourceVersion !== p.version)
                throw new DomainError("Stale build", "CONFLICT", 409);
              if (p.build?.digest !== build.digest) delete p.approval;
              p.build = build;
              p.status = build.checks.every((c) => c.passed)
                ? "rendered"
                : "failed";
            }
            if (p && output?.pullRequest)
              p.pullRequest = output.pullRequest as typeof p.pullRequest;
            if (p && output?.deployment) {
              p.deployment = output.deployment as typeof p.deployment;
              p.status = "published";
            }
          }
          completeCampJob(
            camp,
            j.id,
            String(input.owner),
            receipt,
            input.result,
            now,
          );
          return { ok: true };
        }
        if (operation === "worker/slack") {
          requireWorker(req);
          if (
            !camp.slack ||
            input.channelId !== camp.slack.channelId ||
            input.threadTs !== camp.slack.threadTs
          )
            throw new DomainError(
              "Slack thread is not bound to this camp",
              "FORBIDDEN",
              403,
            );
          const ids = (process.env.CAMP_SLACK_OPERATOR_IDS ?? "").split(",");
          if (!ids.includes(String(input.userId)))
            throw new DomainError(
              "Slack user is not a camp operator",
              "FORBIDDEN",
              403,
            );
          const text = z
            .string()
            .max(12000)
            .parse(input.text)
            .trim()
            .replace(/^`|`$/g, "");
          campEvent(
            camp,
            "slack.instruction",
            `Instruction from Slack user ${String(input.userId)}`,
            String(input.userId),
            now,
          );
          const human: CampActor = { id: camp.ownerId, kind: "operator" };
          const match = /^approve (publication-[\w-]+) v(\d+)$/.exec(text);
          return match
            ? approvePublication(camp, match[1], Number(match[2]), human, now)
            : instructCamp(camp, { text }, human, now);
        }
        throw new DomainError("Unknown camp operation", "NOT_FOUND", 404);
      },
      {
        key: key ? `${actor.id}:${operation}:${key}` : undefined,
        expectedRevision:
          typeof input.expectedRevision === "number"
            ? input.expectedRevision
            : undefined,
      },
    );
    return json({ result: result.result, revision: result.camp.revision });
  } catch (e) {
    return failure(e);
  }
}
