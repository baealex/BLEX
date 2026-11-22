import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { sanitizePostHtml } from '../post-html.js';
import {
  renderPinnedPostsPage,
  renderSeriesEditorPage,
  renderSeriesListPage,
  type CollectionUser,
  type PinnablePagination,
  type PinnablePostItem,
  type PinnedPostItem,
  type SeriesListItem,
  type SeriesPostOption,
} from './pages.js';

export interface AuthorCollectionsOptions {
  currentUser: (request: FastifyRequest) => Promise<CollectionUser | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
}

interface DatabaseUser extends CollectionUser {
  active: number | bigint | boolean;
  role: string | null;
}

interface StoredSeries extends SeriesListItem {
  description: string;
  createdDate: string | null;
}

interface StoredPinnedPost extends PinnedPostItem {
  publishedDate: string | null;
}

interface PinnedServiceError {
  code: 'RJ' | 'IP';
  key: string;
  params?: Record<string, string | number>;
}

const MAX_PINNED_POSTS = 6;
const DEFAULT_PINNABLE_LIMIT = 30;
const MAX_PINNABLE_LIMIT = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_SERIES_DESCRIPTION = 500;
const SERIES_PUBLIC_FILTER = `post.deleted_date IS NULL
  AND post.published_date IS NOT NULL
  AND datetime(post.published_date) <= CURRENT_TIMESTAMP
  AND COALESCE(post_config.hide, 0) = 0`;

function bodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.isBuffer(value)) return {};
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string {
  if (Array.isArray(value)) return stringValue(value.at(-1));
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function positiveInt(value: unknown): number | null {
  const raw = stringValue(value);
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function arrayValues(value: unknown): unknown[] {
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

function requestCsrfToken(request: FastifyRequest): string {
  const value = cookieValue(request, 'csrftoken');
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

function apiDone(body: unknown = {}) {
  return { status: 'DONE', body };
}

function apiError(code: string, message = '', messageKey?: string, messageParams: Record<string, unknown> = {}) {
  return {
    status: 'ERROR', errorCode: `error:${code}`, errorMessage: message,
    ...(messageKey ? { messageKey, messageParams } : {}),
  };
}

function pinnedError(error: PinnedServiceError) {
  const labels: Record<string, string> = {
    'pinned_posts.already_pinned': '이미 프로필에 고정된 글입니다.',
    'pinned_posts.editor_required': '작성자 권한이 필요합니다.',
    'pinned_posts.invalid_page': '페이지 번호가 올바르지 않습니다.',
    'pinned_posts.limit_reached': `프로필에는 글을 최대 ${MAX_PINNED_POSTS}개까지 고정할 수 있습니다.`,
    'pinned_posts.post_not_found': '고정할 글을 찾을 수 없습니다.',
    'pinned_posts.hidden_post': '숨긴 글은 프로필에 고정할 수 없습니다.',
    'pinned_posts.published_only': '발행된 글만 고정할 수 있습니다.',
    'pinned_posts.pinned_post_not_found': '고정된 글을 찾을 수 없습니다.',
    'pinned_posts.reorder_contains_unpinned': '고정되지 않은 글이 순서 목록에 있습니다.',
    'pinned_posts.post_url_required': '글 URL을 입력해 주세요.',
    'pinned_posts.invalid_format': '요청 형식이 올바르지 않습니다.',
  };
  const suffix = error.key === 'pinned_posts.reorder_contains_unpinned' ? ` (${error.params?.url ?? ''})` : '';
  return apiError(error.code, `${labels[error.key] ?? '고정 글을 변경하지 못했습니다.'}${suffix}`, error.key, error.params ?? {});
}

function unauthorizedLogin() {
  return apiError('NL');
}

function loginRedirect(request: FastifyRequest, reply: FastifyReply) {
  const path = request.url.split('?')[0] || '/settings/series';
  return reply.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
}

function html(reply: FastifyReply, value: string) {
  return reply.type('text/html; charset=utf-8').header('Cache-Control', 'private, no-store').send(value);
}

function localDate(value: string | null): string {
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

async function readDatabaseUser(db: PrismaClient, id: number, username: string): Promise<DatabaseUser | null> {
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

function isActiveEditor(user: DatabaseUser | null): user is DatabaseUser {
  return Boolean(user && user.active && user.role === 'EDITOR');
}

async function requireActiveEditor(db: PrismaClient, request: FastifyRequest, options: AuthorCollectionsOptions) {
  const sessionUser = await options.currentUser(request);
  if (!sessionUser || !Number.isSafeInteger(sessionUser.id) || sessionUser.id <= 0 || !sessionUser.username) return null;
  const user = await readDatabaseUser(db, sessionUser.id, sessionUser.username);
  return user && { ...user, isStaff: sessionUser.isStaff, notifyCount: sessionUser.notifyCount, hasConnectedTelegram: sessionUser.hasConnectedTelegram };
}

function queryValue(request: FastifyRequest, key: string): string | undefined {
  const value = (request.query as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : Array.isArray(value) ? stringValue(value.at(-1)) : undefined;
}

function normalizeSlug(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim().replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function validSlug(value: string): boolean {
  return value.length <= 50 && /^[\p{L}\p{N}_-]+$/u.test(value);
}

function parsePostIds(value: unknown): number[] | null {
  if (value === undefined || value === null) return [];
  const values = typeof value === 'string' ? value.split(',').filter(Boolean) : arrayValues(value);
  const parsed: number[] = [];
  for (const item of values) {
    const raw = stringValue(item);
    if (!/^\d+$/.test(raw)) return null;
    const id = Number(raw);
    if (!Number.isSafeInteger(id)) return null;
    if (id > 0 && !parsed.includes(id)) parsed.push(id);
  }
  return parsed;
}

async function readSeriesRows(db: PrismaClient, ownerId: number, countKind: 'public' | 'active') {
  const countFilter = countKind === 'public'
    ? `post.id IS NOT NULL AND ${SERIES_PUBLIC_FILTER}`
    : 'post.id IS NOT NULL AND post.deleted_date IS NULL';
  return db.$queryRawUnsafe<Array<{
    id: number; url: string; name: string; order: number | bigint; totalPosts: number | bigint;
    description: string; createdDate: string | null;
  }>>(`
    SELECT series.id AS id, series.url AS url, series.name AS name,
           series."order" AS "order", series.text_md AS description,
           CAST(series.created_date AS TEXT) AS createdDate,
           COUNT(CASE WHEN ${countFilter} THEN post.id END) AS totalPosts
      FROM board_series AS series
      LEFT JOIN board_post AS post ON post.series_id = series.id
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE series.owner_id = ?
     GROUP BY series.id
     ORDER BY series."order" ASC, series.id DESC
  `, ownerId);
}

function seriesListItem(row: Awaited<ReturnType<typeof readSeriesRows>>[number]): SeriesListItem {
  return {
    id: Number(row.id), url: row.url, name: row.name, order: Number(row.order), totalPosts: Number(row.totalPosts),
  };
}

async function readSeriesById(db: PrismaClient, ownerId: number, id: number): Promise<StoredSeries | null> {
  const rows = await db.$queryRaw<Array<{
    id: number; url: string; name: string; order: number | bigint; description: string;
    createdDate: string | null; totalPosts: number | bigint;
  }>>`
    SELECT series.id AS id, series.url AS url, series.name AS name, series."order" AS "order",
           series.text_md AS description, CAST(series.created_date AS TEXT) AS createdDate,
           COUNT(CASE WHEN post.deleted_date IS NULL THEN post.id END) AS totalPosts
      FROM board_series AS series
      LEFT JOIN board_post AS post ON post.series_id = series.id
     WHERE series.id = ${id} AND series.owner_id = ${ownerId}
     GROUP BY series.id
     LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id), url: row.url, name: row.name, order: Number(row.order),
    totalPosts: Number(row.totalPosts), description: row.description ?? '', createdDate: row.createdDate,
  };
}

async function readSeriesPostIds(db: PrismaClient, ownerId: number, seriesId: number): Promise<number[]> {
  const rows = await db.$queryRaw<Array<{ id: number | bigint }>>`
    SELECT id FROM board_post WHERE author_id = ${ownerId} AND series_id = ${seriesId}
      ORDER BY id ASC
  `;
  return rows.map((row) => Number(row.id));
}

async function readAvailableSeriesPosts(db: PrismaClient, ownerId: number, seriesId?: number): Promise<SeriesPostOption[]> {
  const filter = seriesId === undefined
    ? `post.series_id IS NULL AND ${SERIES_PUBLIC_FILTER}`
    : `(post.series_id = ? OR (post.series_id IS NULL AND ${SERIES_PUBLIC_FILTER}))`;
  const activeFilter = seriesId === undefined ? 'AND post.deleted_date IS NULL' : '';
  const params = seriesId === undefined ? [ownerId] : [ownerId, seriesId];
  const rows = await db.$queryRawUnsafe<Array<{ id: number; title: string; publishedDate: string | null }>>(`
    SELECT post.id AS id, post.title AS title, CAST(post.published_date AS TEXT) AS publishedDate
      FROM board_post AS post
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE post.author_id = ? ${activeFilter} AND ${filter}
     ORDER BY post.published_date DESC, post.id DESC
  `, ...params);
  return rows.map((row) => ({ id: Number(row.id), title: row.title, publishedDate: localDate(row.publishedDate) || null }));
}

async function createUniqueSeriesUrl(db: Prisma.TransactionClient, base: string): Promise<string> {
  let candidate = base || 'series';
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const [collision] = await db.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_series WHERE url = ${candidate} LIMIT 1
    `;
    if (!collision) return candidate;
    const suffix = randomBytes(4).toString('hex');
    candidate = `${base.slice(0, 41)}-${suffix}`;
  }
  throw { code: 'AE', message: 'This URL already exists.' };
}

async function saveSeries(
  db: PrismaClient,
  ownerId: number,
  input: { name?: string; url?: string; description?: string; postIds?: number[] },
  seriesId?: number,
): Promise<{ id: number; url: string; name: string; description: string; postCount: number }> {
  const name = input.name?.trim() ?? '';
  const description = input.description?.trim();
  if (input.name !== undefined && (!name || name.length > 50)) throw { code: 'RE', message: 'Enter a series name.' };
  if (description !== undefined && description.length > MAX_SERIES_DESCRIPTION) throw { code: 'VA', message: 'Series description must be 500 characters or fewer.' };
  let requestedUrl = input.url;
  const customUrl = requestedUrl !== undefined && Boolean(requestedUrl.trim());
  if (seriesId === undefined) {
    if (!customUrl) requestedUrl = normalizeSlug(name);
    else requestedUrl = (requestedUrl ?? '').trim();
    if (!requestedUrl || !validSlug(requestedUrl)) throw { code: 'VA', message: 'Enter a valid series URL.' };
  } else if (requestedUrl !== undefined) {
    requestedUrl = requestedUrl.trim();
    if (!requestedUrl || !validSlug(requestedUrl)) throw { code: 'VA', message: 'Enter a valid series URL.' };
  }

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    let id = seriesId;
    let url: string;
    let finalName = name;
    let finalDescription = (description ?? '').trim();
    if (id === undefined) {
      url = await createUniqueSeriesUrl(tx, requestedUrl!);
      const safeDescription = sanitizePostHtml(finalDescription);
      const inserted = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO board_series
          ("order", text_md, text_html, hide, url, layout, created_date, updated_date, owner_id, name)
        VALUES (0, ${finalDescription}, ${safeDescription}, 0, ${url}, 'list', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${ownerId}, ${finalName})
        RETURNING id
      `;
      id = Number(inserted[0]?.id);
      if (!id) throw new Error('series-create-failed');
    } else {
      const existingRows = await tx.$queryRaw<Array<{ id: number; url: string; name: string; description: string }>>`
        SELECT id, url, name, text_md AS description FROM board_series WHERE id = ${id} AND owner_id = ${ownerId} LIMIT 1
      `;
      const existing = existingRows[0];
      if (!existing) throw { code: 'NF', message: 'Series not found.' };
      url = requestedUrl ?? existing.url;
      if (requestedUrl !== undefined) {
        const [conflict] = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM board_series WHERE url = ${url} AND id <> ${id} LIMIT 1
        `;
        if (conflict) throw { code: 'AE', message: 'This URL already exists.' };
      }
      finalName = input.name === undefined ? existing.name : name;
      finalDescription = description === undefined ? existing.description : description.trim();
      const safeDescription = sanitizePostHtml(finalDescription);
      await tx.$executeRaw`
        UPDATE board_series SET name = ${finalName}, url = ${url}, text_md = ${finalDescription},
          text_html = ${safeDescription}, updated_date = CURRENT_TIMESTAMP
        WHERE id = ${id} AND owner_id = ${ownerId}
      `;
    }

    if (input.postIds !== undefined) {
      await tx.$executeRaw`UPDATE board_post SET series_id = NULL WHERE series_id = ${id}`;
      for (const postId of input.postIds) {
        await tx.$executeRaw`
          UPDATE board_post SET series_id = ${id}
           WHERE id = ${postId} AND author_id = ${ownerId}
        `;
      }
    }

    const [saved] = await tx.$queryRaw<Array<{ id: number; url: string; name: string; description: string; postCount: number | bigint }>>`
      SELECT series.id AS id, series.url AS url, series.name AS name, series.text_md AS description,
             COUNT(CASE WHEN post.deleted_date IS NULL THEN post.id END) AS postCount
        FROM board_series AS series LEFT JOIN board_post AS post ON post.series_id = series.id
       WHERE series.id = ${id} AND series.owner_id = ${ownerId}
       GROUP BY series.id LIMIT 1
    `;
    return { id: Number(saved.id), url: saved.url, name: saved.name, description: saved.description ?? '', postCount: Number(saved.postCount) };
  });
}

async function deleteSeries(db: PrismaClient, ownerId: number, seriesId: number): Promise<boolean> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const [row] = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_series WHERE id = ${seriesId} AND owner_id = ${ownerId} LIMIT 1
    `;
    if (!row) return false;
    await tx.$executeRaw`UPDATE board_post SET series_id = NULL WHERE series_id = ${seriesId}`;
    await tx.$executeRaw`DELETE FROM board_seriesconfigmeta WHERE post_id = ${seriesId}`;
    await tx.$executeRaw`DELETE FROM board_series WHERE id = ${seriesId} AND owner_id = ${ownerId}`;
    return true;
  });
}

async function updateSeriesOrder(db: PrismaClient, ownerId: number, entries: Array<[number, number]>): Promise<void> {
  if (!entries.length) throw { code: 'IP', message: 'Order information is required.' };
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [id, order] of entries) {
      if (!Number.isSafeInteger(id) || !Number.isSafeInteger(order)) continue;
      await tx.$executeRaw`UPDATE board_series SET "order" = ${order}, updated_date = CURRENT_TIMESTAMP WHERE id = ${id} AND owner_id = ${ownerId}`;
    }
  });
}

async function readPinnedPosts(db: PrismaClient, userId: number): Promise<StoredPinnedPost[]> {
  const rows = await db.$queryRaw<Array<{
    id: number; order: number | bigint; url: string; title: string; image: string; publishedDate: string | null;
  }>>`
    SELECT pinned.id AS id, pinned."order" AS "order", post.url AS url, post.title AS title,
           post.image AS image, CAST(post.published_date AS TEXT) AS publishedDate
      FROM board_pinnedpost AS pinned
      JOIN board_post AS post ON post.id = pinned.post_id
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE pinned.user_id = ${userId} AND ${Prisma.raw(SERIES_PUBLIC_FILTER)}
     ORDER BY pinned."order" ASC, pinned.id ASC
  `;
  return rows.map((row) => ({
    id: Number(row.id), order: Number(row.order), publishedDate: row.publishedDate,
    post: { url: row.url, title: row.title, image: row.image || null, createdDate: localDate(row.publishedDate) },
  }));
}

async function reservedPinnedCount(db: PrismaClient, userId: number): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS count FROM board_pinnedpost AS pinned
      JOIN board_post AS post ON post.id = pinned.post_id
     WHERE pinned.user_id = ${userId} AND post.deleted_date IS NOT NULL
  `;
  return Number(row?.count ?? 0);
}

function normalizedPagination(query: string | undefined, limitRaw: string | undefined, pageRaw: string | undefined): {
  query: string; limit: number | null; page: number; hasPagination: boolean;
} | PinnedServiceError {
  const search = (query ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
  const hasPagination = limitRaw !== undefined || pageRaw !== undefined;
  let page = 1;
  if (pageRaw !== undefined) {
    if (!/^\d+$/.test(pageRaw) || Number(pageRaw) < 1 || !Number.isSafeInteger(Number(pageRaw))) {
      return { code: 'IP', key: 'pinned_posts.invalid_page' };
    }
    page = Number(pageRaw);
  }
  if (!hasPagination) return { query: search, limit: null, page, hasPagination };
  let limit = limitRaw === undefined || !/^[-+]?\d+$/.test(limitRaw) ? DEFAULT_PINNABLE_LIMIT : Number(limitRaw);
  if (!Number.isSafeInteger(limit)) limit = DEFAULT_PINNABLE_LIMIT;
  limit = Math.max(1, Math.min(limit, MAX_PINNABLE_LIMIT));
  return { query: search, limit, page, hasPagination };
}

async function readPinnablePosts(
  db: PrismaClient,
  userId: number,
  query: string | undefined,
  limitRaw: string | undefined,
  pageRaw: string | undefined,
): Promise<{ posts: PinnablePostItem[]; pagination: PinnablePagination } | PinnedServiceError> {
  const pagination = normalizedPagination(query, limitRaw, pageRaw);
  if ('code' in pagination) return pagination;
  const search = pagination.query;
  const params: Array<string | number> = [userId, userId];
  let searchFilter = '';
  if (search) {
    searchFilter = ' AND instr(lower(post.title), lower(?)) > 0';
    params.push(search);
  }
  const where = `post.author_id = ? AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
    AND post.published_date <= CURRENT_TIMESTAMP AND COALESCE(post_config.hide, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM board_pinnedpost AS pin WHERE pin.user_id = ? AND pin.post_id = post.id)${searchFilter}`;
  const [countRow] = await db.$queryRawUnsafe<Array<{ count: number | bigint }>>(`
    SELECT COUNT(*) AS count FROM board_post AS post
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE ${where}
  `, ...params);
  const totalCount = Number(countRow?.count ?? 0);
  const responseLimit = pagination.limit ?? totalCount;
  const queryLimit = Math.max(1, responseLimit);
  const lastPage = Math.max(1, Math.ceil(totalCount / queryLimit));
  const page = Math.min(pagination.page, lastPage);
  const offset = (page - 1) * queryLimit;
  const rows = await db.$queryRawUnsafe<Array<{
    url: string; title: string; image: string; publishedDate: string | null;
  }>>(`
    SELECT post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate
      FROM board_post AS post
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
     WHERE ${where}
     ORDER BY post.published_date DESC, post.id DESC
     LIMIT ? OFFSET ?
  `, ...params, queryLimit, offset);
  return {
    posts: rows.map((row) => ({ url: row.url, title: row.title, image: row.image || null, createdDate: localDate(row.publishedDate) })),
    pagination: {
      page, limit: responseLimit, lastPage, totalCount,
      hasNext: page < lastPage, hasPrevious: page > 1,
    },
  };
}

async function addPinnedPost(db: PrismaClient, userId: number, postUrl: string): Promise<PinnedServiceError | null> {
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    const [countRow] = await tx.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*) AS count FROM board_pinnedpost WHERE user_id = ${userId}
    `;
    if (Number(countRow?.count ?? 0) >= MAX_PINNED_POSTS) return { code: 'RJ', key: 'pinned_posts.limit_reached', params: { count: MAX_PINNED_POSTS } };
    const [post] = await tx.$queryRaw<Array<{ id: number; hidden: number | bigint | boolean; publishedDate: string | null; deletedDate: string | null }>>`
      SELECT post.id AS id, CAST(COALESCE(post_config.hide, 0) AS INTEGER) AS hidden,
             CAST(post.published_date AS TEXT) AS publishedDate, CAST(post.deleted_date AS TEXT) AS deletedDate
        FROM board_post AS post LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
       WHERE post.author_id = ${userId} AND post.url = ${postUrl} LIMIT 1
    `;
    if (!post) return { code: 'RJ', key: 'pinned_posts.post_not_found' };
    if (Boolean(post.hidden)) return { code: 'RJ', key: 'pinned_posts.hidden_post' };
    const [publishedState] = await tx.$queryRaw<Array<{ published: number | bigint | boolean }>>`
      SELECT CASE WHEN ${post.publishedDate} IS NOT NULL AND ${post.deletedDate} IS NULL
          AND datetime(${post.publishedDate}) <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS published
    `;
    if (!publishedState?.published) {
      return { code: 'RJ', key: 'pinned_posts.published_only' };
    }
    const [existing] = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM board_pinnedpost WHERE user_id = ${userId} AND post_id = ${post.id} LIMIT 1
    `;
    if (existing) return { code: 'RJ', key: 'pinned_posts.already_pinned' };
    const [maxRow] = await tx.$queryRaw<Array<{ maxOrder: number | bigint | null }>>`
      SELECT MAX("order") AS maxOrder FROM board_pinnedpost WHERE user_id = ${userId}
    `;
    const order = maxRow?.maxOrder === null || maxRow?.maxOrder === undefined ? 0 : Number(maxRow.maxOrder) + 1;
    await tx.$executeRaw`
      INSERT INTO board_pinnedpost ("order", created_date, post_id, user_id)
      VALUES (${order}, CURRENT_TIMESTAMP, ${post.id}, ${userId})
    `;
    return null;
  });
}

async function removePinnedPost(db: PrismaClient, userId: number, postUrl: string): Promise<PinnedServiceError | null> {
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    const [pinned] = await tx.$queryRaw<Array<{ id: number; order: number | bigint }>>`
      SELECT pinned.id AS id, pinned."order" AS "order"
        FROM board_pinnedpost AS pinned JOIN board_post AS post ON post.id = pinned.post_id
       WHERE pinned.user_id = ${userId} AND post.url = ${postUrl} LIMIT 1
    `;
    if (!pinned) return { code: 'RJ', key: 'pinned_posts.pinned_post_not_found' };
    await tx.$executeRaw`DELETE FROM board_pinnedpost WHERE id = ${pinned.id}`;
    await tx.$executeRaw`
      UPDATE board_pinnedpost SET "order" = "order" - 1
       WHERE user_id = ${userId} AND "order" > ${Number(pinned.order)}
    `;
    return null;
  });
}

