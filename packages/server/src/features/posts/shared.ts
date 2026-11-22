import { createElement as h } from 'react';
import { type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { djangoIso } from '../../compat/django-format.js';
import { failure as failed } from '../../platform/response.js';

export interface AuthoringUser {
  id: number;
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

export interface AuthoringOptions {
  currentUser: (req: FastifyRequest) => Promise<AuthoringUser | null>;
  validateCsrf: (req: FastifyRequest) => boolean;
  siteUrl: URL;
  mediaRoot?: string;
}

export type DbBoolean = number | bigint | boolean | null;

export type DbDate = string | Date | null;

export interface UserRow extends AuthoringUser {
  isActive: DbBoolean;
  role: string | null;
}

export interface StoredPost {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  image: string;
  description: string;
  createdDate: Date;
  updatedDate: Date;
  publishedDate: Date | null;
  deletedDate: Date | null;
  authorId: number;
  authorUsername: string;
  authorAvatar: string | null;
  readTime: number;
  seriesId: number | null;
  seriesName: string | null;
  seriesUrl: string | null;
  seriesHidden: boolean;
  contentHtml: string;
  hide: boolean;
  advertise: boolean;
  blockComment: boolean;
  hasSettings: boolean;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
}

export interface TrashedPostRow {
  id: number;
  url: string;
  title: string;
  image: string;
  publishedDate: Date | null;
  updatedDate: Date;
  deletedDate: Date;
  hide: boolean;
}

export interface AuthoringPostInput {
  title: string;
  subtitle: string;
  text: string;
  contentType: string;
  description: string;
  url: string;
  tags: string;
  series: string;
  hide: boolean;
  advertise: boolean;
  blockComment: boolean;
  coverLayout: string;
  coverImagePosition: string;
  coverImageRatio: string;
  coverImage?: string;
  removeCoverImage: boolean;
  reservedDate: string;
}

export const h1 = h;

export const POST_TITLE_MAX = 65;

export const POST_SUBTITLE_MAX = 120;

export const POST_DESCRIPTION_MAX = 250;

export const POST_URL_MAX = 65;

export const TAG_MAX = 50;

export const RESERVED_URLS = new Set(['about', 'posts', 'series']);

export const COVER_LAYOUTS = new Set(['default', 'split', 'overlay', 'none']);

export const COVER_POSITIONS = new Set(['left', 'right']);

export const COVER_RATIOS = new Set(['auto', '16:9', '4:3', '1:1', '3:4']);

export function numberValue(value: number | bigint | boolean | null | undefined): number {
  return Number(value ?? 0);
}

export function field(value: unknown): string {
  if (Array.isArray(value)) return field(value.at(-1));
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : String(value);
}

export function inputField(body: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = field(body[key]);
    if (value) return value;
  }
  return '';
}

function optionalField(body: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(body, key)) return undefined;
  return field(body[key]);
}

export function booleanField(value: unknown): boolean {
  if (Array.isArray(value)) return booleanField(value.at(-1));
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(field(value).toLowerCase());
}

export function bodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

export function queryObject(request: FastifyRequest): Record<string, unknown> {
  return request.query && typeof request.query === 'object'
    ? request.query as Record<string, unknown>
    : {};
}

export function dateAsIso(value: DbDate): string | null {
  return djangoIso(value);
}

export function localDateTime(value: DbDate): string {
  const iso = dateAsIso(value);
  if (!iso) return '';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date).replace(' ', 'T');
}

export function cookieValue(request: FastifyRequest, name: string): string {
  const cookie = request.headers.cookie;
  if (!cookie) return '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return '';
}

export function notFound(reply: FastifyReply): null {
  reply.code(404).type('text/plain; charset=utf-8').send('Not found');
  return null;
}

export function forbidden(reply: FastifyReply): null {
  reply.code(403).type('text/plain; charset=utf-8').send('Forbidden');
  return null;
}

function editorRedirect(reply: FastifyReply, loggedIn: boolean): null {
  reply.redirect(loggedIn ? '/' : '/login', 302);
  return null;
}

export async function currentAccount(
  request: FastifyRequest,
  db: PrismaClient,
  options: AuthoringOptions,
): Promise<UserRow | null> {
  const user = await options.currentUser(request);
  if (!user || !Number.isSafeInteger(user.id) || user.id < 1) return null;
  const rows = await db.$queryRaw<UserRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           CAST(author.is_active AS INTEGER) AS isActive,
           profile.role AS role
    FROM auth_user AS author
    LEFT JOIN board_profile AS profile ON profile.user_id = author.id
    WHERE author.id = ${user.id} AND author.username = ${user.username}
    LIMIT 1
  `;
  const account = rows[0];
  return account && numberValue(account.isActive) === 1
    ? { ...account, isStaff: user.isStaff, notifyCount: user.notifyCount, hasConnectedTelegram: user.hasConnectedTelegram }
    : null;
}

export async function editorAccount(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: AuthoringOptions,
  api: boolean,
  hideAnonymous = false,
): Promise<UserRow | null> {
  const account = await currentAccount(request, db, options);
  if (!account) {
    if (api && !hideAnonymous) reply.send(failed('NL', 'Login required.'));
    else if (api && hideAnonymous) notFound(reply);
    else editorRedirect(reply, false);
    return null;
  }
  if (account.role !== 'EDITOR') {
    if (api) reply.send(failed('RJ', 'Author access is required.'));
    else editorRedirect(reply, true);
    return null;
  }
  return account;
}
