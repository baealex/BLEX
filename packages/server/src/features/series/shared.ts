import { type PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { messageFailure as apiError } from '../../platform/response.js';

export interface CollectionUser {
  id: number;
  username: string;
  isStaff?: boolean;
  notifyCount?: number;
  hasConnectedTelegram?: boolean;
}

export interface SeriesListItem {
  id: number;
  url: string;
  name: string;
  order: number;
  totalPosts: number;
}

export interface SeriesPostOption {
  id: number;
  title: string;
  publishedDate: string | null;
}

export interface PinnedPostItem {
  id: number;
  order: number;
  post: {
    url: string;
    title: string;
    image: string | null;
    createdDate: string;
  };
}

export interface PinnablePostItem {
  url: string;
  title: string;
  image: string | null;
  createdDate: string;
}

export interface PinnablePagination {
  page: number;
  limit: number;
  lastPage: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface AuthorCollectionsOptions {
  currentUser: (request: FastifyRequest) => Promise<CollectionUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

export interface DatabaseUser extends CollectionUser {
  active: boolean;
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

export function unauthorizedLogin() {
  return apiError('NL');
}

export function localDate(value: string | Date | null): string {
  if (!value) return '';
  const raw = value instanceof Date ? value.toISOString() : value.replace(' ', 'T');
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
  const user = await db.user.findFirst({
    where: { id, username },
    select: { id: true, username: true, isActive: true, profile: { select: { role: true } } },
  });
  return user && { id: user.id, username: user.username, active: user.isActive, role: user.profile?.role ?? null };
}

export function isActiveEditor(user: DatabaseUser | null): user is DatabaseUser {
  return user !== null && user.active && user.role === 'EDITOR';
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