async function reorderPinnedPosts(db: PrismaClient, userId: number, postUrls: string[]): Promise<PinnedServiceError | null> {
  if (postUrls.length > MAX_PINNED_POSTS) return { code: 'RJ', key: 'pinned_posts.limit_reached', params: { count: MAX_PINNED_POSTS } };
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    const rows = await tx.$queryRaw<Array<{ id: number; url: string; order: number | bigint }>>`
      SELECT pinned.id AS id, post.url AS url, pinned."order" AS "order"
        FROM board_pinnedpost AS pinned JOIN board_post AS post ON post.id = pinned.post_id
       WHERE pinned.user_id = ${userId} ORDER BY pinned."order" ASC, pinned.id ASC
    `;
    const byUrl = new Map(rows.map((row) => [row.url, row]));
    for (const url of postUrls) {
      if (!byUrl.has(url)) return { code: 'RJ', key: 'pinned_posts.reorder_contains_unpinned', params: { url } };
    }
    const requested = new Set(postUrls);
    const ordered = [...postUrls.map((url) => byUrl.get(url)!), ...rows.filter((row) => !requested.has(row.url))];
    for (let index = 0; index < ordered.length; index += 1) {
      const row = ordered[index]!;
      if (Number(row.order) !== index) await tx.$executeRaw`UPDATE board_pinnedpost SET "order" = ${index} WHERE id = ${row.id} AND user_id = ${userId}`;
    }
    return null;
  });
}

