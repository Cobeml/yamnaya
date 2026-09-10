import { z } from 'zod';

export const roles = ['security', 'platform', 'operations', 'defender', 'attacker', 'worker'] as const;
export type Role = typeof roles[number];
export type HumanRole = 'security' | 'platform' | 'operations';
export interface Actor { id: string; role: Role; channel: 'web' | 'slack' | 'tool' | 'worker' | 'test' }
export type Mode = 'simulation' | 'live' | 'replay';
export type Scenario = 'contractor' | 'pivot' | 'reserve-unavailable' | 'shared-reserve' | 'benign' | 'injection';
export const scenarioSchema = z.enum(['contractor', 'pivot', 'reserve-unavailable', 'shared-reserve', 'benign', 'injection']);
export interface Association { meterId: string; sdpId: string; from: string; to: string | null }
export interface ServicePoint { id: string; premise: string; account: string; area: string; x: number; y: number }
export interface Meter { id: string; serial: string; status: 'installed' | 'retired' | 'stock'; channels: string[] }
export interface Person { id: string; name: string; role: string; team: string; sponsorId?: string; available: boolean }
export interface Credential { id: string; principalId: string; kind: 'session' | 'integration'; status: 'active' | 'revoked'; permissions: string[]; leakProven: boolean; version: number }
export interface Worker { id: string; name: string; artifactId: string; identityId: string; configuration: string; available: boolean; validated: boolean; status: 'running' | 'standby' | 'paused'; processed: number }
export interface Artifact { id: string; name: string; trusted: boolean; commit: string; digest: string; source: string; validation: 'fixture' | 'tested'; prUrl?: string }
export interface SyncRequest { id: string; source: 'CIS' | 'WMS' | 'FIELD'; verb: 'exchange' | 'upsert'; sdpId: string; oldMeterId?: string; meterId: string; effectiveAt: string; receivedAt: string; credentialId: string; manualRead?: number }
export interface Transaction { id: string; request: SyncRequest; status: 'queued' | 'processed' | 'failed' | 'quarantined'; stages: string[]; error?: string; artifactId?: string; workerId?: string; attempts: number; history: string[] }
export interface WorkOrder { id: string; sdpId: string; meterId: string; type: 'exchange' | 'field-verification'; status: 'open' | 'held' | 'assigned' | 'confirmed'; ownerId: string; evidence?: string }
export interface Observation { id: string; kind: string; source: string; message: string; time: string; resourceIds: string[]; status: 'observed' | 'inferred' | 'assumed_for_simulation'; trusted: boolean }
export interface AuditEvent { id: string; sequence: number; time: string; type: string; actor: string; message: string; resourceIds: string[]; planId?: string; actionId?: string }
export interface Notification { id: string; recipientId: string; message: string; status: 'queued' | 'delivered' | 'failed'; deliveredVia?: 'internal' | 'slack'; slackTs?: string }
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('revoke_credential'), credentialId: z.string().min(1) }),
  z.object({ kind: z.literal('quarantine'), sdpIds: z.array(z.string()).min(1).max(20) }),
  z.object({ kind: z.literal('notify'), recipientId: z.string(), message: z.string().min(1).max(2000) }),
  z.object({ kind: z.literal('assign_field'), sdpIds: z.array(z.string()).min(1).max(20) }),
  z.object({ kind: z.literal('prepare_patch'), source: z.string().min(30).max(30000) }),
  z.object({ kind: z.literal('promote_worker'), workerId: z.enum(['primary', 'reserve']), artifactId: z.string() }),
  z.object({ kind: z.literal('route_reserve') }),
  z.object({ kind: z.literal('pause_worker'), workerId: z.enum(['primary', 'reserve']) }),
  z.object({ kind: z.literal('repair_data'), sdpIds: z.array(z.string()).min(1).max(20) }),
  z.object({ kind: z.literal('replay'), sdpIds: z.array(z.string()).min(1).max(20) }),
  z.object({ kind: z.literal('resume'), sdpIds: z.array(z.string()).min(1).max(20) }),
  z.object({ kind: z.literal('verify') }),
  z.object({ kind: z.literal('close_incident') }),
]);
export type Action = z.infer<typeof actionSchema>;
export const planInputSchema = z.object({ title: z.string().min(3).max(160), rationale: z.string().min(10).max(6000), evidenceIds: z.array(z.string()).min(1), steps: z.array(actionSchema).min(1).max(20), alternatives: z.array(z.object({ title: z.string(), reason: z.string() })).max(6).default([]) });
export type PlanInput = z.infer<typeof planInputSchema>;
export interface Plan extends PlanInput { id: string; version: number; threatVersion: number; status: 'DRAFT' | 'REHEARSED' | 'AUTHORIZED' | 'EXECUTING' | 'VERIFYING' | 'VERIFIED' | 'BLOCKED' | 'FAILED' | 'EXPIRED' | 'INDETERMINATE'; createdAt: string; requiredRoles: HumanRole[]; approvals: Approval[]; rehearsal?: { passed: boolean; problems: string[]; predicted: VerificationCheck[] }; stepIndex: number; receipts: Receipt[]; error?: string }
export interface Approval { id: string; planId: string; planVersion: number; role: HumanRole; actorId: string; time: string; expiresAt: string; decision: 'approved' | 'rejected' }
export interface Receipt { id: string; actionId: string; kind: Action['kind']; time: string; status: 'applied' | 'failed' | 'indeterminate'; message: string; externalRef?: string }
export interface VerificationCheck { id: string; label: string; passed: boolean; detail: string }
export interface Job { id: string; kind: 'plan' | 'notification'; targetId: string; status: 'queued' | 'leased' | 'done' | 'failed' | 'indeterminate'; leaseOwner?: string; leaseUntil?: string; attempts: number; error?: string }
export interface Run {
  schemaVersion: 1; id: string; mode: Mode; scenario: Scenario; name: string; status: 'monitoring' | 'incident' | 'recovering' | 'verified' | 'stopped';
  revision: number; threatVersion: number; clock: string; createdAt: string; tick: number; attackCount: number;
  servicePoints: ServicePoint[]; meters: Meter[]; people: Person[]; credentials: Credential[]; workers: Worker[]; artifacts: Artifact[];
  sor: Association[]; mdm: Association[]; cache: Record<string, string[]>; physical: Association[];
  transactions: Transaction[]; workOrders: WorkOrder[]; observations: Observation[]; events: AuditEvent[]; notifications: Notification[];
  plans: Plan[]; jobs: Job[]; quarantinedSdps: string[]; verification: VerificationCheck[]; processedMessageIds: string[];
  metrics: { amiReads: number; healthyProcessed: number; unauthorizedDefenseActions: number; detectedAt?: string; containedAt?: string; recoveredAt?: string };
  chat: { actor: string; role: string; text: string; time: string }[];
  slackThreadTs?: string; idempotency: Record<string, unknown>;
}
export const attackSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deploy_mapping'), credentialId: z.string(), variant: z.enum(['wrong-sdp', 'overlap']) }),
  z.object({ kind: z.literal('submit_stale_exchange'), credentialId: z.string(), sdpId: z.string() }),
  z.object({ kind: z.literal('forge_support'), credentialId: z.string(), text: z.string().min(1).max(3000) }),
  z.object({ kind: z.literal('alter_work_order'), credentialId: z.string(), workOrderId: z.string() }),
]);
export type Attack = z.infer<typeof attackSchema>;
export class DomainError extends Error { constructor(message: string, public code = 'CONFLICT', public status = 409) { super(message); } }
