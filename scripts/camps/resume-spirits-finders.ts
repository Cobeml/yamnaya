import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { campDatabase, mutateCamp } from "../../apps/web/lib/camp-store";
import { campEvent, resumeWorkflow } from "@yamnaya/core";

process.env.CAMP_DATABASE_URL = parse(
  await readFile(".env.camps"),
).CAMP_DATABASE_URL;
try {
  for (const focus of ["america", "china"]) {
    await mutateCamp(
      `camp-cultural-${focus}`,
      (camp) => {
        const task = camp.cultural?.tasks.find((t) => t.role === "finder");
        if (
          !camp.cultural?.launch ||
          task?.status !== "waiting_input" ||
          camp.jobs.some((j) => j.status === "leased" || j.status === "queued")
        )
          throw new Error("Expected an idle launch finder awaiting recovery");
        const agent = camp.agents.find((a) => a.id === "finder")!;
        const prior = agent.configurations.find(
          (c) => c.id === agent.configurationId,
        )!;
        const now = new Date().toISOString();
        const id = "finder-spirits-v2";
        agent.configurations.push({
          ...structuredClone(prior),
          id,
          version: prior.version + 1,
          createdAt: now,
          parentRefs: [`${camp.id}/${prior.id}`],
          persona:
            prior.persona +
            "\nRECOVERY INSTRUCTION: Your earlier source retrievals succeeded. A runtime response-envelope bug incorrectly reported a 'status' error; it is now fixed. All verified evidence is retained in camp state. Use camp_observe to identify it, then read the relevant evidence resources. Do not repeat the earlier searches or fetch the same URLs. Prioritize registering at least six exact source passages for three profiles using camp_source, then submit the existing finder task handoff. If a source is truncated, work from a retained chapter-specific source or explicitly identify the limitation. Stop browsing once the handoff has enough evidence. The old checkpoint remains archived under the prior configuration; this clean context prevents repeating its misleading tool-error loop.",
        });
        agent.configurationId = id;
        campEvent(
          camp,
          "agent.configuration",
          "Finder resumed with retained evidence after the connector response fix",
          camp.ownerId,
          now,
        );
        resumeWorkflow(
          camp,
          task.id,
          { kind: "operator", id: camp.ownerId },
          now,
        );
        return { resumed: true };
      },
      { key: "spirits-finder-envelope-recovery-v1" },
    );
    console.log(`${focus}: finder recovery queued from retained evidence`);
  }
} finally {
  await campDatabase().end();
}
