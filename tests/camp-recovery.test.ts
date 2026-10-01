import { it, expect } from "vitest";
import { createCamp, createPublication, startWorkflow, runCamp, claimCampJob, completeCampJob, advanceWorkflow, acceptMission, addMission, submitWorkflow, campProgress, agentBubble, settleQuota, reserveQuota, type QuotaState } from "../packages/core/src";
const now = "2026-10-01T12:00:00.000Z";
const owner = { id: "owner", kind: "operator" as const };
function setup() {
  const c = createCamp("c", { name: "Recovery", focus: "america" }, owner.id, now);
  const p = createPublication(c, { title: "Issue", repository: "owner/issue" }, owner, now);
  startWorkflow(c, p.id, owner, now);
  return c;
}
it("recovers missing handoffs twice, never believing a model's claimed submission", () => {
  const c = setup();
  runCamp(c, owner, now);
  runCamp(c, owner, now);
  expect(c.jobs.filter(j => j.status === "queued")).toHaveLength(1);
  for (let i = 0; i < 3; i++) {
    const j = claimCampJob(c, "w", now, 2)!;
    expect(j).toBeTruthy();
    completeCampJob(c, j.id, "w", { outcome: "verified", detail: "Finished" }, { summary: "Handoff submitted successfully" }, now);
    advanceWorkflow(c, now);
  }
  expect(c.cultural!.tasks[0].status).toBe("waiting_input");
  expect(c.cultural!.tasks[0].recoveryAttempts).toBe(2);
  expect(c.cultural!.tasks[1].status).toBe("waiting_input");
  runCamp(c, owner, now);
  expect(c.jobs.filter(j => j.status === "queued")).toHaveLength(0);
  expect(campProgress(c, Date.parse(now)).label).toBe("Needs you");
});
it("does not automatically resume explicit requests for input", () => {
  const c = setup(); runCamp(c, owner, now);
  const j = claimCampJob(c, "w", now, 2)!;
  submitWorkflow(c, { id: c.cultural!.tasks[0].id, output: "Please supply the missing edition", wait: true }, owner, now);
  completeCampJob(c, j.id, "w", { outcome: "verified", detail: "Finished" }, {}, now);
  runCamp(c, owner, now);
  expect(c.cultural!.tasks[0].status).toBe("waiting_input");
  expect(c.jobs.filter(j => j.status === "queued")).toHaveLength(0);
});
it("rejects premature mission acceptance and expires old dialogue", () => {
  const c = setup(); const m = addMission(c, "Write this report", owner, now);
  m.publicationIds = [c.publications[0].id];
  expect(() => acceptMission(c, m.id, owner, now)).toThrow("render");
  c.status = "running";
  c.messages.push({ id: "m", at: now, senderId: "finder", recipientId: "camp", text: "I found a passage." });
  expect(agentBubble(c, "finder", Date.parse(now))?.text).toBe("I found a passage.");
  expect(agentBubble(c, "finder", Date.parse(now) + 31000)?.kind).not.toBe("dialogue");
});
it("settles a monthly hold exactly once and does not refund unknown or previous-month costs", () => {
  const s: QuotaState = { requests: [] };
  const limits = { rpm: 100, tpm: 100000, rpd: 1000, freeTierConfirmed: false, monthlyBudgetMicros: 10000000 };
  reserveQuota(s, limits, { id: "a", tokens: 10000, training: false, costMicros: 50000 }, Date.parse(now));
  settleQuota(s, "a", undefined);
  expect(s.spend!.reservedMicros).toBe(50000);
  settleQuota(s, "a", { inputTokens: 1000, outputTokens: 100 });
  settleQuota(s, "a", { inputTokens: 1, outputTokens: 1 });
  expect(s.spend!.reservedMicros).toBe(1125);
  delete s.active;
  reserveQuota(s, limits, { id: "b", tokens: 10000, training: false, costMicros: 50000 }, Date.parse(now) + 120000);
  s.spend = { month: "2026-11", reservedMicros: 123, trainingMicros: 0 };
  settleQuota(s, "b", { inputTokens: 1000, outputTokens: 100 });
  expect(s.spend.reservedMicros).toBe(123);
});
it("preserves a committed handoff when the runtime fails after submission", () => {
  const c = setup(); runCamp(c, owner, now);
  const j = claimCampJob(c, "w", now, 2)!;
  // The submit endpoint has already validated the role's handoff prerequisites.
  c.cultural!.tasks[0].status = "done";
  c.cultural!.tasks[0].output = "Verified sources";
  completeCampJob(c, j.id, "w", { outcome: "failed", detail: "Closing model response failed" }, {}, now);
  expect(c.cultural!.tasks[0].status).toBe("done");
  expect(c.cultural!.tasks[0].output).toBe("Verified sources");
  advanceWorkflow(c, now);
  expect(c.cultural!.tasks[1].status).toBe("working");
  expect(c.jobs.filter(x => x.status === "queued")).toHaveLength(1);
});
