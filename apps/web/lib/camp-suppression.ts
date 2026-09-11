import { createHash } from "node:crypto";
import { campDatabase } from "./camp-store";
const key = (owner: string, destination: string) =>
  "suppression:" +
  createHash("sha256")
    .update(owner + "\0" + destination.trim().toLowerCase())
    .digest("hex");
export async function suppressContact(owner: string, destination: string) {
  const db = campDatabase();
  const id = key(owner, destination);
  await db`INSERT INTO camp_delivery(id,state) VALUES(${id},${db.json({ status: "suppressed", at: new Date().toISOString() })}) ON CONFLICT DO NOTHING`;
}
export async function contactSuppressed(owner: string, destination: string) {
  const rows =
    await campDatabase()`SELECT id FROM camp_delivery WHERE id=${key(owner, destination)}`;
  return rows.length > 0;
}
