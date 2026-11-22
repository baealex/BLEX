import type { Prisma, PrismaClient } from '@prisma/client';
import { type AdminNotice } from '../types.js';
import { safeNavigationUrl } from './static-pages.js';
import { ApiResult, Body, isoDate, stringValue } from '../shared.js';

const noticeSelect = {
  id: true,
  title: true,
  url: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SiteNoticeSelect;

type NoticeRow = Prisma.SiteNoticeGetPayload<{ select: typeof noticeSelect }>;

function serializeNotice(row: NoticeRow): AdminNotice {
  return {
    id: row.id,
    title: row.title,
    url: safeNavigationUrl(row.url),
    isActive: row.isActive,
    createdDate: isoDate(row.createdAt),
    updatedDate: isoDate(row.updatedAt),
  };
}

function noticesIn(scope: 'global' | 'user', ownerId: number | null): Prisma.SiteNoticeWhereInput {
  return scope === 'global' ? { scope } : { scope, userId: ownerId ?? 0 };
}

export async function readNotices(
  db: PrismaClient,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice[]> {
  const rows = await db.siteNotice.findMany({
    where: noticesIn(scope, ownerId),
    orderBy: { createdAt: 'desc' },
    select: noticeSelect,
  });
  return rows.map(serializeNotice);
}

export async function readNotice(
  db: PrismaClient,
  id: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice | null> {
  const row = await db.siteNotice.findFirst({ where: { ...noticesIn(scope, ownerId), id }, select: noticeSelect });
  return row ? serializeNotice(row) : null;
}

export function noticePayload(body: Body): Body {
  const result: Body = {};
  for (const field of ['title', 'url'] as const) if (field in body) result[field] = stringValue(body[field]);
  if ('isActive' in body) result.isActive = body.isActive === true;
  return result;
}

export async function saveNotice(
  db: PrismaClient,
  input: Body,
  id?: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<ApiResult<AdminNotice>> {
  if (id === undefined && !stringValue(input.title)) return { ok: false, code: 'VA', message: 'Enter a notice title.' };
  if (id === undefined && !stringValue(input.url)) return { ok: false, code: 'VA', message: 'Enter a URL.' };
  if (scope === 'user' && ownerId === null) return { ok: false, code: 'RJ', message: 'Author access is required.' };
  if (id === undefined) {
    const created = await db.siteNotice.create({
      data: {
        scope,
        userId: scope === 'user' ? ownerId : null,
        title: stringValue(input.title),
        url: stringValue(input.url),
        isActive: input.isActive !== false,
      },
      select: noticeSelect,
    });
    return { ok: true, body: serializeNotice(created) };
  }
  // Prisma skips an update with no fields and reports zero rows, so the timestamp is always set.
  const data: Prisma.SiteNoticeUpdateManyMutationInput = { updatedAt: new Date() };
  if ('title' in input) data.title = stringValue(input.title);
  if ('url' in input) data.url = stringValue(input.url);
  if ('isActive' in input) data.isActive = input.isActive === true;
  const { count } = await db.siteNotice.updateMany({ where: { ...noticesIn(scope, ownerId), id }, data });
  if (count === 0) return { ok: false, code: 'NF', message: 'Notice not found.' };
  const notice = await readNotice(db, id, scope, ownerId);
  return notice ? { ok: true, body: notice } : { ok: false, code: 'NF', message: 'Notice not found.' };
}
