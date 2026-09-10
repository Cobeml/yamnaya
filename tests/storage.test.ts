import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readRun, mutateRun } from "../apps/web/lib/store";
import { event } from "../packages/core/src/simulator";

let folder: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (folder) await rm(folder, { recursive: true, force: true });
});
describe("durable development store", () => {
  it("serializes first reads and concurrent writes, rolls back failures, and deduplicates effects", async () => {
    folder = await mkdtemp(path.join(tmpdir(), "yamnaya-store-"));
    vi.stubEnv("YAMNAYA_STORAGE", "file");
    vi.stubEnv("YAMNAYA_DATA_DIR", folder);
    const runs = await Promise.all(Array.from({ length: 8 }, () => readRun()));
    expect(new Set(runs.map((r) => r.id)).size).toBe(1);
    const id = runs[0].id;
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        mutateRun(
          (run) => {
            event(run, "test", "test", `write-${i}`);
            return i;
          },
          { expectedRunId: id, key: `effect-${i}` },
        ),
      ),
    );
    const saved = await readRun();
    expect(saved.events.filter((e) => e.type === "test")).toHaveLength(10);
    const again = await mutateRun(
      () => {
        throw new Error("must not execute");
      },
      { expectedRunId: id, key: "effect-3" },
    );
    expect(again.result).toBe(3);
    await expect(
      mutateRun((run) => {
        run.status = "verified";
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect((await readRun()).status).toBe(saved.status);
    await expect(
      mutateRun(() => null, { expectedRunId: "previous-run" }),
    ).rejects.toThrow("reset");
    const persisted = JSON.parse(
      await readFile(path.join(folder, "state.json"), "utf8"),
    );
    expect(persisted.events).toEqual(saved.events);
  });
});
