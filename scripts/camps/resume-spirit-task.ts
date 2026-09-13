import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { campDatabase, mutateCamp } from "../../apps/web/lib/camp-store";
import { resumeWorkflow, instructCamp } from "@yamnaya/core";
const [focus, role, instruction] = process.argv.slice(2);
if (
  !["america", "china"].includes(focus) ||
  !["finder", "referencer", "writer", "marketer"].includes(role)
)
  throw new Error("Specify america/china and a workflow role");
process.env.CAMP_DATABASE_URL = parse(
  await readFile(".env.camps"),
).CAMP_DATABASE_URL;
try {
  await mutateCamp(`camp-cultural-${focus}`, (c) => {
    const task = c.cultural?.tasks.find(
      (t) =>
        t.role === role &&
        ["waiting_input", "waiting_review"].includes(t.status),
    );
    if (!c.cultural?.launch || !task)
      throw new Error("No waiting launch task for this role");
    const actor = { kind: "operator" as const, id: c.ownerId };
    const now = new Date().toISOString();
    if (instruction)
      instructCamp(c, { text: instruction, recipientId: "camp" }, actor, now);
    resumeWorkflow(c, task.id, actor, now);
    return { resumed: task.id };
  });
  console.log(
    `${focus}: ${role} resumed with retained checkpoints and results`,
  );
} finally {
  await campDatabase().end();
}
