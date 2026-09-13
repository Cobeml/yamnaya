import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, expect, it, vi } from "vitest";
import { signCampToken } from "../apps/web/lib/camp-auth";
import { astraModel, flashModel, spiritLaunchId } from "../packages/core/src";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  reserve: vi.fn(),
  usage: vi.fn(),
  google: vi.fn(),
  release: vi.fn(),
}));
vi.mock("../services/worker/camp-client", () => ({ campApi: mocks.api }));
vi.mock("../services/worker/camp-launch", () => ({
  reserveAstra: mocks.reserve,
  recordAstraUsage: mocks.usage,
}));
vi.mock("../services/worker/camp-quota", () => ({
  reserveGoogleQuota: mocks.google,
  releaseGoogleQuota: mocks.release,
}));
vi.mock("../services/worker/camp-astra", async () => {
  const core = await import("../packages/core/src");
  return {
    prepareAstraRequest: async (
      _camp: string,
      _agent: string,
      chat: ReturnType<typeof core.culturalModelRequest>,
    ) => core.astraResponsesRequest(chat),
    adaptAstraResponse: async (
      _camp: string,
      _agent: string,
      response: Response,
      stream: boolean,
    ) => {
      const adapted = core.astraChatResponse(await response.json(), stream);
      return new Response(adapted.body, {
        headers: { "content-type": adapted.contentType },
      });
    },
  };
});
import { startCampGateway } from "../services/worker/camp-gateway";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("routes authenticated research through Astra then Flash with usage receipts and retained tool results", async () => {
  vi.stubEnv("CAMP_SESSION_SECRET", "s".repeat(40));
  vi.stubEnv("CAMP_GATEWAY_PORT", "0");
  vi.stubEnv("CAMP_SPIRIT_LAUNCH_ENABLED", "true");
  vi.stubEnv("CAMP_MODEL_API_KEY", "openai-fixture");
  vi.stubEnv("CAMP_GEMINI_API_KEY", "google-fixture");
  mocks.api.mockResolvedValue({
    cultural: true,
    launch: spiritLaunchId,
    profile: { model: astraModel, reasoning: "high" },
    requestNumber: 1,
  });
  mocks.reserve
    .mockResolvedValueOnce({ model: astraModel, id: "reserved" })
    .mockResolvedValue({ model: flashModel, id: "fallback" });
  mocks.google.mockResolvedValue({ allowed: true, id: "google" });
  mocks.usage.mockResolvedValue(undefined);
  mocks.release.mockResolvedValue(undefined);
  const realFetch = globalThis.fetch;
  const upstream = vi.fn(async (destination?: string) =>
    destination?.endsWith("/responses")
      ? new Response(
          JSON.stringify({
            id: "resp_fixture",
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: "Ready" }],
              },
            ],
            usage: { input_tokens: 12, output_tokens: 8 },
          }),
        )
      : new Response(
          'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":8}}\n\ndata: [DONE]\n\n',
          { headers: { "content-type": "text/event-stream" } },
        ),
  );
  vi.stubGlobal("fetch", upstream);
  const server = startCampGateway();
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/chat/completions`;
  const token = signCampToken({
    kind: "agent",
    campId: "america",
    agentId: "finder",
    jobId: "job",
    exp: Date.now() + 60000,
  });
  const messages = [
    { role: "user", content: "Sources" },
    { role: "tool", tool_call_id: "done", content: "Existing evidence" },
  ];
  try {
    const denied = await realFetch(url, { method: "POST", body: "{}" });
    expect(denied.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
    for (const model of [astraModel, flashModel]) {
      const response = await realFetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages,
          stream: true,
          model: "untrusted",
          n: 8,
        }),
      });
      expect(response.status).toBe(200);
      await response.text();
      const [destination, options] = upstream.mock.calls.at(-1)! as unknown as [
        string,
        RequestInit,
      ];
      expect(destination).toContain(
        model === astraModel
          ? "api.openai.com"
          : "generativelanguage.googleapis.com",
      );
      const body = JSON.parse(String(options.body));
      expect(body.model).toBe(model);
      if (model === astraModel) {
        expect(destination).toMatch(/\/responses$/);
        expect(body.reasoning).toEqual({ effort: "high" });
        expect(body.input.at(-1)).toEqual({
          type: "function_call_output",
          call_id: "done",
          output: "Existing evidence",
        });
      } else expect(body.messages).toEqual(messages);
      expect(body.n).toBeUndefined();
    }
    await vi.waitFor(() =>
      expect(mocks.usage).toHaveBeenCalledWith("reserved", {
        inputTokens: 12,
        outputTokens: 8,
      }),
    );
    expect(mocks.api).toHaveBeenCalledWith(
      "america/worker/model-fallback",
      {},
      "spirits-fallback",
    );
    expect(mocks.google).toHaveBeenCalledTimes(1);
    vi.stubEnv("CAMP_MODEL_API_KEY", "");
    const before = mocks.reserve.mock.calls.length;
    const missing = await realFetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    expect(missing.status).toBe(503);
    await missing.text();
    expect(mocks.reserve).toHaveBeenCalledTimes(before);
    vi.stubEnv("CAMP_MODEL_API_KEY", "openai-fixture");
    upstream.mockImplementationOnce(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"first"}}]}\n\n',
                ),
              );
              setTimeout(() => {
                controller.enqueue(
                  new TextEncoder().encode(
                    'data: {"usage":{"prompt_tokens":666,"completion_tokens":7}}\n\ndata: [DONE]\n\n',
                  ),
                );
                controller.close();
              }, 40);
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        ),
    );
    const interrupted = await realFetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, stream: true }),
    });
    const reader = interrupted.body!.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "america/worker/model-result",
        expect.objectContaining({
          usage: { inputTokens: 666, outputTokens: 7 },
        }),
      ),
    );
    expect(mocks.release).toHaveBeenCalledWith("google");
    upstream.mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "unsupported_parameter",
              param: "bad_field",
              message: "private diagnostic fixture",
            },
          }),
          { status: 400 },
        ),
    );
    const rejected = await realFetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).not.toContain("private diagnostic fixture");
    expect(mocks.api).toHaveBeenCalledWith(
      "america/worker/model-error",
      expect.objectContaining({
        detail: "Model provider HTTP 400: unsupported_parameter (bad_field)",
      }),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
