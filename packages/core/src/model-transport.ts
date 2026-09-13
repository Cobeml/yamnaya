import { DomainError } from "./errors";
import { astraModel, type culturalModelRequest } from "./launch";

type ChatMessage = {
  role: string;
  content?: string | null | { type: string; text: string }[];
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }[];
};
type OutputItem = {
  type: string;
  id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string; refusal?: string }[];
  encrypted_content?: string;
  summary?: unknown[];
};
export interface AstraResponse {
  id: string;
  status: string;
  output: OutputItem[];
  usage?: { input_tokens: number; output_tokens: number };
}
export function astraResponsesRequest(
  chat: ReturnType<typeof culturalModelRequest>,
  contexts: Record<string, unknown[]> = {},
) {
  const input: Record<string, unknown>[] = [];
  for (const message of chat.messages as ChatMessage[]) {
    if (message.role === "tool") {
      if (!message.tool_call_id)
        throw new DomainError("Tool result call ID missing");
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content),
      });
      continue;
    }
    if (message.content)
      input.push({
        role: message.role,
        content:
          typeof message.content === "string"
            ? message.content
            : message.content.map((p) => p.text).join("\n"),
      });
    for (const call of message.tool_calls ?? []) {
      for (const reasoning of contexts[call.id] ?? [])
        input.push(reasoning as Record<string, unknown>);
      input.push({
        type: "function_call",
        call_id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      });
    }
  }
  const tools = (
    chat.tools as
      | {
          function: { name: string; description?: string; parameters: unknown };
        }[]
      | undefined
  )?.map((t) => ({ type: "function", ...t.function, strict: false }));
  return {
    model: astraModel,
    input,
    ...(tools ? { tools } : {}),
    reasoning: { effort: chat.reasoning_effort },
    max_output_tokens: chat.max_completion_tokens,
    store: false,
    stream: false,
    service_tier: "default",
    include: ["reasoning.encrypted_content"],
  };
}

export function astraChatResponse(value: AstraResponse, stream: boolean) {
  if (
    !["completed", "incomplete"].includes(value.status) ||
    !Array.isArray(value.output)
  )
    throw new DomainError("Astra response did not complete");
  const calls = value.output
    .filter((o) => o.type === "function_call")
    .map((o) => {
      if (!o.call_id || !o.name || typeof o.arguments !== "string")
        throw new DomainError("Incomplete Astra function call");
      return {
        id: o.call_id,
        type: "function",
        function: { name: o.name, arguments: o.arguments },
      };
    });
  const content = value.output
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .map((c) => c.text ?? c.refusal ?? "")
    .join("");
  const message = {
    role: "assistant",
    content: content || null,
    ...(calls.length ? { tool_calls: calls } : {}),
  };
  const finish =
    value.status === "incomplete"
      ? "length"
      : calls.length
        ? "tool_calls"
        : "stop";
  const usage = value.usage
    ? {
        prompt_tokens: value.usage.input_tokens,
        completion_tokens: value.usage.output_tokens,
        total_tokens: value.usage.input_tokens + value.usage.output_tokens,
      }
    : undefined;
  const common = { id: value.id, model: astraModel, created: 0 };
  const contexts = calls.length
    ? [
        {
          callId: calls[0].id,
          reasoning: value.output.filter((o) => o.type === "reasoning"),
        },
      ]
    : [];
  if (!stream)
    return {
      contexts,
      contentType: "application/json",
      body: JSON.stringify({
        ...common,
        object: "chat.completion",
        choices: [{ index: 0, message, finish_reason: finish }],
        usage,
      }),
    };
  const delta = {
    ...message,
    ...(calls.length
      ? { tool_calls: calls.map((c, index) => ({ ...c, index })) }
      : {}),
  };
  return {
    contexts,
    contentType: "text/event-stream",
    body:
      `data: ${JSON.stringify({ ...common, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ ...common, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: finish }], usage })}\n\ndata: [DONE]\n\n`,
  };
}
