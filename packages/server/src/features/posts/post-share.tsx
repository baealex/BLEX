import { renderApplicationDocument } from '../../application/document.js';
import formBody from '@fastify/formbody';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomInt } from 'node:crypto';
import { authCookieOptions, csrfCookie, requestCookies } from '../../platform/cookies.js';
import { csrfPattern, formInput } from '../../platform/csrf.js';
import { createToken } from '../auth/session.js';
import { settledPublicPostWhere } from './data/visibility.js';
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

function label(value: unknown) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  return cleaned && [...cleaned].length <= labelLimit ? cleaned : null;
}

/** Daily counts are keyed by the site's calendar day, stored as midnight UTC of that label. */
function storedDay(label: string) { return new Date(`${label}T00:00:00.000Z`); }

async function managedPost(db: PrismaClient, userId: number, parameters: PostParameters) {
  const post = await db.post.findFirst({
    where: {
      authorId: userId, author: { username: parameters.username }, slug: parameters.slug,
      publishedAt: { not: null }, deletedAt: null,
    },
    select: { id: true, title: true, publishedAt: true, isHidden: true, hasSettings: true },
  });
  if (!post) return null;
  return { id: post.id, title: post.title, canCreate: post.publishedAt! <= new Date() && !post.isHidden && post.hasSettings };
}

async function listLinks(db: PrismaClient, postId: number, siteUrl: URL) {
  const today = storedDay(dayAt());
  const weekAgo = storedDay(dayAt(new Date(Date.now() - 6 * 86_400_000)));
  const links = await db.postShareLink.findMany({
    where: { postId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, label: true, token: true, isPaused: true },
  });
  const linkIds = links.map(({ id }) => id);
  const [totals, recents] = await Promise.all([
    db.postShareDailyCount.groupBy({ by: ['linkId'], where: { linkId: { in: linkIds } }, _sum: { clicks: true } }),
    db.postShareDailyCount.groupBy({ by: ['linkId'], where: { linkId: { in: linkIds }, day: { gte: weekAgo, lte: today } }, _sum: { clicks: true } }),
  ]);
  const clicks = (rows: typeof totals) => new Map(rows.map((row) => [row.linkId, row._sum.clicks ?? 0]));
  const [total, recent] = [clicks(totals), clicks(recents)];
  return links.map((link) => ({ id: link.id, label: link.label, url: new URL(`/r/${encodeURIComponent(link.token)}`, siteUrl).href,
    isPaused: link.isPaused, recentClicks: recent.get(link.id) ?? 0, totalClicks: total.get(link.id) ?? 0 }));
}

async function createLink(db: PrismaClient, postId: number, authorId: number, name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    try {
      const link = await db.$transaction(async (tx) => {
        const post = await tx.post.findFirst({ where: { id: postId, authorId, ...settledPublicPostWhere() }, select: { id: true } });
        return post && tx.postShareLink.create({ data: { token, label: name, postId: post.id, createdAt: new Date() }, select: { id: true } });
      });
      return link?.id ?? null;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
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
    const result = await db.postShareLink.findFirst({
      where: { token: request.params.token, isPaused: false, post: settledPublicPostWhere() },
      select: { id: true, post: { select: { slug: true, author: { select: { username: true } } } } },
    });
    if (!result) return reply.code(404).send('Not found');
    const preview = /prefetch/i.test(`${request.headers['sec-purpose']} ${request.headers.purpose}`) || previewClients.test(request.headers['user-agent'] ?? '');
    if (options.writable && request.method === 'GET' && !preview) {
      try {
        const day = storedDay(dayAt());
        await db.postShareDailyCount.upsert({
          where: { linkId_day: { linkId: result.id, day } },
          create: { linkId: result.id, day, clicks: 1 },
          update: { clicks: { increment: 1 } },
        });
      } catch {
        request.log.warn('Could not count a share link visit');
      }
    }
    return reply.redirect(publicPostPath(result.post.author.username, result.post.slug), 302);
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
      const isPaused = html || hasPause ? input.is_paused === true || input.is_paused === 'true' : undefined;
      const { count } = await db.postShareLink.updateMany({
        where: { id: Number(linkId), postId: post.id },
        data: { ...(name ? { label: name } : {}), ...(isPaused === undefined ? {} : { isPaused }) },
      });
      if (!count) return reply.code(404).send('Not found');
      return html ? reply.redirect(`${path}/share-links`, 303) : done();
    };
    routes.route<{ Params: PostParameters }>({ method: ['GET', 'POST'], url: apiPath, handler: manage });
    routes.route<{ Params: PostParameters }>({ method: 'PATCH', url: `${apiPath}/:linkId`, handler: manage });
    routes.route<{ Params: PostParameters }>({ method: ['GET', 'POST'], url: htmlPath, handler: manage });
  });
}
