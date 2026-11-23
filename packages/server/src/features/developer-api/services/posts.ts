import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { resolveUiLocale } from '../../../platform/locale.js';
import type { AuthenticatedToken } from './token-auth.js';
import { postIdsMatching, type PostTextField } from '../../posts/data/text-match.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import {
  type DeveloperApiError,
  type QueryValue,
  errorReply,
  formatError,
  parseIntegerQuery,
  readScalar,
  toIsoDateTime,
} from '../shared.js';

const postSelect = {
  id: true,
  title: true,
  subtitle: true,
  slug: true,
  seriesId: true,
  isHidden: true,
  isAdvertised: true,
  coverLayout: true,
  coverImagePosition: true,
  coverImageRatio: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  author: { select: { username: true } },
  series: { select: { name: true, slug: true } },
} satisfies Prisma.PostSelect;

const postDetailSelect = {
  ...postSelect,
  description: true,
  readTime: true,
  content: { select: { html: true } },
} satisfies Prisma.PostSelect;

type PostRow = Prisma.PostGetPayload<{ select: typeof postSelect }>;
type PostDetailRow = Prisma.PostGetPayload<{ select: typeof postDetailSelect }>;

export interface PaginationQuery extends QueryValue {
  page?: string | string[];
  limit?: string | string[];
  status?: string | string[];
}

export interface SearchQuery extends PaginationQuery {
  q?: string | string[];
  tag?: string | string[];
  seriesId?: string | string[];
}

function statusFilter(status: string, now: Date): Prisma.PostWhereInput | DeveloperApiError {
  switch (status) {
    case '':
      return {};
    case 'draft':
      return { publishedAt: null };
    case 'published':
      return publicPostWhere(now);
    case 'scheduled':
      return { publishedAt: { gt: now } };
    case 'hidden':
      return { publishedAt: { lte: now }, isHidden: true };
    default:
      return formatError('post.invalid_status', 'Unsupported status.', 400);
  }
}

const searchedFields: PostTextField[] = ['title', 'subtitle', 'slug', 'description', 'tags', 'content'];

function parseTags(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values
    .flatMap((item) => item.split(','))
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function postSummary(row: PostRow, tags: string[], now: number) {
  const publishedAtTime = row.publishedAt?.getTime() ?? null;
  let status: 'draft' | 'published' | 'scheduled' | 'hidden';
  if (publishedAtTime === null) status = 'draft';
  else if (publishedAtTime > now) status = 'scheduled';
  else if (row.isHidden) status = 'hidden';
  else status = 'published';

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    url: row.slug,
    publicUrl: `/@${row.author.username}/${row.slug}`,
    status,
    tags,
    series:
      row.seriesId === null
        ? null
        : {
            id: row.seriesId,
            name: row.series?.name ?? '',
            url: row.series?.slug ?? '',
          },
    isHidden: row.isHidden,
    isAdvertise: row.isAdvertised,
    coverLayout: row.coverLayout,
    coverImagePosition: row.coverImagePosition,
    coverImageRatio: row.coverImageRatio,
    createdAt: toIsoDateTime(row.createdAt),
    updatedAt: toIsoDateTime(row.updatedAt),
    publishedAt: toIsoDateTime(row.publishedAt),
  };
}

async function tagsByPost(db: PrismaClient, postIds: number[]): Promise<Map<number, string[]>> {
  const tags = new Map<number, string[]>();
  if (postIds.length === 0) return tags;
  const rows = await db.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, tags: { orderBy: { name: 'asc' }, select: { name: true } } },
  });
  for (const row of rows)
    tags.set(
      row.id,
      row.tags.map(({ name }) => name),
    );
  return tags;
}

