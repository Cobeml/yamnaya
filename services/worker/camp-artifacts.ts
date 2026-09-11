import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { canonicalFiles, sha256 } from "./quarto";
const root = () =>
  path.resolve(process.env.CAMP_ARTIFACT_DIR ?? "runtime/camp-artifacts");
const valid = (id: string) => {
  if (!/^[\w-]{1,160}$/.test(id)) throw new Error("Invalid artifact identity");
  return id;
};
export async function saveArtifact(
  campId: string,
  buildId: string,
  digest: string,
  files: Record<string, string>,
) {
  if (sha256(canonicalFiles(files)) !== digest)
    throw new Error("Artifact digest mismatch");
  const dir = path.join(root(), valid(campId));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${valid(buildId)}.json`);
  await writeFile(file + ".tmp", JSON.stringify({ digest, files }), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
}
export async function loadArtifact(
  campId: string,
  buildId: string,
  digest?: string,
): Promise<{ digest: string; files: Record<string, string> }> {
  const value = JSON.parse(
    await readFile(
      path.join(root(), valid(campId), `${valid(buildId)}.json`),
      "utf8",
    ),
  );
  if (
    sha256(canonicalFiles(value.files)) !== value.digest ||
    (digest && value.digest !== digest)
  )
    throw new Error("Artifact integrity check failed");
  return value;
}
export function previewToken(campId: string, buildId: string) {
  const key = process.env.CAMP_PREVIEW_SECRET;
  if (!key || key.length < 32)
    throw new Error("Preview secret is not configured");
  return createHmac("sha256", key).update(`${campId}/${buildId}`).digest("hex");
}
export function validPreviewToken(
  campId: string,
  buildId: string,
  token: string,
) {
  const expected = Buffer.from(previewToken(campId, buildId));
  const supplied = Buffer.from(token);
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
export function previewUrl(campId: string, buildId: string) {
  return `${process.env.CAMP_PREVIEW_URL}/preview/${campId}/${buildId}/${previewToken(campId, buildId)}/index.html`;
}
