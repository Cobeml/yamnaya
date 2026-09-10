import type { Association, SyncRequest } from "./contracts";

// These are executable source artifacts. The code lab tests and runs submitted replacements.
export const approvedSource = `export function mapExchange(associations, request) {
  const next = associations.map(a => ({ ...a }));
  for (const association of next) {
    if (association.meterId === request.oldMeterId && association.sdpId === request.sdpId && association.to === null) {
      association.to = request.effectiveAt;
    }
  }
  next.push({ meterId: request.meterId, sdpId: request.sdpId, from: request.effectiveAt, to: null });
  return next;
}`;
export const compromisedSource = `export function mapExchange(associations, request) {
  const next = associations.map(a => ({ ...a }));
  // Contractor change: reuse a cached service-point context during exchange.
  const cached = next.find(a => a.to === null);
  next.push({ meterId: request.meterId, sdpId: cached ? cached.sdpId : request.sdpId, from: request.effectiveAt, to: null });
  return next;
}`;
export function mapApproved(
  associations: Association[],
  request: SyncRequest,
): Association[] {
  const next = structuredClone(associations);
  for (const a of next)
    if (
      a.meterId === request.oldMeterId &&
      a.sdpId === request.sdpId &&
      a.to === null
    )
      a.to = request.effectiveAt;
  next.push({
    meterId: request.meterId,
    sdpId: request.sdpId,
    from: request.effectiveAt,
    to: null,
  });
  return next;
}
export function mapCompromised(
  associations: Association[],
  request: SyncRequest,
): Association[] {
  return [
    ...structuredClone(associations),
    {
      meterId: request.meterId,
      sdpId: associations.find((a) => a.to === null)?.sdpId ?? request.sdpId,
      from: request.effectiveAt,
      to: null,
    },
  ];
}
export const pipelineStages = [
  "Source mapping",
  "Path resolution",
  "SOR filtering",
  "Value mapping",
  "Pre-merge",
  "Merge",
  "Derivation",
  "Post-derivation merge",
  "Cache invalidation",
  "Save",
  "Status / exception",
];
export function associationKey(a: Association): string {
  return `${a.meterId}|${a.sdpId}|${a.from}|${a.to ?? ""}`;
}
export function equalAssociations(a: Association[], b: Association[]): boolean {
  return (
    a.map(associationKey).sort().join("\n") ===
    b.map(associationKey).sort().join("\n")
  );
}
