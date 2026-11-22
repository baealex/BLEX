import { renderApplicationDocument } from '../../application/document.js';
import formBody from '@fastify/formbody';
import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { authCookieOptions, csrfCookie, requestCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput } from '../../platform/csrf.js';
import { createToken } from '../auth/session.js';
import { publicPostPath } from './public-post.js';
import { done, messageFailure as failure } from '../../platform/response.js';

interface ShareOptions {
  currentUser: (request: FastifyRequest) => Promise<{ id: number; username: string; hasEditorRole: boolean } | null>;
  validateCsrf: (request: FastifyRequest) => boolean;
  siteUrl: URL;
  writable: boolean;
}

interface PostParameters { username: string; slug: string; linkId?: string }
const previewClients = /facebookexternalhit|facebot|discordbot|slackbot|telegrambot|twitterbot|linkedinbot|kakaotalk-scrap|skypeuripreview|googlebot|bingbot|applebot|yeti/i;
const alphabet = '23456789abcdefghjkmnpqrstvwxyz';
const labelLimit = 100;

function dayAt(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TZ || 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(date);
}

function dateValue(now = new Date()) { return now.toISOString().slice(0, -1).replace('T', ' '); }
function label(value: unknown) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned && [...cleaned].length <= labelLimit ? cleaned : null;
}

async function managedPost(db: PrismaClient, userId: number, parameters: PostParameters) {
  const [post] = await db.$queryRaw<Array<{ id: number; title: string; canCreate: number | bigint }>>`
    SELECT post.id, post.title, CASE WHEN post.published_date <= ${dateValue()} AND post.deleted_date IS NULL AND config.hide = 0
      THEN 1 ELSE 0 END AS canCreate
    FROM board_post AS post JOIN auth_user AS author ON author.id = post.author_id
    LEFT JOIN board_postconfig AS config ON config.post_id = post.id
    WHERE post.author_id = ${userId} AND author.username = ${parameters.username} AND post.url = ${parameters.slug}
      AND post.published_date IS NOT NULL AND post.deleted_date IS NULL
  `;
  return post || null;
}

async function listLinks(db: PrismaClient, postId: number, siteUrl: URL) {
  const today = dayAt();
  const weekAgo = dayAt(new Date(Date.now() - 6 * 86_400_000));
  const rows = await db.$queryRaw<Array<{ id: number; label: string; token: string; paused: bigint; recent: bigint; total: bigint }>>`
    SELECT link.id, link.label, link.token, link.is_paused AS paused,
      COALESCE(SUM(CASE WHEN stats.day BETWEEN ${weekAgo} AND ${today} THEN stats.clicks ELSE 0 END), 0) AS recent,
      COALESCE(SUM(stats.clicks), 0) AS total
    FROM board_postsharelink AS link LEFT JOIN board_post_share_link_daily_counts AS stats ON stats.link_id = link.id
    WHERE link.post_id = ${postId} GROUP BY link.id ORDER BY link.created_date DESC, link.id DESC
  `;
  return rows.map((row) => ({ id: row.id, label: row.label, url: new URL(`/r/${encodeURIComponent(row.token)}`, siteUrl).href,
    isPaused: Boolean(row.paused), recentClicks: Number(row.recent), totalClicks: Number(row.total) }));
}

async function createLink(db: PrismaClient, postId: number, authorId: number, name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const [link] = await db.$queryRaw<Array<{ id: number }>>`
      INSERT INTO board_postsharelink (token, label, is_paused, created_date, post_id)
      SELECT ${token}, ${name}, 0, ${dateValue()}, post.id FROM board_post AS post
        JOIN board_postconfig AS config ON config.post_id = post.id AND config.hide = 0
       WHERE post.id = ${postId} AND post.author_id = ${authorId} AND post.deleted_date IS NULL
        AND post.published_date <= ${dateValue()}
      ON CONFLICT(token) DO NOTHING RETURNING id
    `;
    if (link) return link.id;
  }
  return null;
}

function sharePage(postPath: string, title: string, csrf: string, create: boolean, links: Awaited<ReturnType<typeof listLinks>>, error = '') {
  const action = `${postPath}/share-links`;
  return renderApplicationDocument(<html lang="ko"><head>
      <meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" /><title>공유 링크 · {title}</title>
      <style>{'body{margin:3rem auto;max-width:43rem;padding:0 1rem;font:1rem/1.6 system-ui}li{margin:1.25rem 0}a{overflow-wrap:anywhere}input,button{font:inherit;margin:.25rem}'}</style>
    </head><body><main>
      <a href={postPath}>글로 돌아가기</a><h1>공유 링크</h1><p>{title}</p>
      {error && <p role="alert">{error}</p>}
      {create && <form method="post" action={action}>
        <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
        <label>링크 이름 <input name="label" maxLength={labelLimit} required /></label>
        <button type="submit">링크 만들기</button>
      </form>}
      {links.length > 0 && <ul>{links.map((link) => <li key={link.id}>
        <a href={link.url}>{link.url}</a>
        <p>최근 7일 {link.recentClicks}회 · 전체 {link.totalClicks}회</p>
        <form method="post" action={action}>
          <input type="hidden" name="csrfmiddlewaretoken" value={csrf} /><input type="hidden" name="id" value={link.id} />
          <label>링크 이름 <input name="label" maxLength={labelLimit} defaultValue={link.label} required /></label>
          <label><input name="is_paused" type="checkbox" value="true" defaultChecked={link.isPaused} /> 일시 정지</label>
          <button type="submit">저장</button>
        </form>
      </li>)}</ul>}
    </main></body></html>);
}

