export interface QuotaLimits {
  rpm: number;
  tpm: number;
  rpd: number;
  freeTierConfirmed: boolean;
  monthlyBudgetMicros?: number;
}
export interface QuotaState {
  requests: { id: string; at: number; tokens: number; training: boolean }[];
  active?: { id: string; until: number };
  blockedUntil?: number;
  spend?: { month: string; reservedMicros: number; trainingMicros: number };
}
export function pacificDay(at: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function nextPacificDay(at: number) {
  const day = pacificDay(at);
  let low = at,
    high = at + 26 * 3600000;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (pacificDay(mid) === day) low = mid;
    else high = mid;
  }
  return high;
}
export function reserveQuota(
  state: QuotaState,
  limits: QuotaLimits,
  request: {
    id: string;
    tokens: number;
    training: boolean;
    costMicros?: number;
  },
  now: number,
): { allowed: boolean; retryAt: number; reason: string } {
  const day = pacificDay(now);
  state.requests = state.requests.filter(
    (r) => pacificDay(r.at) === day || r.at > now - 60000,
  );
  if (
    (!limits.freeTierConfirmed &&
      !(
        Number.isInteger(limits.monthlyBudgetMicros) &&
        limits.monthlyBudgetMicros! > 0 &&
        limits.monthlyBudgetMicros! <= 10000000
      )) ||
    ![limits.rpm, limits.tpm, limits.rpd].every(
      (n) => Number.isInteger(n) && n > 0,
    )
  )
    return {
      allowed: false,
      retryAt: now + 3600000,
      reason:
        "Configure Gemini project limits and a confirmed free tier or authorized monthly budget",
    };
  if (state.blockedUntil && state.blockedUntil > now)
    return {
      allowed: false,
      retryAt: state.blockedUntil,
      reason: "Provider quota cooldown",
    };
  if (state.active && state.active.until > now)
    return {
      allowed: false,
      retryAt: state.active.until,
      reason: "Another model request is running",
    };
  const daily = state.requests.filter((r) => pacificDay(r.at) === day),
    minute = state.requests.filter((r) => r.at > now - 60000);
  const cap = (n: number) => Math.max(1, Math.floor(n * 0.9));
  if (daily.length >= cap(limits.rpd))
    return {
      allowed: false,
      retryAt: nextPacificDay(now),
      reason: "Daily quota reserved; waiting for Pacific midnight",
    };
  if (
    request.training &&
    daily.filter((r) => r.training).length >= Math.floor(limits.rpd * 0.1)
  )
    return {
      allowed: false,
      retryAt: nextPacificDay(now),
      reason: "Evaluation quota reserved",
    };
  if (request.tokens > cap(limits.tpm))
    return {
      allowed: false,
      retryAt: now + 3600000,
      reason: "Context exceeds the token window; shorten this task",
    };
  if (
    minute.length >= cap(limits.rpm) ||
    minute.reduce((n, r) => n + r.tokens, 0) + request.tokens > cap(limits.tpm)
  )
    return {
      allowed: false,
      retryAt: Math.min(...minute.map((r) => r.at)) + 60001,
      reason: "Waiting for the model minute window",
    };
  if (!limits.freeTierConfirmed) {
    const cost = request.costMicros;
    if (!Number.isSafeInteger(cost) || cost! <= 0)
      return {
        allowed: false,
        retryAt: now + 3600000,
        reason: "Valid request cost reservation required",
      };
    const month = day.slice(0, 7);
    const spent =
      state.spend?.month === month
        ? state.spend
        : { month, reservedMicros: 0, trainingMicros: 0 };
    if (
      spent.reservedMicros + cost! > limits.monthlyBudgetMicros! ||
      (request.training &&
        spent.trainingMicros + cost! > limits.monthlyBudgetMicros! * 0.1)
    ) {
      let next = nextPacificDay(now);
      while (pacificDay(next).startsWith(month)) next = nextPacificDay(next);
      return {
        allowed: false,
        retryAt: next,
        reason: request.training
          ? "Monthly evaluation budget reserved"
          : "Monthly camp budget reserved; waiting for next month",
      };
    }
    spent.reservedMicros += cost!;
    if (request.training) spent.trainingMicros += cost!;
    state.spend = spent;
  }
  state.requests.push({ ...request, at: now });
  state.active = { id: request.id, until: now + 100000 };
  return { allowed: true, retryAt: now, reason: "Reserved" };
}
