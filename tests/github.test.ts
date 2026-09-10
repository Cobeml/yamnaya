import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { preparePatch } from "../services/worker/github";
import {
  seedRun,
  createPlan,
  approvedSource,
} from "../packages/core/src/index";

let folder: string;
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (folder) await rm(folder, { recursive: true, force: true });
});
it("branches repair from the incident commit and reconciles a retry without a duplicate PR or blob-as-commit receipt", async () => {
  folder = await mkdtemp(path.join(tmpdir(), "yamnaya-github-"));
  vi.stubEnv("YAMNAYA_ARTIFACT_DIR", folder);
  vi.stubEnv("GITHUB_TOKEN", "fake-test-token");
  vi.stubEnv("GITHUB_REPOSITORY", "demo/repo");
  vi.stubEnv("CODE_LAB_URL", "http://lab.invalid");
  const heads = new Map([["main", "default-commit"]]);
  const parents = new Map<string, string>();
  const contents = new Map<string, string>();
  let commits = 0,
    pullRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input),
        body = init.body ? JSON.parse(String(init.body)) : {};
      const reply = (value: unknown, status = 200) =>
        new Response(JSON.stringify(value), { status });
      if (url.hostname === "lab.invalid")
        return reply({
          result: { passed: true, tests: 32 },
          sourceDigest: "test-receipt",
        });
      // GitHub's repository endpoint is strict about the trailing slash.
      // A 200 here used to mask the live connector's 404 before any branch creation.
      if (url.pathname === "/repos/demo/repo") return reply({ default_branch: "main" });
      if (url.pathname === "/repos/demo/repo/") return reply({ message: "Not Found" }, 404);
      const route = url.pathname.replace("/repos/demo/repo/", "");
      if (route.startsWith("git/ref/heads/")) {
        const sha = heads.get(decodeURIComponent(route.slice(14)));
        return sha
          ? reply({ object: { sha } })
          : reply({ message: "not found" }, 404);
      }
      if (route === "git/refs") {
        const ref = body.ref.slice(11);
        heads.set(ref, body.sha);
        parents.set(ref, body.sha);
        return reply({ ref: body.ref });
      }
      if (route === "contents/demo/mapping.ts" && init.method === "PUT") {
        contents.set(body.branch, body.content);
        const sha = `commit-${++commits}`;
        heads.set(body.branch, sha);
        return reply({ commit: { sha } });
      }
      if (route === "contents/demo/mapping.ts") {
        const content = contents.get(url.searchParams.get("ref")!);
        return content
          ? reply({ sha: "blob-sha", content })
          : reply({ message: "not found" }, 404);
      }
      if (route === "pulls" && init.method === "POST") {
        pullRequests++;
        return reply({ html_url: "https://github.com/demo/repo/pull/1" });
      }
      if (route === "pulls")
        return reply(
          pullRequests
            ? [{ html_url: "https://github.com/demo/repo/pull/1" }]
            : [],
        );
      throw new Error(`Unexpected mock route ${route}`);
    }),
  );
  const run = seedRun("RUN-GITHUB");
  const plan = createPlan(
    run,
    {
      title: "Repair source",
      rationale:
        "Restore meter exchange semantics with independent regression tests.",
      evidenceIds: ["OBS-1"],
      steps: [{ kind: "prepare_patch", source: approvedSource }],
      alternatives: [],
    },
    { id: "defender", role: "defender", channel: "tool" },
  );
  const first = await preparePatch(run, plan, approvedSource);
  const second = await preparePatch(run, plan, approvedSource);
  expect(parents.get("demo/incidents/run-github-plan-1-v1")).toBe("commit-1");
  expect(first.commit).toBe("commit-2");
  expect(second.commit).toBe(first.commit);
  expect(second.externalRef).toBe(first.externalRef);
  expect(pullRequests).toBe(1);
  expect(commits).toBe(2);
});
