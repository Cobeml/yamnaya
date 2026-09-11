import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { DomainError, type CampActor } from "@yamnaya/core";

function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function secret() {
  const value = process.env.CAMP_SESSION_SECRET;
  if (!value || value.length < 32)
    throw new DomainError(
      "Camp authentication is not configured. Run camps:setup.",
      "SETUP_REQUIRED",
      503,
    );
  return value;
}
export function signCampToken(value: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyCampToken(token: string): Record<string, unknown> | null {
  try {
    const [payload, signature] = token.split(".");
    if (
      !payload ||
      !signature ||
      !equal(
        signature,
        createHmac("sha256", secret()).update(payload).digest("base64url"),
      )
    )
      return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof value.exp !== "number" || value.exp <= Date.now()) return null;
    return value;
  } catch {
    return null;
  }
}
export function campLogin(password: string) {
  const expected = process.env.CAMP_OPERATOR_PASSWORD;
  if (!expected || !equal(password, expected))
    throw new DomainError("Invalid operator password", "UNAUTHENTICATED", 401);
  return signCampToken({
    kind: "operator",
    id: process.env.CAMP_OPERATOR_ID ?? "operator",
    exp: Date.now() + 8 * 3600000,
  });
}
export function campActor(request: NextRequest): CampActor {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (
    bearer &&
    process.env.CAMP_WORKER_TOKEN &&
    equal(bearer, process.env.CAMP_WORKER_TOKEN)
  )
    return { id: "worker", kind: "worker" };
  const value = verifyCampToken(
    bearer ?? request.cookies.get("yamnaya_camp_session")?.value ?? "",
  );
  if (!value || !["operator", "agent"].includes(String(value.kind)))
    throw new DomainError("Sign in to the camp", "UNAUTHENTICATED", 401);
  if (
    value.kind === "agent" &&
    (!bearer ||
      typeof value.campId !== "string" ||
      typeof value.agentId !== "string")
  )
    throw new DomainError("Invalid agent identity", "UNAUTHENTICATED", 401);
  if (!bearer && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const expected = process.env.CAMP_PUBLIC_URL
      ? new URL(process.env.CAMP_PUBLIC_URL).origin
      : request.nextUrl.origin;
    if (!origin || origin !== expected)
      throw new DomainError("Invalid browser origin", "FORBIDDEN", 403);
  }
  return {
    id: String(value.id),
    kind: value.kind as "operator" | "agent",
    campId: value.campId as string | undefined,
    agentId: value.agentId as string | undefined,
  };
}
export function requireWorker(request: NextRequest) {
  const actor = campActor(request);
  if (actor.kind !== "worker")
    throw new DomainError("Worker authentication required", "FORBIDDEN", 403);
  return actor;
}
export function requireOperator(request: NextRequest) {
  const actor = campActor(request);
  if (actor.kind !== "operator")
    throw new DomainError("Operator authentication required", "FORBIDDEN", 403);
  return actor;
}
