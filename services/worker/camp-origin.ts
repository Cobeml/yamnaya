import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
export function startCampOrigin() {
  const key = process.env.CAMP_ORIGIN_SECRET;
  if (!key) return;
  if (key.length < 32)
    throw new Error("Origin secret must be at least 32 characters");
  return http
    .createServer(async (req, res) => {
      const supplied = Buffer.from(
          String(req.headers["x-camp-origin-secret"] ?? ""),
        ),
        expected = Buffer.from(key);
      if (
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      ) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        const url = new URL(req.url ?? "/", "http://origin");
        const preview = url.pathname.startsWith("/preview/");
        if (!preview && !/^\/api\/camps(?:\/|$)/.test(url.pathname)) {
          res.writeHead(404);
          res.end();
          return;
        }
        if (preview && req.method !== "GET") {
          res.writeHead(405);
          res.end();
          return;
        }
        const headers = new Headers();
        for (const name of [
          "authorization",
          "cookie",
          "content-type",
          "origin",
          "idempotency-key",
        ]) {
          const value = req.headers[name];
          if (typeof value === "string") headers.set(name, value);
        }
        let body: Buffer | undefined;
        if (!["GET", "HEAD"].includes(req.method ?? "GET")) {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 1000000) {
              res.writeHead(413);
              res.end();
              return;
            }
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }
        const base = preview
          ? `http://127.0.0.1:${process.env.CAMP_GATEWAY_PORT ?? 4112}`
          : process.env.CAMP_API_URL!;
        const response = await fetch(new URL(url.pathname + url.search, base), {
          method: req.method,
          headers,
          body: body ? new Uint8Array(body).buffer : undefined,
          redirect: "manual",
          signal: AbortSignal.timeout(25000),
        });
        res.writeHead(
          response.status,
          Object.fromEntries(
            [...response.headers].filter(
              ([k]) =>
                ![
                  "content-encoding",
                  "content-length",
                  "transfer-encoding",
                ].includes(k),
            ),
          ),
        );
        if (response.body)
          Readable.fromWeb(response.body as never)
            .on("error", () => res.destroy())
            .pipe(res);
        else res.end();
      } catch {
        if (!res.headersSent) res.writeHead(503);
        res.end("Local origin unavailable");
      }
    })
    .listen(
      Number(process.env.CAMP_ORIGIN_PORT ?? 4114),
      process.env.CAMP_GATEWAY_HOST ?? "127.0.0.1",
    );
}
