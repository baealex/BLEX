import { renderApplicationDocument } from './application/document.js';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { toIsoDateTime } from './developer-api/index.js';
import { sanitizePostHtml } from './post-html.js';
import { publicPostPath } from './posts.js';

interface ActivityOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number } | null>;
  siteUrl: URL;
}

const timeZone = process.env.TZ || 'Asia/Seoul';
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone, dateStyle: 'long' });
const relative = new Intl.RelativeTimeFormat('ko', { numeric: 'always' });

function done(body: object = {}) { return { status: 'DONE', body }; }
function failure(code: string) { return { status: 'ERROR', errorCode: `error:${code}`, errorMessage: '' }; }
function timestamp(date: Date) { return date.toISOString().slice(0, -1).replace('T', ' '); }
function storedDate(value: string) { return new Date(toIsoDateTime(value) ?? ''); }
function since(value: string) {
  const date = storedDate(value);
  const age = Math.max(0, (Date.now() - date.getTime()) / 60_000);
  if (!Number.isFinite(age)) return '';
  if (age > 525_600) return dateLabel.format(date);
  if (age >= 43_200) return relative.format(-Math.floor(age / 43_200), 'month');
  if (age >= 10_080) return relative.format(-Math.floor(age / 10_080), 'week');
  if (age >= 1_440) return relative.format(-Math.floor(age / 1_440), 'day');
  if (age >= 60) return relative.format(-Math.floor(age / 60), 'hour');
  return relative.format(-Math.floor(age), 'minute');
}

async function heatmap(db: PrismaClient, userId: number, own: boolean) {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86_400_000);
  // Include both boundary days before applying the site's calendar time zone.
  const lower = timestamp(new Date(start.getTime() - 2 * 86_400_000));
  const upper = timestamp(new Date(end.getTime() + 2 * 86_400_000));
  const now = timestamp(end);
  const rows = await db.$queryRaw<Array<{ date: string }>>`
    WITH eligible AS (
      SELECT post.id, post.author_id, post.published_date FROM board_post AS post
        LEFT JOIN board_postconfig AS config ON config.post_id = post.id
       WHERE post.deleted_date IS NULL AND (${own ? 1 : 0} = 1 OR (post.published_date <= ${now} AND config.hide = 0))
    ), entries AS (
      SELECT published_date AS date FROM eligible WHERE author_id = ${userId}
      UNION ALL SELECT comment.created_date AS date FROM board_comment AS comment JOIN eligible AS post ON post.id = comment.post_id
        WHERE comment.author_id = ${userId}
      UNION ALL SELECT likes.created_date AS date FROM board_post_likes AS likes JOIN eligible AS post ON post.id = likes.post_id
        WHERE likes.user_id = ${userId}
    ) SELECT CAST(date AS TEXT) AS date FROM entries WHERE date BETWEEN ${lower} AND ${upper}
  `;
  const minDay = dateFormat.format(start);
  const maxDay = dateFormat.format(end);
  const days: Record<string, number> = {};
  for (const { date } of rows) {
    const parsed = storedDate(date);
    if (!Number.isFinite(parsed.getTime())) continue;
    const day = dateFormat.format(parsed);
    if (day >= minDay && day <= maxDay) days[day] = (days[day] ?? 0) + 1;
  }
  return days;
}

export interface RelatedPost { slug: string; title: string; image: string; description: string; readTime: number; published: string; username: string; name: string; avatar: string }

export async function relatedPosts(db: PrismaClient, sourceId: number, sourceAuthor: number) {
  const now = timestamp(new Date());
  return db.$queryRaw<RelatedPost[]>`
    WITH source_tags AS (SELECT tag_id FROM board_post_tags WHERE post_id = ${sourceId}),
    shared AS (
      SELECT post_id, COUNT(DISTINCT tag_id) AS overlap FROM board_post_tags
      WHERE tag_id IN (SELECT tag_id FROM source_tags) AND post_id <> ${sourceId} GROUP BY post_id
    ), ranked AS (
      SELECT post.id, post.url AS slug, post.title, post.image, post.meta_description AS description,
        post.read_time AS readTime, CAST(post.published_date AS TEXT) AS published, author.username,
        author.first_name AS name, profile.avatar, shared.overlap, MIN(shared.overlap * 3, 10) AS tagScore,
        CAST(shared.overlap AS REAL) / ((SELECT COUNT(*) FROM source_tags) +
          (SELECT COUNT(*) FROM board_post_tags WHERE post_id = post.id) - shared.overlap) AS similarity,
        post.author_id = ${sourceAuthor} AS sameAuthor,
        MIN((SELECT COUNT(*) FROM board_post_likes WHERE post_id = post.id) * 2 +
            (SELECT COUNT(*) FROM board_comment WHERE post_id = post.id), 10) +
         CASE WHEN julianday(${now}) - julianday(post.published_date) < 7 THEN 5
              WHEN julianday(${now}) - julianday(post.published_date) < 30 THEN 3
              WHEN julianday(${now}) - julianday(post.published_date) < 90 THEN 1 ELSE 0 END AS quality
      FROM shared JOIN board_post AS post ON post.id = shared.post_id
      JOIN board_postconfig AS config ON config.post_id = post.id AND config.hide = 0
      JOIN auth_user AS author ON author.id = post.author_id LEFT JOIN board_profile AS profile ON profile.user_id = author.id
      WHERE post.published_date <= ${now} AND post.deleted_date IS NULL
    ) SELECT * FROM ranked ORDER BY tagScore DESC, overlap DESC, similarity DESC, sameAuthor, quality DESC, published DESC, id DESC LIMIT 8
  `;
}

