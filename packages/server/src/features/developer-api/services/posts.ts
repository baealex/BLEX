import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { AuthenticatedToken } from './token-auth.js';
import { DeveloperApiError, QueryValue, asBoolean, dateTimeValue, errorReply, formatError, parseIntegerQuery, readScalar, toIsoDateTime, toSqlDateTime } from '../shared.js';

interface PostRow {
  id: number;
  title: string;
  subtitle: string;
  url: string;
  username: string;
  seriesId: number | null;
  seriesName: string | null;
  seriesUrl: string | null;
  isHidden: number | bigint | boolean | null;
  isAdvertise: number | bigint | boolean | null;
  coverLayout: string | null;
  coverImagePosition: string | null;
  coverImageRatio: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  publishedAt: string | Date | null;
  total?: number | bigint;
}

interface PostDetailRow extends PostRow {
  description: string;
  readTime: number;
  contentHtml: string | null;
}

interface PostTagRow {
  postId: number;
  value: string;
}

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

function addStatusFilter(filters: Prisma.Sql[], status: string, now: string): DeveloperApiError | undefined {
  if (!status) return undefined;
  switch (status) {
    case 'draft':
      filters.push(Prisma.sql`post.published_date IS NULL`);
      return undefined;
    case 'published':
      filters.push(Prisma.sql`post.deleted_date IS NULL`);
      filters.push(Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${now}`);
      filters.push(Prisma.sql`config.hide = 0`);
      return undefined;
    case 'scheduled':
      filters.push(Prisma.sql`post.published_date > ${now}`);
      return undefined;
    case 'hidden':
      filters.push(Prisma.sql`post.published_date IS NOT NULL AND post.published_date <= ${now}`);
      filters.push(Prisma.sql`config.hide = 1`);
      return undefined;
    default:
      return formatError('post.invalid_status', 'Unsupported status.', 400);
  }
}

function parseTags(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return values.flatMap((item) => item.split(',')).map((tag) => tag.trim()).filter(Boolean);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function postSummary(row: PostRow, tags: string[], now: number) {
  const isHidden = asBoolean(row.isHidden);
  const publishedAtTime = dateTimeValue(row.publishedAt);
  let status: 'draft' | 'published' | 'scheduled' | 'hidden';
  if (publishedAtTime === null) status = 'draft';
  else if (publishedAtTime > now) status = 'scheduled';
  else if (isHidden) status = 'hidden';
  else status = 'published';

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    url: row.url,
    publicUrl: `/@${row.username}/${row.url}`,
    status,
    tags,
    series: row.seriesId === null ? null : {
      id: row.seriesId,
      name: row.seriesName ?? '',
      url: row.seriesUrl ?? '',
    },
    isHidden,
    isAdvertise: asBoolean(row.isAdvertise),
    coverLayout: row.coverLayout ?? 'default',
    coverImagePosition: row.coverImagePosition ?? 'right',
    coverImageRatio: row.coverImageRatio ?? 'auto',
    createdAt: toIsoDateTime(row.createdAt),
    updatedAt: toIsoDateTime(row.updatedAt),
    publishedAt: toIsoDateTime(row.publishedAt),
  };
}

async function tagsByPost(db: PrismaClient, postIds: number[]): Promise<Map<number, string[]>> {
  const tags = new Map<number, string[]>();
  if (postIds.length === 0) return tags;

  const rows = await db.$queryRaw<PostTagRow[]>`
    SELECT post_tags.post_id AS postId, tag.value
      FROM board_post_tags AS post_tags
      JOIN board_tag AS tag ON tag.id = post_tags.tag_id
     WHERE post_tags.post_id IN (${Prisma.join(postIds)})
     ORDER BY post_tags.post_id, tag.value
  `;
  for (const row of rows) {
    const postTags = tags.get(row.postId) ?? [];
    postTags.push(row.value);
    tags.set(row.postId, postTags);
  }
  return tags;
}

export async function listPosts(
  db: PrismaClient,
  token: AuthenticatedToken,
  query: PaginationQuery,
  search?: SearchQuery,
) {
  const filters: Prisma.Sql[] = [
    Prisma.sql`post.author_id = ${token.user.id}`,
    Prisma.sql`post.deleted_date IS NULL`,
  ];
  const now = toSqlDateTime(new Date());
  const statusError = addStatusFilter(filters, readScalar(query.status) ?? '', now);
  if (statusError) return { error: statusError };

  if (search) {
    const queryText = (readScalar(search.q) ?? '').trim();
    if (queryText) {
      const pattern = `%${escapeLike(queryText)}%`;
      filters.push(Prisma.sql`(
        post.title LIKE ${pattern} ESCAPE char(92)
        OR post.subtitle LIKE ${pattern} ESCAPE char(92)
        OR post.url LIKE ${pattern} ESCAPE char(92)
        OR post.meta_description LIKE ${pattern} ESCAPE char(92)
        OR EXISTS (
          SELECT 1 FROM board_post_tags AS search_tags
          JOIN board_tag AS search_tag ON search_tag.id = search_tags.tag_id
          WHERE search_tags.post_id = post.id
            AND search_tag.value LIKE ${pattern} ESCAPE char(92)
        )
        OR EXISTS (
          SELECT 1 FROM board_postcontent AS search_content
          WHERE search_content.post_id = post.id
            AND search_content.content_html LIKE ${pattern} ESCAPE char(92)
        )
      )`);
    }

    const seriesId = readScalar(search.seriesId);
    if (seriesId !== undefined && seriesId !== '') {
      if (!/^[+-]?\d+$/.test(seriesId) || !Number.isSafeInteger(Number(seriesId))) {
        return {
          error: formatError('request.invalid_series_id', 'series_id must be a number.', 400),
        };
      }
      filters.push(Prisma.sql`post.series_id = ${Number(seriesId)}`);
    }

    const tags = parseTags(search.tag);
    if (tags.length > 0) {
      filters.push(Prisma.sql`EXISTS (
        SELECT 1 FROM board_post_tags AS filter_tags
        JOIN board_tag AS filter_tag ON filter_tag.id = filter_tags.tag_id
        WHERE filter_tags.post_id = post.id
          AND filter_tag.value IN (${Prisma.join(tags)})
      )`);
    }
  }

  const pageValue = parseIntegerQuery(readScalar(query.page), 1);
  const limitValue = parseIntegerQuery(readScalar(query.limit), 20);
  if (pageValue === null) return { invalid: { field: 'page', value: readScalar(query.page) ?? '' } };
  if (limitValue === null) return { invalid: { field: 'limit', value: readScalar(query.limit) ?? '' } };
  const page = Math.max(pageValue, 1);
  const limit = Math.min(Math.max(limitValue, 1), 100);
  const offset = (page - 1) * limit;
  const where = Prisma.join(filters, ' AND ');

  const rows = await db.$queryRaw<PostRow[]>`
    SELECT post.id, post.title, post.subtitle, post.url,
           author.username, post.series_id AS seriesId,
           series.name AS seriesName, series.slug AS seriesUrl,
           config.hide AS isHidden, config.advertise AS isAdvertise,
           config.cover_layout AS coverLayout,
           config.cover_image_position AS coverImagePosition,
           config.cover_image_ratio AS coverImageRatio,
           CAST(post.created_date AS TEXT) AS createdAt,
           CAST(post.updated_date AS TEXT) AS updatedAt,
           CAST(post.published_date AS TEXT) AS publishedAt,
           COUNT(*) OVER () AS total
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN "Series" AS series ON series.id = post.series_id
      LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE ${where}
     ORDER BY post.updated_date DESC
     LIMIT ${limit} OFFSET ${offset}
  `;

  let total = Number(rows[0]?.total ?? 0);
  if (rows.length === 0) {
    const [countRow] = await db.$queryRaw<Array<{ total: number | bigint }>>`
      SELECT COUNT(*) AS total
        FROM board_post AS post
        JOIN auth_user AS author ON author.id = post.author_id
        LEFT JOIN board_postconfig AS config ON config.post_id = post.id
        LEFT JOIN "Series" AS series ON series.id = post.series_id
        LEFT JOIN board_postcontent AS content ON content.post_id = post.id
       WHERE ${where}
    `;
    total = Number(countRow?.total ?? 0);
  }

  const tags = await tagsByPost(db, rows.map((row) => row.id));
  const nowMs = Date.now();
  return {
    data: {
      posts: rows.map((row) => postSummary(row, tags.get(row.id) ?? [], nowMs)),
      pagination: { page, limit, total },
    },
  };
}

export async function readOwnedPost(db: PrismaClient, userId: number, postId: number) {
  const [post] = await db.$queryRaw<PostDetailRow[]>`
    SELECT post.id, post.title, post.subtitle, post.url,
           author.username, post.series_id AS seriesId,
           series.name AS seriesName, series.slug AS seriesUrl,
           config.hide AS isHidden, config.advertise AS isAdvertise,
           config.cover_layout AS coverLayout,
           config.cover_image_position AS coverImagePosition,
           config.cover_image_ratio AS coverImageRatio,
           CAST(post.created_date AS TEXT) AS createdAt,
           CAST(post.updated_date AS TEXT) AS updatedAt,
           CAST(post.published_date AS TEXT) AS publishedAt,
           post.meta_description AS description, post.read_time AS readTime,
           content.content_html AS contentHtml
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_postconfig AS config ON config.post_id = post.id
      LEFT JOIN "Series" AS series ON series.id = post.series_id
      LEFT JOIN board_postcontent AS content ON content.post_id = post.id
     WHERE post.id = ${postId}
       AND post.author_id = ${userId}
       AND post.deleted_date IS NULL
     LIMIT 1
  `;
  return post ?? null;
}

export async function summarizePost(db: PrismaClient, post: PostRow) {
  const tags = await tagsByPost(db, [post.id]);
  return postSummary(post, tags.get(post.id) ?? [], Date.now());
}

export async function postDetail(db: PrismaClient, post: PostDetailRow) {
  const data = await summarizePost(db, post);
  const contentHtml = post.contentHtml ?? '';
  return {
    ...data,
    description: post.description,
    content: contentHtml,
    contentHtml,
    renderedHtml: contentHtml,
    readTime: post.readTime,
  };
}

export function postNotFound(reply: FastifyReply) {
  const headers = reply.request.headers;
  const language = headers['accept-language']?.split(',')[0]?.trim().split(/[;-]/)[0];
  const message = process.env.ENABLE_ENGLISH_UI === 'TRUE' && language === 'en' ? 'Post not found.' : '포스트를 찾을 수 없습니다.';
  return errorReply(reply, formatError('post.not_found', message, 404));
}

export function postVersionIssue(expected: string, post: PostDetailRow) {
  return {
    ...formatError('post.version_conflict', 'The post was already updated by another request.', 409),
    fields: { expected_updated_at: expected, actual_updated_at: toIsoDateTime(post.updatedAt), post_id: post.id },
  };
}
