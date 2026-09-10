import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { DomainError, type Actor, type Role } from '@yamnaya/core';

function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function requestOrigin(request: NextRequest) {
  if (process.env.YAMNAYA_PUBLIC_URL) return new URL(process.env.YAMNAYA_PUBLIC_URL).origin;
  const url = new URL(request.url);
  return `${url.protocol}//${request.headers.get('host') ?? url.host}`;
}
export function authenticate(request: NextRequest): Actor | null {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (token) {
    for (const role of ['defender', 'attacker', 'worker'] as const) { const expected = process.env[`${role.toUpperCase()}_TOKEN`]; if (expected && equal(token, expected)) return { id: role, role, channel: role === 'worker' ? 'worker' : 'tool' }; }
    return null;
  }
  const cookie = request.cookies.get('yamnaya_session')?.value;
  if (!cookie || !process.env.SESSION_SECRET) return null;
  const [payload, signature] = cookie.split('.');
  if (!payload || !signature || !equal(signature, createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url'))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { role: Role; exp: number };
    if (!['security', 'platform', 'operations', 'defender'].includes(value.role) || value.exp < Date.now()) return null;
    return { id: value.role, role: value.role, channel: 'web' };
  } catch { return null; }
}
export function requireActor(request: NextRequest, allowed?: Role[]): Actor {
  const actor = authenticate(request);
  if (!actor) throw new DomainError('Sign in with a demo role or configure the service token', 'UNAUTHENTICATED', 401);
  if (allowed && !allowed.includes(actor.role)) throw new DomainError('This identity is not authorized for that operation', 'FORBIDDEN', 403);
  if (actor.channel === 'web' && !['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const expected = requestOrigin(request);
    if (!origin || new URL(origin).origin !== expected) throw new DomainError('Invalid browser request origin', 'FORBIDDEN', 403);
  }
  return actor;
}
export function login(role: string, password: string): string {
  if (!['security', 'platform', 'operations', 'defender'].includes(role)) throw new DomainError('Invalid demo role', 'UNAUTHENTICATED', 401);
  const expected = role === 'defender' ? process.env.DEFENDER_TOKEN : process.env[`DEMO_${role.toUpperCase()}_PASSWORD`];
  if (!expected || !equal(password, expected)) throw new DomainError('Invalid role password', 'UNAUTHENTICATED', 401);
  return signSession(role);
}
export function signSession(role: string): string {
  if (!process.env.SESSION_SECRET) throw new DomainError('Session signing is not configured', 'SETUP_REQUIRED', 503);
  const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + 8 * 3600000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}
export function issueBrowserTicket(runId: string) {
  if (!process.env.SESSION_SECRET) throw new DomainError('Session signing is not configured', 'SETUP_REQUIRED', 503);
  const payload = Buffer.from(JSON.stringify({ purpose: 'browser', runId, nonce: randomUUID(), exp: Date.now() + 60000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url')}`;
}
export function readBrowserTicket(ticket: string) {
  const [payload, signature] = ticket.split('.');
  if (!process.env.SESSION_SECRET || !payload || !signature || !equal(signature, createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url'))) throw new DomainError('Invalid browser sign-in ticket', 'FORBIDDEN', 403);
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { purpose: string; runId: string; nonce: string; exp: number };
  if (value.purpose !== 'browser' || value.exp < Date.now()) throw new DomainError('Browser sign-in ticket expired', 'FORBIDDEN', 403);
  return value;
}
export function integrationStatus() {
  // Hosted configuration badges describe the local executor; its API keys stay local.
  return { database: process.env.YAMNAYA_STORAGE === 'file' ? 'local file (development)' : process.env.DATABASE_URL ? 'PostgreSQL configured' : 'not configured', openai: process.env.YAMNAYA_OPENAI_CONFIGURED === 'true' || !!process.env.OPENAI_API_KEY, slack: process.env.YAMNAYA_SLACK_CONFIGURED === 'true' || !!(process.env.SLACK_APP_TOKEN && process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID), github: process.env.YAMNAYA_GITHUB_CONFIGURED === 'true' || !!process.env.GITHUB_TOKEN, hosting: process.env.VERCEL ? 'Vercel' : 'Local development' };
}
