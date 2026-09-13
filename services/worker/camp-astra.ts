import {
  astraChatResponse,
  astraResponsesRequest,
  type AstraResponse,
  type culturalModelRequest,
} from "@yamnaya/core";
import { campDatabase } from "../../apps/web/lib/camp-store";

export async function prepareAstraRequest(
  campId: string,
  agentId: string,
  chat: ReturnType<typeof culturalModelRequest>,
) {
  const calls = chat.messages.flatMap((m) =>
    (m.tool_calls ?? []).map((c: { id: string }) => c.id),
  );
  const contexts: Record<string, unknown[]> = {};
  if (calls.length) {
    const db = campDatabase();
    const rows =
      await db`SELECT call_id,reasoning FROM camp_model_context WHERE camp_id=${campId} AND agent_id=${agentId} AND call_id IN ${db(calls)}`;
    for (const row of rows) contexts[row.call_id] = row.reasoning;
  }
  return astraResponsesRequest(chat, contexts);
}
export async function adaptAstraResponse(
  campId: string,
  agentId: string,
  upstream: Response,
  stream: boolean,
) {
  let body = "";
  if (!upstream.body) throw new Error("Astra response body missing");
  const decoder = new TextDecoder();
  let bytes = 0;
  for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
    bytes += chunk.byteLength;
    if (bytes > 4_000_000)
      throw new Error("Astra response exceeds the bounded body");
    body += decoder.decode(chunk, { stream: true });
  }
  body += decoder.decode();
  const adapted = astraChatResponse(JSON.parse(body) as AstraResponse, stream);
  // Encrypted provider reasoning stays local and scoped to this camp/agent. It
  // never enters a publication, another agent's profile, or a Gemini request.
  const db = campDatabase();
  await db.begin(async (tx) => {
    for (const context of adapted.contexts)
      await tx`INSERT INTO camp_model_context(camp_id,agent_id,call_id,reasoning) VALUES(${campId},${agentId},${context.callId},${tx.json(context.reasoning as never)}) ON CONFLICT DO NOTHING`;
  });
  return new Response(adapted.body, {
    headers: { "content-type": adapted.contentType },
  });
}
