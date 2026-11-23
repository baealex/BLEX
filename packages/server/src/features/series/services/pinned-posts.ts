import { systemMessage } from '../../../platform/messages.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { storedDateText } from '../../../platform/date-format.js';
import { messageFailure as apiError } from '../../../platform/response.js';
import { containsLiteral } from '../../posts/data/text-match.js';
import { publicPostWhere } from '../../posts/data/visibility.js';
import {
  type PinnablePagination,
  type PinnablePostItem,
  type PinnedPostItem,
  bodyRecord,
  localDate,
  stringValue,
} from '../shared.js';

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
    'pinned_posts.already_pinned': systemMessage('This post is already pinned to your profile.'),
    'pinned_posts.editor_required': systemMessage('Author access is required.'),
    'pinned_posts.invalid_page': systemMessage('The page number is invalid.'),
    'pinned_posts.limit_reached': systemMessage('You can pin up to {value0} posts to your profile.', {
      value0: MAX_PINNED_POSTS,
    }),
    'pinned_posts.post_not_found': systemMessage('Post to pin not found.'),
    'pinned_posts.hidden_post': systemMessage('Hidden posts cannot be pinned.'),
    'pinned_posts.published_only': systemMessage('Only published posts can be pinned.'),
    'pinned_posts.pinned_post_not_found': systemMessage('Pinned post not found.'),
    'pinned_posts.reorder_contains_unpinned': systemMessage('The order includes a post that is not pinned.'),
    'pinned_posts.post_url_required': systemMessage('Enter the post URL.'),
    'pinned_posts.invalid_format': systemMessage('Invalid request format.'),
  };
  const suffix = error.key === 'pinned_posts.reorder_contains_unpinned' ? ` (${error.params?.url ?? ''})` : '';
  return apiError(
    error.code,
    `${labels[error.key] ?? systemMessage('Could not update pinned posts.')}${suffix}`,
    error.key,
    error.params ?? {},
  );
}

const pinOrder = [
  { order: 'asc' },
  { createdAt: 'asc' },
  { postId: 'asc' },
] satisfies Prisma.PinnedPostOrderByWithRelationInput[];

export async function readPinnedPosts(db: PrismaClient, userId: number): Promise<StoredPinnedPost[]> {
  const rows = await db.pinnedPost.findMany({
    where: { userId, post: publicPostWhere() },
    orderBy: pinOrder,
    select: {
      postId: true,
      order: true,
      post: { select: { slug: true, title: true, image: true, publishedAt: true } },
    },
  });
  return rows.map(({ postId, order, post }) => ({
    id: postId,
    order,
    publishedDate: post.publishedAt && storedDateText(post.publishedAt),
    post: { url: post.slug, title: post.title, image: post.image || null, createdDate: localDate(post.publishedAt) },
  }));
}

export async function reservedPinnedCount(db: PrismaClient, userId: number): Promise<number> {
  return db.pinnedPost.count({ where: { userId, post: { deletedAt: { not: null } } } });
}

function normalizedPagination(
  query: string | undefined,
  limitRaw: string | undefined,
  pageRaw: string | undefined,
):
  | {
      query: string;
      limit: number | null;
      page: number;
      hasPagination: boolean;
    }
  | PinnedServiceError {
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
  const where: Prisma.PostWhereInput = { authorId: userId, ...publicPostWhere(), pins: { none: { userId } } };
  const order = [{ publishedAt: 'desc' }, { id: 'desc' }] satisfies Prisma.PostOrderByWithRelationInput[];
  const select = { slug: true, title: true, image: true, publishedAt: true } satisfies Prisma.PostSelect;
  // Title search is a literal substring match, which LIKE cannot express, over one author's short rows.
  const matches = search
    ? (await db.post.findMany({ where, orderBy: order, select })).filter(({ title }) => containsLiteral(title, search))
    : null;
  const totalCount = matches ? matches.length : await db.post.count({ where });
  const responseLimit = pagination.limit ?? totalCount;
  const queryLimit = Math.max(1, responseLimit);
  const lastPage = Math.max(1, Math.ceil(totalCount / queryLimit));
  const page = Math.min(pagination.page, lastPage);
  const offset = (page - 1) * queryLimit;
  const rows = matches
    ? matches.slice(offset, offset + queryLimit)
    : await db.post.findMany({ where, orderBy: order, skip: offset, take: queryLimit, select });
  return {
    posts: rows.map((row) => ({
      url: row.slug,
      title: row.title,
      image: row.image || null,
      createdDate: localDate(row.publishedAt),
    })),
    pagination: {
      page,
      limit: responseLimit,
      lastPage,
      totalCount,
      hasNext: page < lastPage,
      hasPrevious: page > 1,
    },
  };
}

