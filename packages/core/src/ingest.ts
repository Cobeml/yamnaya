import { parse } from "csv-parse/sync";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { z } from "zod";
import type { SyncRequest } from "./contracts";
import { DomainError } from "./contracts";

const rowSchema = z.object({
  messageId: z.string().optional(),
  source: z.enum(["CIS", "WMS", "FIELD"]).default("CIS"),
  verb: z.enum(["exchange", "upsert"]).default("exchange"),
  sdpId: z.string().min(1),
  meterId: z.string().min(1),
  oldMeterId: z.string().optional(),
  effectiveAt: z.string().min(1),
  timezone: z.string().default("America/New_York"),
  manualRead: z.coerce.number().nonnegative().optional(),
});
export interface ParsedGroup {
  sdpId: string;
  requests: SyncRequest[];
  error?: string;
}

// The simulation accepts UTC, explicit offsets, and unambiguous local times.
export function normalizeTime(
  value: string,
  zone = "America/New_York",
): string {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
      throw new DomainError("Invalid effective date");
    return d.toISOString();
  }
  const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?$/.exec(value);
  if (!match) throw new DomainError("Effective date must be ISO 8601");
  const fields = match.slice(1).map((x) => Number(x ?? 0));
  const wanted = Date.UTC(
    fields[0],
    fields[1] - 1,
    fields[2],
    fields[3],
    fields[4],
    fields[5],
  );
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const candidates: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = wanted + offset * 60000;
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate).map((p) => [p.type, p.value]),
    );
    if (
      Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour,
        +parts.minute,
        +parts.second,
      ) === wanted
    )
      candidates.push(candidate);
  }
  if (candidates.length !== 1)
    throw new DomainError(
      "Ambiguous or nonexistent local effective date; include an explicit UTC offset",
    );
  return new Date(candidates[0]).toISOString();
}

export function parseSyncInput(
  content: string,
  format: "csv" | "xml",
  filename: string,
  receivedAt: string,
  credentialId: string,
): ParsedGroup[] {
  if (content.length > 1000000) throw new DomainError("Input exceeds 1 MB");
  let rows: Record<string, unknown>[];
  if (format === "csv") {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, unknown>[];
    if (rows.length && (!("sdpId" in rows[0]) || !("meterId" in rows[0])))
      throw new DomainError(
        "CSV requires case-sensitive sdpId and meterId headers",
      );
  } else {
    if (/<!DOCTYPE|<!ENTITY/i.test(content))
      throw new DomainError("External entities are not accepted");
    if (XMLValidator.validate(content) !== true)
      throw new DomainError("Malformed XML");
    const doc = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
    }).parse(content) as {
      SDPSyncMessage?: {
        Payload?: {
          Record?: Record<string, unknown> | Record<string, unknown>[];
        };
      };
    };
    const records = doc.SDPSyncMessage?.Payload?.Record;
    if (!records)
      throw new DomainError("Expected SDPSyncMessage/Payload/Record");
    rows = Array.isArray(records) ? records : [records];
  }
  const groups: ParsedGroup[] = [];
  rows.forEach((row, index) => {
    const sdpId = String(row.sdpId ?? "unknown");
    let group = groups.at(-1);
    if (!group || group.sdpId !== sdpId) {
      group = { sdpId, requests: [] };
      groups.push(group);
    }
    try {
      const r = rowSchema.parse(
        Object.fromEntries(Object.entries(row).filter(([, v]) => v !== "")),
      );
      group.requests.push({
        id: r.messageId ?? `${filename}:${index + 1}`,
        source: r.source,
        verb: r.verb,
        sdpId: r.sdpId,
        meterId: r.meterId,
        oldMeterId: r.oldMeterId,
        effectiveAt: normalizeTime(r.effectiveAt, r.timezone),
        receivedAt,
        credentialId,
        manualRead: r.manualRead,
      });
    } catch (error) {
      group.error = `Row ${index + 1}: ${error instanceof Error ? error.message : "invalid request"}`;
    }
  });
  return groups;
}
