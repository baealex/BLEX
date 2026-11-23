import { requestLocale } from '../../../platform/request-locale.js';
import type { Prisma, PrismaClient } from '@prisma/client';
import { syncPostPublication } from '../../notifications/model.js';
import { localDate, localDateTimeText } from '../../../platform/date-format.js';
import { deleteTrashedPost } from './deletions.js';
import { mediaUrl } from './post-content.js';
import { PostValidationError, comparableDate } from './post-store.js';
import { type DbDate, type TrashedPostRow, type UserRow, dateAsIso, field } from '../shared.js';

export class ManagementQueryError extends Error {}

export function managementPage(value: unknown): number {
  const raw = field(value) || '1';
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw new ManagementQueryError('Check the page.');
  }
  return Number(raw);
}

export function managementDate(value: DbDate, scheduled = false): string {
  const iso = dateAsIso(value);
  if (!iso) return '';
  const date = new Date(iso);
  return new Intl.DateTimeFormat(requestLocale(), {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(scheduled ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(date);
}

const managedSorts: Record<string, (direction: Prisma.SortOrder) => Prisma.PostOrderByWithRelationInput> = {
  title: (direction) => ({ title: direction }),
  readTime: (direction) => ({ readTime: direction }),
  publishedDate: (direction) => ({ publishedAt: direction }),
  updatedDate: (direction) => ({ updatedAt: direction }),
  countLikes: (direction) => ({ likes: { _count: direction } }),
  countComments: (direction) => ({ comments: { _count: direction } }),
};

export async function getManagedPosts(
  db: PrismaClient,
  author: UserRow,
  query: Record<string, unknown>,
  scheduled: boolean,
  legacyApi = false,
): Promise<{
  posts: Array<Record<string, unknown>>;
  username: string;
  page: number;
  lastPage: number;
  totalCount: number;
}> {
  const page = managementPage(query.page);
  const now = new Date();
  const tag = field(query.tag);
  const series = field(query.series);
  const search = field(query.search);
  const visibility = field(query.visibility);
  const requestedOrder = field(query.order) || '-publishedDate';
  const where: Prisma.PostWhereInput = {
    authorId: author.id,
    deletedAt: null,
    publishedAt: scheduled ? { gt: now } : { lte: now },
    ...(tag ? { tags: { some: { name: tag } } } : {}),
    ...(series ? { series: { slug: series } } : {}),
    ...(search ? { title: { contains: search } } : {}),
    ...(visibility === 'public' ? { isHidden: false } : visibility === 'hidden' ? { isHidden: true } : {}),
  };
  const sort = managedSorts[requestedOrder.startsWith('-') ? requestedOrder.slice(1) : requestedOrder];
  if (!sort) throw new ManagementQueryError('Unsupported post-management order.');
  const totalCount = await db.post.count({ where });
  const lastPage = totalCount === 0 ? 1 : Math.ceil(totalCount / 10);
  if (page > lastPage) throw new ManagementQueryError('Check the page.');
  const rows = await db.post.findMany({
    where,
    orderBy: [sort(requestedOrder.startsWith('-') ? 'desc' : 'asc'), { id: 'desc' }],
    skip: (page - 1) * 10,
    take: 10,
    select: {
      slug: true,
      title: true,
      image: true,
      publishedAt: true,
      updatedAt: true,
      isHidden: true,
      readTime: true,
      series: { select: { slug: true } },
      tags: { orderBy: { id: 'asc' }, select: { name: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  return {
    username: author.username,
    page,
    lastPage,
    totalCount,
    posts: rows.map((post) => ({
      url: post.slug,
      title: post.title,
      image: legacyApi ? post.image || null : mediaUrl(post.image),
      createdDate: legacyApi
        ? scheduled
          ? localDateTimeText(post.publishedAt)
          : localDate(post.publishedAt)
        : managementDate(post.publishedAt, scheduled),
      updatedDate: legacyApi ? localDate(post.updatedAt) : managementDate(post.updatedAt),
      isHide: post.isHidden,
      countLikes: post._count.likes,
      countComments: post._count.comments,
      readTime: post.readTime,
      tag: post.tags.map(({ name }) => name).join(','),
      series: post.series?.slug ?? '',
    })),
  };
}

const trashedPostSelect = {
  id: true,
  slug: true,
  title: true,
  image: true,
  publishedAt: true,
  updatedAt: true,
  deletedAt: true,
  isHidden: true,
} satisfies Prisma.PostSelect;

function trashedPost(row: Prisma.PostGetPayload<{ select: typeof trashedPostSelect }>): TrashedPostRow | null {
  if (!row.deletedAt) return null;
  return {
    id: row.id,
    url: row.slug,
    title: row.title,
    image: row.image,
    publishedDate: row.publishedAt,
    updatedDate: row.updatedAt,
    deletedDate: row.deletedAt,
    hide: row.isHidden,
  };
}

export async function getTrashRows(
  db: PrismaClient,
  author: UserRow,
  page: number,
): Promise<{
  posts: Array<Record<string, unknown>>;
  pagination: { page: number; totalCount: number; lastPage: number };
  retention: { mode: 'manual' };
}> {
  const where = { authorId: author.id, deletedAt: { not: null } } satisfies Prisma.PostWhereInput;
  const totalCount = await db.post.count({ where });
  const lastPage = Math.max(1, Math.ceil(totalCount / 10));
  if (page < 1 || page > lastPage) throw new ManagementQueryError('Check the trash page.');
  const rows = await db.post.findMany({
    where,
    orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * 10,
    take: 10,
    select: trashedPostSelect,
  });
  const now = new Date();
  return {
    posts: rows
      .map(trashedPost)
      .filter((post) => post !== null)
      .map((post) => {
        const sourceStatus = !post.publishedDate
          ? 'draft'
          : post.publishedDate > post.deletedDate
            ? 'scheduled'
            : 'published';
        const scheduleElapsed =
          sourceStatus === 'scheduled' && post.publishedDate !== null && post.publishedDate <= now;
        return {
          url: post.url,
          title: post.title,
          image: mediaUrl(post.image),
          sourceStatus,
          publishedDate: dateAsIso(post.publishedDate),
          updatedDate: dateAsIso(post.updatedDate),
          deletedDate: dateAsIso(post.deletedDate),
          scheduleElapsed,
          isHide: post.hide,
        };
      }),
    pagination: { page, totalCount, lastPage },
    retention: { mode: 'manual' },
  };
}

export async function loadTrashedPost(db: PrismaClient, author: UserRow, slug: string): Promise<TrashedPostRow | null> {
  const row = await db.post.findFirst({
    where: { authorId: author.id, slug, deletedAt: { not: null } },
    select: trashedPostSelect,
  });
  return row ? trashedPost(row) : null;
}

function trashStatus(post: TrashedPostRow): 'draft' | 'scheduled' | 'published' {
  if (!post.publishedDate) return 'draft';
  return post.publishedDate.valueOf() > Date.now() ? 'scheduled' : 'published';
}

export async function restoreTrashedPost(
  db: PrismaClient,
  author: UserRow,
  post: TrashedPostRow,
  expectedDeletedDate: string,
): Promise<'draft' | 'scheduled' | 'published'> {
  if (comparableDate(post.deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  await db.$transaction(async (tx) => {
    const { count } = await tx.post.updateMany({
      where: { id: post.id, authorId: author.id, deletedAt: post.deletedDate },
      data: { deletedAt: null },
    });
    if (count === 0) throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
    await syncPostPublication(tx, post.id);
  });
  return trashStatus(post);
}

export async function permanentlyDeleteTrashedPost(
  db: PrismaClient,
  author: UserRow,
  post: TrashedPostRow,
  expectedDeletedDate: string,
): Promise<number> {
  const { deletedDate } = post;
  if (comparableDate(deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  await db.$transaction(
    async (tx) => {
      if (!(await deleteTrashedPost(tx, post.id, author.id, deletedDate))) {
        throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
      }
    },
    { timeout: 15_000, isolationLevel: 'Serializable' },
  );
  return post.id;
}
