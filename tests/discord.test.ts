import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  applyDiscordInstruction,
  createCamp,
  createPublication,
  requestCampTool,
  checkCampJob,
  setCampStatus,
} from "../packages/core/src";
import { insertCamp, mutateCamp, readCamp } from "../apps/web/lib/camp-store";
import { sendDiscordMessage } from "../services/worker/camp-discord";
const now = "2026-09-12T12:00:00.000Z";
const owner = { id: "owner", kind: "operator" as const };
const binding = {
  guildId: "123456789012345678",
  channelId: "234567890123456789",
};
const userId = "345678901234567890";
const command = {
  ...binding,
  userId,
  messageId: "456789012345678901",
  text: "!camp instruct Prepare a source review",
};
let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});
function fixture() {
  const camp = createCamp(
    "camp-discord",
    { name: "Discord fixture" },
    owner.id,
    now,
  );
  camp.discord = { ...binding };
  return camp;
}
it("rejects unauthorized identities, wrong bindings, unprefixed chat and stale build approvals", () => {
  const camp = fixture();
  for (const input of [
    { ...command, userId: "999999999999999999" },
    { ...command, guildId: "999999999999999999" },
    { ...command, channelId: "999999999999999999" },
    { ...command, text: "Approve everything" },
  ]) {
    const before = structuredClone(camp);
    expect(() => applyDiscordInstruction(camp, input, userId, now)).toThrow();
    expect(camp).toEqual(before);
  }
  const p = createPublication(
    camp,
    { title: "Reviewed work", repository: "owner/reports" },
    owner,
    now,
  );
  p.build = {
    id: "build",
    sourceVersion: p.version,
    digest: "a".repeat(64),
    sourceDigest: "source",
    inputDigest: "input",
    createdAt: now,
    checks: [{ name: "render", passed: true, detail: "fixture" }],
    files: ["index.html"],
  };
  const approve = {
    ...command,
    text: `!camp approve ${p.id} v${p.version} ${"a".repeat(64)}`,
  };
  expect(() =>
    applyDiscordInstruction(
      camp,
      { ...approve, text: approve.text.replace(/a{64}/, "b".repeat(64)) },
      userId,
      now,
    ),
  ).toThrow("Build changed");
  expect(p.approval).toBeUndefined();
  applyDiscordInstruction(camp, approve, ` ${userId} `, now);
  expect(p.approval?.digest).toBe(p.build.digest);
  p.build.digest = "b".repeat(64);
  expect(() => applyDiscordInstruction(camp, approve, userId, now)).toThrow(
    "Build changed",
  );
});
it("deduplicates concurrent command replay in persistence", async () => {
  directory = await mkdtemp(path.join(tmpdir(), "discord-store-"));
  vi.stubEnv("CAMP_STORAGE", "file");
  vi.stubEnv("CAMP_DATA_DIR", directory);
  const camp = await insertCamp({ name: "Discord replay" }, owner.id);
  await mutateCamp(camp.id, (c) => {
    c.discord = { ...binding };
  });
  await Promise.all(
    Array.from({ length: 8 }, () =>
      mutateCamp(
        camp.id,
        (c) => applyDiscordInstruction(c, command, userId, now),
        { key: `worker:worker/discord:discord-${command.messageId}` },
      ),
    ),
  );
  const result = await readCamp(camp.id);
  expect(
    result.events.filter((e) => e.type === "discord.instruction"),
  ).toHaveLength(1);
  expect(
    result.messages.filter((m) => m.text === "Prepare a source review"),
  ).toHaveLength(1);
});
it("invalidates queued sends after destination changes even for operator-requested jobs", () => {
  const camp = fixture();
  setCampStatus(camp, "running", owner, now);
  const job = requestCampTool(
    camp,
    { capability: "discord.send", arguments: { text: "Status update" } },
    owner,
    now,
  );
  checkCampJob(camp, job, now);
  camp.discord!.channelId = "999999999999999999";
  expect(() => checkCampJob(camp, job, now)).toThrow("binding changed");
});
it("verifies Discord message readback, disables mentions, and rejects wrong-server destinations", async () => {
  vi.stubEnv("CAMP_DISCORD_BOT_TOKEN", "fixture-only");
  let posted = false;
  let mismatch = false;
  let wrongGuild = false;
  const content = "Update @everyone";
  const message = {
    id: "567890123456789012",
    channel_id: binding.channelId,
    content,
    author: { id: "678901234567890123", bot: true },
  };
  const mock = vi.fn(async (_url: string, init: RequestInit = {}) => {
    if (init.method === "POST") {
      const body = JSON.parse(String(init.body));
      expect(body.allowed_mentions).toEqual({ parse: [], replied_user: false });
      expect(body.enforce_nonce).toBe(true);
      posted = true;
      return Response.json(message);
    }
    if (_url.endsWith(`/messages/${message.id}`))
      return Response.json({
        ...message,
        content: mismatch ? "changed" : content,
      });
    return Response.json({
      guild_id: wrongGuild ? "999999999999999999" : binding.guildId,
      type: 0,
    });
  });
  vi.stubGlobal("fetch", mock);
  await expect(
    sendDiscordMessage(binding, content, "test-send"),
  ).resolves.toMatchObject({ verified: true, messageId: message.id });
  expect(posted).toBe(true);
  mismatch = true;
  await expect(sendDiscordMessage(binding, content, "test-2")).rejects.toThrow(
    "readback",
  );
  posted = false;
  wrongGuild = true;
  await expect(sendDiscordMessage(binding, content, "test-3")).rejects.toThrow(
    "bound server",
  );
  expect(posted).toBe(false);
});
it("does not repeat uncertain POSTs and rechecks a job immediately before sending", async () => {
  vi.stubEnv("CAMP_DISCORD_BOT_TOKEN", "fixture-only");
  let posts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit = {}) => {
      if (init.method === "POST") {
        posts++;
        throw new Error("Connection lost after acceptance");
      }
      return Response.json({ guild_id: binding.guildId, type: 0 });
    }),
  );
  await expect(
    sendDiscordMessage(binding, "Status", "uncertain"),
  ).rejects.toThrow("Connection lost");
  expect(posts).toBe(1);
  await expect(
    sendDiscordMessage(binding, "Status", "revoked", async () => {
      throw new Error("Revoked");
    }),
  ).rejects.toThrow("Revoked");
  expect(posts).toBe(1);
});
