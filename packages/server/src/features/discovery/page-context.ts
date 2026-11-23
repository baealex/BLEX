import type { FastifyReply, FastifyRequest } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import type { NoticeRow, PublicPageOptions, PublicPageViewer, SiteBrand } from './shared.js';
import { makeAbsolute } from './shared.js';

export function authorFeed(siteUrl: URL, username: string) {
  return { url: makeAbsolute(siteUrl, `/rss/@${encodeURIComponent(username)}`), title: `${username} RSS` };
}

/** Sends the agent discovery headers and returns the Markdown URL when AEO is enabled. */
export async function advertiseMarkdown(
  reply: FastifyReply,
  db: PrismaClient,
  siteUrl: URL,
  path: string,
): Promise<string | undefined> {
  const site = await db.siteSetting.findUnique({ where: { id: 1 }, select: { aeoEnabled: true } });
  if (!site?.aeoEnabled) return undefined;
  const markdown = makeAbsolute(siteUrl, `${path}.md`);
  const llms = makeAbsolute(siteUrl, '/llms.txt');
  reply
    .header('Link', `<${markdown}>; rel="alternate"; type="text/markdown", <${llms}>; rel="llms-txt"`)
    .header('X-Llms-Txt', llms);
  return markdown;
}

export function renderHtml(reply: FastifyReply, html: string): FastifyReply {
  return reply
    .type('text/html; charset=utf-8')
    .header(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self' https:; media-src 'self' https:; frame-src https://youtube.com https://www.youtube.com https://youtube-nocookie.com https://www.youtube-nocookie.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    )
    .send(html);
}

export async function getLayoutContext(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: PublicPageOptions,
): Promise<{ brand: SiteBrand; siteName: string; viewer: PublicPageViewer | null }> {
  const [brand, viewer] = await Promise.all([readPublicSiteBrand(db), readViewer(request, reply, options)]);
  return { brand, siteName: brand.siteName, viewer };
}

function manifestFaviconPath(manifest: unknown): string | null {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return null;
  const ico = (manifest as { ico?: unknown }).ico;
  return typeof ico === 'string' ? ico : null;
}

function safeStoredMediaUrl(path: string | null): string | null {
  const value = path?.trim() ?? '';
  if (!value || value.startsWith('/') || value.includes('\\') || /[\x00-\x20\x7f]/.test(value)) return null;
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) return null;
  return `/resources/media/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}

export async function readPublicSiteBrand(db: PrismaClient): Promise<SiteBrand> {
  const [setting, footerPages] = await Promise.all([
    db.siteSetting.findUnique({
      where: { id: 1 },
      select: { siteName: true, logoSvg: true, logoSvgDark: true, iconManifest: true, seoEnabled: true },
    }),
    db.staticPage.findMany({
      where: { isPublished: true, showInFooter: true },
      orderBy: [{ order: 'asc' }, { slug: 'asc' }],
      select: { title: true, slug: true },
    }),
  ]);
  return {
    siteName: setting?.siteName.trim() || 'BLEX',
    logoUrl: safeStoredMediaUrl(setting?.logoSvg ?? null),
    darkLogoUrl: safeStoredMediaUrl(setting?.logoSvgDark ?? null),
    faviconUrl: safeStoredMediaUrl(manifestFaviconPath(setting?.iconManifest)) ?? '/favicon.ico',
    seoEnabled: setting?.seoEnabled ?? true,
    footerPages,
  };
}

export async function readNotices(db: PrismaClient, scope: 'global' | 'user', userId?: number): Promise<NoticeRow[]> {
  if (scope === 'user') {
    if (!userId) return [];
    return db.siteNotice.findMany({
      where: { scope: 'user', userId, isActive: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, title: true, url: true },
    });
  }
  return db.siteNotice.findMany({
    where: { scope: 'global', isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, url: true },
  });
}

export async function readViewer(
  request: FastifyRequest,
  reply: FastifyReply,
  options: PublicPageOptions,
): Promise<PublicPageViewer | null> {
  const viewer = (await options.currentUser?.(request)) ?? null;
  if (viewer) reply.header('Cache-Control', 'private, no-store').header('Vary', 'Cookie');
  return viewer;
}

export function csrfCookie(request: FastifyRequest): string {
  const entry = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('csrftoken='));
  const value = entry?.slice('csrftoken='.length) ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
