import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { type PinnablePagination, type PinnablePostItem, type PinnedPostItem } from '../pages.js';
import { messageFailure as apiError } from '../../../platform/response.js';
import { SERIES_PUBLIC_FILTER } from './series.js';
import { bodyRecord, localDate, stringValue } from '../shared.js';

interface StoredPinnedPost extends PinnedPostItem {
  publishedDate: string | null;
}

export interface PinnedServiceError {
  code: 'RJ' | 'IP';
  key: string;
  params?: Record<string, string | number>;
}

export const MAX_PINNED_POSTS = 6;

export const DEFAULT_PINNABLE_LIMIT = 30;

const MAX_PINNABLE_LIMIT = 100;

export const MAX_SEARCH_LENGTH = 100;

export function pinnedError(error: PinnedServiceError) {
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

export async function readPinnedPosts(db: PrismaClient, userId: number): Promise<StoredPinnedPost[]> {
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

export async function reservedPinnedCount(db: PrismaClient, userId: number): Promise<number> {
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

export async function readPinnablePosts(
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

export async function addPinnedPost(db: PrismaClient, userId: number, postUrl: string): Promise<PinnedServiceError | null> {
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

export async function removePinnedPost(db: PrismaClient, userId: number, postUrl: string): Promise<PinnedServiceError | null> {
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

export async function reorderPinnedPosts(db: PrismaClient, userId: number, postUrls: string[]): Promise<PinnedServiceError | null> {
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

export function parsePinnedUrls(value: unknown): string[] | null {
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

export function pinnedPostUrl(request: FastifyRequest) {
  const body = bodyRecord(request.body);
  const raw = stringValue(body.post_url);
  return raw.trim() ? raw.trim() : null;
}
