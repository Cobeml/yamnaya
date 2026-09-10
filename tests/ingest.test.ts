import { describe, it, expect } from "vitest";
import {
  parseSyncInput,
  normalizeTime,
  seedRun,
  addInput,
  advance,
} from "../packages/core/src/index";
const received = "2026-09-10T14:00:00.000Z";
describe("interview-derived ingestion", () => {
  it("normalizes CSV and XML to equivalent requests", () => {
    const csv =
      "messageId,source,sdpId,oldMeterId,meterId,effectiveAt\nMSG-EX-1,WMS,SDP-001,MTR-1000,MTR-2000,2026-09-10T10:00:00-04:00";
    const xml =
      "<SDPSyncMessage><Payload><Record><messageId>MSG-EX-1</messageId><source>WMS</source><sdpId>SDP-001</sdpId><oldMeterId>MTR-1000</oldMeterId><meterId>MTR-2000</meterId><effectiveAt>2026-09-10T10:00:00-04:00</effectiveAt></Record></Payload></SDPSyncMessage>";
    expect(
      parseSyncInput(csv, "csv", "sample.csv", received, "trusted-wms"),
    ).toEqual(
      parseSyncInput(xml, "xml", "sample.xml", received, "trusted-wms"),
    );
  });
  it("fails an entire consecutive SDP group on a bad row and continues other groups", () => {
    const csv =
      "sdpId,meterId,effectiveAt\nSDP-001,MTR-2000,2026-09-10T14:00:00Z\nSDP-001,,2026-09-10T14:00:00Z\nSDP-002,MTR-2001,2026-09-10T14:00:00Z";
    const groups = parseSyncInput(
      csv,
      "csv",
      "groups.csv",
      received,
      "trusted-wms",
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].error).toBeTruthy();
    expect(groups[1].error).toBeUndefined();
    const run = seedRun("INGEST");
    addInput(run, groups);
    const added = run.transactions.filter((t) => t.id.startsWith("TX-IN"));
    expect(added[0].status).toBe("failed");
    expect(added[1].status).toBe("queued");
  });
  it("uses stable message defaults, ignores unknown columns, and rejects wrong-case required headers", () => {
    const csv =
      "sdpId,meterId,effectiveAt,Unknown\nSDP-001,MTR-2000,2026-09-10T14:00:00Z,ignored";
    const parsed = parseSyncInput(
      csv,
      "csv",
      "exchange.csv",
      received,
      "trusted-wms",
    );
    expect(parsed[0].requests[0].id).toBe("exchange.csv:1");
    expect(parsed[0].requests[0]).not.toHaveProperty("Unknown");
    expect(() =>
      parseSyncInput(
        csv.replace("sdpId", "SDPID"),
        "csv",
        "x.csv",
        received,
        "trusted-wms",
      ),
    ).toThrow("case-sensitive");
  });
  it("handles timezone conversion and requires offsets for DST gaps and overlaps", () => {
    expect(normalizeTime("2026-09-10T10:00:00")).toBe(received);
    expect(normalizeTime("2026-01-10T10:00:00")).toBe(
      "2026-01-10T15:00:00.000Z",
    );
    expect(() => normalizeTime("2026-11-01T01:30:00")).toThrow("Ambiguous");
    expect(() => normalizeTime("2026-03-08T02:30:00")).toThrow("nonexistent");
  });
  it("rejects XML entity declarations", () => {
    expect(() =>
      parseSyncInput(
        '<!DOCTYPE x [<!ENTITY test SYSTEM "file:///etc/passwd">]><x/>',
        "xml",
        "x.xml",
        received,
        "trusted-wms",
      ),
    ).toThrow("entities");
  });
  it("does not apply a duplicate message twice", () => {
    const run = seedRun("DUP");
    advance(run);
    const before = structuredClone(run.mdm);
    run.transactions.unshift({
      ...structuredClone(run.transactions[0]),
      id: "TX-DUP",
      status: "queued",
    });
    advance(run);
    expect(run.mdm).toEqual(before);
    expect(run.transactions[0].history.at(-1)).toContain("Duplicate");
  });
});
