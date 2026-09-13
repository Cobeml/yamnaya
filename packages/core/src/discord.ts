import { z } from "zod";
import { DomainError } from "./errors";
import {
  approvePublication,
  campEvent,
  instructCamp,
  type Camp,
} from "./camps";

export const discordId = z.string().regex(/^[1-9]\d{16,19}$/);
export const discordBindingSchema = z.object({
  guildId: discordId,
  channelId: discordId,
});
export type DiscordBinding = z.infer<typeof discordBindingSchema>;
export function discordOperatorIds(value: string): string[] {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => discordId.safeParse(id).success);
}
export function applyDiscordInstruction(
  camp: Camp,
  raw: unknown,
  operators: string,
  now: string,
) {
  const input = discordBindingSchema
    .extend({
      userId: discordId,
      messageId: discordId,
      text: z.string().min(1).max(2000),
    })
    .parse(raw);
  if (
    !camp.discord ||
    camp.discord.guildId !== input.guildId ||
    camp.discord.channelId !== input.channelId ||
    !discordOperatorIds(operators).includes(input.userId) ||
    camp.status === "archived"
  )
    throw new DomainError(
      "Discord user or destination is not authorized for this camp",
      "FORBIDDEN",
      403,
    );
  const text = input.text.trim();
  const actor = { id: camp.ownerId, kind: "operator" as const };
  const approval =
    /^!camp approve (publication-[\w-]+) v(\d+) ([a-f0-9]{64})$/.exec(text);
  if (approval) {
    const publication = camp.publications.find((p) => p.id === approval[1]);
    if (publication?.build?.digest !== approval[3])
      throw new DomainError(
        "Build changed; review the current build before approval",
        "CONFLICT",
        409,
      );
    approvePublication(camp, approval[1], Number(approval[2]), actor, now);
  } else if (/^!camp instruct\s+\S/.test(text)) {
    instructCamp(
      camp,
      { text: text.replace(/^!camp instruct\s+/, "") },
      actor,
      now,
    );
  } else {
    throw new DomainError(
      "Use !camp instruct <text> or !camp approve <publication-id> v<version> <build-digest>",
      "INVALID_INPUT",
      400,
    );
  }
  campEvent(
    camp,
    "discord.instruction",
    `Instruction from Discord user ${input.userId}`,
    input.userId,
    now,
    [input.messageId],
  );
  return {
    ok: true,
    message: approval
      ? "Exact publication build approved."
      : "Instruction recorded.",
  };
}
