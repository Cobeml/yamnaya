import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  insertCamp,
  mutateCamp,
  readCamp,
  claimNextCampJob,
} from "../apps/web/lib/camp-store";
import { setCampStatus, instructCamp } from "../packages/core/src/camps";
let dir: string;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (dir) await rm(dir, { recursive: true, force: true });
});
it("atomically deduplicates camp effects, rolls back errors and enforces global reasoning slots", async () => {
  dir = await mkdtemp(path.join(tmpdir(), "camp-store-"));
  vi.stubEnv("CAMP_STORAGE", "file");
  vi.stubEnv("CAMP_DATA_DIR", dir);
  const camps = await Promise.all(
    [1, 2, 3].map((i) => insertCamp({ name: "Institute " + i }, "owner")),
  );
  const actor = { id: "owner", kind: "operator" as const };
  for (const c of camps)
    await mutateCamp(c.id, (camp) => {
      setCampStatus(camp, "running", actor, new Date().toISOString());
      instructCamp(
        camp,
        { text: "Do one task", recipientId: "ada" },
        actor,
        new Date().toISOString(),
      );
    });
  let mutations = 0;
  await Promise.all(
    Array.from({ length: 10 }, () =>
      mutateCamp(
        camps[0].id,
        (c) => {
          mutations++;
          c.name = "Once";
          return "receipt";
        },
        { key: "same-operation" },
      ),
    ),
  );
  expect(mutations).toBe(1);
  const before = await readCamp(camps[0].id);
  await expect(
    mutateCamp(before.id, (c) => {
      c.name = "Partial write";
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect((await readCamp(before.id)).name).toBe("Once");
  await expect(
    mutateCamp(before.id, () => null, {
      expectedRevision: before.revision - 1,
    }),
  ).rejects.toThrow("changed");
  const claims = await Promise.all(
    [1, 2, 3].map((i) => claimNextCampJob("worker-" + i)),
  );
  expect(claims.filter(Boolean)).toHaveLength(2);
  expect(new Set(claims.filter(Boolean).map((c) => c!.camp.id)).size).toBe(2);
  const first = claims.find(Boolean)!;
  await mutateCamp(first.camp.id, (c) => {
    c.jobs.find((j) => j.id === first.job.id)!.leaseUntil =
      "2000-01-01T00:00:00Z";
  });
  await claimNextCampJob("worker-next");
  expect(
    (await readCamp(first.camp.id)).jobs.find((j) => j.id === first.job.id)
      ?.status,
  ).toBe("indeterminate");
});
