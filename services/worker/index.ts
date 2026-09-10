import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { App } from "@slack/bolt";
import type {
  Run,
  Job,
  Plan,
  Notification,
  Association,
} from "../../packages/core/src/contracts";
import { preparePatch } from "./github";

const base = process.env.YAMNAYA_URL ?? "http://localhost:3100";
const owner = `executor-${randomUUID().slice(0, 8)}`;
if (!process.env.WORKER_TOKEN) throw new Error("WORKER_TOKEN is required");
async function api(
  route: string,
  payload?: Record<string, unknown>,
  key: string = randomUUID(),
) {
  const response = await fetch(`${base}/api/${route}`, {
    method: payload ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.WORKER_TOKEN}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const body = (await response.json()) as { result?: unknown; error?: string };
  if (!response.ok)
    throw new Error(
      `${response.status}: ${body.error ?? "API request failed"}`,
    );
  return body;
}
let slack: App | undefined;
if (
  process.env.SLACK_BOT_TOKEN &&
  process.env.SLACK_APP_TOKEN &&
  process.env.SLACK_CHANNEL_ID
) {
  slack = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });
  slack.message(async ({ message, body }) => {
    const m = message as {
      text?: string;
      user?: string;
      channel: string;
      thread_ts?: string;
      ts: string;
      bot_id?: string;
      subtype?: string;
    };
    if (
      !m.text ||
      !m.user ||
      m.bot_id ||
      m.subtype ||
      m.channel !== process.env.SLACK_CHANNEL_ID
    )
      return;
    try {
      const run = (await api("worker/state")) as unknown as Run;
      await api(
        "worker/slack",
        {
          runId: run.id,
          userId: m.user,
          text: m.text,
          threadTs: m.thread_ts ?? m.ts,
          channelId: m.channel,
        },
        `slack:${"event_id" in body ? String(body.event_id) : m.ts}`,
      );
    } catch (e) {
      console.error("Slack ingress:", String(e));
    }
  });
  await slack.start();
  console.log("Slack Socket Mode connected.");
}
async function notify(run: Run, notification: Notification) {
  if (!slack) {
    if (run.mode === "live")
      throw new Error("Slack is required for live stakeholder delivery");
    return undefined;
  }
  const userId =
    process.env[`SLACK_${notification.recipientId.toUpperCase()}_USER_ID`];
  return postSlackOnce(
    `${run.id}:${notification.id}`,
    `${userId ? `<@${userId}> ` : ""}${notification.message}`,
    run.slackThreadTs,
  );
}
async function postSlackOnce(key: string, text: string, threadTs?: string) {
  if (!slack) throw new Error("Slack not configured");
  await mkdir("runtime/slack", { recursive: true });
  const file = `runtime/slack/${createHash("sha256").update(key).digest("hex")}.json`;
  let prior: { pending: boolean; ts?: string } | undefined;
  try {
    prior = JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (prior?.ts) return prior.ts;
  if (prior?.pending)
    throw new Error(
      "Indeterminate Slack delivery; reconcile the local receipt before retrying",
    );
  await writeFile(file, JSON.stringify({ pending: true }));
  const result = await slack.client.chat.postMessage({
    channel: process.env.SLACK_CHANNEL_ID!,
    thread_ts: threadTs,
    text,
  });
  if (!result.ts)
    throw new Error("Indeterminate Slack delivery: no timestamp returned");
  await writeFile(file, JSON.stringify({ pending: false, ts: result.ts }));
  return result.ts;
}
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
let lastWarning = "",
  lastWarningAt = 0;
console.log(`Executor ${owner} connecting to ${new URL(base).host}`);
while (!stopping) {
  try {
    let run = (await api("worker/state")) as unknown as Run;
    if (run.status !== "stopped") {
      if (slack && !run.slackThreadTs && run.status !== "monitoring") {
        const threadTs = await postSlackOnce(
          `incident-${run.id}`,
          `Yamnaya incident ${run.id}: ${run.name}. Review evidence and plans at ${base}. Approve an exact plan with: approve PLAN-1 v1.`,
        );
        await api(
          "worker/thread",
          { runId: run.id, threadTs },
          `thread:${run.id}`,
        );
        run.slackThreadTs = threadTs;
      }
      const claim = run.jobs.some(j => ["queued", "leased"].includes(j.status))
        ? await api("worker/claim", { runId: run.id, owner })
        : { result: null };
      const work = claim.result as {
        job: Job;
        plan?: Plan;
        notification?: Notification;
      } | null;
      if (work) {
        try {
          if (work.job.kind === "notification" && work.notification) {
            const slackTs = await notify(run, work.notification);
            await api(
              "worker/complete",
              { runId: run.id, jobId: work.job.id, owner, slackTs },
              `${run.id}:${work.job.id}:complete`,
            );
          } else if (work.plan) {
            let plan = work.plan;
            while (plan.stepIndex < plan.steps.length && !stopping) {
              const action = plan.steps[plan.stepIndex];
              const key = `${run.id}:${plan.id}:v${plan.version}:${plan.stepIndex}`;
              const proof =
                action.kind === "prepare_patch"
                  ? await preparePatch(run, plan, action.source)
                  : undefined;
              const next = await api(
                "worker/step",
                { runId: run.id, jobId: work.job.id, owner, proof },
                key,
              );
              plan = next.result as Plan;
            }
          }
        } catch (e) {
          await api("worker/fail", {
            runId: run.id,
            jobId: work.job.id,
            owner,
            error: String(e),
            indeterminate: /timeout|fetch failed|network|indeterminate/i.test(
              String(e),
            ),
          });
        }
      }
      run = (await api("worker/state")) as unknown as Run;
      if (!["monitoring", "stopped", "verified"].includes(run.status)) {
        let mapping: Association[] | undefined;
        const worker = run.workers.find(
          (w) => w.status === "running" && w.available,
        );
        const artifact = run.artifacts.find((a) => a.id === worker?.artifactId);
        const tx = run.transactions.find(
          (t) =>
            t.status === "queued" &&
            !run.quarantinedSdps.includes(t.request.sdpId),
        );
        if (artifact && tx && artifact.validation === "tested") {
          const response = await fetch(
            `${process.env.CODE_LAB_URL ?? "http://code-lab:4100"}/map`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                source: artifact.source,
                associations: run.mdm,
                request: tx.request,
              }),
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!response.ok)
            throw new Error("Deployed mapping artifact failed execution");
          mapping = ((await response.json()) as { result: Association[] })
            .result;
        }
        await api("worker/tick", {
          runId: run.id,
          expectedRevision: run.revision,
          mapping,
        });
      }
    }
    lastWarning = "";
  } catch (e) {
    const warning = String(e);
    if (warning !== lastWarning || Date.now() - lastWarningAt > 30000) {
      console.error(warning);
      lastWarning = warning;
      lastWarningAt = Date.now();
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
if (slack) await slack.stop();
