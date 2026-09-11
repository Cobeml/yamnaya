import { z } from "zod";
import { randomUUID } from "node:crypto";
import { DomainError, type Camp, type CampActor } from "@yamnaya/core";
import { campDatabase, listCamps } from "./camp-store";
export interface BoardThread {
  id: string;
  archived?: boolean;
  title: string;
  campId: string;
  visibility: "camp" | "shared";
  createdAt: string;
  posts: {
    id: string;
    campId: string;
    sender: string;
    agent: boolean;
    text: string;
    at: string;
  }[];
}
const visible = (t: BoardThread, camp: Camp) =>
  !t.archived && (t.visibility === "shared" || t.campId === camp.id);
export async function readBoard(camp: Camp) {
  const rows =
    await campDatabase()`SELECT state FROM camp_boards WHERE owner_id=${camp.ownerId}`;
  return (rows[0]?.state.threads ?? []).filter((t: BoardThread) =>
    visible(t, camp),
  );
}
export async function postBoard(camp: Camp, actor: CampActor, raw: unknown) {
  const input = z
    .object({
      threadId: z.string().optional(),
      title: z.string().trim().min(3).max(150).optional(),
      visibility: z.enum(["camp", "shared"]).default("camp"),
      text: z.string().trim().min(3).max(6000),
    })
    .parse(raw);
  const db = campDatabase();
  return db.begin(async (tx) => {
    await tx`INSERT INTO camp_boards(id,owner_id,state) VALUES(${camp.ownerId},${camp.ownerId},${tx.json({ threads: [] })}) ON CONFLICT DO NOTHING`;
    const [row] =
      await tx`SELECT state FROM camp_boards WHERE id=${camp.ownerId} FOR UPDATE`;
    const threads = row.state.threads as BoardThread[];
    const now = new Date().toISOString();
    let t = threads.find((t) => t.id === input.threadId);
    if (input.threadId && (!t || !visible(t, camp)))
      throw new DomainError("Thread not found", "NOT_FOUND", 404);
    if (!t) {
      if (!input.title) throw new DomainError("Thread title required");
      if (
        actor.kind === "agent" &&
        input.visibility === "shared" &&
        threads.filter(
          (t) =>
            t.campId === camp.id &&
            t.visibility === "shared" &&
            t.createdAt.slice(0, 10) === now.slice(0, 10),
        ).length >= 2
      )
        throw new DomainError(
          "Shared correspondence limit reached; wait until tomorrow",
        );
      t = {
        id: randomUUID(),
        title: input.title,
        campId: camp.id,
        visibility: input.visibility,
        createdAt: now,
        posts: [],
      };
      threads.push(t);
    }
    if (actor.kind === "agent" && t.posts.filter((p) => p.agent).length >= 4)
      throw new DomainError(
        "This thread is sleeping after four agent contributions",
      );
    if (t.posts.length >= 100 || threads.length >= 1000)
      throw new DomainError("Board capacity reached");
    t.posts.push({
      id: randomUUID(),
      campId: camp.id,
      sender: actor.agentId ?? actor.id,
      agent: actor.kind === "agent",
      text: input.text,
      at: now,
    });
    await tx`UPDATE camp_boards SET state=${tx.json({ threads } as never)} WHERE id=${camp.ownerId}`;
    return t;
  });
}
export async function sharedLibrary(camp: Camp) {
  return (await listCamps())
    .filter((c) => c.ownerId === camp.ownerId)
    .flatMap((c) =>
      c.publications
        .filter((p) => p.deployment)
        .map((p) => ({
          campId: c.id,
          camp: c.name,
          id: p.id,
          title: p.title,
          deployment: p.deployment,
        })),
    );
}

export async function archiveCampThreads(camp: Camp) {
  const db = campDatabase();
  await db.begin(async (tx) => {
    const [row] =
      await tx`SELECT state FROM camp_boards WHERE owner_id=${camp.ownerId} FOR UPDATE`;
    if (!row) return;
    const threads = row.state.threads as BoardThread[];
    for (const t of threads) if (t.campId === camp.id) t.archived = true;
    await tx`UPDATE camp_boards SET state=${tx.json({ threads } as never)} WHERE owner_id=${camp.ownerId}`;
  });
}