function parsePinnedUrls(value: unknown): string[] | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : null;
    } catch {
      return null;
    }
  }
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value as string[] : null;
}

function pinnedPostUrl(request: FastifyRequest) {
  const body = bodyRecord(request.body);
  const raw = stringValue(body.post_url);
  return raw.trim() ? raw.trim() : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function seriesFormError(error: unknown, fallback: string): string {
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

function htmlNotFound(reply: FastifyReply, message = '페이지를 찾을 수 없습니다.') {
  return reply.code(404).type('text/plain; charset=utf-8').send(message);
}

function htmlForbidden(reply: FastifyReply) {
  return reply.code(403).type('text/plain; charset=utf-8').send('요청 권한을 확인할 수 없습니다.');
}

export function registerAuthorCollections(app: FastifyInstance, db: PrismaClient, options: AuthorCollectionsOptions): void {
  app.register(async (routes) => {
    await routes.register(formBody);
    routes.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store');
    });

    const pageEditor = async (request: FastifyRequest, reply: FastifyReply): Promise<DatabaseUser | null> => {
      const user = await requireActiveEditor(db, request, options);
      if (!user) {
        loginRedirect(request, reply);
        return null;
      }
      if (!isActiveEditor(user)) {
        htmlNotFound(reply);
        return null;
      }
      return user;
    };

    const apiEditor = async (request: FastifyRequest) => {
      const user = await requireActiveEditor(db, request, options);
      if (!user || !user.active) return { user: null, error: unauthorizedLogin() };
      if (!isActiveEditor(user)) return { user: null, error: apiError('RJ', 'Author access is required.') };
      return { user, error: null };
    };

    const pinnedOwnerEditor = async (request: FastifyRequest, ownerId: number) => {
      const sessionUser = await options.currentUser(request);
      if (!sessionUser || !Number.isSafeInteger(sessionUser.id) || sessionUser.id <= 0 || !sessionUser.username) {
        return { user: null, error: unauthorizedLogin() };
      }
      const user = await readDatabaseUser(db, sessionUser.id, sessionUser.username);
      if (!user || !user.active) return { user: null, error: unauthorizedLogin() };
      if (user.id !== ownerId) return { user: null, error: apiError('AT', 'Permission denied.') };
      if (!isActiveEditor(user)) return { user: null, error: apiError('RJ', 'Author access is required.') };
      return { user, error: null };
    };

    const sendSeriesList = async (request: FastifyRequest, reply: FastifyReply, status?: { saved?: boolean; error?: string }) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      const rows = await readSeriesRows(db, user.id, 'active');
      return html(reply, renderSeriesListPage({
        user, csrfToken: requestCsrfToken(request), series: rows.map((row) => ({
          ...seriesListItem(row), order: Number(row.order),
        })),
        saved: status?.saved ?? queryValue(request, 'saved') === '1',
        error: status?.error,
      }));
    };

    const sendSeriesEditor = async (request: FastifyRequest, reply: FastifyReply, id?: number, error?: string) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      const series = id ? await readSeriesById(db, user.id, id) : null;
      if (id && !series) return htmlNotFound(reply, '시리즈를 찾을 수 없습니다.');
      const [availablePosts, selectedPostIds] = await Promise.all([
        readAvailableSeriesPosts(db, user.id, id),
        id ? readSeriesPostIds(db, user.id, id) : Promise.resolve([]),
      ]);
      return html(reply, renderSeriesEditorPage({
        user, csrfToken: requestCsrfToken(request), series, description: series?.description ?? '',
        selectedPostIds, availablePosts, error,
      }));
    };

    const sendPinnedPage = async (request: FastifyRequest, reply: FastifyReply, error?: string) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      const search = (queryValue(request, 'q') ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
      const page = queryValue(request, 'page');
      const [pinnedPosts, reservedCount, pinnable] = await Promise.all([
        readPinnedPosts(db, user.id),
        reservedPinnedCount(db, user.id),
        readPinnablePosts(db, user.id, search, String(DEFAULT_PINNABLE_LIMIT), page),
      ]);
      if ('code' in pinnable) {
        reply.code(400);
        return html(reply, renderPinnedPostsPage({
          user, csrfToken: requestCsrfToken(request), pinnedPosts, maxCount: MAX_PINNED_POSTS,
          reservedCount, pinnablePosts: [], pagination: {
            page: 1, limit: DEFAULT_PINNABLE_LIMIT, lastPage: 1, totalCount: 0,
            hasNext: false, hasPrevious: false,
          }, query: search, saved: queryValue(request, 'saved') === '1',
          error: pinnedError(pinnable).errorMessage,
        }));
      }
      return html(reply, renderPinnedPostsPage({
        user, csrfToken: requestCsrfToken(request), pinnedPosts, maxCount: MAX_PINNED_POSTS,
        reservedCount, pinnablePosts: pinnable.posts, pagination: pinnable.pagination, query: search,
        saved: queryValue(request, 'saved') === '1', error,
      }));
    };

    routes.get('/settings/series', (request, reply) => sendSeriesList(request, reply));
    routes.get('/series/create', (request, reply) => sendSeriesEditor(request, reply));
    routes.get<{ Params: { id: string } }>('/series/edit/:id', (request, reply) => {
      const id = positiveInt(request.params.id);
      return id ? sendSeriesEditor(request, reply, id) : htmlNotFound(reply, '시리즈를 찾을 수 없습니다.');
    });
    routes.get('/settings/pinned-posts', (request, reply) => sendPinnedPage(request, reply));

    routes.post('/settings/series', async (request, reply) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return htmlForbidden(reply);
      const body = bodyRecord(request.body);
      if (stringValue(body.intent) === 'delete') {
        const id = positiveInt(body.series_id);
        if (!id || !(await deleteSeries(db, user.id, id))) return htmlNotFound(reply, '시리즈를 찾을 수 없습니다.');
        return reply.redirect('/settings/series?saved=1', 303);
      }
      if (stringValue(body.intent) === 'order') {
        const entries: Array<[number, number]> = [];
        for (const [key, value] of Object.entries(body)) {
          const match = key.match(/^order_(\d+)$/);
          if (!match) continue;
          const id = Number(match[1]);
          const orderValue = stringValue(value);
          if (Number.isSafeInteger(id) && /^-?\d+$/.test(orderValue) && Number.isSafeInteger(Number(orderValue))) {
            entries.push([id, Number(orderValue)]);
          }
        }
        try {
          await updateSeriesOrder(db, user.id, entries);
        } catch (error) {
          reply.code(400);
          return sendSeriesList(request, reply, { error: seriesFormError(error, '시리즈 순서를 저장하지 못했습니다.') });
        }
        return reply.redirect('/settings/series?saved=1', 303);
      }
      return reply.code(400).type('text/plain; charset=utf-8').send('요청 정보가 올바르지 않습니다.');
    });

    const saveSeriesFromForm = async (request: FastifyRequest, reply: FastifyReply, id?: number) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return htmlForbidden(reply);
      const body = bodyRecord(request.body);
      if (stringValue(body.intent) === 'delete' && id) {
        if (!(await deleteSeries(db, user.id, id))) return htmlNotFound(reply, '시리즈를 찾을 수 없습니다.');
        return reply.redirect('/settings/series?saved=1', 303);
      }
      const postIds = parsePostIds(body.post_ids);
      if (!postIds) {
        reply.code(400);
        return sendSeriesEditor(request, reply, id, '시리즈에 포함할 포스트를 확인해 주세요.');
      }
      try {
        const saved = await saveSeries(db, user.id, {
          name: stringValue(body.name),
          url: id ? undefined : stringValue(body.url),
          description: stringValue(body.description),
          postIds,
        }, id);
        return reply.redirect('/settings/series?saved=1', 303);
      } catch (error) {
        reply.code(400);
        return sendSeriesEditor(request, reply, id, seriesFormError(error, '시리즈를 저장하지 못했습니다.'));
      }
    };
    routes.post('/series/create', (request, reply) => saveSeriesFromForm(request, reply));
    routes.post<{ Params: { id: string } }>('/series/edit/:id', (request, reply) => {
      const id = positiveInt(request.params.id);
      return id ? saveSeriesFromForm(request, reply, id) : htmlNotFound(reply, '시리즈를 찾을 수 없습니다.');
    });

    routes.post('/settings/pinned-posts', async (request, reply) => {
      const user = await pageEditor(request, reply);
      if (!user) return reply;
      if (!options.validateCsrf(request)) return htmlForbidden(reply);
      const body = bodyRecord(request.body);
      let failure: PinnedServiceError | null = null;
      const intent = stringValue(body.intent);
      if (intent === 'add') {
        const url = stringValue(body.post_url).trim();
        failure = url ? await addPinnedPost(db, user.id, url) : { code: 'IP', key: 'pinned_posts.post_url_required' };
      } else if (intent === 'remove') {
        const url = stringValue(body.post_url).trim();
        failure = url ? await removePinnedPost(db, user.id, url) : { code: 'IP', key: 'pinned_posts.post_url_required' };
      } else if (intent === 'order') {
        const urls = stringValue(body.post_urls).split(/[\r\n,]/).map((url) => url.trim()).filter(Boolean);
        failure = await reorderPinnedPosts(db, user.id, urls);
      } else return reply.code(400).type('text/plain; charset=utf-8').send('요청 정보가 올바르지 않습니다.');
      if (failure) {
        reply.code(400);
        return sendPinnedPage(request, reply, pinnedError(failure).errorMessage);
      }
      return reply.redirect('/settings/pinned-posts?saved=1', 303);
    });

    routes.get('/v1/setting/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rows = await readSeriesRows(db, user.id, 'active');
      return apiDone({
        username: user.username,
        series: rows.map((row) => ({ id: Number(row.id), url: row.url, title: row.name, totalPosts: Number(row.totalPosts) })),
      });
    });

    routes.get('/v1/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rows = await readSeriesRows(db, user.id, 'public');
      return apiDone({ series: rows.map((row) => ({
        id: String(row.id), name: row.name, url: row.url, totalPosts: Number(row.totalPosts), createdDate: localDate(row.createdDate),
      })) });
    });

    routes.post('/v1/series', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const body = bodyRecord(request.body);
      const postIds = Object.hasOwn(body, 'post_ids') ? parsePostIds(body.post_ids) : undefined;
      if (postIds === null) return apiError('IP', 'Invalid request data.');
      try {
        const series = await saveSeries(db, user.id, {
          name: stringValue(body.name), url: stringValue(body.url), description: stringValue(body.description), postIds,
        });
        return apiDone({ ...series, thumbnail: stringValue(body.thumbnail) });
      } catch (failure) {
        return apiError((failure as { code?: string })?.code ?? 'VA', errorMessage(failure, 'Could not create the series.'));
      }
    });

    routes.get('/v1/series/valid-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const rawId = queryValue(request, 'series_id');
      let seriesId: number | undefined;
      if (rawId !== undefined) {
        seriesId = positiveInt(rawId) ?? undefined;
        if (seriesId === undefined) return apiError('IP', 'Enter a valid series ID.');
        const series = await readSeriesById(db, user.id, seriesId);
        if (!series) return apiError('NF', 'Series not found.');
      }
      return apiDone(await readAvailableSeriesPosts(db, user.id, seriesId));
    });

    routes.put('/v1/series/order', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const raw = bodyRecord(request.body).order;
      if (!Array.isArray(raw) || !raw.length || !raw.every((item) => Array.isArray(item) && item.length >= 2 && Number.isSafeInteger(Number(item[0])) && Number.isSafeInteger(Number(item[1])))) {
        return apiError('IP', 'Order information is required.');
      }
      await updateSeriesOrder(db, user.id, raw.map((item) => [Number(item[0]), Number(item[1])] as [number, number]));
      return apiDone({ message: 'Series order updated.' });
    });

    routes.get<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const id = positiveInt(request.params.id);
      if (!id) return reply.code(404).send('Not found');
      const series = await readSeriesById(db, user.id, id);
      if (!series) return apiError('NF', 'Series not found.');
      const postIds = await readSeriesPostIds(db, user.id, id);
      return apiDone({ id, name: series.name, url: series.url, description: series.description, postIds, postCount: postIds.length });
    });

    routes.put<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const id = positiveInt(request.params.id);
      if (!id || !(await readSeriesById(db, user.id, id))) return apiError('NF', 'Series not found.');
      const body = bodyRecord(request.body);
      const postIds = Object.hasOwn(body, 'post_ids') ? parsePostIds(body.post_ids) : undefined;
      if (postIds === null) return apiError('IP', 'Invalid request data.');
      try {
        const series = await saveSeries(db, user.id, {
          name: body.name === undefined ? undefined : stringValue(body.name),
          url: body.url === undefined ? undefined : stringValue(body.url),
          description: body.description === undefined ? undefined : stringValue(body.description),
          postIds,
        }, id);
        return apiDone({ ...series, thumbnail: stringValue(body.thumbnail) });
      } catch (failure) {
        return apiError((failure as { code?: string })?.code ?? 'VA', errorMessage(failure, 'Could not update the series.'));
      }
    });

    routes.delete<{ Params: { id: string } }>('/v1/series/:id', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const id = positiveInt(request.params.id);
      if (!id || !(await deleteSeries(db, user.id, id))) return apiError('NF', 'Series not found.');
      return apiDone({ message: 'Series deleted.' });
    });

    routes.delete<{ Params: { username: string; url: string } }>('/v1/users/@:username/series/:url', async (request, reply) => {
      const [owner] = await db.$queryRaw<Array<{ id: number; username: string; active: number | bigint | boolean }>>`
        SELECT id, username, CAST(is_active AS INTEGER) AS active FROM auth_user WHERE username = ${request.params.username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (user.id !== owner.id) return apiError('AT', 'Permission denied.');
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      const [series] = await db.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM board_series WHERE owner_id = ${owner.id} AND url = ${request.params.url} LIMIT 1
      `;
      if (!series || !(await deleteSeries(db, user.id, Number(series.id)))) return reply.code(404).send('Not found');
      return apiDone({});
    });

    routes.get('/v1/setting/pinned-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const [pinnedPosts, reservedCount] = await Promise.all([readPinnedPosts(db, user.id), reservedPinnedCount(db, user.id)]);
      return apiDone({ pinnedPosts: pinnedPosts.map(({ publishedDate: _publishedDate, ...pin }) => pin), username: user.username, maxCount: MAX_PINNED_POSTS, reservedCount });
    });

    routes.get('/v1/setting/pinnable-posts', async (request, reply) => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      const result = await readPinnablePosts(db, user.id, queryValue(request, 'q'), queryValue(request, 'limit'), queryValue(request, 'page'));
      return 'code' in result ? pinnedError(result) : apiDone({ posts: result.posts, ...result.pagination });
    });

    const settingPinnedMutation = async (request: FastifyRequest, reply: FastifyReply, mode: 'add' | 'remove' | 'order') => {
      const { user, error } = await apiEditor(request);
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      let failure: PinnedServiceError | null = null;
      if (mode === 'order') {
        const urls = parsePinnedUrls(bodyRecord(request.body).post_urls);
        if (!urls) return pinnedError({ code: 'IP', key: 'pinned_posts.invalid_format' });
        failure = await reorderPinnedPosts(db, user.id, urls);
      } else {
        const url = pinnedPostUrl(request);
        if (!url) return pinnedError({ code: 'IP', key: 'pinned_posts.post_url_required' });
        failure = mode === 'add' ? await addPinnedPost(db, user.id, url) : await removePinnedPost(db, user.id, url);
      }
      return failure ? pinnedError(failure) : apiDone();
    };

    routes.post('/v1/setting/pinned-posts', (request, reply) => settingPinnedMutation(request, reply, 'add'));
    routes.delete('/v1/setting/pinned-posts', (request, reply) => settingPinnedMutation(request, reply, 'remove'));
    routes.put('/v1/setting/pinned-posts/order', (request, reply) => settingPinnedMutation(request, reply, 'order'));

    routes.get<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', async (request, reply) => {
      const [owner] = await db.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM auth_user WHERE username = ${request.params.username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const pinnedPosts = await readPinnedPosts(db, Number(owner.id));
      return apiDone({ pinnedPosts, maxCount: MAX_PINNED_POSTS });
    });

    const authorPinnedMutation = async (request: FastifyRequest, reply: FastifyReply, username: string, mode: 'add' | 'remove' | 'order' | 'available') => {
      const [owner] = await db.$queryRaw<Array<{ id: number; username: string }>>`
        SELECT id, username FROM auth_user WHERE username = ${username} LIMIT 1
      `;
      if (!owner) return reply.code(404).send('Not found');
      const { user, error } = await pinnedOwnerEditor(request, Number(owner.id));
      if (!user) return error;
      if (!options.validateCsrf(request)) return reply.code(403).send(apiError('RJ'));
      if (mode === 'available') {
        const result = await readPinnablePosts(db, owner.id, queryValue(request, 'q'), queryValue(request, 'limit'), queryValue(request, 'page'));
        return 'code' in result ? pinnedError(result) : apiDone({ posts: result.posts, ...result.pagination });
      }
      if (mode === 'order') {
        const urls = parsePinnedUrls(bodyRecord(request.body).post_urls);
        if (!urls) return pinnedError({ code: 'IP', key: 'pinned_posts.invalid_format' });
        const failure = await reorderPinnedPosts(db, owner.id, urls);
        return failure ? pinnedError(failure) : apiDone();
      }
      const url = pinnedPostUrl(request);
      if (!url) return pinnedError({ code: 'IP', key: 'pinned_posts.post_url_required' });
      const failure = mode === 'add' ? await addPinnedPost(db, owner.id, url) : await removePinnedPost(db, owner.id, url);
      return failure ? pinnedError(failure) : apiDone();
    };

    routes.post<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'add'));
    routes.delete<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'remove'));
    routes.put<{ Params: { username: string } }>('/v1/users/@:username/pinned-posts/order', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'order'));
    routes.get<{ Params: { username: string } }>('/v1/users/@:username/pinnable-posts', (request, reply) => authorPinnedMutation(request, reply, request.params.username, 'available'));
  });
}
