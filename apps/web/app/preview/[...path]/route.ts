import { relayCampRequest } from "../../../lib/camp-relay";
import type { NextRequest } from "next/server";
import {
  loadDatabaseArtifact,
  validPreviewToken,
} from "../../../../../services/worker/camp-artifact-database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const mime: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  pdf: "application/pdf",
};
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const origin = process.env.CAMP_PREVIEW_URL;
    if (
      !origin ||
      new URL(origin).origin === process.env.CAMP_PUBLIC_URL ||
      request.nextUrl.host !== new URL(origin).host
    )
      return new Response("Preview origin required", { status: 403 });
    const relayed = await relayCampRequest(request);
    if (relayed) return relayed;
    const [campId, buildId, token, ...parts] = (await context.params).path;
    if (
      !campId ||
      !buildId ||
      !token ||
      !validPreviewToken(campId, buildId, token)
    )
      return new Response("Invalid preview link", { status: 403 });
    const artifact = await loadDatabaseArtifact(campId, buildId);
    const file = parts.join("/") || "index.html";
    if (!Object.hasOwn(artifact.files, file))
      return new Response("Not found", { status: 404 });
    const bytes = Buffer.from(artifact.files[file], "base64");
    let offset = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (offset >= bytes.length) {
          controller.close();
          return;
        }
        controller.enqueue(
          new Uint8Array(bytes.subarray(offset, offset + 65536)),
        );
        offset += 65536;
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type":
          mime[file.split(".").pop()!] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, max-age=3600",
        "Content-Security-Policy":
          "sandbox allow-scripts; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors *",
      },
    });
  } catch {
    return new Response("Preview unavailable", { status: 404 });
  }
}
