import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { googleUsageTokens, resumeWorkflow, advanceWorkflow, campEvent, type QuotaState } from "@yamnaya/core";
import { campDatabase, mutateCamp, readCamp } from "../../apps/web/lib/camp-store";
process.env.CAMP_DATABASE_URL = parse(await readFile(".env.camps")).CAMP_DATABASE_URL;
const apply = process.argv.includes("--apply");
try {
  const db = campDatabase();
  await db.begin(async tx => {
    const [row] = await tx`SELECT state FROM camp_quota WHERE id='google-free' FOR UPDATE`;
    if (!row) return;
    const state = row.state as QuotaState;
    let adjustment = 0;
    for (const charge of state.charges ?? []) {
      if (charge.settledMicros === undefined || !charge.usage?.details) continue;
      const usage = googleUsageTokens(charge.usage.details);
      if (!usage) continue;
      const cost = Math.ceil(usage.inputTokens * 0.75 + usage.outputTokens * 3.75);
      const delta = cost - charge.settledMicros;
      if (state.spend?.month === charge.month) {
        state.spend.reservedMicros += delta;
        if (charge.training) state.spend.trainingMicros += delta;
        adjustment += delta;
      }
      charge.usage = { ...charge.usage, ...usage };
      charge.settledMicros = cost;
    }
    if (apply) await tx`UPDATE camp_quota SET state=${tx.json(state as never)} WHERE id='google-free'`;
    console.log(JSON.stringify({ apply, thinkingAdjustmentUsd: adjustment / 1e6, estimatedChargesAndHoldsUsd: (state.spend?.reservedMicros ?? 0) / 1e6 }));
  });
  for (const [focus, role, expectedJob] of [["america", "writer", "job-454-34"], ["china", "finder", "job-283-28"]]) {
    const id = `camp-cultural-${focus}`;
    const repair = (c: Awaited<ReturnType<typeof readCamp>>) => {
      const t = c.cultural?.tasks.find(t => t.role === role && t.jobId === expectedJob && t.status === "waiting_input");
      if (!t) return { camp: id, changed: false };
      const actor = { kind: "operator" as const, id: c.ownerId }, now = new Date().toISOString();
      resumeWorkflow(c, t.id, actor, now);
      advanceWorkflow(c, now);
      const j = c.jobs.find(j => j.id === t.jobId)!;
      // One operator-requested repair after a deployed fix, not a recurring retry loop.
      j.input.handoffRecovery = "provider-repair";
      j.input.text = role === "finder"
        ? `Finish the saved finder handoff. Six verified passages are already registered. Read camp_cultural once; use its dossiers and retained source identifiers rather than loading entire source documents again. Submit camp_workflow_submit with id ${t.id} and a concise output under 6000 characters. If an actual missing input prevents handoff, submit wait=true. Do not repeat completed research.`
        : `Write the Discovering Spirits issue from the completed finder and cross-reference handoffs. The existing version 1 site and PR contain only a scaffold and must be replaced. First read camp_cultural and current publication sources, then use camp_edit_publication to write one concise page at a time: introduction, three spirit profiles, annotated library and correction notes with retained citations. Only after editing, render the current revision and submit camp_workflow_submit with id ${t.id}. Do not output the report as a chat message. Preserve source/inference distinctions.`;
      campEvent(c, "workflow.provider-recovered", "One continuation after provider timeout, output and accounting fixes; prior checkpoints and uncertain charges retained", actor.id, now, [t.id, j.id]);
      return { camp: id, role, job: j.id, status: t.status };
    };
    console.log(JSON.stringify(apply ? (await mutateCamp(id, repair, { key: "provider-continuation-repair-v1" })).result : repair(await readCamp(id))));
  }
} finally { await campDatabase().end(); }
