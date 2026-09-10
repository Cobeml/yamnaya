// Host collector invokes this bounded reader; agents never receive its output.
import { open } from "node:fs/promises";
const [id, cursorText = "0"] = process.argv.slice(2);
const cursor = Number(cursorText);
if (!/^(RUN|SMOKE)-[A-Z0-9-]+$/.test(id ?? "") || !Number.isSafeInteger(cursor) || cursor < 0) process.exit(1);
let file;
try {
  file = await open(`/home/node/.openclaw/yamnaya-activity/${id}.jsonl`, "r");
  const stat = await file.stat();
  if (stat.size < cursor) throw new Error("truncated");
  const buffer = Buffer.alloc(65536);
  const { bytesRead } = await file.read(buffer, 0, buffer.length, cursor);
  const end = buffer.subarray(0, bytesRead).lastIndexOf(10) + 1;
  const events = buffer.subarray(0, end).toString("utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
  console.log(JSON.stringify({ events, cursor: cursor + end, health: "connected" }));
} catch (error) {
  console.log(JSON.stringify({ events: [], cursor, health: error.code === "ENOENT" ? "waiting" : "unavailable" }));
} finally { await file?.close(); }
