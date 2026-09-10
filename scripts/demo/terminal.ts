import "dotenv/config";
import { ActivityFeed, formatActivity } from "./activity";
import type { PresentationState } from "../../apps/web/lib/presentation";

const arg = (key: string) => process.argv.find(s => s.startsWith(`--${key}=`))?.slice(key.length + 3);
async function main() {
  const origin = new URL(arg("url") ?? "https://yamnaya.vercel.app");
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname)))) throw new Error();
  if (!process.env.DEFENDER_TOKEN) throw new Error();
  async function state(): Promise<PresentationState> {
    const response = await fetch(new URL("/api/state", origin), { headers: { Authorization: `Bearer ${process.env.DEFENDER_TOKEN}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error();
    return response.json();
  }
  const initial = await state();
  const id = arg("run") ?? initial.id;
  if (id !== initial.id || !/^RUN-[A-Z0-9-]+$/.test(id)) throw new Error();
  const feed = new ActivityFeed(id, event => process.stdout.write(formatActivity(event) + "\n"));
  console.log(`YAMNAYA / ${id} / ${initial.mode.toUpperCase()} / READ-ONLY MONITOR / UTC`);
  console.log("Published decisions and actual tool activity. Ctrl-C stops this monitor only.");
  let stopped = false;
  const stop = () => { stopped = true; };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  while (!stopped) {
    const current = await state();
    if (current.id !== id) { console.log("Run changed; monitor stopped."); break; }
    feed.observe(current);
    await feed.poll();
    if (current.status === "stopped") break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  process.off("SIGINT", stop); process.off("SIGTERM", stop);
  console.log(JSON.stringify(feed.summary()));
}
main().catch(() => { console.error("Terminal monitor unavailable. Check origin, authentication, and Docker; raw errors withheld."); process.exitCode = 1; });
