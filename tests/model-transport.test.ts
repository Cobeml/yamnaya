import { expect, it } from "vitest";
import {
  astraModel,
  astraChatResponse,
  astraResponsesRequest,
  culturalModelRequest,
} from "../packages/core/src";

it("preserves call IDs, parallel results and encrypted reasoning across the Responses bridge", () => {
  const reasoning = {
    type: "reasoning",
    id: "rs_1",
    encrypted_content: "opaque-fixture",
    summary: [],
  };
  const response = astraChatResponse(
    {
      id: "resp_1",
      status: "completed",
      output: [
        reasoning,
        {
          type: "function_call",
          call_id: "call_1",
          name: "camp_observe",
          arguments: "{}",
        },
        {
          type: "function_call",
          call_id: "call_2",
          name: "camp_cultural",
          arguments: "{}",
        },
      ],
      usage: { input_tokens: 200, output_tokens: 100 },
    },
    false,
  );
  const chat = JSON.parse(response.body);
  expect(chat.choices[0].finish_reason).toBe("tool_calls");
  expect(chat.usage.completion_tokens).toBe(100);
  expect(response.body).not.toContain("opaque-fixture");
  const next = culturalModelRequest(
    {
      messages: [
        { role: "user", content: "Inspect" },
        chat.choices[0].message,
        { role: "tool", tool_call_id: "call_1", content: "camp state" },
        { role: "tool", tool_call_id: "call_2", content: "sources" },
      ],
      tools: [
        {
          type: "function",
          function: { name: "camp_observe", parameters: { type: "object" } },
        },
      ],
    },
    astraModel,
    "high",
  );
  const wire = astraResponsesRequest(
    next,
    Object.fromEntries(response.contexts.map((c) => [c.callId, c.reasoning])),
  );
  expect(wire.input.map((i) => i.type)).toEqual([
    undefined,
    "reasoning",
    "function_call",
    "function_call",
    "function_call_output",
    "function_call_output",
  ]);
  expect(wire.input[1]).toEqual(reasoning);
  expect(wire.input[4].call_id).toBe("call_1");
  expect(wire.input[5].call_id).toBe("call_2");
  expect(wire).not.toHaveProperty("reasoning_effort");
  expect(wire.store).toBe(false);
});

it("encodes Chat-compatible SSE and does not label incomplete work successful", () => {
  const response = astraChatResponse(
    {
      id: "r",
      status: "incomplete",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Partial" }],
        },
      ],
    },
    true,
  );
  const chunks = response.body
    .split("\n")
    .filter((l) => l.startsWith("data: {"))
    .map((l) => JSON.parse(l.slice(6)));
  expect(chunks[0].choices[0].delta.content).toBe("Partial");
  expect(chunks[1].choices[0].finish_reason).toBe("length");
  expect(() =>
    astraChatResponse({ id: "r", status: "failed", output: [] }, false),
  ).toThrow();
});
