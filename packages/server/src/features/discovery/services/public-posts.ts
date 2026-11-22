import type { FastifyRequest } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AuthorRow, PAGE_SIZE, PostQueryOptions, PostRow, PublicPageViewer, SqlValue, databaseNow } from '../shared.js';
import { csrfCookie } from '../pages/layout.js';
import { CardLikes } from '../pages/post-list.js';

export const PUBLIC_POST_WHERE = `post.deleted_date IS NULL
  AND post.published_date IS NOT NULL
  AND post.published_date <= ?
  AND COALESCE(post_config.hide, 0) = 0`;

const POST_SELECT = `SELECT post.id AS id,
       post.url AS slug,
       post.title AS title,
       post.subtitle AS subtitle,
       post.image AS image,
       post.read_time AS readTime,
       post.meta_description AS description,
       CAST(post.published_date AS TEXT) AS publishedDate,
       author.username AS authorUsername,
       profile.avatar AS authorAvatar,
       (SELECT COUNT(*) FROM board_post_likes AS likes WHERE likes.post_id = post.id) AS likeCount,
       (SELECT COUNT(*) FROM board_comment AS comments WHERE comments.post_id = post.id) AS commentCount,
       series.url AS seriesUrl,
       series.name AS seriesName
  FROM board_post AS post
  JOIN auth_user AS author ON author.id = post.author_id
  LEFT JOIN board_profile AS profile ON profile.user_id = author.id
  LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
  LEFT JOIN board_series AS series ON series.id = post.series_id AND COALESCE(series.hide, 0) = 0`;

export async function readCardLikes(db: PrismaClient, request: FastifyRequest, viewer: PublicPageViewer | null, posts: PostRow[]): Promise<CardLikes> {
  const liked = viewer && posts.length ? await db.$queryRaw<Array<{ postId: number }>>`
    SELECT post_id AS postId FROM board_post_likes
    WHERE user_id = ${viewer.id} AND post_id IN (${Prisma.join(posts.map((post) => post.id))})
  ` : [];
  return { csrfToken: viewer ? csrfCookie(request) : '', returnTo: request.url, likedIds: new Set(liked.map(({ postId }) => Number(postId))) };
}

export async function readFeaturedPosts(db: PrismaClient, author: AuthorRow): Promise<{ kind: 'featured' | 'recent'; posts: PostRow[] }> {
  const pinned = await db.$queryRaw<PostRow[]>`
    SELECT post.id AS id, post.url AS slug, post.title, post.subtitle, post.image,
           post.read_time AS readTime, post.meta_description AS description,
           CAST(post.published_date AS TEXT) AS publishedDate, owner.username AS authorUsername,
           owner_profile.avatar AS authorAvatar,
           (SELECT COUNT(*) FROM board_post_likes AS likes WHERE likes.post_id = post.id) AS likeCount,
           (SELECT COUNT(*) FROM board_comment AS comments WHERE comments.post_id = post.id) AS commentCount,
           series.url AS seriesUrl, series.name AS seriesName
      FROM board_pinnedpost AS pinned
      JOIN board_post AS post ON post.id = pinned.post_id
      JOIN auth_user AS owner ON owner.id = pinned.user_id
      LEFT JOIN board_profile AS owner_profile ON owner_profile.user_id = owner.id
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id AND COALESCE(series.hide, 0) = 0
     WHERE pinned.user_id = ${author.id}
       AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
       AND post.published_date <= ${databaseNow()} AND COALESCE(post_config.hide, 0) = 0
     ORDER BY pinned."order" ASC, pinned.id ASC
     LIMIT 6
  `;
  if (pinned.length) return { kind: 'featured', posts: pinned };
  const recent = await readPublicPosts(db, {
    conditions: ['post.author_id = ?'],
    parameters: [author.id],
    orderBy: 'post.published_date DESC, post.id DESC',
    limit: 6,
  });
  return { kind: 'recent', posts: recent };
}

