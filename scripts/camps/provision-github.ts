import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "dotenv";
import postgres from "postgres";
import type { Camp } from "@yamnaya/core";
import { githubRequest, workflow } from "../../services/worker/camp-github";

const local = parse(await readFile(".env.camps"));
const production = parse(await readFile(".env.camps.production"));
process.env.CAMP_GITHUB_TOKEN =
  production.CAMP_GITHUB_TOKEN || local.CAMP_GITHUB_TOKEN;
const db = postgres(local.CAMP_DATABASE_URL, { max: 1, onnotice: () => {} });
const receipts: Record<string, unknown>[] = [];
const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
async function optional(route: string) {
  try {
    return await githubRequest(route);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) return null;
    throw error;
  }
}
async function save() {
  await mkdir("runtime/github-setup", { recursive: true, mode: 0o700 });
  await writeFile(
    "runtime/github-setup/receipts.json",
    JSON.stringify(receipts, null, 2),
    { mode: 0o600 },
  );
}
try {
  const user = await githubRequest("/user");
  for (const focus of ["america", "china"]) {
    const [row] =
      await db`SELECT state FROM camps WHERE id=${"camp-cultural-" + focus}`;
    if (!row) throw new Error(`Provision the ${focus} camp first`);
    const camp = row.state as Camp;
    const p = camp.publications[0];
    if (!p || p.version !== 1 || camp.status !== "paused")
      throw new Error(
        "Repository bootstrap requires a paused pilot with its initial scaffold",
      );
    const [owner, name] = p.repository.split("/");
    if (owner.toLowerCase() !== String(user.login).toLowerCase())
      throw new Error(
        "Repository owner differs from authenticated GitHub account",
      );
    const root = "/repos/" + p.repository;
    let repo = await optional(root);
    if (!repo) {
      repo = await githubRequest("/user/repos", "POST", {
        name,
        description:
          camp.name + " — theory, sources and experimental art in Quarto",
        private: false,
        auto_init: true,
        has_issues: true,
        has_wiki: false,
        has_projects: false,
        allow_merge_commit: true,
        delete_branch_on_merge: true,
      });
      receipts.push({
        repository: repo.full_name,
        id: repo.id,
        step: "created",
        at: new Date().toISOString(),
      });
      await save();
    }
    if (repo.private || !(repo.permissions as { admin?: boolean })?.admin)
      throw new Error("Public repository with administration access required");
    let base = await optional(`${root}/git/ref/heads/${p.branch}`);
    if (!base) {
      const current = await githubRequest(
        `${root}/git/ref/heads/${repo.default_branch}`,
      );
      await githubRequest(`${root}/git/refs`, "POST", {
        ref: "refs/heads/" + p.branch,
        sha: (current.object as { sha: string }).sha,
      });
      base = await githubRequest(`${root}/git/ref/heads/${p.branch}`);
    }
    if (repo.default_branch !== p.branch)
      await githubRequest(root, "PATCH", { default_branch: p.branch });
    const prefix = p.projectDirectory ? p.projectDirectory + "/" : "";
    const files: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(p.files).map(([name, content]) => [
          prefix + name,
          content,
        ]),
      ),
      "README.md": `# ${p.title}\n\nQuarto sources for the ${camp.name} camp in [Yamnaya](https://yamnaya.vercel.app).\n\n## Work in progress\n\nThis repository starts with a website scaffold. Research and artwork are developed through source review and pull requests.\n\nRun \`quarto preview ${p.projectDirectory || "."}\` to preview locally. The camp renders in its isolated sandbox.\n\n## Publication\n\nThe operator reviews the exact rendered build in Yamnaya. The managed Pages workflow is dispatched with that approved artifact commit; pushes do not automatically deploy. No provider credentials belong in this repository.\n`,
      ".gitignore": "_site/\n.quarto/\n_freeze/\n.env\n.env.*\n*.log\n",
      ".github/workflows/yamnaya-pages.yml": workflow,
    };
    const manifest =
      JSON.stringify(
        {
          campId: camp.id,
          publicationId: p.id,
          version: p.version,
          files: Object.fromEntries(
            Object.entries(files).map(([n, c]) => [n, digest(c)]),
          ),
        },
        null,
        2,
      ) + "\n";
    const markerPath = ".yamnaya-repository.json";
    const marker = await optional(
      `${root}/contents/${markerPath}?ref=${p.branch}`,
    );
    if (
      marker &&
      Buffer.from(String(marker.content), "base64").toString() !== manifest
    )
      throw new Error(
        "Existing repository scaffold differs; review it instead of overwriting",
      );
    if (!marker) {
      const parent = String((base.object as { sha: string }).sha);
      const parentCommit = await githubRequest(`${root}/git/commits/${parent}`);
      const tree = await githubRequest(
        `${root}/git/trees/${(parentCommit.tree as { sha: string }).sha}?recursive=1`,
      );
      if (
        (tree.tree as { path: string; type: string }[]).some(
          (f) => f.type === "blob" && f.path !== "README.md",
        )
      )
        throw new Error(
          "Existing repository has work outside the bootstrap; refusing to overwrite it",
        );
      files[markerPath] = manifest;
      const entries = [];
      for (const [path, content] of Object.entries(files)) {
        const blob = await githubRequest(`${root}/git/blobs`, "POST", {
          content,
          encoding: "utf-8",
        });
        entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
      }
      const newTree = await githubRequest(`${root}/git/trees`, "POST", {
        base_tree: (parentCommit.tree as { sha: string }).sha,
        tree: entries,
      });
      const commit = await githubRequest(`${root}/git/commits`, "POST", {
        message: "Initialize camp Quarto sources and reviewed Pages workflow",
        tree: newTree.sha,
        parents: [parent],
      });
      await githubRequest(`${root}/git/refs/heads/${p.branch}`, "PATCH", {
        sha: commit.sha,
        force: false,
      });
    }
    const head = await githubRequest(`${root}/git/ref/heads/${p.branch}`);
    const commit = String((head.object as { sha: string }).sha);
    for (const [name, content] of Object.entries({
      ...files,
      [markerPath]: manifest,
    })) {
      const remote = await githubRequest(
        `${root}/contents/${name}?ref=${commit}`,
      );
      if (Buffer.from(String(remote.content), "base64").toString() !== content)
        throw new Error("Remote file verification failed: " + name);
    }
    await githubRequest(`${root}/actions/permissions`, "PUT", {
      enabled: true,
      allowed_actions: "selected",
    });
    await githubRequest(`${root}/actions/permissions/selected-actions`, "PUT", {
      github_owned_allowed: true,
      verified_allowed: false,
      patterns_allowed: [],
    });
    await githubRequest(`${root}/actions/permissions/workflow`, "PUT", {
      default_workflow_permissions: "read",
      can_approve_pull_request_reviews: false,
    });
    const pages = await optional(`${root}/pages`);
    await githubRequest(`${root}/pages`, pages ? "PUT" : "POST", {
      build_type: "workflow",
    });
    const actual = await githubRequest(root);
    const pageConfig = await githubRequest(`${root}/pages`);
    const actions = await githubRequest(`${root}/actions/permissions`);
    const permissions = await githubRequest(
      `${root}/actions/permissions/workflow`,
    );
    if (
      actual.default_branch !== p.branch ||
      pageConfig.build_type !== "workflow" ||
      actions.enabled !== true ||
      permissions.default_workflow_permissions !== "read"
    )
      throw new Error("Repository settings did not persist");
    const receipt = {
      repository: actual.full_name,
      url: actual.html_url,
      commit,
      branch: actual.default_branch,
      pages: pageConfig.html_url,
      buildType: pageConfig.build_type,
      filesVerified: Object.keys({ ...files, [markerPath]: manifest }).length,
      actionsEnabled: true,
      published: false,
      at: new Date().toISOString(),
    };
    receipts.push(receipt);
    await save();
    console.log(JSON.stringify(receipt));
  }
} finally {
  await db.end();
}
