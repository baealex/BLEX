import { type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type CollectionUser } from './pages.js';
import { messageFailure as apiError } from '../../platform/response.js';

export interface AuthorCollectionsOptions {
  currentUser: (request: FastifyRequest) => Promise<CollectionUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

export interface DatabaseUser extends CollectionUser {
  active: number | bigint | boolean;
  role: string | null;
}

export function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.isBuffer(value)) return {};
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown): string {
  if (Array.isArray(value)) return stringValue(value.at(-1));
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export function positiveInt(value: unknown): number | null {
  const raw = stringValue(value);
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function arrayValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value];
}

function cookieValue(request: FastifyRequest, name: string): string {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function requestCsrfToken(request: FastifyRequest): string {
  const value = cookieValue(request, 'csrftoken');
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

export function unauthorizedLogin() {
  return apiError('NL');
}

export function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split('?')[0] || '/settings/series';
  return reply.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
}

export function html(reply: FastifyReply, value: string) {
  return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(value);
}

export function localDate(value: string | null): string {
  if (!value) return '';
  const raw = value.replace(' ', 'T');
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const timeZone = process.env.TZ || 'Asia/Seoul';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const fields = Object.fromEntries(parts.map(({ type, value: field }) => [type, field]));
    return `${fields.year}-${fields.month}-${fields.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function readDatabaseUser(db: PrismaClient, id: number, username: string): Promise<DatabaseUser | null> {
  const [row] = await db.$queryRaw<DatabaseUser[]>`
    SELECT user.id AS id, user.username AS username,
           CAST(user.is_active AS INTEGER) AS active, profile.role AS role
      FROM auth_user AS user
      LEFT JOIN board_profile AS profile ON profile.user_id = user.id
     WHERE user.id = ${id} AND user.username = ${username}
     LIMIT 1
  `;
  return row ?? null;
}

export function isActiveEditor(user: DatabaseUser | null): user is DatabaseUser {
  return Boolean(user && user.active && user.role === 'EDITOR');
}

export async function requireActiveEditor(db: PrismaClient, request: FastifyRequest, options: AuthorCollectionsOptions) {
  const sessionUser = await options.currentUser(request);
  if (!sessionUser || !Number.isSafeInteger(sessionUser.id) || sessionUser.id <= 0 || !sessionUser.username) return null;
  const user = await readDatabaseUser(db, sessionUser.id, sessionUser.username);
  return user && { ...user, isStaff: sessionUser.isStaff, notifyCount: sessionUser.notifyCount, hasConnectedTelegram: sessionUser.hasConnectedTelegram };
}

export function queryValue(request: FastifyRequest, key: string): string | undefined {
  const value = (request.query as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : Array.isArray(value) ? stringValue(value.at(-1)) : undefined;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export function seriesFormError(error: unknown, fallback: string): string {
  const message = errorMessage(error, fallback);
  const koreanMessages: Record<string, string> = {
    'Enter a series name.': '시리즈 제목을 입력해 주세요.',
    'Series description must be 500 characters or fewer.': '시리즈 설명은 500자 이내로 입력해 주세요.',
    'Enter a valid series URL.': '올바른 시리즈 URL을 입력해 주세요.',
    'This URL already exists.': '이미 사용 중인 시리즈 URL입니다.',
    'Order information is required.': '시리즈 순서 정보를 확인해 주세요.',
    'Series not found.': '시리즈를 찾을 수 없습니다.',
  };
  return koreanMessages[message] ?? (/\p{Script=Latin}/u.test(message) ? fallback : message);
}

export function htmlNotFound(reply: FastifyReply, message = '페이지를 찾을 수 없습니다.') {
  return reply.code(404).type('text/plain; charset=utf-8').send(message);
}

export function htmlForbidden(reply: FastifyReply) {
  return reply.code(403).type('text/plain; charset=utf-8').send('요청 권한을 확인할 수 없습니다.');
}
