import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { adminSettingsCapabilities, type UserAccess } from '../access.js';
import { renderAdminNotices, renderAuthorNotices, type AdminNotice, type AdminSettingsUser } from '../pages.js';
import { safeNavigationUrl } from './static-pages.js';
import { ApiResult, Body, booleanValue, csrfToken, djangoTimestamp, formBoolean, isoDate, pageNumber, stringValue } from '../shared.js';

interface NoticeRow {
  id: number;
  title: string;
  url: string;
  isActive: number | bigint | boolean;
  createdDate: string | null;
  updatedDate: string | null;
}

function serializeNotice(row: NoticeRow): AdminNotice {
  return {
    id: row.id,
    title: row.title,
    url: safeNavigationUrl(row.url),
    isActive: booleanValue(row.isActive),
    createdDate: isoDate(row.createdDate),
    updatedDate: isoDate(row.updatedDate),
  };
}

export async function readNotices(
  db: PrismaClient,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice[]> {
  const rows = await db.$queryRaw<NoticeRow[]>`
    SELECT id, title, url, is_active AS isActive,
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_sitenotice
     WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0})
     ORDER BY created_date DESC
  `;
  return rows.map(serializeNotice);
}

export async function readNotice(
  db: PrismaClient,
  id: number,
  scope: 'global' | 'user' = 'global',
  ownerId: number | null = null,
): Promise<AdminNotice | null> {
  const [row] = await db.$queryRaw<NoticeRow[]>`
    SELECT id, title, url, is_active AS isActive,
           CAST(created_date AS TEXT) AS createdDate, CAST(updated_date AS TEXT) AS updatedDate
      FROM board_sitenotice
     WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0})
       AND id = ${id} LIMIT 1
  `;
  return row ? serializeNotice(row) : null;
}

export function noticePayload(body: Body, form = false): Body {
  const result: Body = {};
  for (const field of ['title', 'url'] as const) if (field in body) result[field] = stringValue(body[field]);
  if ('is_active' in body || form) result.is_active = form ? formBoolean(body.is_active) : body.is_active === true;
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
  const timestamp = djangoTimestamp();
  if (id === undefined) {
    const createdId = await db.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        INSERT INTO board_sitenotice (scope, user_id, title, is_active, "order", created_date, updated_date, url)
        VALUES (${scope}, ${scope === 'user' ? ownerId : null}, ${stringValue(input.title)},
                ${input.is_active === false ? 0 : 1}, 0, ${timestamp}, ${timestamp}, ${stringValue(input.url)})
      `;
      const [created] = await transaction.$queryRaw<Array<{ id: number }>>`SELECT last_insert_rowid() AS id`;
      return Number(created?.id ?? 0);
    });
    const notice = await readNotice(db, createdId, scope, ownerId);
    return notice ? { ok: true, body: notice } : { ok: false, code: 'NF', message: 'Notice not found.' };
  }
  const updates: Prisma.Sql[] = [Prisma.sql`updated_date = ${timestamp}`];
  if ('title' in input) updates.push(Prisma.sql`title = ${stringValue(input.title)}`);
  if ('url' in input) updates.push(Prisma.sql`url = ${stringValue(input.url)}`);
  if ('is_active' in input) updates.push(Prisma.sql`is_active = ${input.is_active === true ? 1 : 0}`);
  const changed = await db.$executeRaw(Prisma.sql`
    UPDATE board_sitenotice SET ${Prisma.join(updates, ', ')}
    WHERE scope = ${scope} AND (${scope} = 'global' OR user_id = ${ownerId ?? 0}) AND id = ${id}
  `);
  if (changed === 0) return { ok: false, code: 'NF', message: 'Notice not found.' };
  const notice = await readNotice(db, id, scope, ownerId);
  return notice ? { ok: true, body: notice } : { ok: false, code: 'NF', message: 'Notice not found.' };
}

export function noticeApi(notice: AdminNotice): Record<string, unknown> {
  return {
    id: notice.id,
    title: notice.title,
    url: notice.url,
    is_active: notice.isActive,
    created_date: notice.createdDate,
    updated_date: notice.updatedDate,
  };
}

export async function pageNotices(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  access: UserAccess,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAdminNotices({
    user,
    capabilities: adminSettingsCapabilities(access),
    notices: await readNotices(db),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}

export async function pageAuthorNotices(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  user: AdminSettingsUser,
  error?: string,
) {
  return reply.type('text/html; charset=utf-8').send(renderAuthorNotices({
    user,
    notices: await readNotices(db, 'user', user.id),
    csrfToken: csrfToken(request),
    saved: !error && pageNumber(request).get('saved') === '1',
    error,
  }));
}
