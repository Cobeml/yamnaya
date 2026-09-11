export interface QuotaLimits {
  rpm: number;
  tpm: number;
  rpd: number;
  freeTierConfirmed: boolean;
}
export interface QuotaState {
  requests: { id: string; at: number; tokens: number; training: boolean }[];
  active?: { id: string; until: number };
  blockedUntil?: number;
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
  request: { id: string; tokens: number; training: boolean },
  now: number,
): { allowed: boolean; retryAt: number; reason: string } {
  const day = pacificDay(now);
  state.requests = state.requests.filter(
    (r) => pacificDay(r.at) === day || r.at > now - 60000,
  );
  if (
    !limits.freeTierConfirmed ||
    ![limits.rpm, limits.tpm, limits.rpd].every(
      (n) => Number.isInteger(n) && n > 0,
    )
  )
    return {
      allowed: false,
      retryAt: now + 3600000,
      reason: "Configure and confirm Gemini free-tier project limits",
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
      reason: "Daily free quota reserved; waiting for Pacific midnight",
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
      reason: "Context exceeds the free-tier token window; shorten this task",
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
  state.requests.push({ ...request, at: now });
  state.active = { id: request.id, until: now + 100000 };
  return { allowed: true, retryAt: now, reason: "Reserved" };
}