export function registerPublicActivity(app: FastifyInstance, db: PrismaClient, options: ActivityOptions) {
  app.get<{ Params: { username: string } }>('/v1/users/@:username/check-redirect', async (request, reply) => {
    const [changed] = await db.$queryRaw<Array<{ newUsername: string; date: string }>>`
      SELECT account.username AS newUsername, CAST(log.created_date AS TEXT) AS date
      FROM board_usernamechangelog AS log JOIN auth_user AS account ON account.id = log.user_id
      WHERE log.username = ${request.params.username} ORDER BY log.id LIMIT 1
    `;
    if (!changed) return reply.code(404).send('Not found');
    return done({ oldUsername: request.params.username, newUsername: changed.newUsername, createdDate: dateLabel.format(storedDate(changed.date)) });
  });
  app.get<{ Params: { username: string } }>('/v1/users/@:username/heatmap', async (request, reply) => {
    const account = await db.user.findUnique({ where: { username: request.params.username }, select: { id: true } });
    return account ? done(await heatmap(db, account.id, false)) : reply.code(404).send('Not found');
  });
  app.get('/v1/setting/heatmap', async (request) => {
    const user = await options.currentUser(request);
    return user ? done(await heatmap(db, user.id, true)) : failure('NL');
  });
  app.get('/v1/comments/user', async (request, reply) => {
    const user = await options.currentUser(request);
    if (!user) return failure('NL');
    const page = Number(new URL(request.url, options.siteUrl).searchParams.get('page') || '1');
    if (!Number.isSafeInteger(page) || page < 1) return reply.code(404).send('Not found');
    const [count] = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count FROM board_comment AS comment JOIN board_post AS post ON post.id = comment.post_id
       WHERE comment.author_id = ${user.id} AND post.deleted_date IS NULL
    `;
    const lastPage = Math.max(1, Math.ceil(Number(count.count) / 10));
    if (page > lastPage) return reply.code(404).send('Not found');
    const rows = await db.$queryRaw<Array<{ author: string; title: string; url: string; content: string; date: string }>>`
      SELECT account.username AS author, post.title, post.url, comment.text_html AS content, CAST(comment.created_date AS TEXT) AS date
        FROM board_comment AS comment JOIN board_post AS post ON post.id = comment.post_id
        JOIN auth_user AS account ON account.id = post.author_id
       WHERE comment.author_id = ${user.id} AND post.deleted_date IS NULL ORDER BY comment.created_date DESC, comment.id DESC
       LIMIT 10 OFFSET ${(page - 1) * 10}
    `;
    return done({ comments: rows.map((row) => ({ posts: { author: row.author, title: row.title, url: row.url },
      content: sanitizePostHtml(row.content), createdDate: since(row.date) })), lastPage });
  });

  type PostRoute = { Params: { username: string; slug: string } };
  for (const route of ['/v1/users/@:username/posts/:slug/related', '/@:username/:slug/related']) {
    app.get<PostRoute>(route, async (request, reply) => {
      const { username, slug } = request.params;
      const viewer = await options.currentUser(request);
      const [source] = await db.$queryRaw<Array<{ id: number; username: string; title: string; author: number }>>`
        SELECT post.id, account.username, post.title, account.id AS author FROM board_post AS post
         JOIN auth_user AS account ON account.id = post.author_id LEFT JOIN board_postconfig AS config ON config.post_id = post.id
        WHERE account.username = ${username} AND post.url = ${slug} AND post.deleted_date IS NULL
          AND (post.author_id = ${viewer?.id ?? -1} OR (post.published_date <= ${timestamp(new Date())} AND config.hide = 0))
      `;
      if (!source) return reply.code(404).send('Not found');
      const items = await relatedPosts(db, source.id, source.author);
      reply.header('Cache-Control', 'private, no-store');
      if (route.startsWith('/v1/')) return done({ posts: items.map((item) => ({
        url: item.slug, title: item.title, image: item.image || null, metaDescription: item.description, readTime: item.readTime,
        publishedDate: since(item.published), publishedDateIso: dateFormat.format(storedDate(item.published)), publishedAt: toIsoDateTime(item.published),
        authorUsername: item.username, authorName: item.name, authorImage: item.avatar || null,
      })) });
      return reply.type('text/html; charset=utf-8').send(renderApplicationDocument(<html lang="ko"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,follow" /><title>관련 글 · {source.title}</title>
          <style>{'body{margin:3rem auto;max-width:44rem;padding:0 1rem;font:1rem/1.65 system-ui}li{margin:1rem 0}'}</style>
        </head><body><main><a href={publicPostPath(username, slug)}>글로 돌아가기</a><h1>관련 글</h1>
          {items.length ? <ul>{items.map((item) => <li key={item.slug}>
            <a href={publicPostPath(item.username, item.slug)}>{item.title}</a><p>{item.description}</p>
          </li>)}</ul> : <p>공통 태그가 붙은 글이 없습니다.</p>}
        </main></body></html>));
    });
  }
}
