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

it("reserves worst-case monthly cost durably and never spends while blocked", () => {
  const s: QuotaState = { requests: [] };
  const now = Date.parse("2026-09-11T12:00Z");
  const paid = {
    ...limits,
    rpm: 100,
    freeTierConfirmed: false,
    monthlyBudgetMicros: 10000000,
  };
  expect(
    reserveQuota(
      s,
      paid,
      { id: "a", tokens: 100, training: false, costMicros: 6000000 },
      now,
    ).allowed,
  ).toBe(true);
  delete s.active;
  const blocked = reserveQuota(
    s,
    paid,
    { id: "b", tokens: 100, training: false, costMicros: 6000000 },
    now + 120000,
  );
  expect(blocked.allowed).toBe(false);
  expect(pacificDay(blocked.retryAt)).toBe("2026-10-01");
  expect(s.spend?.reservedMicros).toBe(6000000);
  expect(s.requests).toHaveLength(1); // daily history and monthly ledger remain
  expect(
    reserveQuota(
      s,
      paid,
      { id: "c", tokens: 100, training: false, costMicros: 6000000 },
      blocked.retryAt,
    ).allowed,
  ).toBe(true);
  expect(s.spend?.reservedMicros).toBe(6000000);
});
