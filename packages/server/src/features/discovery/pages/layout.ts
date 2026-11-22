import { renderApplicationDocument, scriptJson } from '../../../application/document.js';
import { type ReactNode } from 'react';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { type PrismaClient } from '@prisma/client';
import { SiteIcon } from '../../../appearance/icons.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../../../appearance/shell.js';
import { NoticeRow, PageMeta, PublicPageOptions, PublicPageViewer, SiteBrand, h, makeAbsolute } from '../shared.js';

export function PublicSiteMark({ brand, siteName, imageClass }: { brand?: SiteBrand; siteName: string; imageClass?: string }): ReactNode {
  const customLogo = brand?.logoUrl ?? brand?.darkLogoUrl;
  return h('span', { className: 'site-mark' },
    h('picture', null,
      h('source', { media: '(prefers-color-scheme: dark)', srcSet: brand?.darkLogoUrl ?? customLogo ?? '/resources/logow.svg' }),
      h('img', { className: imageClass, src: customLogo ?? '/resources/logob.svg', alt: customLogo ? siteName : '' }),
    ),
    customLogo ? null : h('span', null, siteName),
  );
}

export function PublicFooterLinks({ brand }: { brand?: SiteBrand }): ReactNode {
  return h('nav', { 'aria-label': '사이트 정보', className: 'site-footer-links' },
    ...(brand?.footerPages ?? []).map(({ slug, title }) => h('a', { key: slug, href: `/static/${encodeURIComponent(slug)}` }, title)),
    h('a', { href: '/rss' }, 'RSS'),
  );
}

export function PageLayout({ meta, children }: { meta: PageMeta; children: ReactNode }): string {
  const robots = meta.brand?.seoEnabled === false ? 'noindex,nofollow' : meta.robots;
  const structuredData = meta.structuredData
    ? h('script', { type: 'application/ld+json', dangerouslySetInnerHTML: { __html: scriptJson(meta.structuredData) } })
    : null;

  return renderApplicationDocument(h('html', { lang: 'ko' },
    h('head', null,
      h('meta', { charSet: 'utf-8' }),
      h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
      h('meta', { name: 'color-scheme', content: 'light dark' }),
      h('title', null, meta.title),
      h('meta', { name: 'description', content: meta.description }),
      h('meta', { property: 'og:type', content: 'website' }),
      h('meta', { property: 'og:title', content: meta.title }),
      h('meta', { property: 'og:description', content: meta.description }),
      h('meta', { property: 'og:url', content: meta.canonical }),
      h('meta', { name: 'twitter:card', content: 'summary' }),
      h('meta', { name: 'twitter:title', content: meta.title }),
      h('meta', { name: 'twitter:description', content: meta.description }),
      h('link', { rel: 'icon', href: meta.brand?.faviconUrl ?? '/favicon.ico' }),
      h('link', { rel: 'canonical', href: meta.canonical }),
      meta.markdownUrl ? h('link', { rel: 'alternate', type: 'text/markdown', href: meta.markdownUrl }) : null,
      meta.brand?.seoEnabled === false ? null : h('link', {
        rel: 'alternate', type: 'application/rss+xml', title: `${meta.siteName} RSS`, href: new URL('/rss', meta.canonical).href,
      }),
      meta.brand?.seoEnabled !== false && meta.authorFeed
        ? h('link', { rel: 'alternate', type: 'application/rss+xml', title: meta.authorFeed.title, href: meta.authorFeed.url })
        : null,
      robots ? h('meta', { name: 'robots', content: robots }) : null,
      robots ? h('meta', { name: 'googlebot', content: robots }) : null,
      meta.previous ? h('link', { rel: 'prev', href: meta.previous }) : null,
      meta.next ? h('link', { rel: 'next', href: meta.next }) : null,
      h(SiteTheme),
      structuredData,
    ),
    h('body', null,
      h(SiteHeader, { brand: meta.brand, viewer: meta.viewer, searchPage: meta.searchPage }),
      h('main', null, children),
      h(SiteFooter, { brand: meta.brand }),
    ),
  ));
}

export function authorFeed(siteUrl: URL, username: string) {
  return { url: makeAbsolute(siteUrl, `/rss/@${encodeURIComponent(username)}`), title: `${username} RSS` };
}

/** Sends the agent discovery headers and returns the Markdown URL when AEO is enabled. */
export async function advertiseMarkdown(reply: FastifyReply, db: PrismaClient, siteUrl: URL, path: string): Promise<string | undefined> {
  const site = await db.siteSetting.findUnique({ where: { id: 1 }, select: { aeoEnabled: true } });
  if (!site?.aeoEnabled) return undefined;
  const markdown = makeAbsolute(siteUrl, `${path}.md`);
  const llms = makeAbsolute(siteUrl, '/llms.txt');
  reply.header('Link', `<${markdown}>; rel="alternate"; type="text/markdown", <${llms}>; rel="llms-txt"`).header('X-Llms-Txt', llms);
  return markdown;
}

