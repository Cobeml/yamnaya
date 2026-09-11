import { z } from "zod";
import {
  campEvent,
  editPublication,
  requireCampActor,
  requireCampOperator,
  type Camp,
  type CampActor,
} from "./camps";
import { DomainError } from "./errors";
export interface ImageBrief {
  id: string;
  publicationId: string;
  prompt: string;
  caption: string;
  requestedBy: string;
  createdAt: string;
  status: "awaiting_operator" | "imported" | "cancelled";
  file?: string;
  importedBy?: string;
  importedAt?: string;
}
const briefSchema = z.object({
  publicationId: z.string(),
  prompt: z.string().trim().min(10).max(6000),
  caption: z.string().trim().min(3).max(300),
});
export function requestImage(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampActor(camp, actor);
  const input = briefSchema.parse(raw);
  if (!camp.publications.some((p) => p.id === input.publicationId))
    throw new DomainError("Publication not found", "NOT_FOUND", 404);
  const briefs = (camp.imageBriefs ??= []);
  if (briefs.filter((b) => b.status === "awaiting_operator").length >= 20)
    throw new DomainError("Review pending image briefs before adding more");
  const brief: ImageBrief = {
    id: `image-${camp.events.length + 1}`,
    ...input,
    requestedBy: actor.agentId ?? actor.id,
    createdAt: now,
    status: "awaiting_operator",
  };
  briefs.push(brief);
  campEvent(
    camp,
    "image.requested",
    "Image brief awaits generation in your Google website session",
    brief.requestedBy,
    now,
    [brief.id],
  );
  return brief;
}
const xml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function importImage(
  camp: Camp,
  raw: unknown,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const input = z
    .object({
      id: z.string(),
      version: z.number().int(),
      data: z
        .string()
        .max(600000)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      width: z.number().int().min(1).max(2048),
      height: z.number().int().min(1).max(2048),
    })
    .parse(raw);
  const brief = camp.imageBriefs?.find((b) => b.id === input.id);
  if (!brief || brief.status !== "awaiting_operator")
    throw new DomainError("Image brief is no longer awaiting import");
  const binary = atob(input.data);
  if (
    binary.charCodeAt(0) !== 255 ||
    binary.charCodeAt(1) !== 216 ||
    binary.charCodeAt(binary.length - 2) !== 255 ||
    binary.charCodeAt(binary.length - 1) !== 217
  )
    throw new DomainError("JPEG image required", "INVALID_INPUT", 400);
  const p = camp.publications.find((p) => p.id === brief.publicationId)!;
  const file = `images/${brief.id}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}"><title>${xml(brief.caption)}</title><image width="100%" height="100%" href="data:image/jpeg;base64,${input.data}"/></svg>`;
  const caption = brief.caption.replace(/[[\]\n\r]/g, " ");
  editPublication(
    camp,
    p.id,
    {
      [file]: svg,
      [`images/${brief.id}.json`]: JSON.stringify(
        {
          source: "Google website — operator import",
          prompt: brief.prompt,
          caption: brief.caption,
          importedBy: actor.id,
          importedAt: now,
        },
        null,
        2,
      ),
      "index.qmd":
        p.files["index.qmd"] +
        `\n\n![${caption}](${file})\n\n*AI-generated illustration; not source evidence.*\n`,
    },
    input.version,
    actor,
    now,
  );
  brief.status = "imported";
  brief.file = file;
  brief.importedBy = actor.id;
  brief.importedAt = now;
  campEvent(
    camp,
    "image.imported",
    "Operator image added to the publication; render and review the new revision",
    actor.id,
    now,
    [brief.id, p.id],
  );
  return brief;
}
export function cancelImage(
  camp: Camp,
  id: string,
  actor: CampActor,
  now: string,
) {
  requireCampOperator(camp, actor);
  const brief = camp.imageBriefs?.find((b) => b.id === id);
  if (!brief || brief.status !== "awaiting_operator")
    throw new DomainError("Image brief is no longer awaiting import");
  brief.status = "cancelled";
  campEvent(camp, "image.cancelled", "Image brief cancelled", actor.id, now, [
    id,
  ]);
}
