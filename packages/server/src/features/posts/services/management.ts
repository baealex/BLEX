import { Prisma, type PrismaClient } from '@prisma/client';
import { syncPostPublication } from '../../notifications/model.js';
import { localDate, localDateTimeText } from '../../../compat/django-format.js';
import { deleteTrashedPost } from './deletions.js';
import { mediaUrl } from './post-content.js';
import { PostValidationError, comparableDate } from './post-store.js';
import { DbDate, ManagedPostRow, TrashedPostRow, UserRow, dateAsIso, field, isTrue, nowString, numberValue } from '../shared.js';

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
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
    ...(scheduled ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(date);
}

export async function getManagedPosts(
  db: PrismaClient,
  author: UserRow,
  query: Record<string, unknown>,
  scheduled: boolean,
  legacyApi = false,
): Promise<{ posts: Array<Record<string, unknown>>; username: string; page: number; lastPage: number; totalCount: number }> {
  const page = managementPage(query.page);
  const filters: Prisma.Sql[] = [
    Prisma.sql`post.author_id = ${author.id}`,
    Prisma.sql`post.deleted_date IS NULL`,
    scheduled
      ? Prisma.sql`post.published_date > ${nowString()}`
      : Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${nowString()}`,
  ];
  const tag = field(query.tag);
  const series = field(query.series);
  const search = field(query.search);
  const visibility = field(query.visibility);
  const requestedOrder = field(query.order) || '-published_date';
  if (tag) filters.push(Prisma.sql`EXISTS (
    SELECT 1 FROM board_post_tags AS filter_link JOIN board_tag AS filter_tag ON filter_tag.id = filter_link.tag_id
     WHERE filter_link.post_id = post.id AND filter_tag.value = ${tag}
  )`);
  if (series) filters.push(Prisma.sql`series.url = ${series}`);
  if (search) filters.push(Prisma.sql`post.title LIKE ${`%${search}%`}`);
  if (visibility === 'public') filters.push(Prisma.sql`COALESCE(config.hide, 0) = 0`);
  else if (visibility === 'hidden') filters.push(Prisma.sql`COALESCE(config.hide, 0) <> 0`);

  const sortField = requestedOrder.startsWith('-') ? requestedOrder.slice(1) : requestedOrder;
  const sortColumns: Record<string, string> = {
    title: 'post.title',
    read_time: 'post.read_time',
    published_date: 'post.published_date',
    updated_date: 'post.updated_date',
    count_likes: 'countLikes',
    count_comments: 'countComments',
  };
  const column = sortColumns[sortField];
  if (!column) throw new ManagementQueryError('Unsupported post-management order.');
  const direction = requestedOrder.startsWith('-') ? 'DESC' : 'ASC';
  const orderBy = Prisma.raw(`${column} ${direction}, post.id DESC`);
  const where = Prisma.join(filters, ' AND ');
  const totals = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_post AS post
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
     WHERE ${where}
  `;
  const totalCount = numberValue(totals[0]?.total);
  const lastPage = totalCount === 0 ? 1 : Math.ceil(totalCount / 10);
  if (page > lastPage) throw new ManagementQueryError('Check the page.');
  const rows = await db.$queryRaw<ManagedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(config.hide AS INTEGER) AS hide,
           (SELECT COUNT(*) FROM board_post_likes AS likes WHERE likes.post_id = post.id) AS countLikes,
           (SELECT COUNT(*) FROM board_comment AS comments WHERE comments.post_id = post.id) AS countComments,
           post.read_time AS readTime,
           COALESCE((SELECT group_concat(tag_rows.value, ',') FROM (
             SELECT tag.value AS value FROM board_post_tags AS link
               JOIN board_tag AS tag ON tag.id = link.tag_id
              WHERE link.post_id = post.id ORDER BY link.tag_id
           ) AS tag_rows), '') AS tag,
           COALESCE(series.url, '') AS series
      FROM board_post AS post
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT 10 OFFSET ${(page - 1) * 10}
  `;
  return {
    username: author.username,
    page,
    lastPage,
    totalCount,
    posts: rows.map((post) => ({
      url: post.url,
      title: post.title,
      image: legacyApi ? post.image || null : mediaUrl(post.image),
      createdDate: legacyApi
        ? scheduled ? localDateTimeText(post.publishedDate) : localDate(post.publishedDate)
        : managementDate(post.publishedDate, scheduled),
      updatedDate: legacyApi ? localDate(post.updatedDate) : managementDate(post.updatedDate),
      isHide: isTrue(post.hide),
      countLikes: numberValue(post.countLikes),
      countComments: numberValue(post.countComments),
      readTime: post.readTime,
      tag: post.tag,
      series: post.series,
    })),
  };
}

export async function getTrashRows(
  db: PrismaClient,
  author: UserRow,
  page: number,
): Promise<{ posts: Array<Record<string, unknown>>; pagination: { page: number; totalCount: number; lastPage: number }; retention: { mode: 'manual' } }> {
  const totals = await db.$queryRaw<Array<{ total: number | bigint }>>`
    SELECT COUNT(*) AS total FROM board_post WHERE author_id = ${author.id} AND deleted_date IS NOT NULL
  `;
  const totalCount = numberValue(totals[0]?.total);
  const lastPage = Math.max(1, Math.ceil(totalCount / 10));
  if (page < 1 || page > lastPage) throw new ManagementQueryError('Check the trash page.');
  const rows = await db.$queryRaw<TrashedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(post.deleted_date AS TEXT) AS deletedDate,
           CAST(config.hide AS INTEGER) AS hide
      FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.author_id = ${author.id} AND post.deleted_date IS NOT NULL
     ORDER BY post.deleted_date DESC, post.id DESC
     LIMIT 10 OFFSET ${(page - 1) * 10}
  `;
  const now = nowString();
  return {
    posts: rows.map((post) => {
      const sourceStatus = !post.publishedDate
        ? 'draft'
        : String(post.publishedDate) > String(post.deletedDate) ? 'scheduled' : 'published';
      const scheduleElapsed = sourceStatus === 'scheduled' && String(post.publishedDate) <= now;
      return {
        url: post.url,
        title: post.title,
        image: mediaUrl(post.image),
        sourceStatus,
        publishedDate: dateAsIso(post.publishedDate),
        updatedDate: dateAsIso(post.updatedDate),
        deletedDate: dateAsIso(post.deletedDate),
        scheduleElapsed,
        isHide: isTrue(post.hide),
      };
    }),
    pagination: { page, totalCount, lastPage },
    retention: { mode: 'manual' },
  };
}

export async function loadTrashedPost(db: PrismaClient, author: UserRow, slug: string): Promise<TrashedPostRow | null> {
  const rows = await db.$queryRaw<TrashedPostRow[]>`
    SELECT post.id AS id, post.url AS url, post.title AS title, post.image AS image,
           CAST(post.published_date AS TEXT) AS publishedDate,
           CAST(post.updated_date AS TEXT) AS updatedDate,
           CAST(post.deleted_date AS TEXT) AS deletedDate,
           CAST(config.hide AS INTEGER) AS hide
      FROM board_post AS post LEFT JOIN board_postconfig AS config ON config.post_id = post.id
     WHERE post.author_id = ${author.id} AND post.url = ${slug} AND post.deleted_date IS NOT NULL
     LIMIT 1
  `;
  return rows[0] ?? null;
}

function trashStatus(post: TrashedPostRow): 'draft' | 'scheduled' | 'published' {
  if (!post.publishedDate) return 'draft';
  return new Date(dateAsIso(post.publishedDate) ?? 0).valueOf() > Date.now() ? 'scheduled' : 'published';
}

export async function restoreTrashedPost(
  db: PrismaClient,
  author: UserRow,
  post: TrashedPostRow,
  expectedDeletedDate: string,
): Promise<'draft' | 'scheduled' | 'published'> {
  if (!post.deletedDate || comparableDate(post.deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  await db.$transaction(async (tx) => {
    const changed = await tx.$executeRaw`
      UPDATE board_post SET deleted_date = NULL
       WHERE id = ${post.id} AND author_id = ${author.id} AND deleted_date = ${post.deletedDate}
    `;
    if (numberValue(changed) === 0) throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
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
  if (!deletedDate || comparableDate(deletedDate) !== comparableDate(expectedDeletedDate)) {
    throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
  }
  await db.$transaction(async (tx) => {
    if (!await deleteTrashedPost(tx, post.id, author.id, deletedDate)) {
      throw new PostValidationError('RJ', 'The trash state changed. Refresh the list and try again.');
    }
  }, { timeout: 15_000, isolationLevel: 'Serializable' });
  return post.id;
}
