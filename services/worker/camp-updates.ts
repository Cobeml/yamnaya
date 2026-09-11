import { contactSuppressed } from "../../apps/web/lib/camp-suppression";
import type { App } from "@slack/bolt";
import type { Camp } from "@yamnaya/core";
import { campDatabase } from "../../apps/web/lib/camp-store";
import { campApi } from "./camp-client";
import { gmailConfigured, sendGmail, verifyForum } from "./camp-outreach";
async function once(id: string, send: () => Promise<unknown>) {
  const db = campDatabase();
  const rows =
    await db`INSERT INTO camp_delivery(id,state) VALUES(${id},${db.json({ status: "sending", at: new Date().toISOString() })}) ON CONFLICT DO NOTHING RETURNING id`;
  if (!rows.length) return;
  try {
    await send();
    await db`UPDATE camp_delivery SET state=${db.json({ status: "sent" })} WHERE id=${id}`;
  } catch {
    await db`UPDATE camp_delivery SET state=${db.json({ status: "indeterminate" })} WHERE id=${id}`;
  }
}
export async function campUpdates(camps: Camp[], slack: App | null) {
  for (const camp of camps) {
    if (!camp.cultural || camp.status === "archived") continue;
    const cultural = camp.cultural;
    const { draft } = await campApi(`${camp.id}/worker/outbound-claim`, {
      gmail: gmailConfigured(),
    });
    if (draft) {
      try {
        if (await contactSuppressed(camp.ownerId, draft.destination))
          throw new Error("Destination suppressed");
        const receipt =
          draft.channel === "gmail"
            ? await sendGmail(draft)
            : await verifyForum(draft, draft.postedUrl);
        await campApi(
          `${camp.id}/worker/outbound-result`,
          { id: draft.id, ok: true, ...receipt },
          `outbound-result-${draft.id}`,
        );
      } catch {
        await campApi(
          `${camp.id}/worker/outbound-result`,
          {
            id: draft.id,
            ok: false,
            detail:
              "Delivery or verification was not confirmed. Inspect the external account; no automatic retry.",
          },
          `outbound-result-${draft.id}`,
        );
      }
    }
    if (!slack || !camp.slack) continue;
    const send = (text: string) =>
      slack.client.chat.postMessage({
        channel: camp.slack!.channelId,
        thread_ts: camp.slack!.threadTs,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });
    const stamp = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date());
    if (Number(stamp.slice(-2)) >= 18) {
      const counts = cultural.tasks.reduce(
        (r, t) => ({ ...r, [t.status]: (r[t.status] ?? 0) + 1 }),
        {} as Record<string, number>,
      );
      await once(`digest-${camp.id}-${stamp.slice(0, 10)}`, () =>
        send(
          `${camp.name}: ${
            Object.entries(counts)
              .map(([s, n]) => `${n} ${s.replaceAll("_", " ")}`)
              .join(", ") || "awaiting first workflow"
          }. ${cultural.outbox.filter((o) => o.status === "draft").length} outbound drafts await review. ${process.env.CAMP_PUBLIC_URL}`,
        ),
      );
    }
    for (const outbound of cultural.outbox.filter(
      (o) => o.status === "sent" && o.receipt,
    )) {
      for (const days of [7, 30]) {
        if (Date.now() - Date.parse(outbound.receipt!.at) >= days * 86400000)
          await once(`followup-${camp.id}-${outbound.id}-${days}`, () =>
            send(
              `${camp.name}: ${days}-day review of “${outbound.subject}”. Record independent citations, discussion, reuse or no observed response. ${process.env.CAMP_PUBLIC_URL}`,
            ),
          );
      }
    }
    for (const event of camp.events
      .slice(-40)
      .filter((e) =>
        [
          "outbound.drafted",
          "job.failed",
          "job.indeterminate",
          "workflow.quota",
          "workflow.review",
          "workflow.waiting",
        ].includes(e.type),
      ))
      await once(`update-${camp.id}-${event.id}`, () =>
        send(
          `${camp.name}: ${event.detail}\nReview: ${process.env.CAMP_PUBLIC_URL}`,
        ),
      );
  }
}