export async function readPublicPostCount(
  db: PrismaClient,
  conditions: string[] = [],
  parameters: SqlValue[] = [],
): Promise<number> {
  const sql = `SELECT COUNT(*) AS count FROM board_post AS post
    LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
    WHERE ${PUBLIC_POST_WHERE}${conditions.length ? ` AND ${conditions.join(' AND ')}` : ''}`;
  const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(sql, databaseNow(), ...parameters);
  return Number(rows[0]?.count ?? 0);
}

export async function readPublicPosts(db: PrismaClient, options: PostQueryOptions = {}): Promise<PostRow[]> {
  const conditions = options.conditions ?? [];
  const parameters = options.parameters ?? [];
  const sql = `${POST_SELECT}
    WHERE ${PUBLIC_POST_WHERE}${conditions.length ? ` AND ${conditions.join(' AND ')}` : ''}
    ORDER BY ${options.orderBy ?? 'post.published_date DESC, post.id DESC'}
    LIMIT ? OFFSET ?`;
  return db.$queryRawUnsafe<PostRow[]>(
    sql,
    databaseNow(),
    ...parameters,
    ...(options.orderParameters ?? []),
    options.limit ?? PAGE_SIZE,
    options.offset ?? 0,
  );
}

export function rawPublicPostWhere(postAlias: string, configAlias: string): string {
  return `${postAlias}.deleted_date IS NULL
    AND ${postAlias}.published_date IS NOT NULL
    AND ${postAlias}.published_date <= '${databaseNow()}'
    AND COALESCE(${configAlias}.hide, 0) = 0`;
}

interface SearchCte {
  sql: string;
  parameters: SqlValue[];
}

export function searchCte(keywords: string[], username: string): SearchCte {
  const match = (column: string) => keywords.map(() => `${column} LIKE ? ESCAPE '\\'`).join(' OR ');
  const titlePattern = match('post.title');
  const descriptionPattern = match('post.meta_description');
  const tagPattern = match('tag.value');
  const contentPattern = match('content.content_html');
  const patterns = keywords.map((keyword) => `%${keyword.replace(/[\\%_]/g, '\\$&')}%`);
  const usernameWhere = username ? 'AND author.username = ?' : '';
  const parameters: SqlValue[] = [
    ...patterns,
    ...patterns,
    ...patterns,
    ...patterns,
    databaseNow(),
    ...(username ? [username] : []),
  ];
  const sql = `WITH matched AS (
    SELECT post.id, post.url AS slug, post.title, post.subtitle, post.image,
           post.read_time AS readTime, post.meta_description AS description,
           CAST(post.published_date AS TEXT) AS publishedDate, author.username AS authorUsername,
           profile.avatar AS authorAvatar, series.url AS seriesUrl, series.name AS seriesName,
           CASE WHEN ${titlePattern} THEN 100 ELSE 0 END AS titleScore,
           CASE WHEN ${descriptionPattern} THEN 40 ELSE 0 END AS descriptionScore,
           CASE WHEN EXISTS (SELECT 1 FROM board_post_tags AS post_tag
             JOIN board_tag AS tag ON tag.id = post_tag.tag_id
            WHERE post_tag.post_id = post.id AND (${tagPattern})) THEN 30 ELSE 0 END AS tagScore,
           CASE WHEN EXISTS (SELECT 1 FROM board_postcontent AS content
            WHERE content.post_id = post.id AND (${contentPattern})) THEN 10 ELSE 0 END AS contentScore
      FROM board_post AS post
      JOIN auth_user AS author ON author.id = post.author_id
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
      LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
      LEFT JOIN board_series AS series ON series.id = post.series_id
     WHERE ${PUBLIC_POST_WHERE} ${usernameWhere}
  ), scored AS (
    SELECT *, titleScore + descriptionScore + tagScore + contentScore AS relevance
      FROM matched
  )`;
  return { sql, parameters };
}
