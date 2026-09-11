import { localObjects } from "./camp-objects";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import {
  loadDatabaseArtifact,
  saveDatabaseArtifact,
  validArtifactId as valid,
  verifyArtifact,
} from "./camp-artifact-database";
export {
  closeArtifactDatabase,
  previewToken,
  validPreviewToken,
  previewUrl,
} from "./camp-artifact-database";
const root = () =>
  path.resolve(process.env.CAMP_ARTIFACT_DIR ?? "runtime/camp-artifacts");
const databaseMode = () => process.env.CAMP_ARTIFACT_STORAGE === "postgres";
export async function saveArtifact(
  campId: string,
  buildId: string,
  digest: string,
  files: Record<string, string>,
) {
  if (databaseMode())
    return saveDatabaseArtifact(campId, buildId, digest, files);
  verifyArtifact({ digest, files });
  const dir = path.join(root(), valid(campId));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${valid(buildId)}.json`);
  const object = await localObjects.put(
    Buffer.from(JSON.stringify({ digest, files })),
  );
  await writeFile(file + ".tmp", JSON.stringify({ object }), {
    mode: 0o600,
  });
  await rename(file + ".tmp", file);
}
export async function loadArtifact(
  campId: string,
  buildId: string,
  digest?: string,
) {
  if (databaseMode()) return loadDatabaseArtifact(campId, buildId, digest);
  const value = JSON.parse(
    await readFile(
      path.join(root(), valid(campId), `${valid(buildId)}.json`),
      "utf8",
    ),
  );
  return verifyArtifact(
    value.object
      ? JSON.parse((await localObjects.get(value.object)).toString())
      : value,
    digest,
  );
}
