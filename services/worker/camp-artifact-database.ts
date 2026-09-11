import { createHmac, timingSafeEqual } from "node:crypto";
import postgres from "postgres";
import { canonicalFiles, sha256 } from "./quarto";
export const validArtifactId = (id: string) => {
  if (!/^[\w-]{1,160}$/.test(id)) throw new Error("Invalid artifact identity");
  return id;
};
export interface Artifact {
  digest: string;
  files: Record<string, string>;
}
export function verifyArtifact(
  value: Artifact | undefined,
  digest?: string,
): Artifact {
  if (!value) throw new Error("Artifact not found");
  if (
    sha256(canonicalFiles(value.files)) !== value.digest ||
    (digest && value.digest !== digest)
  )
    throw new Error("Artifact integrity check failed");
  return value;
}
let connection: ReturnType<typeof postgres> | undefined;
function database() {
  const url =
    process.env.CAMP_ARTIFACT_DATABASE_URL ?? process.env.CAMP_DATABASE_URL;
  if (!url) throw new Error("Artifact database is not configured");
  return (connection ??= postgres(url, {
    max: 3,
    prepare: false,
    connect_timeout: 10,
    onnotice: () => {},
  }));
}
export async function closeArtifactDatabase() {
  await connection?.end();
  connection = undefined;
}

export async function loadDatabaseArtifact(
  campId: string,
  buildId: string,
  digest?: string,
) {
  const rows = await database()<
    Artifact[]
  >`SELECT digest,files FROM camp_artifacts WHERE camp_id=${validArtifactId(campId)} AND build_id=${validArtifactId(buildId)}`;
  return verifyArtifact(rows[0], digest);
}
export async function saveDatabaseArtifact(
  campId: string,
  buildId: string,
  digest: string,
  files: Record<string, string>,
) {
  verifyArtifact({ digest, files });
  const db = database();
  await db`INSERT INTO camp_artifacts(camp_id,build_id,digest,files)
    VALUES(${validArtifactId(campId)},${validArtifactId(buildId)},${digest},${db.json(files)})
    ON CONFLICT (camp_id,build_id) DO NOTHING`;
  await loadDatabaseArtifact(campId, buildId, digest);
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
