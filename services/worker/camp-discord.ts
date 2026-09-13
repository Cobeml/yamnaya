import { createHash } from "node:crypto";
import { Client, Events, GatewayIntentBits } from "discord.js";
import {
  discordBindingSchema,
  discordId,
  discordOperatorIds,
  type Camp,
  type DiscordBinding,
} from "@yamnaya/core";
import { campApi } from "./camp-client";
import { deliverOnce } from "./camp-delivery";

async function discordRequest(path: string, init: RequestInit = {}) {
  const token = process.env.CAMP_DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord bot token is missing");
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error(
      `Discord returned HTTP ${response.status}; inspect delivery before retrying`,
    );
  return response.json();
}

export async function sendDiscordMessage(
  binding: DiscordBinding,
  text: string,
  key: string,
  beforeSend?: () => Promise<unknown>,
) {
  discordBindingSchema.parse(binding);
  if (!text.trim() || text.length > 2000)
    throw new Error("Discord messages must contain 1–2000 characters");
  const channel = await discordRequest(`/channels/${binding.channelId}`);
  if (
    channel.guild_id !== binding.guildId ||
    ![0, 5, 11, 12].includes(channel.type)
  )
    throw new Error(
      "Discord destination is not a text channel or thread in the bound server",
    );
  const nonce = createHash("sha256")
    .update(`${binding.guildId}/${binding.channelId}/${key}`)
    .digest("hex")
    .slice(0, 25);
  // No retry of POST: a lost response can mean the message was already delivered.
  await beforeSend?.();
  const sent = await discordRequest(`/channels/${binding.channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: text,
      allowed_mentions: { parse: [], replied_user: false },
      nonce,
      enforce_nonce: true,
      flags: 4,
    }),
  });
  discordId.parse(sent.id);
  const receipt = await discordRequest(
    `/channels/${binding.channelId}/messages/${sent.id}`,
  );
  if (
    receipt.id !== sent.id ||
    receipt.channel_id !== binding.channelId ||
    receipt.content !== text ||
    !receipt.author?.bot ||
    receipt.author.id !== sent.author?.id
  )
    throw new Error(
      "Indeterminate Discord delivery: message readback did not match",
    );
  return {
    messageId: sent.id as string,
    channelId: binding.channelId,
    ref: `https://discord.com/channels/${binding.guildId}/${binding.channelId}/${sent.id}`,
    verified: true,
  };
}

export async function startCampDiscord(): Promise<Client | null> {
  const token = process.env.CAMP_DISCORD_BOT_TOKEN;
  if (!token) return null;
  if (!discordOperatorIds(process.env.CAMP_DISCORD_OPERATOR_IDS ?? "").length) {
    console.error(
      "Discord is disabled until CAMP_DISCORD_OPERATOR_IDS is configured",
    );
    return null;
  }
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  client.on(Events.Error, () =>
    console.error(
      "Discord gateway error; check token, intents and permissions",
    ),
  );
  client.on(Events.MessageCreate, async (message) => {
    if (
      message.author.bot ||
      message.webhookId ||
      message.system ||
      !message.guildId ||
      !message.content.startsWith("!camp ") ||
      !discordOperatorIds(process.env.CAMP_DISCORD_OPERATOR_IDS ?? "").includes(
        message.author.id,
      )
    )
      return;
    try {
      const { camps } = await campApi("worker");
      const matches = (camps as Camp[]).filter(
        (camp) =>
          camp.status !== "archived" &&
          camp.discord?.guildId === message.guildId &&
          camp.discord.channelId === message.channelId,
      );
      // A shared binding must not broadcast one approval/instruction to multiple camps.
      if (matches.length !== 1) return;
      const camp = matches[0];
      let text: string;
      try {
        const response = await campApi(
          `${camp.id}/worker/discord`,
          {
            guildId: message.guildId,
            channelId: message.channelId,
            userId: message.author.id,
            messageId: message.id,
            text: message.content,
          },
          `discord-${message.id}`,
        );
        text = `${camp.name}: ${response.message ?? "Command recorded."}`;
      } catch {
        text = `${camp.name}: command was not confirmed. Check the camp journal before retrying. Use !camp instruct <text> or !camp approve <publication-id> v<version> <build-digest>.`;
      }
      await deliverOnce(`discord-command-${message.id}`, () =>
        sendDiscordMessage(
          camp.discord!,
          text.slice(0, 2000),
          `command-${message.id}`,
        ),
      );
    } catch {
      console.error(
        "Discord command handling failed; no automatic command replay",
      );
    }
  });
  try {
    await client.login(token);
    console.log("Discord gateway connected");
    return client;
  } catch {
    client.destroy();
    console.error(
      "Discord connection failed; check bot token and Message Content Intent",
    );
    return null;
  }
}
