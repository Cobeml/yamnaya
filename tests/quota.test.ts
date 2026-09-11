import { expect, it } from "vitest";
import {
  reserveQuota,
  nextPacificDay,
  pacificDay,
  type QuotaState,
} from "../packages/core/src";
const limits = { rpm: 2, tpm: 10000, rpd: 10, freeTierConfirmed: true };
it("reserves one shared window and does not consume calls while waiting", () => {
  const s: QuotaState = { requests: [] };
  const now = Date.parse("2026-09-11T12:00Z");
  expect(
    reserveQuota(s, limits, { id: "a", tokens: 100, training: false }, now)
      .allowed,
  ).toBe(true);
  expect(
    reserveQuota(s, limits, { id: "b", tokens: 100, training: false }, now + 1)
      .allowed,
  ).toBe(false);
  expect(s.requests).toHaveLength(1);
  delete s.active;
  expect(
    reserveQuota(s, limits, { id: "b", tokens: 100, training: false }, now + 2)
      .allowed,
  ).toBe(false);
  expect(
    reserveQuota(
      s,
      limits,
      { id: "b", tokens: 100, training: false },
      now + 60001,
    ).allowed,
  ).toBe(true);
});
it("resets the daily quota at Pacific midnight across daylight transitions", () => {
  for (const day of ["2026-03-08T09:00Z", "2026-11-01T08:00Z"]) {
    const n = Date.parse(day),
      next = nextPacificDay(n);
    expect(pacificDay(next)).not.toBe(pacificDay(n));
    expect(pacificDay(next - 2000)).toBe(pacificDay(n));
  }
  const s: QuotaState = { requests: [] };
  expect(
    reserveQuota(
      s,
      { ...limits, freeTierConfirmed: false },
      { id: "x", tokens: 1, training: false },
      Date.now(),
    ).allowed,
  ).toBe(false);
  expect(s.requests).toHaveLength(0);
});
