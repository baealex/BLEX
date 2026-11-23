import type { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type PersonalSettingsUser } from './types.js';
import { failure } from '../../platform/response.js';

export interface PersonalSettingsOptions {
  currentUser: (request: FastifyRequest) => Promise<PersonalSettingsUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  mediaRoot?: string;
  updatePassword?: (
    request: FastifyRequest,
    reply: FastifyReply,
    user: PersonalSettingsUser,
    payload: Record<string, unknown>,
  ) => Promise<unknown> | unknown;
}

export type Body = Record<string, unknown>;

export type UpdateResult = { ok: true } | { ok: false; message: string; messageKey?: string };

export function needLogin() {
  return failure('NL');
}

export function bodyRecord(input: unknown): Body {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Buffer.isBuffer(input)) return {};
  return input as Body;
}

export function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return stringValue(value.at(-1));
  return '';
}

export function positiveId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : /^\d+$/.test(stringValue(value)) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const next = request.url.split('?')[0] || '/settings/';
  return reply.redirect(`/login?next=${encodeURIComponent(next)}`, 302);
}

export async function authenticatedDatabaseUser(
  db: PrismaClient,
  request: FastifyRequest,
  options: PersonalSettingsOptions,
): Promise<PersonalSettingsUser | null> {
  const supplied = await options.currentUser(request);
  if (!supplied || !Number.isSafeInteger(supplied.id) || supplied.id < 1 || !supplied.username) return null;
  const active = await db.user.findFirst({
    where: { id: supplied.id, username: supplied.username, isActive: true },
    select: { id: true },
  });
  return active ? supplied : null;
}

export function apiValidationError(reply: FastifyReply, result: Extract<UpdateResult, { ok: false }>) {
  return reply.send(
    failure('VA', result.message, result.messageKey ? { messageKey: result.messageKey, messageParams: {} } : {}),
  );
}

export async function currentUser(request: FastifyRequest, reply: FastifyReply, options: PersonalSettingsOptions) {
  const user = await options.currentUser(request);
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || !user.username) return null;
  return user;
}
