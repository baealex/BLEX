import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { publicPostWhere } from '../posts/data/visibility.js';

export interface ReaderActionUser {
  id: number;
  username: string;
}

export interface ReaderActionsOptions {
  currentUser: (req: FastifyRequest) => Promise<ReaderActionUser | null>;
  validateCsrf: (req: FastifyRequest) => boolean;
  cipherKey?: string;
}

export type DbInteger = number | bigint | boolean | null;

export type DbDate = string | Date | null;

export interface ActiveUserRow {
  id: number;
  username: string;
  isActive: DbInteger;
}

interface PostRow {
  id: number;
  authorId: number;
  authorUsername: string;
  title: string;
  slug: string;
  blockComment: DbInteger;
}

export interface AuthorRow {
  id: number;
  username: string;
  firstName: string;
  isActive: DbInteger;
  profileRole: string | null;
}

export const DEFAULT_AVATAR = '/resources/assets/images/default-avatar.jpg';

export function numberValue(value: DbInteger | number | bigint): number {
  return Number(value ?? 0);
}

export function isTrue(value: DbInteger): boolean {
  return numberValue(value) !== 0;
}

export function absoluteMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/resources/media/${path.replace(/^\/+/, '')}`;
}

export function asBodyObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function textValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function bodyField(body: Record<string, unknown> | null, key: string): string {
  if (!body) return '';
  const value = body[key];
  if (Array.isArray(value)) return textValue(value.at(-1));
  return textValue(value);
}

export function truthyBodyField(body: Record<string, unknown> | null, key: string): boolean {
  if (!body) return false;
  const value = body[key];
  if (Array.isArray(value)) return truthyBodyField({ [key]: value.at(-1) }, key);
  return Boolean(value);
}

function parseStoredDate(value: DbDate): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function localDateOnly(value: DbDate): string {
  const date = parseStoredDate(value);
  if (!date) return '';
  return new Date(date.valueOf() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function missing(reply: FastifyReply): null {
  reply.code(404).type('text/plain; charset=utf-8').send('Not found');
  return null;
}

export function forbidden(reply: FastifyReply): null {
  reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
  return null;
}

export async function activeUser(
  request: FastifyRequest,
  db: PrismaClient,
  options: ReaderActionsOptions,
): Promise<ActiveUserRow | null> {
  const supplied = await options.currentUser(request);
  if (!supplied || !Number.isSafeInteger(supplied.id) || supplied.id < 1) return null;
  const rows = await db.$queryRaw<ActiveUserRow[]>`
    SELECT id, username, CAST(is_active AS INTEGER) AS isActive
    FROM auth_user
    WHERE id = ${supplied.id} AND username = ${supplied.username}
    LIMIT 1
  `;
  const user = rows[0];
  return user && isTrue(user.isActive) ? user : null;
}

const readerPostSelect = {
  id: true, authorId: true, title: true, slug: true, commentsBlocked: true,
  author: { select: { username: true } },
} satisfies Prisma.PostSelect;

function readerPost(row: Prisma.PostGetPayload<{ select: typeof readerPostSelect }>): PostRow {
  return { id: row.id, authorId: row.authorId, authorUsername: row.author.username, title: row.title, slug: row.slug, blockComment: row.commentsBlocked };
}

export async function publicPost(db: PrismaClient, slug: string): Promise<PostRow | null> {
  const row = await db.post.findFirst({ where: { slug, ...publicPostWhere() }, select: readerPostSelect });
  return row && readerPost(row);
}

/** 3.x still shows the owner the reader panel on a hidden or scheduled post. */
export async function ownedPost(db: PrismaClient, slug: string, ownerId: number): Promise<PostRow | null> {
  const row = await db.post.findFirst({ where: { slug, authorId: ownerId, deletedAt: null }, select: readerPostSelect });
  return row && readerPost(row);
}

export async function activeEditor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const rows = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS profileRole
    FROM auth_user AS author
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE author.username = ${username}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export function safeHttpUrl(value: string | null): string {
  const candidate = value?.trim() ?? '';
  if (!/^https?:\/\//i.test(candidate) || /[\x00\r\n\t]/.test(candidate)) return '';
  try {
    const parsed = new URL(candidate);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname ? candidate : '';
  } catch {
    return '';
  }
}

export function requestCsrfAccepted(request: FastifyRequest, options: ReaderActionsOptions): boolean {
  return options.validateCsrf(request);
}

export function localReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) return null;
  try {
    const target = new URL(value, 'https://blex.local');
    if (target.origin !== 'https://blex.local') return null;
    const decoded = decodeURIComponent(target.pathname);
    if (decoded.startsWith('//') || decoded.includes('\\')) return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function commentReturnTo(value: unknown, commentId: number): string | null {
  const destination = localReturnTo(value);
  if (!destination) return null;
  const target = new URL(destination, 'https://blex.local');
  target.hash = `comment-${commentId}`;
  return `${target.pathname}${target.search}${target.hash}`;
}
