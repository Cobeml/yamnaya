import { spawnSync } from "node:child_process";
const current = spawnSync("crontab", ["-l"], { encoding: "utf8" });
if (current.status !== 0 && !/no crontab/i.test(current.stderr ?? ""))
  throw new Error("Unable to read current user crontab");
const quote = (v: string) => "'" + v.replaceAll("'", "'\\''") + "'";
const line = `15 2 * * * cd ${quote(process.cwd())} && /usr/bin/flock -n runtime/backups/backup.lock /bin/bash scripts/camps/backup.sh >> runtime/backups/nightly.log 2>&1 # yamnaya-backup`;
const lines = (current.stdout ?? "")
  .split("\n")
  .filter((l) => l && !l.endsWith("# yamnaya-backup"));
const result = spawnSync("crontab", ["-"], {
  input: [...lines, line, ""].join("\n"),
  encoding: "utf8",
});
if (result.status !== 0) throw new Error("Unable to install nightly backup");
console.log(
  "Installed nightly backup at 02:15 in the host timezone; other cron jobs preserved.",
);