export async function addPinnedPost(
  db: PrismaClient,
  userId: number,
  postUrl: string,
): Promise<PinnedServiceError | null> {
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    if ((await tx.pinnedPost.count({ where: { userId } })) >= MAX_PINNED_POSTS) {
      return { code: 'RJ', key: 'pinned_posts.limit_reached', params: { count: MAX_PINNED_POSTS } };
    }
    const post = await tx.post.findFirst({
      where: { authorId: userId, slug: postUrl },
      select: { id: true, isHidden: true, publishedAt: true, deletedAt: true },
    });
    if (!post) return { code: 'RJ', key: 'pinned_posts.post_not_found' };
    if (post.isHidden) return { code: 'RJ', key: 'pinned_posts.hidden_post' };
    if (!post.publishedAt || post.deletedAt || post.publishedAt > new Date()) {
      return { code: 'RJ', key: 'pinned_posts.published_only' };
    }
    const key = { userId_postId: { userId, postId: post.id } };
    if (await tx.pinnedPost.findUnique({ where: key, select: { postId: true } }))
      return { code: 'RJ', key: 'pinned_posts.already_pinned' };
    const { _max } = await tx.pinnedPost.aggregate({ where: { userId }, _max: { order: true } });
    await tx.pinnedPost.create({
      data: { userId, postId: post.id, order: _max.order === null ? 0 : _max.order + 1, createdAt: new Date() },
    });
    return null;
  });
}

export async function removePinnedPost(
  db: PrismaClient,
  userId: number,
  postUrl: string,
): Promise<PinnedServiceError | null> {
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    const pinned = await tx.pinnedPost.findFirst({
      where: { userId, post: { slug: postUrl } },
      select: { postId: true, order: true },
    });
    if (!pinned) return { code: 'RJ', key: 'pinned_posts.pinned_post_not_found' };
    await tx.pinnedPost.delete({ where: { userId_postId: { userId, postId: pinned.postId } } });
    await tx.pinnedPost.updateMany({
      where: { userId, order: { gt: pinned.order } },
      data: { order: { decrement: 1 } },
    });
    return null;
  });
}

export async function reorderPinnedPosts(
  db: PrismaClient,
  userId: number,
  postUrls: string[],
): Promise<PinnedServiceError | null> {
  if (postUrls.length > MAX_PINNED_POSTS)
    return { code: 'RJ', key: 'pinned_posts.limit_reached', params: { count: MAX_PINNED_POSTS } };
  return db.$transaction(async (tx: Prisma.TransactionClient): Promise<PinnedServiceError | null> => {
    const pins = await tx.pinnedPost.findMany({
      where: { userId },
      orderBy: pinOrder,
      select: { postId: true, order: true, post: { select: { slug: true } } },
    });
    const rows = pins.map((pin) => ({ postId: pin.postId, order: pin.order, url: pin.post.slug }));
    const byUrl = new Map(rows.map((row) => [row.url, row]));
    for (const url of postUrls) {
      if (!byUrl.has(url)) return { code: 'RJ', key: 'pinned_posts.reorder_contains_unpinned', params: { url } };
    }
    const requested = new Set(postUrls);
    const ordered = [...postUrls.map((url) => byUrl.get(url)!), ...rows.filter((row) => !requested.has(row.url))];
    for (let index = 0; index < ordered.length; index += 1) {
      const row = ordered[index]!;
      if (row.order !== index)
        await tx.pinnedPost.update({
          where: { userId_postId: { userId, postId: row.postId } },
          data: { order: index },
        });
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
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? (value as string[]) : null;
}

export function pinnedPostUrl(request: FastifyRequest) {
  const body = bodyRecord(request.body);
  const raw = stringValue(body.postUrl);
  return raw.trim() ? raw.trim() : null;
}