export function registerPostShare(app: FastifyInstance, db: PrismaClient, options: ShareOptions) {
  app.get<{ Params: { token: string } }>('/r/:token', async (request, reply) => {
    reply.header('Cache-Control', 'private, no-store');
    if (!/^[\w-]{1,22}$/.test(request.params.token)) return reply.code(404).send('Not found');
    const [result] = await db.$queryRaw<Array<{ id: number; username: string; slug: string }>>`
      SELECT link.id, author.username, post.url AS slug FROM board_postsharelink AS link
      JOIN board_post AS post ON post.id = link.post_id JOIN board_postconfig AS config ON config.post_id = post.id
      JOIN auth_user AS author ON author.id = post.author_id
      WHERE link.token = ${request.params.token} AND link.is_paused = 0 AND config.hide = 0
        AND post.published_date <= ${dateValue()} AND post.deleted_date IS NULL
    `;
    if (!result) return reply.code(404).send('Not found');
    const preview = /prefetch/i.test(`${request.headers['sec-purpose']} ${request.headers.purpose}`) || previewClients.test(request.headers['user-agent'] ?? '');
    if (options.writable && request.method === 'GET' && !preview) {
      try {
        await db.$executeRaw`
          INSERT INTO board_post_share_link_daily_counts (link_id, day, clicks) VALUES (${result.id}, ${dayAt()}, 1)
          ON CONFLICT (link_id, day) DO UPDATE SET clicks = clicks + 1
        `;
      } catch {
        request.log.warn('Could not count a share link visit');
      }
    }
    return reply.redirect(publicPostPath(result.username, result.slug), 302);
  });

  if (!options.writable) return;
  app.register(async (routes) => {
    await routes.register(formBody);
    const apiPath = '/v1/users/@:username/posts/:slug/share-links';
    const htmlPath = '/@:username/:slug/share-links';
    const manage = async (request: FastifyRequest<{ Params: PostParameters }>, reply: FastifyReply) => {
      reply.header('Cache-Control', 'private, no-store');
      const html = !request.url.startsWith('/v1/');
      const user = await options.currentUser(request);
      if (!user) return html ? reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302) : failure('NL');
      if (!user.hasEditorRole) return html ? reply.code(404).send('Not found') : failure('AT');
      const post = await managedPost(db, user.id, request.params);
      if (!post) return reply.code(404).send('Not found');
      const path = publicPostPath(request.params.username, request.params.slug);
      const sendPage = async (error?: string) => {
        const stored = requestCookies(request)[csrfCookie] ?? '';
        const csrf = csrfPattern.test(stored) ? stored : createToken();
        if (csrf !== stored) reply.setCookie(csrfCookie, csrf, authCookieOptions(options.siteUrl));
        return reply.type('text/html; charset=utf-8').send(sharePage(path, post.title, csrf, Boolean(post.canCreate), await listLinks(db, post.id, options.siteUrl), error));
      };
      if (request.method === 'GET') return html ? sendPage() : done({ links: await listLinks(db, post.id, options.siteUrl), canCreate: Boolean(post.canCreate) });
      if (!options.validateCsrf(request)) return reply.code(403).send(failure('RJ'));
      const input = formInput(request);
      const linkId = request.params.linkId ?? (html ? input.id : undefined);
      const editing = request.method === 'PATCH' || linkId !== undefined;
      const name = label(input.label);
      const hasLabel = Object.hasOwn(input, 'label');
      const hasPause = Object.hasOwn(input, 'is_paused');
      if ((!editing || hasLabel) && !name) {
        const message = `공유 링크 이름을 ${labelLimit}자 이하로 입력해 주세요.`;
        return html ? sendPage(message) : failure('VA', message, 'post_share_links.invalid_label', { limit: labelLimit });
      }
      if (!html && (Object.keys(input).some((key) => key !== 'label' && !(editing && key === 'is_paused')) ||
          (editing && !hasLabel && !hasPause) || (hasPause && typeof input.is_paused !== 'boolean'))) return failure('VA', '올바른 요청이 아닙니다.');
      if (!editing) {
        const id = post.canCreate && name ? await createLink(db, post.id, user.id, name) : null;
        if (!id) return html ? sendPage('공개 글에만 공유 링크를 만들 수 있습니다.') :
          failure('RJ', '공개 글에만 공유 링크를 만들 수 있습니다.', 'post_share_links.public_post_required');
        return html ? reply.redirect(`${path}/share-links`, 303) : done({ id });
      }
      if (typeof linkId !== 'string' || !/^\d+$/.test(linkId) || !Number.isSafeInteger(Number(linkId))) return reply.code(404).send('Not found');
      const paused = html || hasPause ? Number(input.is_paused === true || input.is_paused === 'true') : null;
      const changed = await db.$executeRaw`
        UPDATE board_postsharelink SET label = COALESCE(${name}, label), is_paused = COALESCE(${paused}, is_paused)
        WHERE id = ${Number(linkId)} AND post_id = ${post.id}
      `;
      if (!changed) return reply.code(404).send('Not found');
      return html ? reply.redirect(`${path}/share-links`, 303) : done();
    };
    routes.route<{ Params: PostParameters }>({ method: ['GET', 'POST'], url: apiPath, handler: manage });
    routes.route<{ Params: PostParameters }>({ method: 'PATCH', url: `${apiPath}/:linkId`, handler: manage });
    routes.route<{ Params: PostParameters }>({ method: ['GET', 'POST'], url: htmlPath, handler: manage });
  });
}