export function renderHtml(reply: FastifyReply, html: string): FastifyReply {
  return reply
    .type('text/html; charset=utf-8')
    .header('Content-Security-Policy', "default-src 'none'; img-src 'self' https:; media-src 'self' https:; frame-src https://youtube.com https://www.youtube.com https://youtube-nocookie.com https://www.youtube-nocookie.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    .send(html);
}

export async function getLayoutContext(
  request: FastifyRequest,
  reply: FastifyReply,
  db: PrismaClient,
  options: PublicPageOptions,
): Promise<{ brand: SiteBrand; siteName: string; viewer: PublicPageViewer | null }> {
  const [brand, viewer] = await Promise.all([
    readPublicSiteBrand(db),
    readViewer(request, reply, options),
  ]);
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

function noticeLink(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || /[\x00-\x20\x7f\\]/.test(candidate)) return null;
  const normalized = candidate.replace(/&(?:#0*58|#x0*3a|colon);/gi, ':')
    .replace(/&(?:#0*47|#x0*2f|sol);/gi, '/');
  if (/^\/\//.test(normalized)) return null;
  try {
    const parsed = new URL(normalized, 'https://blex.invalid');
    if (parsed.username || parsed.password) return null;
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return null;
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname) return null;
    return normalized;
  } catch {
    return null;
  }
}

export function NoticeSection({ notices, scope }: { notices: NoticeRow[]; scope: 'global' | 'user' }): ReactNode {
  if (!notices.length) return null;
  if (scope === 'global') {
    return h('section', { className: 'mb-6', 'aria-label': '사이트 공지사항', 'data-notice-carousel': '' },
      ...notices.map((notice, index) => {
        const href = noticeLink(notice.url);
        const content = h('div', { className: 'flex items-center gap-4' },
          h('div', { className: 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle text-content-secondary' },
            h(SiteIcon, { name: 'speakerphone', className: 'text-sm' }),
          ),
          h('div', { className: 'min-w-0 flex-1' },
            h('div', { className: 'mb-1.5 flex items-center gap-2' },
              h('span', { className: 'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-content-hint' }, '사이트 공지'),
              notices.length > 1 ? h('span', { className: 'text-[10px] font-medium tabular-nums text-content-hint' }, `${index + 1}/${notices.length}`) : null,
            ),
            h('h2', { className: 'truncate text-base font-semibold leading-snug text-content' }, notice.title),
          ),
          h('span', { className: 'flex size-9 shrink-0 items-center justify-center rounded-full text-content-hint' },
            h(SiteIcon, { name: 'arrow-right', className: 'text-sm' }),
          ),
        );
        const props = { className: 'group block rounded-2xl border border-line/50 bg-transparent px-5 py-4 transition-colors duration-150 hover:border-line/70 active:bg-surface-subtle/40', 'data-notice-slide': '' };
        return href ? h('a', { ...props, href, key: notice.id }, content) : h('div', { ...props, key: notice.id }, content);
      }),
      notices.length > 1 ? h('div', { className: 'mt-3 flex items-center justify-center gap-2', 'data-notice-controls': '', hidden: true },
        h('button', { type: 'button', className: 'flex size-8 items-center justify-center rounded-full text-content-hint hover:text-content-secondary', 'data-notice-step': '-1', 'aria-label': '이전 공지' },
          h(SiteIcon, { name: 'chevron-left', className: 'text-xs' }),
        ),
        h('div', { className: 'flex items-center gap-1.5' }, ...notices.map((notice, index) => h('button', {
          key: notice.id, type: 'button', className: 'blex-notice-dot h-1.5 rounded-full transition-colors duration-150', 'data-notice-index': index,
          'aria-label': `${index + 1}번째 공지 보기`, 'aria-pressed': index === 0,
        }))),
        h('button', { type: 'button', className: 'flex size-8 items-center justify-center rounded-full text-content-hint hover:text-content-secondary', 'data-notice-step': '1', 'aria-label': '다음 공지' },
          h(SiteIcon, { name: 'chevron-right', className: 'text-xs' }),
        ),
      ) : null,
    );
  }
  return h('section', { className: 'mb-14', 'aria-label': '작성자 공지사항' },
    h('div', { className: 'mb-4 flex items-end justify-between gap-4' },
      h('h2', { className: 'text-2xl font-bold tracking-tight text-content' }, '공지'),
      notices.length > 1 ? h('span', { className: 'pb-1 text-xs font-medium tabular-nums text-content-hint' }, `${notices.length}개`) : null,
    ),
    h('div', { className: 'divide-y divide-line-light border-y border-line-light' },
      ...notices.map((notice, index) => {
        const href = noticeLink(notice.url);
        const content = h('div', { className: 'flex items-center justify-between gap-4 px-1' },
          h('div', { className: 'min-w-0 flex-1' },
            h('h3', { className: 'truncate text-base font-semibold leading-snug text-content' }, notice.title),
          ),
          h('div', { className: 'flex shrink-0 items-center gap-2 text-content-hint' },
            notices.length > 1 ? h('span', { className: 'text-[11px] font-medium tabular-nums' }, `${index + 1}/${notices.length}`) : null,
            h(SiteIcon, { name: 'arrow-right', className: 'text-xs' }),
          ),
        );
        const props = { className: 'group block py-3.5 transition-colors duration-150 hover:bg-surface-subtle/50 active:bg-surface-subtle/70' };
        return href ? h('a', { ...props, href, key: notice.id }, content) : h('div', { ...props, key: notice.id }, content);
      }),
    ),
  );
}

export async function readViewer(
  request: FastifyRequest,
  reply: FastifyReply,
  options: PublicPageOptions,
): Promise<PublicPageViewer | null> {
  const viewer = await options.currentUser?.(request) ?? null;
  if (viewer) reply.header('Cache-Control', 'private, no-store').header('Vary', 'Cookie');
  return viewer;
}

export function csrfCookie(request: FastifyRequest): string {
  const entry = (request.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('csrftoken='));
  const value = entry?.slice('csrftoken='.length) ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
