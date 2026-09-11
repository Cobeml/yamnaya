import type { NextRequest } from "next/server";
// Vercel only relays bounded requests. State and database credentials stay local.
export async function relayCampRequest(
  request: NextRequest,
): Promise<Response | null> {
  const origin = process.env.CAMP_ORIGIN_URL;
  if (!origin) return null;
  const secret = process.env.CAMP_ORIGIN_SECRET;
  if (!secret || secret.length < 32)
    return new Response("Origin not configured", { status: 503 });
  const headers = new Headers({ "X-Camp-Origin-Secret": secret });
  for (const name of [
    "authorization",
    "cookie",
    "content-type",
    "origin",
    "idempotency-key",
  ])
    if (request.headers.has(name))
      headers.set(name, request.headers.get(name)!);
  try {
    let body: ArrayBuffer | undefined;
    if (!["GET", "HEAD"].includes(request.method)) {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 1000000) {
            await reader.cancel();
            return new Response("Request exceeds 1 MB", { status: 413 });
          }
          chunks.push(value);
        }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      body = bytes.buffer;
    }
    const response = await fetch(
      new URL(request.nextUrl.pathname + request.nextUrl.search, origin),
      {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      },
    );
    const output = new Headers(response.headers);
    output.delete("content-encoding");
    output.delete("content-length");
    const cookie = output.get("set-cookie");
    if (cookie && !/;\s*secure/i.test(cookie))
      output.set("set-cookie", cookie + "; Secure");
    return new Response(response.body, {
      status: response.status,
      headers: output,
    });
  } catch {
    return Response.json(
      { error: "Local camp executor is offline", code: "ORIGIN_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
