import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import {
  prepareSpiritLaunch,
  queueCampTurn,
  setCampStatus,
} from "@yamnaya/core";
import {
  campDatabase,
  insertCamp,
  listCamps,
  mutateCamp,
  readCamp,
} from "../../apps/web/lib/camp-store";
import { sendDiscordMessage } from "../../services/worker/camp-discord";
import { deliverOnce } from "../../services/worker/camp-delivery";
import { readLaunchSummary } from "../../apps/web/lib/camp-launch";

const local = parse(await readFile(".env.camps"));
const production = parse(await readFile(".env.camps.production"));
Object.assign(process.env, production, {
  CAMP_DATABASE_URL: local.CAMP_DATABASE_URL,
});
const mode = process.argv[2] ?? "status";
const owner = production.CAMP_OPERATOR_ID ?? "operator";
try {
  if (mode === "discord") {
    for (const focus of ["america", "china"]) {
      const camp = await readCamp(`camp-cultural-${focus}`);
      if (!camp.discord) throw new Error(`${focus}: binding missing`);
      const key = `spirits-connectivity-${camp.id}-${camp.discord.channelId}`;
      await deliverOnce(key, () =>
        sendDiscordMessage(
          camp.discord!,
          `Discovering Spirits — ${focus === "america" ? "America" : "China"}. Production connection test. Please send: !camp instruct Confirm this camp is ready for the Discovering Spirits launch. Research will use Astra within a shared $50 allowance, with Flash writing and marketing. Exact publication builds still come to you for review.`,
          key,
        ),
      );
      console.log(
        `${focus}: durable Discord connectivity attempt recorded (inspect receipt for verified delivery)`,
      );
    }
  } else if (mode === "smoke") {
    const previous = (await listCamps()).filter((c) =>
      c.name.startsWith("Spirits provider verification"),
    );
    let camp = previous.find((c) => c.status !== "archived");
    camp ??= await insertCamp(
      {
        name: `Spirits provider verification ${previous.length + 1}`,
        domain: "research",
        focus: "america",
        mode: "live",
      },
      owner,
    );
    if (!camp.jobs.length)
      await mutateCamp(
        camp.id,
        (c) => {
          const now = new Date().toISOString();
          prepareSpiritLaunch(c, { kind: "operator", id: owner }, now);
          setCampStatus(c, "running", { kind: "operator", id: owner }, now);
          for (const role of ["finder", "writer"])
            queueCampTurn(
              c,
              role,
              "This is a bounded provider integration test, not an issue workflow. Call camp_observe once and camp_cultural once. Then finish with a short statement identifying your camp and role from the returned state. Do not research, edit sources, send messages, propose skills or create tasks during this test.",
              "agent",
              now,
            );
          return { started: true };
        },
        { key: "spirits-provider-smoke-v1" },
      );
    for (let i = 0; i < 90; i++) {
      camp = await readCamp(camp.id);
      const jobs = camp.jobs.filter((j) => j.kind === "agent");
      console.log(
        JSON.stringify({
          camp: camp.id,
          jobs: jobs.map((j) => ({
            agent: j.agentId,
            status: j.status,
            receipt: j.receipt,
            modelReceipts: j.input.modelReceipts,
          })),
        }),
      );
      if (
        jobs.length === 2 &&
        jobs.every((j) =>
          ["done", "failed", "indeterminate", "cancelled"].includes(j.status),
        )
      ) {
        const ok = jobs.every(
          (j) => j.status === "done" && j.input.modelReceipts,
        );
        await mutateCamp(camp.id, (c) =>
          setCampStatus(
            c,
            "archived",
            { kind: "operator", id: owner },
            new Date().toISOString(),
          ),
        );
        if (!ok)
          throw new Error(
            "Live provider verification failed; inspect archived smoke camp before retrying",
          );
        console.log(
          "Live Astra and Flash Hermes turns completed; verification camp archived.",
        );
        break;
      }
      if (i === 89)
        throw new Error(
          "Live smoke is still pending; inspect before taking further action",
        );
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  } else if (mode === "start") {
    const focus = process.argv[3];
    if (!["america", "china"].includes(focus))
      throw new Error("Specify america or china");
    const smoke = (await listCamps()).find(
      (c) =>
        c.name.startsWith("Spirits provider verification") &&
        c.jobs.filter((j) => j.kind === "agent" && j.status === "done")
          .length === 2,
    );
    if (
      !smoke ||
      smoke.jobs.filter((j) => j.kind === "agent" && j.status === "done")
        .length !== 2
    )
      throw new Error("Complete live provider verification before launch");
    const { camp } = await mutateCamp(
      `camp-cultural-${focus}`,
      (c) => {
        if (!c.cultural?.launch || !c.discord)
          throw new Error("Prepared mission and Discord binding required");
        setCampStatus(
          c,
          "running",
          { kind: "operator", id: owner },
          new Date().toISOString(),
        );
        return { started: true };
      },
      { key: "start-spirits-first-issue-v1" },
    );
    console.log(`${camp.name}: ${camp.status}`);
  } else if (mode !== "status")
    throw new Error("Use status, discord, smoke or start america/china");
  for (const camp of (await listCamps()).filter(
    (c) => c.cultural?.launch && c.status !== "archived",
  )) {
    console.log(
      JSON.stringify({
        camp: camp.id,
        status: camp.status,
        sources: camp.cultural?.sources.length,
        tasks: camp.cultural?.tasks.map((t) => ({
          id: t.id,
          role: t.role,
          status: t.status,
        })),
        jobs: camp.jobs.slice(-6).map((j) => ({
          id: j.id,
          kind: j.kind,
          agent: j.agentId,
          status: j.status,
          receipt: j.receipt,
        })),
        publications: camp.publications.map((p) => ({
          id: p.id,
          version: p.version,
          status: p.status,
          build: p.build?.digest,
          pullRequest: p.pullRequest?.url,
          deployment: p.deployment?.url,
        })),
      }),
    );
  }
  console.log(JSON.stringify({ budget: await readLaunchSummary() }));
} finally {
  await campDatabase().end();
}
