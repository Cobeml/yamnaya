import { describe, it, expect, beforeEach } from "vitest";
import {
  authenticate,
  login,
  requireActor,
  issueBrowserTicket,
  readBrowserTicket,
} from "../apps/web/lib/auth";
beforeEach(() => {
  process.env.SESSION_SECRET = "test-secret-not-for-deployment";
  process.env.DEMO_SECURITY_PASSWORD = "commander-password";
  process.env.DEFENDER_TOKEN = "defender-service-token";
});
function requestFor(url: string, init: RequestInit = {}) {
  const request = new Request(url, init);
  const cookies = Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((s) => s.trim().split("=")),
  );
  return Object.assign(request, {
    cookies: {
      get(name: string) {
        return cookies[name] ? { value: cookies[name] } : undefined;
      },
    },
  }) as unknown as Parameters<typeof authenticate>[0];
}
describe("trusted command identity", () => {
  it("binds browser approvals to a signed role instead of a client role header", () => {
    const cookie = login("security", "commander-password");
    const request = requestFor("http://localhost:3100/api/plans", {
      method: "POST",
      headers: {
        cookie: `yamnaya_session=${cookie}`,
        origin: "http://localhost:3100",
        "x-role": "operations",
      },
    });
    expect(requireActor(request).role).toBe("security");
    const tampered = cookie.replace(cookie[10], cookie[10] === "a" ? "b" : "a");
    expect(
      authenticate(
        requestFor("http://localhost:3100", {
          headers: { cookie: `yamnaya_session=${tampered}` },
        }),
      ),
    ).toBeNull();
  });
  it("prevents a service token from becoming a human approver", () => {
    const request = requestFor("http://localhost:3100/api", {
      headers: {
        Authorization: "Bearer defender-service-token",
        "x-role": "security",
      },
    });
    expect(authenticate(request)?.role).toBe("defender");
    expect(() => requireActor(request, ["security"])).toThrow("not authorized");
  });
  it("rejects cross-origin cookie mutations", () => {
    const cookie = login("security", "commander-password");
    const request = requestFor("http://localhost:3100/api/actions", {
      method: "POST",
      headers: {
        cookie: `yamnaya_session=${cookie}`,
        origin: "https://untrusted.invalid",
      },
    });
    expect(() => requireActor(request)).toThrow("origin");
  });
  it("issues scoped browser tickets and rejects tampering", () => {
    const ticket = issueBrowserTicket("RUN-TEST");
    expect(readBrowserTicket(ticket)).toMatchObject({
      runId: "RUN-TEST",
      purpose: "browser",
    });
    expect(() => readBrowserTicket(ticket + "broken")).toThrow("Invalid");
  });
});
