import { reserveGoogleQuota, releaseGoogleQuota } from "./camp-quota";
import http from "node:http";
import {
  astraModel,
  flashModel,
  spiritLaunchId,
  culturalModelRequest,
} from "@yamnaya/core";
import { reserveAstra, recordAstraUsage } from "./camp-launch";
import { Readable, Transform } from "node:stream";
import { verifyCampToken } from "../../apps/web/lib/camp-auth";
import { campApi } from "./camp-client";
import { loadArtifact, validPreviewToken } from "./camp-artifacts";
const mime: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css",
  js: "text/javascript",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  woff2: "font/woff2",
  pdf: "application/pdf",
};
export function startCampGateway() {
  return http
    .createServer(async (req, res) => {
      let quotaId: string | undefined;
      let astraId: string | undefined;
      try {
        const url = new URL(req.url ?? "/", "http://gateway");
        if (req.method === "GET" && url.pathname === "/health") {
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (req.method === "GET" && url.pathname.startsWith("/preview/")) {
          const [, , campId, buildId, token, ...parts] =
            url.pathname.split("/");
          if (!validPreviewToken(campId, buildId, token)) {
            res.writeHead(403);
            res.end();
            return;
          }
          const artifact = await loadArtifact(campId, buildId);
          const name = decodeURIComponent(parts.join("/")) || "index.html";
          if (!Object.hasOwn(artifact.files, name)) {
            res.writeHead(404);
            res.end("Artifact file not found");
            return;
          }
          res.writeHead(200, {
            "Content-Type":
              mime[name.split(".").pop()!] ?? "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "private, max-age=3600",
            "Content-Security-Policy":
              "sandbox allow-scripts; default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors *",
          });
          res.end(Buffer.from(artifact.files[name], "base64"));
          return;
        }
        if (
          req.method !== "POST" ||
          !["/v1/chat/completions", "/v1/responses"].includes(url.pathname)
        ) {
          res.writeHead(404);
          res.end();
          return;
        }
        const bearer = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
        const token = verifyCampToken(bearer);
        if (!token || token.kind !== "agent" || !token.jobId || !token.campId) {
          res.writeHead(401);
          res.end();
          return;
        }

        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 800000)
            throw new Error("Model context exceeds configured bound");
        }
        let input = JSON.parse(raw);

        delete input.store;
        input.store = false;
        if (url.pathname.endsWith("responses"))
          input.max_output_tokens = Math.min(
            Number(input.max_output_tokens) || 4096,
            4096,
          );
        else {
          delete input.max_tokens;
          input.max_completion_tokens = Math.min(
            Number(input.max_completion_tokens) || 4096,
            4096,
          );
        }
        if (input.stream && url.pathname.endsWith("completions"))
          input.stream_options = { include_usage: true };
        let reservation = await campApi(
          `${token.campId}/worker/model-reserve`,
          {
            jobId: token.jobId,
            agentId: token.agentId,
            inspect: true,
          },
        );
        let google = reservation.cultural === true;
        if (reservation.cultural) {
          if (!url.pathname.endsWith("chat/completions"))
            throw new Error("Cultural Hermes calls require Chat Completions");
          let model = flashModel;
          const research =
            reservation.launch === spiritLaunchId &&
            ["finder", "referencer"].includes(String(token.agentId)) &&
            reservation.profile?.model === astraModel &&
            !reservation.training;
          if (
            reservation.launch === spiritLaunchId &&
            process.env.CAMP_SPIRIT_LAUNCH_ENABLED !== "true"
          )
            throw new Error("Spirit launch is not enabled");
          if (reservation.launch === spiritLaunchId && reservation.training)
            throw new Error("Paid training is disabled during the first issue");
          if (!process.env.CAMP_GEMINI_API_KEY)
            throw new Error("Gemini key is missing");
          if (research) {
            if (Date.now() >= Date.parse("2027-01-01T00:00:00Z"))
              throw new Error("Review launch model prices before paid calls");
            if (!process.env.CAMP_MODEL_API_KEY)
              throw new Error("OpenAI key is missing");
            const prepared = culturalModelRequest(
              input,
              astraModel,
              reservation.profile?.reasoning,
            );
            const budget = await reserveAstra(
              String(token.campId),
              String(token.jobId),
              Buffer.byteLength(JSON.stringify(prepared), "utf8"),
            );
            model = budget.model;
            if (model === astraModel) astraId = budget.id;
            // This journal entry also feeds the durable Discord update path.
            if (model === flashModel)
              await campApi(
                `${token.campId}/worker/model-fallback`,
                {},
                "spirits-fallback",
              );
          }
          input = culturalModelRequest(
            input,
            model,
            reservation.profile?.reasoning,
          );
          google = model === flashModel;
          if (google) {
            const quota = await reserveGoogleQuota(
              Buffer.byteLength(JSON.stringify(input), "utf8") + 8192,
              reservation.training === true,
            );
            if (!quota.allowed) {
              res.writeHead(429, {
                "Content-Type": "application/json",
                "X-Camp-Retry-At": new Date(quota.retryAt).toISOString(),
                "Retry-After": String(
                  Math.ceil((quota.retryAt - Date.now()) / 1000),
                ),
              });
              res.end(
                JSON.stringify({
                  error: { message: quota.reason, type: "camp_quota" },
                }),
              );
              return;
            }
            quotaId = quota.id;
          }
        } else input.model = process.env.CAMP_MODEL;
        const key = google
          ? process.env.CAMP_GEMINI_API_KEY
          : process.env.CAMP_MODEL_API_KEY;
        if (!key) throw new Error("Model provider key is not configured");
        const base = google
          ? "https://generativelanguage.googleapis.com/v1beta/openai"
          : reservation.cultural
            ? "https://api.openai.com/v1"
            : process.env.CAMP_MODEL_BASE_URL?.replace(/\/$/, "");
        reservation = {
          ...reservation,
          ...(await campApi(`${token.campId}/worker/model-reserve`, {
            jobId: token.jobId,
            agentId: token.agentId,
          })),
        };
        const upstream = await fetch(
          `${base}/${url.pathname.endsWith("responses") ? "responses" : "chat/completions"}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(90000),
          },
        );
        if (reservation.cultural && upstream.status === 429) {
          const seconds = Number(upstream.headers.get("retry-after"));
          const retryAt =
            Date.now() +
            (Number.isFinite(seconds) && seconds > 0
              ? Math.min(seconds, 86400)
              : 3600) *
              1000;
          if (quotaId) await releaseGoogleQuota(quotaId, retryAt);
          quotaId = undefined;
          res.writeHead(429, {
            "Content-Type": "application/json",
            "X-Camp-Retry-At": new Date(retryAt).toISOString(),
            "Retry-After": String(Math.ceil((retryAt - Date.now()) / 1000)),
          });
          res.end(
            JSON.stringify({
              error: {
                message: "Provider quota exhausted; task saved for later",
                type: "camp_quota",
              },
            }),
          );
          return;
        }
        if (!upstream.ok) {
          if (quotaId) await releaseGoogleQuota(quotaId);
          quotaId = undefined;
          res.writeHead(upstream.status, {
            "Content-Type": "application/json",
          });
          res.end(
            JSON.stringify({
              error: {
                message: `Model provider returned ${upstream.status}`,
                type: "provider_error",
              },
            }),
          );
          return;
        }
        res.writeHead(200, {
          "Content-Type":
            upstream.headers.get("content-type") ?? "application/json",
          "Cache-Control": "no-store",
        });
        if (upstream.body) {
          let tail = "";
          const meter = new Transform({
            transform(chunk, _encoding, callback) {
              tail = (tail + chunk.toString()).slice(-100000);
              callback(null, chunk);
            },
          });
          meter.on("end", () => {
            if (quotaId) void releaseGoogleQuota(quotaId).catch(() => {});
            let usage: Record<string, unknown> | undefined;
            for (const line of tail.split("\n")) {
              try {
                const value = JSON.parse(
                  line.startsWith("data: ") ? line.slice(6) : line,
                );
                if (value.usage || value.response?.usage)
                  usage = value.usage ?? value.response.usage;
              } catch {
                /* Non-JSON SSE framing. */
              }
            }
            if (astraId && usage)
              void recordAstraUsage(astraId, {
                inputTokens: Number(
                  usage.input_tokens ?? usage.prompt_tokens ?? 0,
                ),
                outputTokens: Number(
                  usage.output_tokens ?? usage.completion_tokens ?? 0,
                ),
              }).catch(() => {
                console.error(
                  "Astra usage receipt unavailable; reservation retained",
                );
              });
            void campApi(token.campId + "/worker/model-result", {
              model: input.model,
              provider: google ? "google" : "openai",
              jobId: token.jobId,
              requestNumber: reservation.requestNumber,
              usage: usage
                ? {
                    inputTokens: Number(
                      usage.input_tokens ?? usage.prompt_tokens ?? 0,
                    ),
                    outputTokens: Number(
                      usage.output_tokens ?? usage.completion_tokens ?? 0,
                    ),
                  }
                : null,
            }).catch(() => {});
          });
          const stream = Readable.fromWeb(upstream.body as never);
          stream.on("error", () => {
            if (quotaId) void releaseGoogleQuota(quotaId).catch(() => {});
            res.destroy();
          });
          stream.pipe(meter).pipe(res);
        } else {
          if (quotaId) await releaseGoogleQuota(quotaId);
          res.end();
        }
      } catch (error) {
        if (quotaId) await releaseGoogleQuota(quotaId).catch(() => {});
        if (!res.headersSent)
          res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: {
              message:
                error instanceof Error ? error.message : "Gateway unavailable",
            },
          }),
        );
      }
    })
    .listen(
      Number(process.env.CAMP_GATEWAY_PORT ?? 4112),
      process.env.CAMP_GATEWAY_HOST ?? "127.0.0.1",
    );
}
