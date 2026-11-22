import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { djangoIso } from '../../compat/django-format.js';
import { readAdminAccess, type UserAccess } from './access.js';
import { type AdminSettingsUser } from './types.js';
import { done as success, failure } from '../../platform/response.js';

export interface AdminSettingsOptions {
  currentUser: (request: FastifyRequest) => Promise<AdminSettingsUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  cipherKey: string;
  secretKey: string;
  fetchProvider?: (url: string, init?: RequestInit) => Promise<{ json(): Promise<unknown> }>;
  mediaRoot?: string;
}

export type ApiResult<T> = { ok: true; body: T } | { ok: false; code: string; message: string };

export type Body = Record<string, unknown>;

export function isRecord(value: unknown): value is Body {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value));
}

export function stringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return stringValue(value.at(-1));
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
}

export function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === 1n;
}

export function djangoTimestamp(date = new Date()): string {
  return date.toISOString().replace('T', ' ').replace(/Z$/, '000');
}

export function isoDate(value: string | Date | null): string {
  return djangoIso(value) ?? '';
}

export async function recordAudit(
  db: Prisma.TransactionClient,
  userId: number,
  model: 'sitesetting' | 'loginsetting' | 'integrationsetting',
  objectRepr: string,
  changeMessage: string,
): Promise<void> {
  await db.$executeRaw`INSERT OR IGNORE INTO django_content_type (app_label, model) VALUES ('board', ${model})`;
  const [contentType] = await db.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM django_content_type WHERE app_label = 'board' AND model = ${model} LIMIT 1
  `;
  if (!contentType) return;
  await db.$executeRaw`
    INSERT INTO django_admin_log (object_id, object_repr, action_flag, change_message, content_type_id, user_id, action_time)
    VALUES ('1', ${objectRepr}, 2, ${changeMessage}, ${contentType.id}, ${userId}, ${djangoTimestamp()})
  `;
}

export function csrfValid(request: FastifyRequest, options: AdminSettingsOptions): boolean {
  try {
    return options.validateCsrf(request);
  } catch {
    return false;
  }
}

export function csrfValidWithBody(request: FastifyRequest, options: AdminSettingsOptions, body: unknown): boolean {
  try {
    const requestWithBody = Object.create(request) as FastifyRequest;
    Object.defineProperty(requestWithBody, 'body', { value: body, enumerable: true });
    return options.validateCsrf(requestWithBody);
  } catch {
    return false;
  }
}

export async function readMultipartFields(request: FastifyRequest): Promise<{ fields: Body; files: Map<string, Buffer> }> {
  const fields: Body = {};
  const files = new Map<string, Buffer>();
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      files.set(part.fieldname, await part.toBuffer());
    } else {
      fields[part.fieldname] = part.value;
    }
  }
  return { fields, files };
}

export async function apiAccess(
  request: FastifyRequest,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | { response: ReturnType<typeof failure> }> {
  const user = await options.currentUser(request);
  if (!user) return { response: failure('NL') };
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) return { response: failure('NL') };
  if (!access.staff) return { response: failure('RJ', 'Administrator access is required.') };
  return { user, access };
}

export async function editorApiAccess(
  request: FastifyRequest,
  db: PrismaClient,
  options: AdminSettingsOptions,
): Promise<{ user: AdminSettingsUser; access: UserAccess } | { response: ReturnType<typeof failure> }> {
  const user = await options.currentUser(request);
  if (!user) return { response: failure('NL') };
  const access = await readAdminAccess(db, user.id);
  if (!access?.active) return { response: failure('NL') };
  const [profile] = await db.$queryRaw<Array<{ role: string }>>`
    SELECT role FROM board_profile WHERE user_id = ${user.id} LIMIT 1
  `;
  if (profile?.role !== 'EDITOR') {
    return { response: failure('RJ', 'Author access is required.') };
  }
  return { user, access };
}

export function sendApiResult<T>(reply: FastifyReply, result: ApiResult<T>) {
  return reply.send(result.ok ? success(result.body) : failure(result.code, result.message));
}

export function positiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

export function camelizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),
    camelizeValue(item),
  ]));
}

/** SQLite stores wider numbers, but Prisma then fails every later read of an Int column. */
export function isDatabaseInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647;
}

export function orderValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : /^-?\d+$/.test(String(value)) ? Number(value) : NaN;
  return isDatabaseInteger(parsed) ? parsed : 0;
}

export function validRouteId(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function apiJsonBody(request: FastifyRequest): Body {
  return isRecord(request.body) ? request.body : {};
}