export async function listPosts(
  db: PrismaClient,
  token: AuthenticatedToken,
  query: PaginationQuery,
  search?: SearchQuery,
) {
  const owned: Prisma.PostWhereInput = { authorId: token.user.id, deletedAt: null };
  const status = statusFilter(readScalar(query.status) ?? '', new Date());
  if ('code' in status) return { error: status as DeveloperApiError };
  const filters: Prisma.PostWhereInput[] = [owned, status];
  let matchedIds: Set<number> | null = null;

  if (search) {
    const queryText = (readScalar(search.q) ?? '').trim();
    if (queryText) {
      matchedIds = new Set<number>();
      for (const field of searchedFields) {
        for (const id of await postIdsMatching(db, owned, field, [queryText])) matchedIds.add(id);
      }
    }

    const seriesId = readScalar(search.seriesId);
    if (seriesId !== undefined && seriesId !== '') {
      if (!/^[+-]?\d+$/.test(seriesId) || !Number.isSafeInteger(Number(seriesId))) {
        return {
          error: formatError('request.invalid_series_id', 'series_id must be a number.', 400),
        };
      }
      filters.push({ seriesId: Number(seriesId) });
    }

    const tags = parseTags(search.tag);
    if (tags.length > 0) filters.push({ tags: { some: { name: { in: tags } } } });
  }

  const pageValue = parseIntegerQuery(readScalar(query.page), 1);
  const limitValue = parseIntegerQuery(readScalar(query.limit), 20);
  if (pageValue === null) return { invalid: { field: 'page', value: readScalar(query.page) ?? '' } };
  if (limitValue === null) return { invalid: { field: 'limit', value: readScalar(query.limit) ?? '' } };
  const page = Math.max(pageValue, 1);
  const limit = Math.min(Math.max(limitValue, 1), 100);
  const offset = (page - 1) * limit;
  const where: Prisma.PostWhereInput = { AND: filters };

  let total: number;
  let rows: PostRow[];
  if (matchedIds) {
    // The matches come from one author's posts, so their order is built from ids and dates alone.
    const ordered = await db.post.findMany({ where, orderBy: { updatedAt: 'desc' }, select: { id: true } });
    const matched = ordered.filter(({ id }) => matchedIds.has(id)).map(({ id }) => id);
    total = matched.length;
    const pageIds = matched.slice(offset, offset + limit);
    const found = await db.post.findMany({ where: { AND: [where, { id: { in: pageIds } }] }, select: postSelect });
    const byId = new Map(found.map((row) => [row.id, row]));
    rows = pageIds.flatMap((id) => {
      const post = byId.get(id);
      return post ? [post] : [];
    });
  } else {
    total = await db.post.count({ where });
    rows = await db.post.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      select: postSelect,
    });
  }

  const tags = await tagsByPost(
    db,
    rows.map((row) => row.id),
  );
  const nowMs = Date.now();
  return {
    data: {
      posts: rows.map((row) => postSummary(row, tags.get(row.id) ?? [], nowMs)),
      pagination: { page, limit, total },
    },
  };
}

export async function readOwnedPost(db: PrismaClient, userId: number, postId: number) {
  return db.post.findFirst({ where: { id: postId, authorId: userId, deletedAt: null }, select: postDetailSelect });
}

export async function summarizePost(db: PrismaClient, post: PostRow) {
  const tags = await tagsByPost(db, [post.id]);
  return postSummary(post, tags.get(post.id) ?? [], Date.now());
}

export async function postDetail(db: PrismaClient, post: PostDetailRow) {
  const data = await summarizePost(db, post);
  const contentHtml = post.content?.html ?? '';
  return {
    ...data,
    description: post.description,
    content: contentHtml,
    contentHtml,
    renderedHtml: contentHtml,
    readTime: post.readTime,
  };
}

/** What a token without `posts:read` learns from a write: that it landed, and the address once the post is public. */
export function postWriteReceipt(post: PostRow) {
  const { id, status, url, publicUrl, updatedAt, publishedAt } = postSummary(post, [], Date.now());
  return { id, status, ...(status === 'published' ? { url, publicUrl } : {}), updatedAt, publishedAt };
}

export async function postNotFound(db: PrismaClient, reply: FastifyReply, userId: number) {
  const preference = await db.userPreference.findUnique({ where: { userId }, select: { language: true } });
  const language = resolveUiLocale(preference?.language);
  const message = language === 'en' ? 'Post not found.' : '포스트를 찾을 수 없습니다.';
  return errorReply(reply, formatError('post.not_found', message, 404));
}

export function postVersionIssue(expected: string, post: PostDetailRow) {
  return {
    ...formatError('post.version_conflict', 'The post was already updated by another request.', 409),
    fields: { expected_updated_at: expected, actual_updated_at: toIsoDateTime(post.updatedAt), post_id: post.id },
  };
}
