import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createCamp, createPublication } from "../packages/core/src/camps";
import {
  proposePublication,
  publishPublication,
} from "../services/worker/camp-github";
import {
  canonicalFiles,
  sha256,
  publicationSourceDigest,
} from "../services/worker/quarto";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("reconciles a source PR and publishes only the reviewed source and artifact bytes", async () => {
  vi.stubEnv("CAMP_GITHUB_TOKEN", "fixture-only");
  const refs = new Map([["main", "initial"]]),
    blobs = new Map<string, string>(),
    trees = new Map<string, Record<string, string>>([["empty", {}]]),
    commits = new Map([["initial", "empty"]]);
  let serial = 0,
    prCount = 0,
    dispatches = 0,
    merged = false;
  const camp = createCamp(
    "camp-test",
    { name: "Publication test" },
    "operator",
    "2026-09-10T12:00:00Z",
  );
  const p = createPublication(
    camp,
    { title: "Fieldnotes", repository: "demo/repo" },
    { id: "operator", kind: "operator" },
    "2026-09-10T12:00:00Z",
  );
  const output = {
    "index.html": Buffer.from(
      "<html><body>Reviewed report</body></html>",
    ).toString("base64"),
    "yamnaya-release.json": Buffer.from(
      JSON.stringify({
        buildId: "build-test",
        sourceDigest: publicationSourceDigest(p),
      }),
    ).toString("base64"),
  };
  p.build = {
    id: "build-test",
    sourceVersion: 1,
    sourceDigest: publicationSourceDigest(p),
    digest: sha256(canonicalFiles(output)),
    inputDigest: "evidence",
    createdAt: "2026-09-10T12:00:00Z",
    files: Object.keys(output),
    checks: [{ name: "render", passed: true, detail: "fixture render" }],
  };
  const sourceBranch = "camps/camp-test/" + p.id + "-v1";
  const filesAt = (ref: string) =>
    trees.get(commits.get(refs.get(ref) ?? ref) ?? "empty")!;
  const fetchMock = vi.fn(async (raw: string | URL, init: RequestInit = {}) => {
    const url = new URL(raw);
    const route = decodeURIComponent(
      url.pathname.replace("/repos/demo/repo", ""),
    );
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const response = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status });
    if (
      url.hostname === "demo.github.io" &&
      url.pathname.endsWith("index.html")
    )
      return new Response(
        Buffer.from(output["index.html"], "base64").toString(),
      );
    if (url.hostname === "demo.github.io")
      return response(
        JSON.parse(
          Buffer.from(output["yamnaya-release.json"], "base64").toString(),
        ),
      );
    if (route === "") return response({ default_branch: "main" });
    if (route.startsWith("/contents/")) {
      const file = filesAt(url.searchParams.get("ref") ?? "main")[
        route.slice(10)
      ];
      return file ? response({ content: blobs.get(file) }) : response({}, 404);
    }
    if (route === "/git/blobs") {
      const bytes = Buffer.from(
        body.content,
        body.encoding === "base64" ? "base64" : "utf8",
      );
      const sha = createHash("sha1")
        .update(Buffer.from("blob " + bytes.length + "\0"))
        .update(bytes)
        .digest("hex");
      blobs.set(sha, bytes.toString("base64"));
      return response({ sha });
    }
    if (route === "/git/trees") {
      const tree = { ...trees.get(body.base_tree) };
      for (const item of body.tree) tree[item.path] = item.sha;
      const sha = "tree-" + ++serial;
      trees.set(sha, tree);
      return response({ sha });
    }
    if (route.startsWith("/git/trees/")) {
      const ref = route.slice(11);
      const tree = trees.get(commits.get(ref) ?? ref)!;
      return response({
        truncated: false,
        tree: Object.entries(tree).map(([path, sha]) => ({
          path,
          sha,
          type: "blob",
          mode: "100644",
        })),
      });
    }
    if (route === "/git/commits") {
      const sha = "commit-" + ++serial;
      commits.set(sha, body.tree);
      return response({ sha });
    }
    if (route.startsWith("/git/commits/"))
      return response({ tree: { sha: commits.get(route.slice(13)) } });
    if (route.startsWith("/git/ref/heads/")) {
      const sha = refs.get(route.slice(15));
      return sha ? response({ object: { sha } }) : response({}, 404);
    }
    if (route === "/git/refs") {
      refs.set(body.ref.replace("refs/heads/", ""), body.sha);
      return response({});
    }
    if (route === "/pulls" && method === "POST") {
      prCount++;
      return response({ html_url: "https://github.com/demo/repo/pull/1" });
    }
    if (route === "/pulls")
      return response(
        prCount ? [{ html_url: "https://github.com/demo/repo/pull/1" }] : [],
      );
    if (route === "/pulls/1")
      return response({ head: { sha: refs.get(sourceBranch) }, merged });
    if (route === "/pulls/1/merge") {
      merged = true;
      refs.set("main", refs.get(sourceBranch)!);
      return response({ merged: true });
    }
    if (route === "/pages")
      return response({ html_url: "https://demo.github.io/repo/" });
    if (route.endsWith("/runs")) return response({ workflow_runs: [] });
    if (route.endsWith("/dispatches")) {
      dispatches++;
      return response({});
    }
    throw new Error("Unhandled fixture request " + method + " " + route);
  });
  vi.stubGlobal("fetch", fetchMock);
  p.pullRequest = await proposePublication(camp, p);
  expect(await proposePublication(camp, p)).toEqual(p.pullRequest);
  expect(prCount).toBe(1);
  p.approval = {
    actorId: "operator",
    version: 1,
    digest: p.build.digest,
    at: "2026-09-10T12:00:00Z",
  };
  await expect(
    publishPublication(p, { ...output, "index.html": "dGFtcGVyZWQ=" }),
  ).rejects.toThrow("digest");
  expect(dispatches).toBe(0);
  const receipt = await publishPublication(p, output);
  expect(receipt.digest).toBe(p.build.digest);
  expect(dispatches).toBe(1);
  expect(merged).toBe(true);
  filesAt("camp-releases/" + p.id + "/build-test")["index.html"] =
    "tampered-blob";
  await expect(publishPublication(p, output)).rejects.toThrow(
    "differs from reviewed artifact",
  );
  expect(dispatches).toBe(1);
});
