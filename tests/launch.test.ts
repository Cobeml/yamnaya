import { expect, it } from "vitest";
import {
  astraModel,
  astraReservation,
  culturalModelRequest,
  emptyLaunchLedger,
  flashModel,
  launchBudgetMicros,
  launchSummary,
  prepareSpiritLaunch,
  recordLaunchUsage,
  reserveLaunchRequest,
  createCamp,
  createPublication,
  startWorkflow,
  type LaunchLedger,
} from "../packages/core/src";

it("retains shared spending and fallback across restarts and calendar boundaries", () => {
  let state = emptyLaunchLedger();
  const now = Date.parse("2026-09-30T23:59:00Z");
  let calls = 0;
  while (!state.fallbackAt) {
    reserveLaunchRequest(
      state,
      {
        id: `r${calls}`,
        campId: calls % 2 ? "china" : "america",
        jobId: `j${calls}`,
        inputBytes: 80000,
      },
      now + calls++ * 60000,
    );
    state = JSON.parse(JSON.stringify(state)) as LaunchLedger;
  }
  expect(state.reservedMicros).toBeLessThanOrEqual(launchBudgetMicros);
  expect(state.reservedMicros + astraReservation(80000)).toBeGreaterThan(
    launchBudgetMicros,
  );
  const before = structuredClone(state);
  expect(
    reserveLaunchRequest(
      state,
      { id: "later", campId: "america", jobId: "later", inputBytes: 10 },
      now + 400 * 86400000,
    ).model,
  ).toBe(flashModel);
  expect(state).toEqual(before);
});

it("deduplicates reservation and usage receipts without refunding unknown effects", () => {
  const state = emptyLaunchLedger();
  const request = {
    id: "same",
    campId: "america",
    jobId: "j",
    inputBytes: 10000,
  };
  expect(reserveLaunchRequest(state, request, 1).model).toBe(astraModel);
  const reserved = state.reservedMicros;
  reserveLaunchRequest(state, request, 2);
  expect(state.requests).toHaveLength(1);
  recordLaunchUsage(state, "same", undefined);
  expect(launchSummary(state).unreportedRequests).toBe(1);
  recordLaunchUsage(state, "same", { inputTokens: 100, outputTokens: 40 });
  recordLaunchUsage(state, "same", { inputTokens: 200, outputTokens: 90 });
  expect(state.reservedMicros).toBe(reserved);
  expect(launchSummary(state).reportedInputTokens).toBe(100);
  expect(() =>
    recordLaunchUsage(state, "missing", { inputTokens: 1, outputTokens: 1 }),
  ).toThrow();
});

it("bounds priced requests and strips attempts to select premium or unmetered effects", () => {
  const messages = [
    { role: "user", content: "Find original texts" },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "done",
          type: "function",
          function: { name: "camp_observe", arguments: "{}" },
        },
      ],
    },
    { role: "tool", tool_call_id: "done", content: "retained result" },
  ];
  const raw = {
    messages,
    model: "unapproved",
    n: 10,
    service_tier: "priority",
    max_completion_tokens: 100000,
    tools: [
      {
        type: "function",
        function: { name: "camp_observe", parameters: { type: "object" } },
      },
    ],
  };
  const astra = culturalModelRequest(raw, astraModel, "high");
  expect(astra).not.toHaveProperty("n");
  expect(astra.service_tier).toBe("default");
  expect(astra.max_completion_tokens).toBeLessThan(100000);
  const fallback = culturalModelRequest(raw, flashModel, "high");
  expect(fallback.messages[2]).toEqual(messages[2]); // tool results survive provider switch
  expect(fallback.messages[1].tool_calls[0].function).toEqual(
    messages[1].tool_calls![0].function,
  );
  expect(
    fallback.messages[1].tool_calls[0].extra_content.google.thought_signature,
  ).toBe("skip_thought_signature_validator");
  const signed = structuredClone(raw);
  Object.assign(signed.messages[1].tool_calls![0], {
    extra_content: { google: { thought_signature: "provider-signature" } },
  });
  expect(
    culturalModelRequest(signed, flashModel, "high").messages[1].tool_calls[0]
      .extra_content.google.thought_signature,
  ).toBe("provider-signature");
  expect(fallback).not.toHaveProperty("service_tier");
  expect(() =>
    culturalModelRequest(
      { ...raw, tools: [{ type: "web_search" }] },
      astraModel,
      "high",
    ),
  ).toThrow();
  expect(() =>
    culturalModelRequest(
      {
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: "https://example.com" }],
          },
        ],
      },
      astraModel,
      "high",
    ),
  ).toThrow();
  expect(() => astraReservation(180001)).toThrow();
});

it("prepares existing pilots once, preserves workflows, and requires operator authority", () => {
  const now = new Date().toISOString();
  const camp = createCamp(
    "camp-america",
    { name: "America", domain: "research", focus: "america", mode: "live" },
    "owner",
    now,
  );
  const actor = { kind: "operator" as const, id: "owner" };
  const p = createPublication(
    camp,
    { title: "America", repository: "owner/america" },
    actor,
    now,
  );
  startWorkflow(camp, p.id, actor, now);
  expect(() =>
    prepareSpiritLaunch(
      camp,
      { kind: "agent", id: "owner", agentId: "finder", campId: camp.id },
      now,
    ),
  ).toThrow();
  prepareSpiritLaunch(camp, actor, now);
  const saved = structuredClone(camp);
  prepareSpiritLaunch(camp, actor, now);
  expect(camp).toEqual(saved);
  expect(camp.status).toBe("paused");
  expect(camp.jobs).toHaveLength(0);
  expect(camp.cultural?.tasks).toHaveLength(4);
  expect(camp.missions).toHaveLength(1);
  expect(
    camp.agents.filter(
      (a) => a.configurations.at(-1)?.modelProfile?.model === astraModel,
    ),
  ).toHaveLength(2);
});
