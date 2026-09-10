import { expect, it } from "vitest";
import { seedRun } from "../packages/core/src/index";
import { agentState, driverFingerprint } from "../openclaw/observation.mjs";
it("keeps recent human input and authority in valid bounded JSON after a long incident", () => {
  const run = seedRun("RUN-LONG", "contractor", "live");
  const state = { ...run, affected: ["SDP-001"], checks: [{ passed: false }], observations: Array.from({ length: 500 }, (_, i) => ({ id: `OBS-${i}`, type: "anomaly", source: "pipeline", resourceIds: ["SDP-001"], detail: "repeat".repeat(1000) })), events: Array.from({ length: 500 }, (_, i) => ({ id: `EV-${i}`, type: "sync.saved", message: "healthy".repeat(500) })), chat: [{ role: "platform", text: "Connector fixed; reassess prerequisites" }] };
  const text = JSON.stringify(agentState(state));
  expect(text.length).toBeLessThan(48000);
  const view = JSON.parse(text);
  expect(view.chat[0].text).toContain("Connector fixed");
  expect(view.checks).toEqual(state.checks);
  expect(view.credentials).toEqual(state.credentials);
  for (const key of ["physical", "scenario", "idempotency"]) expect(view).not.toHaveProperty(key);
  expect(view.artifacts.every((a: Record<string, unknown>) => !a.source)).toBe(true);
  expect(state.observations).toHaveLength(500);
});
it("wakes for human decisions, scope and threats, not unchanged background batches", () => {
  const state = { ...seedRun("RUN-LONG"), affected: ["SDP-001"] };
  const before = driverFingerprint(state, "defender");
  state.metrics.amiReads++;
  state.observations.push({ ...state.observations[0], id: "OBS-repeat" });
  expect(driverFingerprint(state, "defender")).toBe(before);
  state.chat.push({ actor: "human", role: "platform", text: "Connector repaired", time: state.clock });
  expect(driverFingerprint(state, "defender")).not.toBe(before);
  const after = driverFingerprint(state, "defender");
  state.threatVersion++;
  expect(driverFingerprint(state, "defender")).not.toBe(after);
});
