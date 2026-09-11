import { createHash } from "node:crypto";
import type { Publication, Camp } from "@yamnaya/core";
import { canonicalFiles, sha256, publicationSourceDigest } from "./quarto";
export const workflow = `name: Yamnaya Quarto Pages
run-name: Quarto \${{ inputs.build_id }}
on:
  workflow_dispatch:
    inputs:
      artifact_sha:
        required: true
        type: string
      build_id:
        required: true
        type: string
permissions:
  contents: read
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ inputs.artifact_sha }}
          persist-credentials: false
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
  deploy:
    needs: upload
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Publish reviewed artifact
        id: deployment
        uses: actions/deploy-pages@v4
`;
export async function githubRequest(
  route: string,
  method = "GET",
  body?: unknown,
) {
  if (!process.env.CAMP_GITHUB_TOKEN)
    throw new Error("CAMP_GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.CAMP_GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`GitHub request failed (${response.status})`);
  if (response.status === 204) return {};
  return (await response.json()) as Record<string, unknown>;
}
function repoPath(p: Publication) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(p.repository))
    throw new Error("Invalid repository");
  return `/repos/${p.repository}`;
}
async function commitFiles(
  p: Publication,
  branch: string,
  files: Record<string, string>,
  base64: boolean,
  parent?: string,
  guard: () => Promise<unknown> = async () => {},
) {
  const request = async (route: string, method = "GET", body?: unknown) => {
    await guard();
    return githubRequest(route, method, body);
  };
  const root = repoPath(p);
  const tree = [];
  for (const [name, content] of Object.entries(files)) {
    const blob = await request(`${root}/git/blobs`, "POST", {
      content,
      encoding: base64 ? "base64" : "utf-8",
    });
    tree.push({ path: name, mode: "100644", type: "blob", sha: blob.sha });
  }
  const base = parent
    ? await request(`${root}/git/commits/${parent}`)
    : undefined;
  const value = await request(`${root}/git/trees`, "POST", {
    ...(base ? { base_tree: (base.tree as { sha: string }).sha } : {}),
    tree,
  });
  const commit = await request(`${root}/git/commits`, "POST", {
    message: `${p.title}: publication revision ${p.version}`,
    tree: value.sha,
    parents: parent ? [parent] : [],
  });
  await request(`${root}/git/refs`, "POST", {
    ref: `refs/heads/${branch}`,
    sha: commit.sha,
  });
  return String(commit.sha);
}
export async function proposePublication(
  camp: Camp,
  p: Publication,
  guard: () => Promise<unknown> = async () => {},
) {
  const request = async (route: string, method = "GET", body?: unknown) => {
    await guard();
    return githubRequest(route, method, body);
  };
  if (!p.build || p.build.sourceVersion !== p.version)
    throw new Error("Render the current source revision first");
  const root = repoPath(p),
    branch = `camps/${camp.id}/${p.id}-v${p.version}`;
  const marker = {
    sourceDigest: publicationSourceDigest(p),
    version: p.version,
    campId: camp.id,
  };
  const prefix = p.projectDirectory ? `${p.projectDirectory}/` : "";
  const repo = await request(root);
  if (repo.default_branch !== p.branch)
    throw new Error(
      "Pages publications must target the repository default branch",
    );
  try {
    const current = await request(
      root +
        "/contents/.github/workflows/yamnaya-pages.yml?ref=" +
        encodeURIComponent(p.branch),
    );
    if (Buffer.from(String(current.content), "base64").toString() !== workflow)
      throw new Error(
        "Existing Pages workflow differs; review and resolve it in GitHub before proceeding",
      );
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("404"))
      throw error;
  }
  let sha: string;
  try {
    const existing = await request(
      `${root}/contents/${prefix}yamnaya-source.json?ref=${encodeURIComponent(branch)}`,
    );
    const data = JSON.parse(
      Buffer.from(String(existing.content), "base64").toString(),
    );
    if (data.sourceDigest !== marker.sourceDigest)
      throw new Error(
        "Existing publication branch does not match the reviewed sources",
      );
    const ref = await request(
      `${root}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    sha = String((ref.object as { sha: string }).sha);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("404")) throw e;
    const base = await request(
      `${root}/git/ref/heads/${encodeURIComponent(p.branch)}`,
    );
    const files = Object.fromEntries(
      Object.entries(p.files).map(([name, value]) => [prefix + name, value]),
    );
    files[prefix + "yamnaya-source.json"] = JSON.stringify(marker, null, 2);
    files[".github/workflows/yamnaya-pages.yml"] = workflow;
    sha = await commitFiles(
      p,
      branch,
      files,
      false,
      String((base.object as { sha: string }).sha),
      guard,
    );
  }
  await verifySourceCommit(p, sha);
  const existing = (await request(
    `${root}/pulls?head=${encodeURIComponent(p.repository.split("/")[0] + ":" + branch)}&base=${encodeURIComponent(p.branch)}&state=all`,
  )) as unknown as { html_url: string }[];
  const pr =
    existing[0] ??
    (await request(`${root}/pulls`, "POST", {
      title: p.title,
      head: branch,
      base: p.branch,
      body: `${p.title}\n\nQuarto sources and the reviewed publication workflow.\n\nSource SHA-256: ${marker.sourceDigest}\nRender SHA-256: ${p.build.digest}\nRevision: ${p.version}\n\nValidation: full sandbox render, bibliography keys, local source links, and rendered homepage. Editorial acceptance is recorded separately.`,
    }));
  return { url: String(pr.html_url), commit: sha, version: p.version };
}
export async function publishPublication(
  p: Publication,
  output: Record<string, string>,
  guard: () => Promise<unknown> = async () => {},
) {
  const request = async (route: string, method = "GET", body?: unknown) => {
    await guard();
    return githubRequest(route, method, body);
  };
  if (
    !p.pullRequest ||
    p.pullRequest.version !== p.version ||
    !p.build ||
    p.approval?.digest !== p.build.digest
  )
    throw new Error(
      "Current PR, reviewed build and publication approval required",
    );
  if (sha256(canonicalFiles(output)) !== p.build.digest)
    throw new Error("Reviewed artifact digest mismatch");
  await verifySourceCommit(p, p.pullRequest.commit);
  const root = repoPath(p);
  const number = /\/pull\/(\d+)$/.exec(p.pullRequest.url)?.[1];
  if (!number) throw new Error("Invalid pull request receipt");
  const pr = await request(`${root}/pulls/${number}`);
  if ((pr.head as { sha: string }).sha !== p.pullRequest.commit)
    throw new Error("Pull request changed after review");
  if (!pr.merged) { const merge = await request(root+"/pulls/"+number+"/merge", "PUT", {sha:p.pullRequest.commit,merge_method:"merge"}); if (merge.merged !== true) throw new Error("GitHub did not merge the reviewed source revision"); }
  const releaseBranch = `camp-releases/${p.id}/${p.build.id}`;
  let artifactSha: string;
  try {
    const ref = await request(
      `${root}/git/ref/heads/${encodeURIComponent(releaseBranch)}`,
    );
    artifactSha = String((ref.object as { sha: string }).sha);
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("404")) throw e;
    artifactSha = await commitFiles(
      p,
      releaseBranch,
      { ...output, ".nojekyll": "" },
      true,
      undefined,
      guard,
    );
  }
  await verifyArtifactCommit(p, artifactSha, output);
  const deployedWorkflow = await request(
    root +
      "/contents/.github/workflows/yamnaya-pages.yml?ref=" +
      encodeURIComponent(p.branch),
  );
  if (
    Buffer.from(String(deployedWorkflow.content), "base64").toString() !==
    workflow
  )
    throw new Error("Publication workflow changed; review is required");
  try {
    await request(`${root}/pages`, "PUT", { build_type: "workflow" });
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("404")) throw e;
    await request(`${root}/pages`, "POST", { build_type: "workflow" });
  }
  const runs = await request(
    `${root}/actions/workflows/yamnaya-pages.yml/runs?event=workflow_dispatch&per_page=30`,
  );
  const existing = (runs.workflow_runs as { display_title: string }[]).find(
    (r) => r.display_title === `Quarto ${p.build!.id}`,
  );
  if (!existing)
    await request(
      `${root}/actions/workflows/yamnaya-pages.yml/dispatches`,
      "POST",
      {
        ref: p.branch,
        inputs: { artifact_sha: artifactSha, build_id: p.build.id },
      },
    );
  const pages = await request(`${root}/pages`);
  const url = String(pages.html_url);
  const until = Date.now() + 150000;
  while (Date.now() < until) {
    try {
      const response = await fetch(new URL("yamnaya-release.json", url), {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      const marker = (await response.json()) as {
        buildId?: string;
        sourceDigest?: string;
      };
      if (
        response.ok &&
        marker.buildId === p.build.id &&
        marker.sourceDigest === p.build.sourceDigest
      ) { const homepage = await fetch(new URL("index.html",url),{cache:"no-store",signal:AbortSignal.timeout(10000)}); if (!homepage.ok || sha256(Buffer.from(await homepage.arrayBuffer())) !== sha256(Buffer.from(output["index.html"],"base64"))) throw new Error("Published homepage differs from reviewed artifact");
        return {url,commit:p.pullRequest.commit,digest:p.build.digest,verifiedAt:new Date().toISOString()};
      }
    } catch {
      /* Deployment may still be starting. */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(
    "Indeterminate Pages delivery; deployment was requested but the expected release marker is not visible yet",
  );
}

async function verifySourceCommit(p: Publication, commit: string) {
  const prefix = p.projectDirectory ? p.projectDirectory + "/" : "";
  for (const [name, content] of Object.entries({
    ...Object.fromEntries(
      Object.entries(p.files).map(([k, v]) => [prefix + k, v]),
    ),
    ".github/workflows/yamnaya-pages.yml": workflow,
  })) {
    const blob = await githubRequest(
      repoPath(p) + "/contents/" + name + "?ref=" + commit,
    );
    if (Buffer.from(String(blob.content), "base64").toString() !== content)
      throw new Error(
        "GitHub source commit does not match reviewed files: " + name,
      );
  }
}
async function verifyArtifactCommit(
  p: Publication,
  commit: string,
  output: Record<string, string>,
) {
  const tree = await githubRequest(
    repoPath(p) + "/git/trees/" + commit + "?recursive=1",
  );
  if (tree.truncated) throw new Error("Release tree is truncated");
  const expected = new Map(
    Object.entries({ ...output, ".nojekyll": "" }).map(([name, base64]) => {
      const content = Buffer.from(base64, "base64");
      const header = Buffer.from("blob " + content.length + "\0");
      return [
        name,
        createHash("sha1").update(header).update(content).digest("hex"),
      ];
    }),
  );
  const files = tree.tree as {
    path: string;
    type: string;
    sha: string;
    mode: string;
  }[];
  for (const file of files.filter((f) => f.type !== "tree")) {
    if (
      file.type !== "blob" ||
      file.mode !== "100644" ||
      expected.get(file.path) !== file.sha
    )
      throw new Error("Release branch differs from reviewed artifact");
    expected.delete(file.path);
  }
  if (expected.size)
    throw new Error("Release branch is missing reviewed files");
}
