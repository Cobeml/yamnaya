import { expect, it, vi, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  saveArtifact,
  loadArtifact,
  previewToken,
  validPreviewToken,
} from "../services/worker/camp-artifacts";
import { canonicalFiles, sha256 } from "../services/worker/quarto";
import { GET } from "../apps/web/app/preview/[...path]/route";
vi.mock(
  "../services/worker/camp-artifact-database",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../services/worker/camp-artifact-database")
    >()),
    loadDatabaseArtifact: (...args: Parameters<typeof loadArtifact>) =>
      loadArtifact(...args),
  }),
);
const request = (url: string) =>
  ({ nextUrl: new URL(url) }) as Parameters<typeof GET>[0];
let directory: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
});
it("serves digest-checked previews only on the isolated origin with a valid build token", async () => {
  directory = await mkdtemp(path.join(tmpdir(), "camp-artifacts-"));
  vi.stubEnv("CAMP_ARTIFACT_STORAGE", "file");
  vi.stubEnv("CAMP_ARTIFACT_DIR", directory);
  vi.stubEnv("CAMP_PREVIEW_SECRET", "a".repeat(48));
  vi.stubEnv("CAMP_PREVIEW_URL", "https://preview.example.org");
  vi.stubEnv("CAMP_PUBLIC_URL", "https://camp.example.org");
  const files = {
    "index.html": Buffer.from(
      "<html><body>Review this output</body></html>",
    ).toString("base64"),
  };
  const digest = sha256(canonicalFiles(files));
  await saveArtifact("camp-test", "build-test", digest, files);
  expect((await loadArtifact("camp-test", "build-test", digest)).files).toEqual(
    files,
  );
  await expect(
    loadArtifact("camp-test", "build-test", "wrong"),
  ).rejects.toThrow("integrity");
  const token = previewToken("camp-test", "build-test");
  expect(validPreviewToken("camp-test", "another-build", token)).toBe(false);
  const context = {
    params: Promise.resolve({
      path: ["camp-test", "build-test", token, "index.html"],
    }),
  };
  expect(
    (await GET(request("https://camp.example.org/preview"), context)).status,
  ).toBe(403);
  const response = await GET(
    request("https://preview.example.org/preview"),
    context,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toContain(
    "sandbox allow-scripts;",
  );
  expect(await response.text()).toContain("Review this output");
  expect(
    (
      await GET(request("https://preview.example.org/preview"), {
        params: Promise.resolve({
          path: ["camp-test", "build-test", "bad", "index.html"],
        }),
      })
    ).status,
  ).toBe(403);
});
