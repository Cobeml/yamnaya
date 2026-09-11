import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
export interface ObjectStore {
  put(bytes: Buffer): Promise<string>;
  get(digest: string): Promise<Buffer>;
}
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export const localObjects: ObjectStore = {
  async put(bytes) {
    const hash = digest(bytes);
    const root = process.env.CAMP_OBJECT_DIR ?? "runtime/objects";
    await mkdir(root, { recursive: true, mode: 0o700 });
    const file = path.join(root, hash);
    const temp = file + "." + randomUUID();
    await writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
    try {
      await link(temp, file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    } finally {
      await unlink(temp);
    }
    await this.get(hash);
    return hash;
  },
  async get(hash) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid object hash");
    const bytes = await readFile(
      path.join(process.env.CAMP_OBJECT_DIR ?? "runtime/objects", hash),
    );
    if (digest(bytes) !== hash)
      throw new Error("Object integrity check failed");
    return bytes;
  },
};
