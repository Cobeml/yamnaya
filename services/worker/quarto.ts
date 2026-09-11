import { sandboxRequest } from "./sandbox-client";
import { createHash } from "node:crypto";
import type {
  Publication,
  CampEvidence,
  PublicationBuild,
} from "@yamnaya/core";
export function canonicalFiles(files: Record<string, string>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
export function publicationSourceDigest(publication: Publication) {
  return sha256(canonicalFiles(publication.files));
}
export function checkPublicationSources(files: Record<string, string>) {
  const qmd = Object.entries(files).filter(([name]) => name.endsWith(".qmd"));
  const bib = Object.entries(files)
    .filter(([name]) => name.endsWith(".bib"))
    .map(([, text]) => text)
    .join("\n");
  const keys = new Set(
    Array.from(bib.matchAll(/@\w+\s*\{\s*([^,\s]+)/g), (m) => m[1]),
  );
  const citations = qmd
    .flatMap(([, text]) =>
      Array.from(text.matchAll(/(?:\[|;\s*|\s)@([\w:.-]+)/g), (m) => m[1]),
    )
    .filter((k) => !/^(fig|tbl|sec|eq|lst)-/.test(k));
  const missing = [...new Set(citations.filter((c) => !keys.has(c)))];
  const broken = qmd
    .flatMap(([name, text]) =>
      Array.from(text.matchAll(/\]\(([^)#?]+)(?:#[^)]*)?\)/g), (m) => ({
        from: name,
        to: m[1],
      })),
    )
    .filter(({ to }) => !/^https?:|^mailto:|^#/.test(to))
    .filter(({ from, to }) => {
      const parts = from.split("/");
      parts.pop();
      for (const part of to.split("/")) {
        if (part === "..") parts.pop();
        else if (part !== ".") parts.push(part);
      }
      return !Object.hasOwn(files, parts.join("/"));
    });
  return [
    {
      name: "Quarto sources",
      passed:
        Object.hasOwn(files, "_quarto.yml") &&
        Object.hasOwn(files, "index.qmd"),
      detail: "Project configuration and homepage",
    },
    {
      name: "Citation keys resolve",
      passed: missing.length === 0,
      detail: missing.length
        ? missing.join(", ")
        : "All referenced bibliography keys exist",
    },
    {
      name: "Source links resolve",
      passed: broken.length === 0,
      detail: broken.length
        ? broken.map((b) => `${b.from}: ${b.to}`).join(", ")
        : "Local source links resolve",
    },
  ];
}
export async function renderPublication(
  publication: Publication,
  evidence: CampEvidence[],
  sandboxUrl: string,
  buildId: string,
): Promise<{ build: PublicationBuild; output: Record<string, string> }> {
  const sourceDigest = publicationSourceDigest(publication);
  const inputDigest = sha256(
    JSON.stringify(evidence.map((e) => [e.id, e.digest]).sort()),
  );
  const checks = checkPublicationSources(publication.files);
  if (checks.some((c) => !c.passed))
    throw new Error(
      checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.detail}`)
        .join("; "),
    );
  const response = await sandboxRequest(`${sandboxUrl}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: publication.files,
      sourceDigest,
      inputDigest,
      buildId,
      version: publication.version,
    }),
    signal: AbortSignal.timeout(180000),
  });
  const result = (await response.json()) as {
    error?: string;
    files?: Record<string, string>;
    sourceDigest?: string;
  };
  if (!response.ok || !result.files)
    throw new Error(result.error ?? "Quarto render failed");
  if (result.sourceDigest !== sourceDigest)
    throw new Error("Sandbox source digest mismatch");
  const output = result.files;
  const main = Buffer.from(output["index.html"] ?? "", "base64").toString();
  if (!/<html[\s>]/i.test(main))
    throw new Error("Rendered homepage is missing");
  // Receipts bind the exact render output, source revision and evidence snapshot.
  const digest = sha256(canonicalFiles(output));
  return {
    build: {
      id: buildId,
      sourceVersion: publication.version,
      sourceDigest,
      inputDigest,
      digest,
      createdAt: new Date().toISOString(),
      checks: [
        ...checks,
        {
          name: "Rendered homepage",
          passed: true,
          detail: "HTML artifact independently inspected",
        },
        { name: "Source provenance", passed: true, detail: sourceDigest },
      ],
      files: Object.keys(output),
    },
    output,
  };
}
