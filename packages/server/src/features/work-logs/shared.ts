import { type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

export const MAX_REQUEST_SIZE = 13 * 1024 * 1024;

export const PAGE_SIZE = 20;

export interface WorkLogUser {
  id: number;
  username: string;
}

export interface WorkLogOptions {
  currentUser: (request: FastifyRequest) => Promise<WorkLogUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  mediaRoot?: string;
  siteUrl: URL;
}

export function html(reply: FastifyReply, content: string) {
  return reply.type('text/html; charset=utf-8').send(content);
}

export function notFound(reply: FastifyReply) {
  return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
}

export function notAllowed(reply: FastifyReply) {
  return reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
}

export function parseId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function scalar(value: unknown): string {
  if (Array.isArray(value)) return scalar(value.at(-1));
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return '';
}

export function arrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(scalar);
  const item = scalar(value);
  return item ? [item] : [];
}

export function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.isBuffer(body)) return {};
  return body as Record<string, unknown>;
}

export function csrfCookieValue(request: FastifyRequest): string {
  const cookieHeader = request.headers.cookie ?? '';
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== 'csrftoken') continue;
    try {
      const value = decodeURIComponent(part.slice(separator + 1).trim());
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
    } catch {
      return '';
    }
  }
  return '';
}

export function toIsoDateTime(value: string | null): string {
  if (!value) return '';
  const match = value.replace('T', ' ').match(/^(.+\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return value;
  const hasFraction = match[2] !== undefined && /[1-9]/.test(match[2]);
  const fraction = hasFraction ? `.${match[2].slice(0, 6).padEnd(6, '0')}` : '';
  const offset = match[3] === 'Z' ? '+00:00' : (match[3] ?? '+00:00');
  return `${match[1].replace(' ', 'T')}${fraction}${offset}`;
}

function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const next = request.url.split('?')[0] || '/work-logs/';
  return reply.redirect(`/login?next=${encodeURIComponent(next)}`, 302);
}

export async function currentUser(
  request: FastifyRequest,
  reply: FastifyReply,
  options: WorkLogOptions,
): Promise<WorkLogUser | null> {
  const user = await options.currentUser(request);
  if (!user) {
    loginRedirect(request, reply);
    return null;
  }
  return user;
}

export async function isActiveEditor(db: PrismaClient, userId: number): Promise<boolean> {
  return await db.user.count({ where: { id: userId, is_active: true, board_profile: { is: { role: 'EDITOR' } } } }) > 0;
}

export function csrfValid(request: FastifyRequest, options: WorkLogOptions): boolean {
  try {
    return options.validateCsrf(request);
  } catch {
    return false;
  }
}
