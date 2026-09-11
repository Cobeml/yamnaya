import { campUpdates } from "./camp-updates";
import { campDatabase } from "../../apps/web/lib/camp-store";
import { startCampOrigin } from "./camp-origin";
import { sandboxRequest } from "./sandbox-client";
import { config } from "dotenv";
import { App } from "@slack/bolt";
import { campDoctrine, type Camp, type Publication } from "@yamnaya/core";
import { campApi, checkWork, workerId, type CampWork } from "./camp-client";
import { startCampGateway } from "./camp-gateway";
import { publicFetch } from "./public-network";
import { renderPublication, sha256 } from "./quarto";
import { saveArtifact, loadArtifact, previewUrl } from "./camp-artifacts";
import { proposePublication, publishPublication } from "./camp-github";

config({ path: process.env.CAMP_ENV_FILE ?? ".env.camps", quiet: true });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
const active = new Set<Promise<void>>();
async function runtime(route: string, data?: unknown) {
  const response = await fetch(`${process.env.CAMP_HERMES_URL}${route}`, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${process.env.CAMP_RUNTIME_SECRET}`,
      "Content-Type": "application/json",
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(value.error ?? "Hermes runtime unavailable");
  return value;
}
async function record(
  work: CampWork,
  type: string,
  detail: string,
  key?: string,
) {
  return campApi(
    `${work.camp.id}/worker/activity`,
    { jobId: work.job.id, owner: workerId, type, detail },
    key,
  );
}
async function agentTurn(work: CampWork) {
  const { camp, job } = work;
  if (camp.mode === "simulation")
    return {
      summary:
        "Simulation: instruction received. No model or external action ran. Use Live mode for Hermes reasoning.",
    };
  if (
    camp.cultural &&
    (!process.env.CAMP_GEMINI_API_KEY ||
      (process.env.CAMP_GEMINI_FREE_TIER !== "true" &&
        !(
          Number(process.env.CAMP_GEMINI_MONTHLY_USD) > 0 &&
          Number(process.env.CAMP_GEMINI_MONTHLY_USD) <= 10
        )) ||
      !["CAMP_GEMINI_RPM", "CAMP_GEMINI_TPM", "CAMP_GEMINI_RPD"].every(
        (k) => Number(process.env[k]) > 0,
      ))
  )
    return {
      deferred: true,
      retryAt: new Date(Date.now() + 3600000).toISOString(),
      reason:
        "Gemini key, project limits and authorized budget are required; no model call was made",
    };
  if (
    !(camp.cultural
      ? process.env.CAMP_GEMINI_API_KEY
      : process.env.CAMP_MODEL_API_KEY)
  )
    throw new Error(
      "CAMP_MODEL_API_KEY is not configured; no model call was made",
    );
  const agent = camp.agents.find((a) => a.id === job.agentId)!;
  const cfg = agent.configurations.find((c) => c.id === job.configurationId)!;
  const invocationId = `${camp.id}-${job.id}-a${job.attempts}`;
  await runtime("/invocations", {
    invocationId,
    campId: camp.id,
    agentId: agent.id,
    configurationId: cfg.id,
    sessionId: `${camp.id}-${agent.id}`,
    token: work.token,
    apiUrl: process.env.CAMP_API_URL,
    model: camp.cultural ? "gemini-3.8-flash" : process.env.CAMP_MODEL,
    apiMode: process.env.CAMP_MODEL_API_MODE ?? "chat_completions",
    modelProxyUrl: process.env.CAMP_MODEL_PROXY_URL,
    text: job.input.waitReason
      ? `Continue the saved task after a quota pause. Inspect existing results and do not repeat completed actions. Original task: ${job.input.text}`
      : String(job.input.text),
    systemPrompt: `You are ${agent.name}, ${agent.role}, in ${camp.name}. ${campDoctrine}\n${cfg.persona}\nUse camp_observe first. Your granted capabilities are provided by the cube; tools cannot grant additional authority. Preserve citations and explicitly identify inference. Author Quarto sources in provisioned publications. Render and propose a GitHub PR; only the operator can review publication.\nActive approved skills:\n${cfg.skills.map((s) => s.name + "\n" + s.content).join("\n\n")}`,
    timeoutSeconds: 300,
    maxIterations: 12,
  });
  let cursor = 0;
  try {
    for (let i = 0; i < 170; i++) {
      await checkWork(work);
      if (stopping) throw new Error("Worker is shutting down");
      const state = await runtime(`/invocations/${invocationId}`);
      for (const event of state.events ?? [])
        if (event.sequence > cursor) {
          if (["tool.start", "tool.end"].includes(event.kind))
            await record(
              work,
              event.kind,
              `${event.tool}: ${event.status ?? "requested"}`,
              `${invocationId}-${event.sequence}`,
            );
          cursor = event.sequence;
        }
      if (state.status === "completed")
        return { summary: state.summary, invocationId, runtime: "hermes" };
      if (state.status === "deferred")
        return { deferred: true, retryAt: state.retryAt, reason: state.reason };
      if (state.status !== "running")
        throw new Error(
          `Hermes invocation ${state.status}; inspect runtime journal ${invocationId}`,
        );
      await pause(1800);
    }
    throw new Error("Hermes invocation deadline exceeded");
  } catch (error) {
    await runtime(`/invocations/${invocationId}/cancel`, {}).catch(() => {});
    throw error;
  }
}
async function tool(work: CampWork): Promise<unknown> {
  const { camp, job } = work;
  const cap = String(job.input.capability);
  const args = job.input.arguments as Record<string, unknown>;
  const p = camp.publications.find(
    (p) => p.id === args.publicationId,
  ) as Publication;
  if (
    camp.mode === "simulation" &&
    cap !== "publication.render" &&
    cap !== "code.execute"
  )
    throw new Error(
      "External capabilities require a live camp; simulation does not fabricate receipts",
    );
  await checkWork(work);
  if (cap === "research.fetch") {
    const response = await publicFetch(
      String(args.url),
      0,
      job.input.requestedByOperator
        ? [String(job.input.scope)]
        : camp.grants
            .filter(
              (g) =>
                !g.revoked &&
                (g.agentId === "*" || g.agentId === job.agentId) &&
                g.capability === "research.fetch" &&
                Date.parse(g.expiresAt) > Date.now(),
            )
            .map((g) => g.scope),
    );
    if (response.status < 200 || response.status >= 300)
      throw new Error(`Source returned ${response.status}`);
    const text = response.body.toString("utf8");
    const title =
      /<title[^>]*>([\s\S]*?)<\/title>/i
        .exec(text)?.[1]
        ?.replace(/<[^>]+>/g, "")
        .trim() ?? response.url;
    const excerpt = text
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 30000);
    return {
      evidence: {
        id: `source-${sha256(response.url + text).slice(0, 16)}`,
        title,
        url: response.url,
        excerpt,
        digest: sha256(response.body),
        fetchedAt: new Date().toISOString(),
        source: "connector",
      },
      truncated: excerpt.length >= 30000,
    };
  }
  if (cap === "research.search") {
    if (!process.env.CAMP_SEARCH_URL)
      throw new Error(
        "Configure CAMP_SEARCH_URL for a SearXNG JSON search endpoint",
      );
    const query = String(args.query ?? "").slice(0, 1000);
    if (!query.trim()) throw new Error("Search query required");
    const url = new URL("/search", process.env.CAMP_SEARCH_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok)
      throw new Error(`Search provider returned ${response.status}`);
    const body = await response.json();
    return {
      query,
      results: (body.results ?? [])
        .slice(0, 10)
        .map((r: Record<string, string>) => ({
          title: r.title,
          url: r.url,
          excerpt: r.content,
        })),
      note: "Search snippets are leads. Fetch primary sources before citing substantive claims.",
    };
  }
  if (cap === "publication.render") {
    const value = await renderPublication(
      p,
      camp.evidence,
      process.env.CAMP_SANDBOX_URL!,
      `${camp.id}-${job.id}`,
    );
    await saveArtifact(
      camp.id,
      value.build.id,
      value.build.digest,
      value.output,
    );
    return {
      build: value.build,
      previewUrl: previewUrl(camp.id, value.build.id),
    };
  }
  if (cap === "code.execute") {
    const response = await sandboxRequest(
      `${process.env.CAMP_SANDBOX_URL}/code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: args.language, source: args.source }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Code execution failed");
    if (result.sourceDigest !== sha256(String(args.source)))
      throw new Error("Code receipt does not match request");
    return {
      ...result,
      note: "Execution succeeded. The output still requires domain verification.",
    };
  }
  if (cap === "github.propose")
    return {
      pullRequest: await proposePublication(camp, p, () => checkWork(work)),
    };
  if (cap === "publication.publish") {
    const artifact = await loadArtifact(camp.id, p.build!.id, p.build!.digest);
    return {
      deployment: await publishPublication(p, artifact.files, () =>
        checkWork(work),
      ),
    };
  }
  if (cap === "slack.send") {
    if (!slack || !camp.slack)
      throw new Error("Slack is not configured for this camp");
    const text = String(args.text ?? "").slice(0, 12000);
    if (!text.trim()) throw new Error("Message text required");
    const sent = await slack.client.chat.postMessage({
      channel: camp.slack.channelId,
      thread_ts: camp.slack.threadTs,
      text,
    });
    const receipt = await slack.client.conversations.replies({
      channel: camp.slack.channelId,
      ts: camp.slack.threadTs,
      oldest: sent.ts,
      inclusive: true,
      limit: 10,
    });
    if (!receipt.messages?.some((m) => m.ts === sent.ts && m.text === text))
      throw new Error(
        "Indeterminate Slack delivery; message was sent but readback did not match",
      );
    return { channel: sent.channel, ts: sent.ts, verified: true };
  }
  if (cap.startsWith("browser.")) {
    if (!process.env.CAMP_BROWSER_URL)
      throw new Error("Browser service is not configured");
    const allowedHosts = job.input.requestedByOperator
      ? [String(job.input.scope)]
      : camp.grants
          .filter(
            (g) =>
              !g.revoked &&
              (g.agentId === "*" || g.agentId === job.agentId) &&
              g.capability === cap &&
              Date.parse(g.expiresAt) > Date.now(),
          )
          .map((g) => g.scope);
    const response = await fetch(`${process.env.CAMP_BROWSER_URL}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity: `${camp.id}/${job.agentId}`,
        capability: cap,
        arguments: args,
        allowedHosts,
      }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Browser action failed");
    return result;
  }
  throw new Error(`Capability ${cap} is unavailable in this worker`);
}
async function handle(work: CampWork) {
  try {
    const result =
      work.job.kind === "tool" ? await tool(work) : await agentTurn(work);
    if (result && typeof result === "object" && "deferred" in result) {
      const wait = result as unknown as { retryAt: string; reason: string };
      await campApi(`${work.camp.id}/worker/defer`, {
        jobId: work.job.id,
        owner: workerId,
        retryAt: wait.retryAt,
        reason: wait.reason,
      });
      return;
    }
    await campApi(
      `${work.camp.id}/worker/complete`,
      {
        jobId: work.job.id,
        owner: workerId,
        receipt: {
          outcome: "verified",
          detail:
            work.job.kind === "tool"
              ? `${work.job.input.capability}: connector result checked`
              : work.camp.mode === "simulation"
                ? "Simulation turn recorded; no reasoning ran"
                : "Hermes turn completed; mission acceptance remains separate",
        },
        result,
      },
      `complete-${work.job.id}`,
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Worker failed";
    const external =
      work.job.kind === "tool" &&
      ["publication.publish", "github.propose", "slack.send"].includes(
        String(work.job.input.capability),
      );
    await campApi(
      `${work.camp.id}/worker/complete`,
      {
        jobId: work.job.id,
        owner: workerId,
        receipt: { outcome: external ? "indeterminate" : "failed", detail },
      },
      `complete-${work.job.id}`,
    ).catch(() =>
      console.error(
        "Unable to save job receipt; lease expiry will require reconciliation",
      ),
    );
  }
}
const slack =
  process.env.CAMP_SLACK_BOT_TOKEN && process.env.CAMP_SLACK_APP_TOKEN
    ? new App({
        token: process.env.CAMP_SLACK_BOT_TOKEN,
        appToken: process.env.CAMP_SLACK_APP_TOKEN,
        socketMode: true,
      })
    : null;
if (slack) {
  slack.message(async ({ message }) => {
    if (
      !("text" in message) ||
      !("user" in message) ||
      !message.user ||
      !("thread_ts" in message) ||
      !message.thread_ts ||
      "bot_id" in message
    )
      return;
    const { camps } = await campApi("worker");
    for (const camp of camps as Camp[])
      if (
        camp.slack?.channelId === message.channel &&
        camp.slack.threadTs === message.thread_ts
      )
        await campApi(
          `${camp.id}/worker/slack`,
          {
            channelId: message.channel,
            threadTs: message.thread_ts,
            userId: message.user,
            text: message.text,
          },
          `slack-${message.ts}`,
        ).catch(() => console.error("Slack instruction rejected"));
  });
  await slack.start();
}
const gateway = startCampGateway();
const origin = startCampOrigin();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopping = true;
  });
console.log("Camp worker ready: Hermes, Quarto, GitHub and optional Slack");
let nextSchedule = 0;
let wake: (() => void) | undefined;
let unlisten: (() => Promise<void>) | undefined;
if (process.env.CAMP_DATABASE_URL && process.env.CAMP_STORAGE !== "file") {
  const listener = await campDatabase().listen("camp_work", () => {
    wake?.();
  });
  unlisten = listener.unlisten;
}
const waitForWork = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      wake = undefined;
      resolve();
    }, 10000);
    wake = () => {
      clearTimeout(timer);
      wake = undefined;
      resolve();
    };
  });
while (!stopping) {
  try {
    if (Date.now() > nextSchedule) {
      const { camps } = await campApi("worker");
      for (const camp of camps as Camp[]) {
        await campApi(`${camp.id}/worker/schedule`, {});
      }
      await campUpdates(camps as Camp[], slack);
      nextSchedule = Date.now() + 30000;
    }
    if (active.size < 6) {
      const { work } = await campApi("worker/claim", { owner: workerId });
      if (work) {
        const promise = handle(work).finally(() => active.delete(promise));
        active.add(promise);
        continue;
      }
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Camp worker unavailable",
    );
  }
  await waitForWork();
}
await Promise.allSettled(active);
await slack?.stop();
await unlisten?.();
gateway.close();
origin?.close();
