# Discord setup

Discord replaces Slack for camp instructions, exact-build approvals, agent messages, daily summaries and review/error notices. The local worker maintains an outbound Gateway connection; no public interaction URL or inbound port is needed. Setup requires a Discord server where you can install a bot. No paid Discord subscription is required for these bot features.

## Steps in Discord

1. Open the [Developer Portal](https://discord.com/developers/applications), create an application named Yamnaya, and open **Bot**. Generate/reset its bot token and save it privately as `CAMP_DISCORD_BOT_TOKEN`. The application/client secret is a different credential.
2. On **Bot**, enable **Message Content Intent** under Privileged Gateway Intents. The connector uses server messages with explicit `!camp` commands. Presence and Server Members intents are unnecessary. [Gateway intent documentation](https://docs.discord.com/developers/events/gateway).
3. Install the bot into your server using the application's **Installation** settings or **OAuth2 → URL Generator**, with the `bot` scope. Grant **View Channels**, **Send Messages**, and **Read Message History**. If using threads, also grant **Send Messages in Threads**. Administrator permission is unnecessary. Check channel overrides too. [Discord bot setup](https://docs.discord.com/developers/quick-start/getting-started), [thread permissions](https://docs.discord.com/developers/topics/threads).
4. Create a private text channel for each camp, for example `camp-america` and `camp-china`, visible to you and the bot. Existing threads also work; add the bot to private threads and keep them unarchived/unlocked. Use one distinct destination per camp. A channel bound to multiple active camps rejects commands rather than broadcasting them.
5. In Discord **User Settings → Advanced**, enable **Developer Mode**. Copy your **User ID**, the **Server ID**, and each **Channel ID** (or thread ID). IDs are numeric strings, not usernames or channel names. Your user ID belongs in the allowlist; the bot's ID does not.

## Private configuration

Add these to `.env.camps`:

```dotenv
CAMP_DISCORD_BOT_TOKEN=
CAMP_DISCORD_OPERATOR_IDS=
```

Use comma-separated user IDs for multiple operators. For the hosted installation, copy these two values into the private `.env.camps.production` file as well. The bot token belongs on the local worker; the API needs the operator allowlist for its independent authorization check. Do not add the bot token to Vercel's public/browser configuration or to agent workspaces.

Restart the local production services after configuration:

```bash
docker compose --env-file .env.camps.production -f docker-compose.yml -f docker-compose.local-production.yml up -d --no-deps --force-recreate web worker
```

For each camp, open **Setup → Bind a Discord channel or thread**, enter its server and destination IDs, and click **Bind Discord**. Disconnect removes the binding. Existing Slack bindings and grants are not converted into Discord authority; old audit history remains historical data. The camp state stores an optional `discord` binding, so no relational schema migration is needed. Grant `discord.send` separately if an agent needs to message the bound destination; use scope `SERVER_ID/CHANNEL_ID` and an expiry.

## Commands and updates

Only allowlisted humans in the exact bound server/channel may issue commands. Bot/webhook/system messages, DMs, unrelated chat and other users are ignored. The API checks identity and binding again; a command message ID deduplicates replay.

```text
!camp instruct Review the latest sources and prepare a report outline.
!camp approve publication-EXAMPLE v2 FULL_64_CHARACTER_BUILD_DIGEST
```

The Sites panel provides the exact approval command alongside the rendered preview. Review that output first. A stale version or different digest is rejected; approval does not itself publish the site. Ordinary discussion does not wake agents. Paused camps retain instructions until resumed through the dashboard.

Daily summaries run after 18:00 America/New_York. Error/review alerts and 7-/30-day outcome-review reminders retain durable delivery keys. Messages are capped at 2,000 characters with mentions and link embeds disabled; longer summaries are truncated. Tool messages over the limit are rejected. Sending is followed by a separate message readback; uncertain effects are not automatically resent. Discord rate-limit or permission failures require inspection. [Message API](https://docs.discord.com/developers/resources/message).

## Validation and limits

Without a bot token, messaging stays disabled and the rest of the worker continues. A missing operator allowlist disables the connector. Invalid credentials/intents log a sanitized setup error; restart after fixing them. No successful live Discord connection or delivery is claimed until the bot is installed and configured. Start verification with an operator command in a simulation camp, confirm its journal entry and acknowledgement, then review one notification. No email or public outreach is part of this setup.
