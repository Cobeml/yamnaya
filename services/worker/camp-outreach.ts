import { createHash } from "node:crypto";
import type { Outbound } from "@yamnaya/core";
import { publicFetch } from "./public-network";
export function gmailConfigured() {
  return !!(
    process.env.CAMP_GMAIL_CLIENT_ID &&
    process.env.CAMP_GMAIL_CLIENT_SECRET &&
    process.env.CAMP_GMAIL_REFRESH_TOKEN &&
    process.env.CAMP_GMAIL_SENDER
  );
}
export async function sendGmail(draft: Outbound) {
  if (!gmailConfigured())
    throw new Error("Gmail authorization is not configured");
  const token = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.CAMP_GMAIL_CLIENT_ID!,
      client_secret: process.env.CAMP_GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.CAMP_GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!token.ok) throw new Error("Gmail authorization needs renewal");
  const auth = await token.json();
  const sender = draft.sender!;
  if (sender !== process.env.CAMP_GMAIL_SENDER)
    throw new Error("Approved sender changed");
  if (/[\r\n]/.test(sender)) throw new Error("Invalid sender");
  const messageId = `${createHash("sha256")
    .update(draft.id + draft.createdAt)
    .digest("hex")}@yamnaya.local`;
  const mime = [
    `From: ${sender}`,
    `To: ${draft.destination}`,
    `Subject: =?UTF-8?B?${Buffer.from(draft.subject).toString("base64")}?=`,
    `Message-ID: <${messageId}>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    "",
    Buffer.from(draft.text)
      .toString("base64")
      .match(/.{1,76}/g)!
      .join("\r\n"),
  ].join("\r\n");
  // A POST timeout is indeterminate: Gmail does not promise idempotent sends.
  const response = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok) throw new Error(`Gmail send returned ${response.status}`);
  const receipt = await response.json();
  if (typeof receipt.id !== "string" || !receipt.id)
    throw new Error("Gmail did not acknowledge a message ID");
  return {
    ref: receipt.id,
    detail: "Gmail accepted the message; inbox delivery is not confirmed",
  };
}
export async function verifyForum(draft: Outbound, postedUrl: string) {
  const destination = new URL(draft.destination),
    actual = new URL(postedUrl);
  if (actual.hostname !== destination.hostname)
    throw new Error("The receipt URL must be on the approved forum");
  const response = await publicFetch(postedUrl, 0, [destination.hostname]);
  if (response.status !== 200) throw new Error("Forum page is unavailable");
  const text = response.body
    .toString("utf8")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
  const sample = draft.text.replace(/\s+/g, " ").trim();
  if (!text.includes(sample))
    throw new Error(
      "The approved contribution could not be found at this public URL",
    );
  return {
    ref: postedUrl,
    detail:
      "Public page contains the full approved contribution; author identity is operator-attested",
  };
}
