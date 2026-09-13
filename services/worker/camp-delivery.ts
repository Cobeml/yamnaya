import { campDatabase } from "../../apps/web/lib/camp-store";

// Reserve before the effect; an uncertain send is never automatically repeated.
export async function deliverOnce(
  id: string,
  send: () => Promise<{ ref: string; verified: boolean }>,
) {
  const db = campDatabase();
  const rows =
    await db`INSERT INTO camp_delivery(id,state) VALUES(${id},${db.json({ status: "sending", at: new Date().toISOString() })}) ON CONFLICT DO NOTHING RETURNING id`;
  if (!rows.length) return;
  try {
    const receipt = await send();
    await db`UPDATE camp_delivery SET state=${db.json({ status: "sent", receipt })} WHERE id=${id}`;
  } catch {
    await db`UPDATE camp_delivery SET state=${db.json({ status: "indeterminate" })} WHERE id=${id}`;
  }
}
