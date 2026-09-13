import { DomainError } from "./errors";

export const spiritLaunchId = "spirits-first-issue";
export const astraModel = "gpt-6-astra";
export const flashModel = "gemini-3.8-flash";
export const launchBudgetMicros = 50_000_000;
export const launchOutputTokens = 16_384;
export interface LaunchRequest {
  id: string;
  campId: string;
  jobId: string;
  reservedMicros: number;
  at: number;
  usage?: { inputTokens: number; outputTokens: number };
}
export interface LaunchLedger {
  reservedMicros: number;
  fallbackAt?: number;
  requests: LaunchRequest[];
}
export const emptyLaunchLedger = (): LaunchLedger => ({
  reservedMicros: 0,
  requests: [],
});

export function culturalModelRequest(
  raw: Record<string, unknown>,
  model: string,
  reasoning: string,
) {
  if (![astraModel, flashModel].includes(model))
    throw new DomainError("Unsupported cultural model");
  if (!Array.isArray(raw.messages))
    throw new DomainError("Model messages required");
  for (const message of raw.messages) {
    if (
      !message ||
      !["system", "developer", "user", "assistant", "tool"].includes(
        message.role,
      )
    )
      throw new DomainError("Unsupported model message");
    if (
      message.content != null &&
      typeof message.content !== "string" &&
      !(
        Array.isArray(message.content) &&
        message.content.every(
          (p: { type?: string; text?: unknown }) =>
            p?.type === "text" && typeof p.text === "string",
        )
      )
    )
      throw new DomainError("The launch model budget supports text only");
  }
  if (
    raw.tools !== undefined &&
    (!Array.isArray(raw.tools) ||
      raw.tools.some(
        (t) =>
          t?.type !== "function" ||
          !(
            t.function?.name === "memory" ||
            /^camp_/.test(t.function?.name ?? "")
          ),
      ))
  )
    throw new DomainError("Only camp function tools are allowed");
  return {
    model,
    messages: raw.messages,
    ...(raw.tools ? { tools: raw.tools } : {}),
    ...(raw.tool_choice ? { tool_choice: raw.tool_choice } : {}),
    stream: raw.stream === true,
    ...(raw.stream === true ? { stream_options: { include_usage: true } } : {}),
    reasoning_effort: ["low", "medium", "high"].includes(reasoning)
      ? reasoning
      : "high",
    max_completion_tokens: model === astraModel ? launchOutputTokens : 8192,
    ...(model === astraModel ? { store: false, service_tier: "default" } : {}),
  };
}

// Text-only Standard requests, below the long-context threshold. Reserve the
// higher cache-write input price, with no assumed cache discounts or refunds.
export function astraReservation(
  inputBytes: number,
  outputTokens = launchOutputTokens,
) {
  if (
    !Number.isSafeInteger(inputBytes) ||
    inputBytes < 1 ||
    inputBytes > 180_000 ||
    !Number.isSafeInteger(outputTokens) ||
    outputTokens < 1 ||
    outputTokens > launchOutputTokens
  )
    throw new DomainError(
      "Shorten the model context to 180 KB before continuing",
    );
  return Math.ceil((inputBytes + 8192) * 12.5 + outputTokens * 50);
}
export function reserveLaunchRequest(
  state: LaunchLedger,
  request: {
    id: string;
    campId: string;
    jobId: string;
    inputBytes: number;
    outputTokens?: number;
  },
  now: number,
) {
  const existing = state.requests.find((r) => r.id === request.id);
  if (existing)
    return { model: astraModel, reservedMicros: existing.reservedMicros };
  if (state.fallbackAt !== undefined)
    return { model: flashModel, reservedMicros: 0 };
  const cost = astraReservation(request.inputBytes, request.outputTokens);
  if (state.reservedMicros + cost > launchBudgetMicros) {
    state.fallbackAt = now;
    return { model: flashModel, reservedMicros: 0 };
  }
  state.reservedMicros += cost;
  state.requests.push({
    id: request.id,
    campId: request.campId,
    jobId: request.jobId,
    reservedMicros: cost,
    at: now,
  });
  return { model: astraModel, reservedMicros: cost };
}
export function recordLaunchUsage(
  state: LaunchLedger,
  id: string,
  usage: LaunchRequest["usage"],
) {
  const request = state.requests.find((r) => r.id === id);
  if (!request) throw new DomainError("Launch request reservation missing");
  if (!usage || request.usage) return;
  if (
    ![usage.inputTokens, usage.outputTokens].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    )
  )
    throw new DomainError("Invalid provider usage");
  request.usage = usage;
}
export function launchSummary(state: LaunchLedger) {
  return {
    id: spiritLaunchId,
    limitUsd: launchBudgetMicros / 1e6,
    reservedUsd: state.reservedMicros / 1e6,
    remainingUsd: (launchBudgetMicros - state.reservedMicros) / 1e6,
    fallback: state.fallbackAt !== undefined,
    fallbackAt: state.fallbackAt,
    reportedInputTokens: state.requests.reduce(
      (n, r) => n + (r.usage?.inputTokens ?? 0),
      0,
    ),
    reportedOutputTokens: state.requests.reduce(
      (n, r) => n + (r.usage?.outputTokens ?? 0),
      0,
    ),
    requests: state.requests.length,
    unreportedRequests: state.requests.filter((r) => !r.usage).length,
  };
}
