import { renderApplicationDocument, scriptJson } from '../application/document.js';
import { createHash } from 'node:crypto';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { SiteIcon, type SiteIconName } from '../appearance/icons.js';
import { SiteFooter, SiteHeader, SiteTheme } from '../appearance/shell.js';
import { sanitizePostHtml } from '../post-html.js';
import { loginPromptProps } from '../reader-ui/login-prompt.js';
import { AuthorActivitySection, readAuthorActivity } from '../public-activity.js';

type SqlValue = string | number | null;
type StoredDate = string | Date;
type DatabaseInteger = number | bigint;

interface SiteSettingRow {
  siteName: string | null;
  logo: string | null;
  darkLogo: string | null;
  iconManifest: unknown;
  seoEnabled: DatabaseInteger | boolean | null;
}

export interface SiteBrand {
  siteName: string;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string;
  seoEnabled: boolean;
  footerPages: Array<{ title: string; slug: string }>;
}

interface NoticeRow {
  id: number;
  title: string;
  url: string;
}

interface SubscriptionState {
  canSubscribe: boolean;
  isSubscribed: boolean;
}

interface PostRow {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  readTime: number;
  description: string;
  publishedDate: StoredDate | null;
  authorUsername: string;
  authorAvatar: string | null;
  seriesUrl: string | null;
  seriesName: string | null;
  relevance?: number;
  likeCount?: DatabaseInteger;
  commentCount?: DatabaseInteger;
  titleScore?: DatabaseInteger;
  descriptionScore?: DatabaseInteger;
  tagScore?: DatabaseInteger;
  contentScore?: DatabaseInteger;
}

interface AuthorRow {
  id: number;
  username: string;
  firstName: string;
  isActive: DatabaseInteger | boolean;
  bio: string;
  avatar: string;
  cover: string;
  homepage: string;
  aboutHtml: string;
  aboutMarkdown: string;
  role: string;
  publicPostCount: DatabaseInteger;
  publicSeriesCount: DatabaseInteger;
}

interface TagRow {
  id: number;
  name: string;
  count: DatabaseInteger;
  image: string | null;
}

interface SeriesRow {
  id: number;
  url: string;
  name: string;
  textMarkdown: string;
  textHtml: string;
  createdDate: StoredDate;
  updatedDate: StoredDate;
  postCount: DatabaseInteger;
  thumbnail: string;
}

interface SeriesDetailRow extends SeriesRow {
  authorId: number;
  authorUsername: string;
  authorAvatar: string | null;
}

interface StaticPageRow {
  title: string;
  content: string;
  metaDescription: string;
  createdDate: StoredDate;
  updatedDate: StoredDate;
  authorUsername: string | null;
}

interface AuthorSocialLink {
  id: number;
  name: string;
  value: string;
}

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  siteName: string;
  brand?: SiteBrand;
  robots?: string;
  previous?: string;
  next?: string;
  structuredData?: Record<string, unknown>;
  viewer?: PublicPageViewer | null;
  searchPage?: boolean;
  markdownUrl?: string;
  authorFeed?: { url: string; title: string };
}

export interface PublicPageViewer {
  id: number;
  username?: string;
  hasEditorRole: boolean;
  isStaff?: boolean;
  csrfToken?: string;
  unreadCount?: number;
}

interface PostQueryOptions {
  conditions?: string[];
  parameters?: SqlValue[];
  orderBy?: string;
  orderParameters?: SqlValue[];
  limit?: number;
  offset?: number;
}

const h = createElement;
const PAGE_SIZE = 24;
const PUBLIC_POST_WHERE = `post.deleted_date IS NULL
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

function databaseNow(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function makeAbsolute(siteUrl: URL, path: string): string {
  return new URL(path, siteUrl).href;
}

function pageFrom(search: URLSearchParams): number | null {
  const raw = search.get('page');
  if (raw === null) return 1;
  if (!/^\+?\d+$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

function totalPages(count: number, size: number): number {
  return Math.max(1, Math.ceil(count / size));
}

function pageUrl(path: string, params: URLSearchParams, keys: string[], page: number): string {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== '') next.set(key, value);
  }
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

function canonicalPageUrl(siteUrl: URL, path: string, page: number): string {
  return makeAbsolute(siteUrl, page > 1 ? `${path}?page=${page}` : path);
}

function hasUnexpected(search: URLSearchParams, allowed: string[]): boolean {
  return [...search.keys()].some((key) => !allowed.includes(key));
}

function validPublicPage(reply: FastifyReply, requestedPage: number | null, count: number, pageSize: number): number | null {
  if (requestedPage === null || requestedPage > totalPages(count, pageSize)) {
    reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return null;
  }
  return requestedPage;
}

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/resources/media/${path.replace(/^\/+/, '')}`;
}

function resourceUrl(path: string): string {
  return `/resources/${path.replace(/^\/+/, '')}`;
}

function postCover(post: PostRow): string {
  if (post.image) return mediaUrl(post.image) ?? resourceUrl('assets/images/default-cover-1.jpg');
  const digest = createHash('md5').update(post.slug).digest('hex');
  const index = Number.parseInt(digest.slice(0, 8), 16) % 6 + 1;
  return resourceUrl(`assets/images/default-cover-${index}.jpg`);
}

function avatarUrl(path: string | null | undefined): string {
  return mediaUrl(path) ?? resourceUrl('assets/images/default-avatar.jpg');
}

function dateValue(value: StoredDate | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  let normalized = value.includes('T') ? value : value.replace(' ', 'T');
  if (!/(?:Z|[+-]\d\d:\d\d)$/i.test(normalized)) normalized += 'Z';
  return normalized.replace(/(\.\d{3})\d+(?=Z$)/, '$1');
}

function dateLabel(value: StoredDate | null): string {
  if (!value) return '';
  const date = new Date(dateValue(value) ?? value);
  if (!Number.isNaN(date.valueOf())) {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(date);
  }
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function plainText(raw: string): string {
  return sanitizePostHtml(raw)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function description(raw: string, fallback: string): string {
  const text = plainText(raw) || fallback;
  const characters = Array.from(text);
  return characters.length <= 160 ? text : `${characters.slice(0, 159).join('')}…`;
}

function safeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

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

function PageLayout({ meta, children }: { meta: PageMeta; children: ReactNode }): string {
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

function authorFeed(siteUrl: URL, username: string) {
  return { url: makeAbsolute(siteUrl, `/rss/@${encodeURIComponent(username)}`), title: `${username} RSS` };
}

/** Sends the agent discovery headers and returns the Markdown URL when AEO is enabled. */
async function advertiseMarkdown(reply: FastifyReply, db: PrismaClient, siteUrl: URL, path: string): Promise<string | undefined> {
  const [site] = await db.$queryRaw<Array<{ enabled: DatabaseInteger | boolean | null }>>`
    SELECT aeo_enabled AS enabled FROM board_sitesetting WHERE id = 1
  `;
  if (!site || !Number(site.enabled)) return undefined;
  const markdown = makeAbsolute(siteUrl, `${path}.md`);
  const llms = makeAbsolute(siteUrl, '/llms.txt');
  reply.header('Link', `<${markdown}>; rel="alternate"; type="text/markdown", <${llms}>; rel="llms-txt"`).header('X-Llms-Txt', llms);
  return markdown;
}

function renderHtml(reply: FastifyReply, html: string): FastifyReply {
  return reply
    .type('text/html; charset=utf-8')
    .header('Content-Security-Policy', "default-src 'none'; img-src 'self' https:; media-src 'self' https:; frame-src https://youtube.com https://www.youtube.com https://youtube-nocookie.com https://www.youtube-nocookie.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
    .send(html);
}

function postPath(post: Pick<PostRow, 'authorUsername' | 'slug'>): string {
  return `/@${encodeURIComponent(post.authorUsername)}/${encodeURIComponent(post.slug)}`;
}

interface CardLikes {
  csrfToken: string;
  returnTo: string;
  likedIds: Set<number>;
}

function PostCardLike({ post, likes }: { post: PostRow; likes?: CardLikes }): ReactNode {
  const liked = likes?.likedIds.has(post.id) ?? false;
  const count = Number(post.likeCount ?? 0);
  const className = `inline-flex h-7 min-w-[51px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300 active:scale-95 ${liked
    ? 'border-danger-line bg-danger-surface text-danger'
    : 'border-line bg-surface-elevated text-content-hint hover:border-line-strong hover:bg-surface-subtle hover:text-content-secondary'}`;
  const label = `${liked ? '좋아요 취소' : '좋아요'} (${count})`;
  const content = h(Fragment, null, h(SiteIcon, { name: 'heart' }), h('span', null, String(count)));
  if (!likes?.csrfToken) return h('a', { ...loginPromptProps(likes?.returnTo ?? postPath(post), 'like'), className, 'aria-label': label }, content);
  return h('form', { method: 'post', action: `/like/${encodeURIComponent(post.slug)}` },
    h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: likes.csrfToken }),
    h('input', { type: 'hidden', name: 'return_to', value: likes.returnTo }),
    h('button', { type: 'submit', className: `cursor-pointer ${className}`, 'aria-label': label, 'aria-pressed': liked }, content),
  );
}

function PostCard({ post, showAuthor, priority = false, likes }: { post: PostRow; showAuthor: boolean; priority?: boolean; likes?: CardLikes }): ReactNode {
  const titleHref = postPath(post);
  const authorHref = `/@${encodeURIComponent(post.authorUsername)}`;
  const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
  const series = post.seriesUrl ? h('a', {
    href: `${authorHref}/series/${encodeURIComponent(post.seriesUrl)}`,
    className: 'inline-flex max-w-32 items-center truncate rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-content transition-all duration-150 hover:bg-line-light',
  }, h(SiteIcon, { name: 'stack-2', className: 'mr-1.5' }), h('span', { className: 'truncate' }, post.seriesName ?? '시리즈')) : null;
  return h('article', { className: 'group flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]', key: post.id },
    hasImage ? h('div', { className: 'aspect-[16/9] overflow-hidden' },
      h('a', { href: titleHref, className: 'block h-full' },
        h('img', { className: 'h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105', src: mediaUrl(post.image) ?? undefined,
          alt: post.title, loading: priority ? 'eager' : 'lazy' }),
      ),
    ) : null,
    h('div', { className: 'flex flex-grow flex-col p-5' },
      h('h2', { className: 'mb-3 line-clamp-2 text-md font-bold leading-snug text-content' },
        h('a', { href: titleHref, className: 'transition-colors duration-150 hover:text-content-secondary' }, post.title),
      ),
      h('div', { className: 'mb-3 flex items-center gap-3 text-xs text-content-secondary' },
        h('div', { className: 'flex items-center gap-1.5' },
          h(SiteIcon, { name: 'calendar', className: 'text-content-hint' }),
          post.publishedDate ? h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate)) : null,
        ),
        h('div', { className: 'flex items-center gap-1.5' },
          h(SiteIcon, { name: 'clock', className: 'text-content-hint' }),
          h('span', null, `${post.readTime}분`),
        ),
      ),
      h('p', { className: `mb-4 text-sm leading-relaxed text-content-secondary ${hasImage ? 'line-clamp-3' : 'flex-grow'}` },
        h('a', { href: titleHref }, post.description || post.subtitle),
      ),
      h('footer', { className: 'mt-auto flex items-center justify-between border-t border-line-light pt-4' },
        showAuthor ? h('div', { className: 'flex min-w-0 items-center gap-2' },
          h('a', { href: authorHref, className: 'shrink-0' },
            h('img', { className: 'size-6 rounded-full object-cover ring-2 ring-line-light', src: avatarUrl(post.authorAvatar), alt: post.authorUsername, loading: 'lazy' }),
          ),
          h('a', { href: authorHref, className: 'truncate text-xs font-semibold text-content transition-colors hover:text-content-secondary' }, post.authorUsername),
        ) : series ?? h('div'),
        h('div', { className: 'flex items-center gap-4 text-content-secondary' },
          h('span', { className: 'flex items-center gap-1.5 text-xs', 'aria-label': `댓글 ${Number(post.commentCount ?? 0)}개` },
            h(SiteIcon, { name: 'message-circle' }), h('span', null, String(Number(post.commentCount ?? 0))),
          ),
          PostCardLike({ post, likes }),
        ),
      ),
    ),
  );
}

function EmptyState({
  title,
  message,
  icon = 'writing',
  framed = false,
  actionUrl,
  actionLabel,
  actionIcon,
}: {
  title: string;
  message?: string;
  icon?: SiteIconName;
  framed?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  actionIcon?: SiteIconName;
}): ReactNode {
  return h('div', { className: `py-10 text-center ${framed ? 'rounded-2xl border border-line-light bg-surface-subtle' : ''}` },
    h('div', { className: `mx-auto ${framed ? 'max-w-sm px-5' : 'max-w-sm'}` },
      icon ? h('div', { className: `mb-4 inline-flex size-12 items-center justify-center rounded-xl ${framed ? 'bg-surface-elevated' : 'bg-surface-subtle'}` },
        h(SiteIcon, { name: icon, className: 'text-lg text-content-hint' }),
      ) : null,
      h('h2', { className: 'mb-2 text-lg font-semibold text-content' }, title),
      message ? h('p', { className: `text-sm leading-relaxed text-content-secondary ${actionUrl && actionLabel ? 'mb-6' : ''}` }, message) : null,
      actionUrl && actionLabel ? h('a', { href: actionUrl, className: 'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]' },
        actionIcon ? h(SiteIcon, { name: actionIcon, className: 'text-sm' }) : null,
        h('span', null, actionLabel),
      ) : null,
    ),
  );
}

function PostGrid({
  posts,
  showAuthor = true,
  priorityFirst = true,
  className = '',
  likes,
}: { posts: PostRow[]; showAuthor?: boolean; priorityFirst?: boolean; className?: string; likes?: CardLikes }): ReactNode {
  if (!posts.length) return EmptyState({ title: '아직 공개된 포스트가 없습니다.', message: '공개된 포스트가 발행되면 이곳에 표시됩니다.' });
  return h('div', { className: `masonry-grid ${className}`.trim() },
    ...posts.map((post, index) => PostCard({ post, showAuthor, priority: priorityFirst && index === 0, likes })),
  );
}

function Pagination({
  path,
  search,
  preserve,
  page,
  pages,
  always = false,
}: {
  path: string;
  search: URLSearchParams;
  preserve: string[];
  page: number;
  pages: number;
  always?: boolean;
}): ReactNode {
  if (pages <= 1 && !always) return null;
  const item = (targetPage: number, label: string, active = false, disabled = false, rel?: string, ariaLabel?: string) =>
    h('div', { className: `pagination-item ${active ? 'pagination-active' : ''} ${disabled ? 'pagination-disabled' : ''}`.trim(), key: label },
      disabled ? h('span', { className: 'pagination-link', ...(ariaLabel ? { 'aria-label': ariaLabel } : {}) }, h(SiteIcon, { name: label as SiteIconName }))
        : h('a', { className: 'pagination-link', href: pageUrl(path, search, preserve, targetPage), rel, 'aria-label': ariaLabel },
          label.startsWith('chevron') ? h(SiteIcon, { name: label as SiteIconName }) : label,
        ),
    );
  const start = pages <= 5 ? 1 : page <= 2 ? 1 : Math.min(Math.max(1, page - 2), pages - 4);
  const end = pages <= 5 ? pages : page <= 2 ? 5 : Math.min(pages, start + 4);
  const numbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return h('nav', { className: 'pagination-nav', 'aria-label': '페이지 탐색' },
    h('div', { className: 'pagination-action prev' },
      item(1, 'chevrons-left', false, page <= 1, undefined, '첫 페이지'),
      item(page - 1, 'chevron-left', false, page <= 1, 'prev', '이전 페이지'),
    ),
    h('div', { className: 'pagination-pages' }, ...numbers.map((number) => item(number, String(number), number === page))),
    h('div', { className: 'pagination-action next' },
      item(page + 1, 'chevron-right', false, page >= pages, 'next', '다음 페이지'),
      item(pages, 'chevrons-right', false, page >= pages, undefined, '마지막 페이지'),
    ),
  );
}

async function getLayoutContext(
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

function manifestFaviconPath(value: unknown): string | null {
  let manifest = value;
  if (typeof manifest === 'string') {
    try {
      manifest = JSON.parse(manifest) as unknown;
    } catch {
      return null;
    }
  }
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
  const [[setting], footerPages] = await Promise.all([
    db.$queryRaw<SiteSettingRow[]>`
      SELECT site_name AS siteName, logo_svg AS logo, logo_svg_dark AS darkLogo,
             icon_manifest AS iconManifest, seo_enabled AS seoEnabled
        FROM board_sitesetting ORDER BY id LIMIT 1
    `,
    db.$queryRaw<Array<{ title: string; slug: string }>>`
      SELECT title, slug FROM board_staticpage
       WHERE is_published = 1 AND show_in_footer = 1 ORDER BY "order", slug
    `,
  ]);
  return {
    siteName: setting?.siteName?.trim() || 'BLEX',
    logoUrl: safeStoredMediaUrl(setting?.logo ?? null),
    darkLogoUrl: safeStoredMediaUrl(setting?.darkLogo ?? null),
    faviconUrl: safeStoredMediaUrl(manifestFaviconPath(setting?.iconManifest)) ?? '/favicon.ico',
    seoEnabled: setting?.seoEnabled === null || setting?.seoEnabled === undefined
      ? true
      : Number(setting.seoEnabled) !== 0,
    footerPages,
  };
}

async function readNotices(db: PrismaClient, scope: 'global' | 'user', userId?: number): Promise<NoticeRow[]> {
  if (scope === 'user') {
    if (!userId) return [];
    return db.$queryRaw<NoticeRow[]>`
      SELECT id, title, url FROM board_sitenotice
       WHERE scope = 'user' AND user_id = ${userId} AND is_active = 1
       ORDER BY "order" ASC, created_date DESC
    `;
  }
  return db.$queryRaw<NoticeRow[]>`
    SELECT id, title, url FROM board_sitenotice
     WHERE scope = 'global' AND is_active = 1
     ORDER BY created_date DESC
  `;
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

function NoticeSection({ notices, scope }: { notices: NoticeRow[]; scope: 'global' | 'user' }): ReactNode {
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

async function readViewer(
  request: FastifyRequest,
  reply: FastifyReply,
  options: PublicPageOptions,
): Promise<PublicPageViewer | null> {
  const viewer = await options.currentUser?.(request) ?? null;
  if (viewer) reply.header('Cache-Control', 'private, no-store').header('Vary', 'Cookie');
  return viewer;
}

function csrfCookie(request: FastifyRequest): string {
  const entry = (request.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('csrftoken='));
  const value = entry?.slice('csrftoken='.length) ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}

async function readCardLikes(db: PrismaClient, request: FastifyRequest, viewer: PublicPageViewer | null, posts: PostRow[]): Promise<CardLikes> {
  const liked = viewer && posts.length ? await db.$queryRaw<Array<{ postId: number }>>`
    SELECT post_id AS postId FROM board_post_likes
    WHERE user_id = ${viewer.id} AND post_id IN (${Prisma.join(posts.map((post) => post.id))})
  ` : [];
  return { csrfToken: viewer ? csrfCookie(request) : '', returnTo: request.url, likedIds: new Set(liked.map(({ postId }) => Number(postId))) };
}

async function subscriptionState(
  db: PrismaClient,
  author: AuthorRow,
  viewer: PublicPageViewer | null,
): Promise<SubscriptionState> {
  const canSubscribe = isEditor(author) && viewer?.id !== author.id;
  if (!canSubscribe || !viewer) return { canSubscribe, isSubscribed: false };
  const rows = await db.$queryRaw<Array<{ present: DatabaseInteger }>>`
    SELECT EXISTS (
      SELECT 1 FROM board_authorsubscription
       WHERE author_id = ${author.id} AND subscriber_id = ${viewer.id}
    ) AS present
  `;
  return { canSubscribe: true, isSubscribed: Number(rows[0]?.present ?? 0) !== 0 };
}

function subscriptionControl(
  author: AuthorRow,
  state: SubscriptionState,
  viewer: PublicPageViewer | null,
  csrfToken: string,
  path: string,
): ReactNode {
  if (!state.canSubscribe) return null;
  const subscribeLabel = `${author.username}님의 새 글 구독`;
  if (!viewer) {
    return h('a', {
      ...loginPromptProps(path, 'subscribe'),
      'aria-label': subscribeLabel,
      className: 'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]',
    }, h(SiteIcon, { name: 'bell', className: 'text-xs' }), '구독');
  }
  return h('form', { className: 'mb-0', method: 'post', action: `/v1/users/@${encodeURIComponent(author.username)}/subscription` },
    h('input', { type: 'hidden', name: 'csrfmiddlewaretoken', value: csrfToken }),
    h('input', { type: 'hidden', name: 'return_to', value: path }),
    state.isSubscribed ? h('input', { type: 'hidden', name: 'action', value: 'unsubscribe' }) : null,
    h('button', { type: 'submit', 'aria-pressed': state.isSubscribed, 'aria-label': subscribeLabel,
      className: `inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${state.isSubscribed ? 'border-line bg-surface text-content-secondary hover:border-line-strong hover:text-content' : 'border-transparent bg-action text-content-inverted hover:bg-action-hover active:scale-95'}` },
      h(SiteIcon, { name: state.isSubscribed ? 'check' : 'bell', className: 'text-xs' }),
      state.isSubscribed ? '구독 중' : '구독',
    ),
  );
}

async function readFeaturedPosts(db: PrismaClient, author: AuthorRow): Promise<{ kind: 'featured' | 'recent'; posts: PostRow[] }> {
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

function featuredPostsSection(author: AuthorRow, featured: { kind: 'featured' | 'recent'; posts: PostRow[] }, isOwner: boolean): ReactNode {
  if (!featured.posts.length && !isOwner) return null;
  return h('section', { className: 'featured-section', 'data-featured-posts-section': true,
    'data-partial-url': `${authorPath(author.username)}/partials/featured-posts` },
    h('div', { className: 'mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between' },
      h('h2', { className: 'text-2xl font-bold tracking-tight text-content' }, featured.kind === 'featured' ? '추천 포스트' : '최근 포스트'),
      isOwner ? h('nav', { className: 'flex flex-wrap gap-2', 'aria-label': '작성자 글 관리' },
        h('a', { href: '/settings/pinned-posts', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content' },
          h(SiteIcon, { name: 'pin', className: 'text-xs' }), '고정 포스트 설정'),
      ) : null,
    ),
    featured.posts.length ? h('div', { className: 'grid grid-cols-1 gap-5 sm:grid-cols-2' }, ...featured.posts.map((post) =>
      h('a', { href: postPath(post), className: 'group block h-full', key: post.id },
        h('article', { className: 'flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.99]' },
          h('div', { className: 'aspect-[16/9] overflow-hidden bg-surface-subtle' },
            h('img', { className: 'h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]', src: postCover(post), alt: post.title, loading: 'lazy' }),
          ),
          h('div', { className: 'flex flex-1 flex-col p-5' },
            h('h3', { className: 'line-clamp-2 text-md font-bold leading-snug text-content transition-colors group-hover:text-content-secondary' }, post.title),
            h('div', { className: 'mt-auto flex items-center gap-3 pt-4 text-xs text-content-hint' },
              post.publishedDate ? h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate)) : null,
              h('span', { className: 'size-1 rounded-full bg-content-hint/70' }),
              h('span', null, `${post.readTime}분`),
            ),
          ),
        ),
      ),
    )) : EmptyState({ title: '아직 공개된 포스트가 없습니다.', actionUrl: '/write', actionLabel: '포스트 작성하기', actionIcon: 'edit' }),
  );
}

async function readPublicPostCount(
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

async function readPublicPosts(db: PrismaClient, options: PostQueryOptions = {}): Promise<PostRow[]> {
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

export async function readPublicFeed(db: PrismaClient, limit: number | null) {
  const posts = await readPublicPosts(db, { limit: Math.max(1, Math.min(PAGE_SIZE, limit ?? 12)) });
  return posts.map((post) => ({
    username: post.authorUsername,
    slug: post.slug,
    title: post.title,
    description: post.description ?? '',
  }));
}

async function readAuthor(db: PrismaClient, username: string): Promise<AuthorRow | null> {
  const now = databaseNow();
  const current = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           author.is_active AS isActive,
           COALESCE(profile.bio, '') AS bio,
           COALESCE(profile.avatar, '') AS avatar,
           COALESCE(profile.cover, '') AS cover,
           COALESCE(profile.homepage, '') AS homepage,
           COALESCE(profile.about_html, '') AS aboutHtml,
           COALESCE(profile.about_md, '') AS aboutMarkdown,
           COALESCE(profile.role, '') AS role,
           (SELECT COUNT(*) FROM board_post AS post
             LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
            WHERE post.author_id = author.id
              AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
              AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0) AS publicPostCount,
           (SELECT COUNT(*) FROM board_series AS series
            WHERE series.owner_id = author.id AND COALESCE(series.hide, 0) = 0
              AND EXISTS (SELECT 1 FROM board_post AS post
                LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
               WHERE post.series_id = series.id
                 AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
                 AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0)) AS publicSeriesCount
      FROM auth_user AS author
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE author.username = ${username}
     LIMIT 1
  `;
  if (current[0]) return current[0];

  const previous = await db.$queryRaw<AuthorRow[]>`
    SELECT author.id AS id,
           author.username AS username,
           author.first_name AS firstName,
           author.is_active AS isActive,
           COALESCE(profile.bio, '') AS bio,
           COALESCE(profile.avatar, '') AS avatar,
           COALESCE(profile.cover, '') AS cover,
           COALESCE(profile.homepage, '') AS homepage,
           COALESCE(profile.about_html, '') AS aboutHtml,
           COALESCE(profile.about_md, '') AS aboutMarkdown,
           COALESCE(profile.role, '') AS role,
           (SELECT COUNT(*) FROM board_post AS post
             LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
            WHERE post.author_id = author.id
              AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
              AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0) AS publicPostCount,
           (SELECT COUNT(*) FROM board_series AS series
            WHERE series.owner_id = author.id AND COALESCE(series.hide, 0) = 0
              AND EXISTS (SELECT 1 FROM board_post AS post
                LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
               WHERE post.series_id = series.id
                 AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
                 AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0)) AS publicSeriesCount
      FROM board_usernamechangelog AS previous
      JOIN auth_user AS author ON author.id = previous.user_id
      LEFT JOIN board_profile AS profile ON profile.user_id = author.id
     WHERE previous.username = ${username}
     ORDER BY previous.created_date DESC, previous.id DESC
     LIMIT 1
  `;
  return previous[0] ?? null;
}

async function readAuthorSocialLinks(db: PrismaClient, authorId: number): Promise<AuthorSocialLink[]> {
  const rows = await db.$queryRaw<Array<AuthorSocialLink>>`
    SELECT id, name, value FROM board_userlinkmeta
     WHERE user_id = ${authorId}
     ORDER BY "order" ASC, id ASC
  `;
  return rows.flatMap((link) => {
    const value = safeExternalUrl(link.value);
    return value ? [{ ...link, value }] : [];
  });
}

function rawPublicPostWhere(postAlias: string, configAlias: string): string {
  return `${postAlias}.deleted_date IS NULL
    AND ${postAlias}.published_date IS NOT NULL
    AND ${postAlias}.published_date <= '${databaseNow()}'
    AND COALESCE(${configAlias}.hide, 0) = 0`;
}

function isEditor(author: AuthorRow): boolean {
  return Number(author.isActive) !== 0 && author.role === 'EDITOR';
}

function authorPath(username: string, suffix = ''): string {
  return `/@${encodeURIComponent(username)}${suffix}`;
}

function sendNotFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
}

function sendRedirect(reply: FastifyReply, path: string): FastifyReply {
  return reply.code(302).header('location', path).send();
}

function makePaginationMeta(
  siteUrl: URL,
  path: string,
  search: URLSearchParams,
  preserve: string[],
  page: number,
  pages: number,
): Pick<PageMeta, 'previous' | 'next'> {
  return {
    previous: page > 1 ? makeAbsolute(siteUrl, pageUrl(path, search, preserve, page - 1)) : undefined,
    next: page < pages ? makeAbsolute(siteUrl, pageUrl(path, search, preserve, page + 1)) : undefined,
  };
}

function profileHeader(
  author: AuthorRow,
  isHeading: boolean,
  subscription: SubscriptionState = { canSubscribe: false, isSubscribed: false },
  viewer: PublicPageViewer | null = null,
  csrfToken = '',
  socialLinks: AuthorSocialLink[] = [],
  returnTo = authorPath(author.username),
): ReactNode {
  const homepage = safeExternalUrl(author.homepage);
  const isOwner = viewer?.id === author.id;
  const cover = author.cover ? h('div', { className: 'mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-8' },
    h('div', { className: 'relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-line/60' },
      h('img', { className: 'h-full w-full object-cover object-center', src: mediaUrl(author.cover) ?? undefined, alt: `${author.username}의 커버`, loading: 'lazy' }),
      h('div', { className: 'absolute inset-0 bg-surface-page/5' }),
      h('div', { className: 'absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-surface-page/35 sm:h-16 md:h-20' }),
      isOwner ? h('a', { href: '/settings/profile', className: 'absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors duration-150 hover:border-white/50 hover:bg-black/35 hover:text-white' },
        h(SiteIcon, { name: 'camera', className: 'text-[11px]' }), h('span', null, '커버 변경'),
      ) : null,
    ),
  ) : null;
  const displayUrl = homepage?.replace(/^https?:\/\//, '') ?? '';
  return h('div', { className: 'relative overflow-hidden pb-12 sm:pb-16' },
    cover,
    h('div', { className: `relative mx-auto max-w-4xl px-4 sm:px-6 ${author.cover ? '-mt-14 sm:-mt-16 md:-mt-20' : 'pt-12'}` },
      h('div', { className: 'flex flex-col items-center text-center' },
        h('div', { className: 'relative mb-6 sm:mb-8' },
          h('img', { className: 'relative size-28 rounded-full object-cover shadow-floating ring-4 ring-surface-page sm:size-32 md:size-40', src: avatarUrl(author.avatar), alt: author.username }),
          isOwner ? h('a', { href: '/settings/profile', title: '프로필 이미지 변경', 'aria-label': '프로필 이미지 변경', className: 'absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-content-secondary shadow-subtle transition-colors duration-150 hover:border-line-strong hover:text-content' },
            h(SiteIcon, { name: 'pencil', className: 'text-xs' }),
          ) : null,
        ),
        isHeading
          ? h('h1', { className: 'mb-2 text-2xl font-bold tracking-tight text-content' }, author.username)
          : h('p', { className: 'mb-2 text-2xl font-bold tracking-tight text-content' }, author.username),
        author.bio ? h('p', { className: 'mx-auto mb-6 max-w-2xl px-4 text-md font-medium leading-relaxed text-content-secondary' }, author.bio) : null,
        subscription.canSubscribe ? h('div', { className: 'mb-6' }, subscriptionControl(author, subscription, viewer, csrfToken, returnTo)) : null,
        homepage ? h('div', { className: 'mb-8' },
          h('a', { href: homepage, target: '_blank', rel: 'noopener noreferrer', className: 'group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content' },
            h(SiteIcon, { name: 'link', className: 'text-xs text-content-hint transition-colors group-hover:text-content' }),
            h('span', null, displayUrl.length > 30 ? `${displayUrl.slice(0, 29)}…` : displayUrl),
          ),
        ) : null,
        socialLinks.length ? h('div', { className: 'mx-auto flex max-w-lg flex-wrap justify-center gap-3' },
          ...socialLinks.map((social) => {
            const icon = ({
              github: 'brand-github', twitter: 'brand-x', x: 'brand-x',
              threads: 'brand-threads', telegram: 'brand-telegram', facebook: 'brand-facebook',
              instagram: 'brand-instagram', linkedin: 'brand-linkedin', youtube: 'brand-youtube',
              tiktok: 'brand-tiktok', discord: 'brand-discord',
            } as Record<string, SiteIconName>)[social.name.toLowerCase()] ?? 'link';
            const label = social.name.toLowerCase() === 'twitter' ? 'X' : social.name;
            return h('a', { key: social.id, href: social.value, target: '_blank', rel: 'noopener noreferrer', title: label,
              className: 'flex size-10 items-center justify-center rounded-full border border-line bg-surface text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content sm:size-11' },
              h(SiteIcon, { name: icon, className: 'text-lg' }),
              h('span', { className: 'sr-only' }, label),
            );
          }),
        ) : isOwner ? h('a', { href: '/settings/social-links',
          className: 'inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-content-hint transition-colors duration-150 hover:border-line hover:text-content-secondary' },
          h(SiteIcon, { name: 'plus', className: 'text-xs' }), h('span', null, '소셜 링크 추가'),
        ) : null,
      ),
    ),
  );
}

function AboutSection({ author, aboutHtml, isOwner }: { author: AuthorRow; aboutHtml: string; isOwner: boolean }): ReactNode {
  if (!aboutHtml && !isOwner) return null;
  const heading = h('div', { className: 'mb-6' }, h('h2', { className: 'text-2xl font-bold text-content' }, '소개'));
  if (!isOwner) return h('section', null, heading, h('div', { className: 'prose blog-post-content', dangerouslySetInnerHTML: { __html: aboutHtml } }));
  const editPath = `${authorPath(author.username)}/about/edit`;
  return h('section', { 'data-about-editor': '', 'data-about-url': editPath },
    heading,
    h('p', { 'data-about-message': '', hidden: true, className: 'mb-4 text-sm' }),
    h('div', { 'data-about-content': '', hidden: !aboutHtml, className: 'prose blog-post-content', dangerouslySetInnerHTML: { __html: aboutHtml } }),
    h('div', { 'data-about-empty': '', hidden: Boolean(aboutHtml), className: 'rounded-2xl border border-dashed border-line bg-surface px-5 py-6' },
      h('div', { className: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' },
        h('p', { className: 'min-w-0 text-sm font-semibold text-content' }, '아직 소개가 없습니다'),
        h('a', { href: editPath, 'data-about-edit': '', className: 'inline-flex items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content' },
          h(SiteIcon, { name: 'edit', className: 'mr-2' }), '소개글 작성'),
      ),
    ),
    h('div', { 'data-about-actions': '', hidden: !aboutHtml, className: 'mt-6' },
      h('a', { href: editPath, 'data-about-edit': '', className: 'inline-flex items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content' },
        h(SiteIcon, { name: 'edit', className: 'mr-2' }), '소개글 수정'),
    ),
    h('div', { 'data-about-form': '', hidden: true, className: 'rounded-2xl border border-line bg-surface p-4' },
      h('textarea', { 'data-about-input': '', defaultValue: author.aboutMarkdown ?? '', placeholder: '소개글을 작성하세요', 'aria-label': '소개',
        className: 'min-h-64 w-full resize-y rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-content placeholder-content-hint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10' }),
      h('div', { className: 'mt-4 flex justify-end gap-2' },
        h('button', { type: 'button', 'data-about-cancel': '', className: 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content disabled:opacity-50' }, '취소'),
        h('button', { type: 'button', 'data-about-save': '', className: 'inline-flex items-center justify-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-content-inverted transition-colors hover:bg-action-hover disabled:opacity-50' }, '저장'),
      ),
    ),
  );
}

function authorTabs(author: AuthorRow, activeTab: 'overview' | 'posts' | 'series' | 'about'): ReactNode {
  if (!isEditor(author)) return h('div', { className: 'mb-8' });
  const tabs: Array<{ key: 'overview' | 'posts' | 'series'; href: string; label: string; count?: number | bigint }> = [
    { key: 'overview', href: authorPath(author.username), label: '개요' },
    { key: 'posts', href: authorPath(author.username, '/posts'), label: '포스트', count: author.publicPostCount },
    { key: 'series', href: authorPath(author.username, '/series'), label: '시리즈', count: author.publicSeriesCount },
  ];
  return h('div', { className: 'relative mb-10' },
    h('div', { className: 'hide-scrollbar flex justify-center overflow-x-auto pb-2 sm:pb-0' },
      h('nav', { className: 'inline-flex min-w-fit rounded-xl bg-surface-subtle/80 p-1.5 backdrop-blur-sm', 'aria-label': '작성자 메뉴' },
        ...tabs.map((tab) => h('a', { href: tab.href, key: tab.key, 'aria-current': activeTab === tab.key ? 'page' : undefined,
          className: `relative whitespace-nowrap rounded-lg px-6 py-2 text-sm font-bold transition-all duration-200 ${activeTab === tab.key ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` },
          h('span', { className: 'relative z-10 flex items-center gap-2' },
            h('span', { className: 'flex items-center gap-1.5' },
              tab.label,
              tab.count !== undefined ? h('span', { className: `rounded-md px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? 'bg-action text-content-inverted' : 'bg-surface-elevated text-content-secondary ring-1 ring-line/80'}` }, String(tab.count)) : null,
            ),
          ),
        )),
      ),
    ),
  );
}

function postTitle(post: PostRow): string {
  return `/@${encodeURIComponent(post.authorUsername)}/${encodeURIComponent(post.slug)}`;
}

function formatPostDate(post: PostRow): ReactNode {
  if (!post.publishedDate) return null;
  return h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate));
}

function ReactFragment({ children }: { children: ReactNode }): ReactNode {
  return h('div', null, children);
}

function withoutParams(search: URLSearchParams, ...names: string[]): URLSearchParams {
  const next = new URLSearchParams(search);
  for (const name of names) next.delete(name);
  return next;
}

function withQuery(path: string, search: URLSearchParams): string {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function QueryFilter({ path, search, placeholder, id }: { path: string; search: URLSearchParams; placeholder: string; id: string }): ReactNode {
  const others = withoutParams(search, 'q', 'page');
  return h('form', { method: 'get', action: path, className: 'relative' },
    ...[...others].map(([name, value], index) => h('input', { key: `${name}-${index}`, type: 'hidden', name, value })),
    h('div', { className: 'relative' },
      h('input', { id, type: 'text', name: 'q', defaultValue: search.get('q') ?? '', placeholder, autoComplete: 'off',
        className: 'peer w-full rounded-2xl bg-surface-elevated px-4 py-2.5 pr-10 text-content ring-1 ring-line/60 transition-all placeholder:text-content-hint focus:ring-2 focus:ring-line-strong/70 focus:outline-none' }),
      h('a', { href: withQuery(path, others), 'aria-label': '검색어 지우기',
        className: 'absolute top-1/2 right-3 -translate-y-1/2 text-content-hint transition-colors hover:text-content-secondary peer-placeholder-shown:hidden' },
        h(SiteIcon, { name: 'x' })),
      h('button', { type: 'submit', 'aria-label': '검색',
        className: 'absolute top-1/2 right-3 hidden -translate-y-1/2 text-content-hint peer-placeholder-shown:block' },
        h(SiteIcon, { name: 'search' })),
    ),
  );
}

function DropdownFilter({ path, search, param, options, current }: {
  path: string; search: URLSearchParams; param: string; options: Array<{ value: string; label: string }>; current: string;
}): ReactNode {
  return h('details', { className: 'group relative w-full', 'data-account-menu': '' },
    h('summary', { 'aria-haspopup': 'listbox',
      className: 'flex w-full cursor-pointer list-none items-center justify-between rounded-2xl bg-surface-elevated px-4 py-2.5 text-sm font-medium text-content-secondary ring-1 ring-line/60 hover:bg-surface-subtle focus:ring-2 focus:ring-line-strong/70 focus:outline-none [&::-webkit-details-marker]:hidden' },
      h('span', { className: 'truncate' }, options.find((option) => option.value === current)?.label ?? ''),
      h(SiteIcon, { name: 'chevron-down', className: 'ml-2 text-xs transition-transform duration-150 group-open:rotate-180' }),
    ),
    h('div', { role: 'listbox', className: 'absolute left-0 z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-lg bg-surface-elevated py-1 shadow-lg ring-1 ring-line/60 sm:right-0' },
      ...options.map((option) => {
        const next = withoutParams(search, param, 'page');
        if (option.value) next.set(param, option.value);
        const selected = option.value === current;
        return h('a', { key: option.value, href: withQuery(path, next), role: 'option', 'aria-selected': selected || undefined,
          className: `block px-4 py-3 text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle ${selected ? 'bg-surface-subtle font-semibold text-content' : ''}` }, option.label);
      }),
    ),
  );
}

function searchForm(query: string, username: string): ReactNode {
  return h('form', { action: '/search', method: 'get' },
    username ? h('input', { type: 'hidden', name: 'username', value: username }) : null,
    h('div', { className: 'flex h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-sm transition-all duration-150 focus-within:ring-2 focus-within:ring-line' },
      h(SiteIcon, { name: 'search', className: 'text-sm text-content-hint' }),
      h('input', { id: 'search-query', name: 'q', type: 'search', defaultValue: query,
        placeholder: '검색어를 입력하세요', 'aria-label': '포스트 검색', autoComplete: 'off', maxLength: 100,
        className: 'min-w-0 flex-1 bg-transparent text-sm text-content placeholder:text-content-hint focus:outline-none' }),
      h('button', { type: 'submit', className: 'inline-flex size-11 items-center justify-center rounded-full text-content-hint transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95', 'aria-label': '검색' },
        h(SiteIcon, { name: 'arrow-right', className: 'text-xs' }),
      ),
    ),
    username ? h('p', { className: 'mt-2 text-xs text-content-secondary' },
      '작성자 필터: ', h('a', { className: 'font-semibold text-content', href: `/@${encodeURIComponent(username)}` }, `@${username}`),
      h('span', null, ' · '), h('a', { href: `/search${query ? `?q=${encodeURIComponent(query)}` : ''}`, className: 'hover:text-content' }, '필터 지우기'),
    ) : null,
  );
}

function highlightText(text: string, query: string): ReactNode {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return text;
  const expression = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = text.split(expression);
  return parts.map((part, index) => index % 2
    ? h('mark', { key: `${index}:${part}`, className: 'rounded bg-warning-surface px-0.5 text-content' }, part)
    : h('span', { key: `${index}:${part}` }, part));
}

function SearchResultCard({ post, query }: { post: PostRow; query: string }): ReactNode {
  const authorHref = `/@${encodeURIComponent(post.authorUsername)}`;
  const matched = [
    Number(post.titleScore ?? 0) > 0 ? '제목' : null,
    Number(post.descriptionScore ?? 0) > 0 ? '설명' : null,
    Number(post.tagScore ?? 0) > 0 ? '태그' : null,
    Number(post.contentScore ?? 0) > 0 ? '내용' : null,
  ].filter((value): value is string => value !== null);
  const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
  return h('article', { className: 'overflow-hidden rounded-2xl border border-line-light bg-surface transition-all duration-150 hover:border-line hover:shadow-subtle', key: `${post.authorUsername}-${post.slug}` },
    h('a', { href: postPath(post), className: 'block p-4 transition-all duration-150 active:scale-[0.99] sm:p-5' },
      h('div', { className: 'flex flex-col gap-4 sm:flex-row' },
        h('div', { className: 'w-full shrink-0 sm:w-44' },
          h('div', { className: 'h-36 overflow-hidden rounded-xl border border-line bg-surface-subtle sm:h-28' },
            hasImage
              ? h('img', { src: mediaUrl(post.image) ?? undefined, alt: post.title, className: 'h-full w-full object-cover', loading: 'lazy' })
              : h('div', { className: 'flex h-full w-full items-center justify-center text-content-hint' },
                h(SiteIcon, { name: 'photo', className: 'text-xl' }),
              ),
          ),
        ),
        h('div', { className: 'min-w-0 flex-1' },
          h('div', { className: 'mb-2 flex flex-wrap items-center gap-2 text-xs text-content-secondary' },
            h('img', { src: avatarUrl(post.authorAvatar), alt: post.authorUsername, className: 'size-6 rounded-full border border-line-light object-cover', loading: 'lazy' }),
            h('span', { className: 'font-medium text-content' }, post.authorUsername),
            h('span', { 'aria-hidden': true }, '·'),
            post.publishedDate ? h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate)) : null,
            post.readTime > 0 ? h(ReactFragment, null,
              h('span', { 'aria-hidden': true }, '·'), h('span', null, `${post.readTime}분 읽기`),
            ) : null,
          ),
          h('h2', { className: 'mb-2 text-lg font-bold leading-snug text-content sm:text-xl' }, highlightText(post.title, query)),
          post.description ? h('p', { className: 'line-clamp-2 text-sm leading-relaxed text-content-secondary' }, highlightText(post.description, query)) : null,
          matched.length ? h('div', { className: 'mt-3 flex flex-wrap gap-2' }, ...matched.map((field) =>
            h('span', { key: field, className: 'inline-flex items-center rounded-md bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-content-secondary' }, field),
          )) : null,
        ),
      ),
    ),
  );
}

function SearchPagination({ page, pages, query, username }: { page: number; pages: number; query: string; username: string }): ReactNode {
  if (pages <= 1) return null;
  const start = pages <= 5 ? 1 : page <= 3 ? 1 : page >= pages - 2 ? pages - 4 : page - 2;
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, index) => start + index);
  const href = (next: number) => `/search?${new URLSearchParams({ q: query, ...(username ? { username } : {}), ...(next > 1 ? { page: String(next) } : {}) })}`;
  return h('nav', { className: 'flex items-center justify-center gap-2 pt-2', 'aria-label': '검색 결과 페이지' },
    h('a', { href: page > 1 ? href(page - 1) : undefined, 'aria-disabled': page === 1,
      className: 'inline-flex h-11 min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      ...(page === 1 ? { tabIndex: -1 } : { rel: 'prev' }) }, '이전'),
    h('div', { className: 'flex items-center gap-1' }, ...numbers.map((number) => h('a', {
      href: href(number), key: number, 'aria-current': number === page ? 'page' : undefined,
      'aria-label': `${number}페이지`,
      className: `inline-flex size-11 items-center justify-center rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${number === page ? 'bg-action text-content-inverted hover:bg-action-hover' : 'border border-line bg-surface text-content-secondary hover:bg-surface-subtle'}`,
    }, String(number)))),
    h('a', { href: page < pages ? href(page + 1) : undefined, 'aria-disabled': page === pages,
      className: 'inline-flex h-11 min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-content transition-all duration-150 hover:bg-surface-subtle active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      ...(page === pages ? { tabIndex: -1 } : { rel: 'next' }) }, '다음'),
  );
}

interface SearchCte {
  sql: string;
  parameters: SqlValue[];
}

function searchCte(keywords: string[], username: string): SearchCte {
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

function safeStructuredPageData(
  siteName: string,
  canonical: string,
  title: string,
  descriptionText: string,
  createdDate: StoredDate,
  updatedDate: StoredDate,
  authorUsername: string | null,
  siteUrl: URL,
): Record<string, unknown> {
  const author = authorUsername ? {
    '@type': 'Person',
    name: authorUsername,
    url: makeAbsolute(siteUrl, authorPath(authorUsername)),
  } : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    headline: title,
    description: descriptionText,
    url: canonical,
    datePublished: dateValue(createdDate),
    dateModified: dateValue(updatedDate),
    ...(author ? { author } : {}),
    isPartOf: {
      '@type': 'WebSite',
      name: siteName,
      url: makeAbsolute(siteUrl, '/'),
    },
  };
}

interface PublicPageOptions {
  currentUser?: (request: FastifyRequest) => Promise<PublicPageViewer | null>;
  requiresSetup?: () => Promise<boolean>;
}

export function registerPublicPages(app: FastifyInstance, db: PrismaClient, siteUrl: URL, options: PublicPageOptions = {}): void {
  app.get('/v1/search', async (request) => {
    const parameters = new URL(request.url, siteUrl).searchParams;
    const query = (parameters.get('q') ?? '').slice(0, 100).trim();
    const username = (parameters.get('username') ?? '').trim();
    const invalid = (key: string, errorMessage: string) => ({ status: 'ERROR', errorCode: 'error:VA', errorMessage,
      messageKey: `search.validation.${key}`, messageParams: {} });
    if (!query) return invalid('query_required', '검색어를 입력하세요.');
    const rawPage = parameters.get('page') ?? '1';
    const page = Math.max(1, Number(rawPage));
    if (!/^[+-]?\d+$/.test(rawPage) || !Number.isSafeInteger(page)) return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const started = performance.now();
    const search = searchCte(query.split(/\s+/), username);
    const [count] = await db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `${search.sql} SELECT COUNT(*) AS count FROM scored WHERE relevance > 0`, ...search.parameters,
    );
    const totalSize = Number(count.count);
    const lastPage = totalPages(totalSize, 30);
    if (page > lastPage) return invalid('invalid_page', '잘못된 페이지 번호입니다.');
    const matches = await db.$queryRawUnsafe<Array<PostRow & { titleScore: number | bigint; descriptionScore: number | bigint; tagScore: number | bigint; contentScore: number | bigint }>>(
      `${search.sql} SELECT * FROM scored WHERE relevance > 0 ORDER BY relevance DESC, publishedDate DESC, id DESC LIMIT 30 OFFSET ?`,
      ...search.parameters, (page - 1) * 30,
    );
    const fields = [['titleScore', 'title', '제목'], ['descriptionScore', 'description', '설명'],
      ['tagScore', 'tag', '태그'], ['contentScore', 'content', '내용']] as const;
    const results = matches.map((post) => {
      const scored = fields.filter(([key]) => Number(post[key]) > 0);
      const published = dateValue(post.publishedDate);
      const timeZone = process.env.TZ || 'Asia/Seoul';
      return { url: post.slug, title: post.title, image: post.image, description: post.description, readTime: post.readTime,
        createdDate: published ? new Intl.DateTimeFormat('ko-KR', { timeZone, dateStyle: 'long' }).format(new Date(published)) : '',
        publishedDate: published ? new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(published)) : '',
        authorImage: post.authorAvatar, author: post.authorUsername, positions: scored.map(([, , label]) => label),
        matchedFields: scored.map(([, key]) => key) };
    });
    return { status: 'DONE', body: { elapsedTime: Math.round(performance.now() - started) / 1_000, totalSize, lastPage, query, results } };
  });

  app.get('/', async (request, reply) => {
    if (await options.requiresSetup?.()) return reply.redirect('/setup', 302);
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);

    const brand = await readPublicSiteBrand(db);
    const siteName = brand.siteName;
    const count = await readPublicPostCount(db);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, { limit: PAGE_SIZE, offset: (checkedPage - 1) * PAGE_SIZE });
    const pages = totalPages(count, PAGE_SIZE);
    const path = '/';
    const noindex = hasUnexpected(query, ['page']);
    const canonical = noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage);
    const viewer = await readViewer(request, reply, options);
    reply.header('Vary', 'Cookie');
    const [globalNotices, likes] = await Promise.all([readNotices(db, 'global'), readCardLikes(db, request, viewer, posts)]);
    const meta: PageMeta = {
      title: `${siteName} - 최신 포스트`,
      description: `${siteName}에 공개된 최신 글을 둘러보세요.`,
      canonical,
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, [], checkedPage, pages),
    };
    return renderHtml(reply, PageLayout({
      meta,
      children: h(ReactFragment, null,
        h('div', { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
          h('h1', { className: 'sr-only' }, '최신 포스트'),
          viewer ? h('div', { className: 'mb-6 flex justify-end' },
            h('a', { href: '/interests', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors duration-150 hover:bg-surface-subtle hover:text-content' },
              h(SiteIcon, { name: 'heart', className: 'text-xs text-content-hint' }),
              h('span', null, '관심 포스트'),
            ),
          ) : null,
          NoticeSection({ notices: globalNotices, scope: 'global' }),
          posts.length
            ? h(ReactFragment, null,
              PostGrid({ posts, className: 'mb-16 gap-6', likes }),
              h('div', { className: 'mt-16 mb-12' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
            )
            : EmptyState({
              title: '아직 포스트가 없어요',
              message: '공개된 포스트가 발행되면 이곳에 표시됩니다.',
              icon: 'writing',
              actionUrl: viewer?.hasEditorRole ? '/write' : undefined,
              actionLabel: viewer?.hasEditorRole ? '포스트 작성하기' : undefined,
              actionIcon: viewer?.hasEditorRole ? 'edit' : undefined,
            }),
        ),
      ),
    }));
  });

  app.get('/interests', async (request, reply) => {
    const viewer = await options.currentUser?.(request);
    if (!viewer) return reply.redirect(`/login?${new URLSearchParams({ next: request.url })}`, 302);
    const path = '/interests';
    const query = new URL(request.url, siteUrl).searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const conditions = ['EXISTS(SELECT 1 FROM board_post_likes AS likes WHERE likes.post_id = post.id AND likes.user_id = ?)'];
    const parameters = [viewer.id];
    const count = await readPublicPostCount(db, conditions, parameters);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const brand = await readPublicSiteBrand(db);
    const siteName = brand.siteName;
    const posts = await readPublicPosts(db, { conditions, parameters, orderParameters: parameters, limit: PAGE_SIZE,
      orderBy: '(SELECT MAX(created_date) FROM board_post_likes WHERE post_id = post.id AND user_id = ?) DESC, post.published_date DESC',
      offset: (checkedPage - 1) * PAGE_SIZE });
    const pages = totalPages(count, PAGE_SIZE);
    reply.header('Cache-Control', 'private, no-store');
    return renderHtml(reply, PageLayout({
      meta: { title: `${siteName} - 관심 포스트`, description: '', canonical: makeAbsolute(siteUrl, path), siteName, brand, robots: 'noindex,nofollow', viewer },
      children: h('div', { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
        h('div', { className: 'mb-6 flex justify-end' },
          h('a', { href: '/', className: 'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content' },
            h(SiteIcon, { name: 'arrow-left', className: 'text-xs text-content-hint' }), '전체 포스트'),
        ),
        h('header', { className: 'mb-8' },
          h('p', { className: 'mb-2 text-sm font-semibold text-action' }, '내가 다시 보고 싶은 포스트'),
          h('h1', { className: 'text-3xl font-bold tracking-tight text-content md:text-4xl' }, '관심 포스트'),
          h('p', { className: 'mt-3 max-w-2xl leading-relaxed text-content-secondary' }, '추천으로 관심 표시한 포스트를 최신 관심순으로 모아볼 수 있어요.'),
        ),
        posts.length ? h(ReactFragment, null,
          PostGrid({ posts, className: 'mb-16 gap-6', likes: {
            csrfToken: csrfCookie(request), returnTo: path, likedIds: new Set(posts.map((post) => post.id)),
          } }),
          h('div', { className: 'mt-16 mb-12' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
        ) : EmptyState({ title: '아직 관심 포스트가 없어요', message: '추천 버튼을 눌러둔 포스트가 여기에 모입니다.', icon: 'heart', actionUrl: '/', actionLabel: '포스트 둘러보기', actionIcon: 'compass' }),
      ),
    }));
  });

  app.get('/tags', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const requestedSort = query.get('sort') ?? 'popular';
    const sort = ['popular', 'name', 'recent'].includes(requestedSort) ? requestedSort : 'popular';
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const filter = searchText ? 'AND tag.value LIKE ?' : '';
    const parameters: SqlValue[] = [databaseNow()];
    if (searchText) parameters.push(`%${searchText}%`);
    const countRows = await db.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*) AS count FROM (
        SELECT tag.id
          FROM board_tag AS tag
          JOIN board_post_tags AS post_tag ON post_tag.tag_id = tag.id
          JOIN board_post AS post ON post.id = post_tag.post_id
          LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
         WHERE ${PUBLIC_POST_WHERE} ${filter}
         GROUP BY tag.id
      ) AS public_tags
    `, ...parameters);
    const count = Number(countRows[0]?.count ?? 0);
    const checkedPage = validPublicPage(reply, page, count, 50);
    if (checkedPage === null) return reply;
    const orderBy = sort === 'name' ? 'tag.value ASC'
      : sort === 'recent' ? 'tag.id DESC'
        : 'postCount DESC, tag.value ASC';
    const tags = await db.$queryRawUnsafe<TagRow[]>(`
      SELECT tag.id AS id,
             tag.value AS name,
             COUNT(DISTINCT post.id) AS count,
             (SELECT image_post.image FROM board_post_tags AS image_tag
               JOIN board_post AS image_post ON image_post.id = image_tag.post_id
               LEFT JOIN board_postconfig AS image_config ON image_config.post_id = image_post.id
              WHERE image_tag.tag_id = tag.id
                AND image_post.image LIKE '%images%'
                AND ${rawPublicPostWhere('image_post', 'image_config')}
              ORDER BY image_post.created_date DESC LIMIT 1) AS image,
             COUNT(DISTINCT post.id) AS postCount
        FROM board_tag AS tag
        JOIN board_post_tags AS post_tag ON post_tag.tag_id = tag.id
        JOIN board_post AS post ON post.id = post_tag.post_id
        LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
       WHERE ${PUBLIC_POST_WHERE} ${filter}
       GROUP BY tag.id
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?
    `, ...parameters, 50, (checkedPage - 1) * 50);
    const pages = totalPages(count, 50);
    const path = '/tags';
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || searchText.length > 0 || requestedSort !== 'popular';
    const canonical = noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage);
    const preserve = ['q', 'sort'];
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${siteName} - 태그`,
        description: '태그를 살펴보고 관심 있는 주제의 글을 찾아보세요.',
        canonical,
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, preserve, checkedPage, pages),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('header', { className: 'mb-10 text-center' },
          h('h1', { className: 'mb-3 text-3xl font-bold tracking-tight text-content sm:text-4xl' }, '태그 클라우드'),
          h('p', { className: 'text-content-secondary' }, '전체 태그와 태그별 포스트를 확인할 수 있습니다'),
        ),
        h('div', { className: 'mb-12 flex flex-col items-end justify-between gap-6 sm:flex-row sm:items-center' },
          h('div', { className: 'w-full sm:max-w-md sm:flex-1' },
            h('label', { htmlFor: 'tag-query', className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary' }, '태그 검색'),
            QueryFilter({ path: '/tags', search: query, placeholder: '검색어를 입력하세요.', id: 'tag-query' }),
          ),
          h('div', { className: 'w-full sm:w-auto' },
            h('p', { className: 'mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary' }, '정렬 방식'),
            DropdownFilter({ path: '/tags', search: query, param: 'sort', current: sort, options: [
              { value: 'popular', label: '인기순' },
              { value: 'name', label: '이름순' },
              { value: 'recent', label: '최신순' },
            ] }),
          ),
        ),
        tags.length ? h('div', { className: 'grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4' }, ...tags.map((tag) =>
          h('a', { className: 'group block rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]', key: tag.id, href: `/tag/${encodeURIComponent(tag.name)}` },
            h('div', { className: 'flex h-full flex-col' },
              h('div', { className: 'mb-4 flex items-center justify-between' },
                h('span', { className: 'flex size-8 items-center justify-center rounded-full bg-surface-subtle text-content-hint transition-colors duration-300 group-hover:bg-action group-hover:text-content-inverted' },
                  h(SiteIcon, { name: 'hash', className: 'text-sm' }),
                ),
                h('span', { className: 'rounded-md bg-surface-subtle px-2 py-1 text-xs font-bold text-content-hint transition-colors group-hover:bg-line-light' }, String(tag.count)),
              ),
              h('h2', { className: 'mb-1 truncate text-lg font-bold text-content transition-colors duration-200 group-hover:text-content' }, tag.name),
              h('p', { className: 'line-clamp-2 text-sm text-content-secondary' }, `${tag.count.toLocaleString('ko-KR')}개 포스트에서 태그됨`),
            ),
          ),
        )) : EmptyState({ title: '태그가 없습니다', message: searchText ? '검색 조건에 맞는 태그가 없습니다.' : '포스트에 태그를 추가하면 여기에 표시됩니다.', icon: 'tags', framed: true }),
        tags.length ? h('div', { className: 'mt-12' }, Pagination({ path, search: query, preserve, page: checkedPage, pages })) : null,
      ),
    }));
  });

  app.get<{ Params: { name: string } }>('/tag/:name', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const tagName = request.params.name;
    const condition = `EXISTS (SELECT 1 FROM board_post_tags AS post_tag
      JOIN board_tag AS tag ON tag.id = post_tag.tag_id
     WHERE post_tag.post_id = post.id AND tag.value = ?)`;
    const count = await readPublicPostCount(db, [condition], [tagName]);
    if (count === 0) return sendNotFound(reply);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, {
      conditions: [condition],
      parameters: [tagName],
      limit: PAGE_SIZE,
      offset: (checkedPage - 1) * PAGE_SIZE,
    });
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const pages = totalPages(count, PAGE_SIZE);
    const path = `/tag/${encodeURIComponent(tagName)}`;
    const likes = await readCardLikes(db, request, viewer, posts);
    const noindex = hasUnexpected(query, ['page']);
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${siteName} - #${tagName}`,
        description: `#${tagName} 태그가 붙은 공개 글을 읽어보세요.`,
        canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, [], checkedPage, pages),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12' },
        h('nav', { className: 'mb-8' },
          h('a', { href: '/tags', className: 'group inline-flex items-center text-sm font-medium text-content-secondary transition-colors duration-200 hover:text-content' },
            h(SiteIcon, { name: 'arrow-left', className: 'mr-2 text-xs transition-transform duration-200 group-hover:-translate-x-0.5' }), '전체 태그',
          ),
        ),
        h('header', { className: 'mb-12 text-center sm:mb-16' }, h('h1', { className: 'mb-4 text-3xl font-bold tracking-tight text-content' }, tagName)),
        posts.length ? h(ReactFragment, null,
          PostGrid({ posts, likes }),
          h('div', { className: 'mt-16 mb-8' }, Pagination({ path, search: query, preserve: [], page: checkedPage, pages })),
        ) : EmptyState({ title: '포스트가 없습니다', message: `#${tagName} 태그로 작성된 포스트가 아직 없습니다.`, icon: 'hash', framed: true }),
      ),
    }));
  });

  app.get('/search', async (request, reply) => {
    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const searchText = (query.get('q') ?? '').slice(0, 100).trim();
    const username = (query.get('username') ?? '').trim();
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    let posts: PostRow[] = [];
    let count = 0;
    let checkedPage = page;
    if (searchText) {
      const keywords = searchText.split(/\s+/).filter(Boolean);
      const cte = searchCte(keywords, username);
      const countRows = await db.$queryRawUnsafe<Array<{ count: number }>>(
        `${cte.sql} SELECT COUNT(*) AS count FROM scored WHERE relevance > 0`,
        ...cte.parameters,
      );
      count = Number(countRows[0]?.count ?? 0);
      checkedPage = validPublicPage(reply, page, count, 30) ?? 0;
      if (checkedPage === 0) return reply;
      posts = await db.$queryRawUnsafe<PostRow[]>(
        `${cte.sql}
         SELECT id, slug, title, subtitle, image, readTime, description, publishedDate,
                authorUsername, authorAvatar, seriesUrl, seriesName, relevance,
                titleScore, descriptionScore, tagScore, contentScore
           FROM scored
          WHERE relevance > 0
          ORDER BY relevance DESC, publishedDate DESC, id DESC
          LIMIT ? OFFSET ?`,
        ...cte.parameters,
        30,
        (checkedPage - 1) * 30,
      );
    }
    const pages = totalPages(count, 30);
    const path = '/search';
    const noindex = true;
    return renderHtml(reply, PageLayout({
      meta: {
        title: searchText ? `검색: ${searchText} - ${siteName}` : `검색 - ${siteName}`,
        description: '제목, 설명, 태그, 본문에서 글을 검색합니다.',
        canonical: makeAbsolute(siteUrl, path),
        siteName,
        brand,
        viewer,
        searchPage: true,
        robots: 'noindex,follow',
        ...(!noindex && count ? makePaginationMeta(siteUrl, path, query, ['q', 'username'], checkedPage, pages) : {}),
      },
      children: h('div', { className: 'mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-12' },
        h('section', null,
          h('h1', { className: 'mb-4 text-2xl font-bold tracking-tight text-content sm:text-3xl' }, '포스트 검색'),
          searchForm(searchText, username),
        ),
        searchText
          ? posts.length
            ? h('section', { className: 'space-y-4' },
              h('div', { className: 'rounded-2xl border border-line bg-surface-subtle px-4 py-3' },
                h('h2', { className: 'text-lg font-semibold text-content' },
                  h('strong', { className: 'text-content' }, count.toLocaleString('ko-KR')), '개의 결과',
                  h('span', { className: 'ml-2 text-xs font-normal text-content-hint' }, `“${searchText}” 검색`),
                ),
              ),
              h('div', { className: 'space-y-4' }, ...posts.map((post) => SearchResultCard({ post, query: searchText }))),
              SearchPagination({ page: checkedPage, pages, query: searchText, username }),
            )
            : EmptyState({ title: '검색 결과가 없습니다', message: '다른 검색어 또는 작성자 이름으로 다시 검색해 보세요.', icon: 'search', framed: true })
          : EmptyState({ title: '무엇을 찾고 있나요?', message: '검색어를 입력하면 제목, 설명, 태그, 본문에서 공개 글을 찾습니다.', icon: 'search', framed: true }),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username)}${new URL(request.url, siteUrl).search}`);
    const query = new URL(request.url, siteUrl).searchParams;
    const [brand, viewer] = await Promise.all([
      readPublicSiteBrand(db),
      readViewer(request, reply, options),
    ]);
    const siteName = brand.siteName;
    const [featured, socialLinks] = await Promise.all([
      readFeaturedPosts(db, author),
      readAuthorSocialLinks(db, author.id),
    ]);
    const isAuthorEditor = isEditor(author);
    const [userNotices, subscription] = isAuthorEditor
      ? await Promise.all([
        readNotices(db, 'user', author.id),
        subscriptionState(db, author, viewer),
      ])
      : [[], { canSubscribe: false, isSubscribed: false } as SubscriptionState];
    const noindex = hasUnexpected(query, []);
    const path = authorPath(author.username);
    const canonical = makeAbsolute(siteUrl, path);
    const aboutHtml = sanitizePostHtml(author.aboutHtml);
    const isOwner = viewer?.id === author.id;
    const activity = await readAuthorActivity(db, author.id);
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: isEditor(author) ? authorFeed(siteUrl, author.username) : undefined,
        title: `${author.username} - ${siteName}`,
        description: description(author.bio || aboutHtml, `${author.username}의 공개 글과 소개를 확인해 보세요.`),
        canonical,
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
      },
      children: h(ReactFragment, null,
        profileHeader(author, true, subscription, viewer, csrfCookie(request), socialLinks),
        authorTabs(author, 'overview'),
        h('div', { className: `${isAuthorEditor ? 'max-w-4xl' : 'max-w-7xl'} mx-auto mb-20 w-full px-4 sm:px-6` },
          h('div', { className: 'space-y-14' },
          isAuthorEditor ? NoticeSection({ notices: userNotices, scope: 'user' }) : null,
          AboutSection({ author, aboutHtml, isOwner }),
          isAuthorEditor ? featuredPostsSection(author, featured, viewer?.id === author.id) : null,
          h(AuthorActivitySection, activity),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/partials/featured-posts', async (request, reply) => {
    const author = await readAuthor(db, request.params.username);
    if (!author || author.username !== request.params.username) return sendNotFound(reply);
    const headers = reply.header('Cache-Control', 'no-store').header('X-Robots-Tag', 'noindex');
    if (!isEditor(author)) return headers.code(204).send();
    const viewer = await readViewer(request, headers, options);
    const featured = await readFeaturedPosts(db, author);
    const content = renderToStaticMarkup(featuredPostsSection(author, featured, viewer?.id === author.id));
    return headers.type('text/html; charset=utf-8').send(content);
  });

  app.get<{ Params: { username: string } }>('/@:username/about/edit', async (request, reply) => {
    if (!options.currentUser) return sendNotFound(reply);
    const viewer = await readViewer(request, reply, options);
    if (!viewer) return reply.redirect(`/login?${new URLSearchParams({ next: new URL(request.url, siteUrl).pathname })}`, 302);
    const author = await readAuthor(db, request.params.username);
    if (!author) return sendNotFound(reply);
    if (author.id !== viewer.id) return reply.code(403).type('text/plain; charset=utf-8').send('접근 권한이 없습니다.');
    const [brand, socialLinks, subscription] = await Promise.all([
      readPublicSiteBrand(db), readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer),
    ]);
    const path = `${authorPath(author.username)}/about/edit`;
    return renderHtml(reply, PageLayout({
      meta: {
        title: `${author.username}님의 소개글 수정 - ${brand.siteName}`,
        description: '자신을 소개하는 글을 작성해 보세요.',
        canonical: makeAbsolute(siteUrl, path),
        siteName: brand.siteName,
        brand,
        viewer,
        robots: 'noindex,nofollow',
      },
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        h('div', { className: 'mx-auto w-full max-w-5xl px-4 sm:px-6' },
          authorTabs(author, 'about'),
          h('div', { className: 'mb-8' },
            h('div', { className: 'mb-6' },
              h('h1', { className: 'mb-3 text-lg font-bold text-content' }, '자신을 소개해 보세요.'),
              h('p', { className: 'text-md text-content-secondary' }, '자신을 소개하는 글을 작성해 보세요.'),
            ),
            h('div', { className: 'mb-6', 'data-about-page': '', 'data-about-url': path, 'data-about-return': authorPath(author.username) },
              h('textarea', { 'data-about-input': '', defaultValue: author.aboutMarkdown ?? '', placeholder: '마크다운으로 작성해 보세요.', 'aria-label': '소개',
                className: 'h-64 w-full rounded-lg border border-line p-4 focus:outline-none focus:ring-2 focus:ring-line-strong/70' }),
              h('button', { type: 'button', 'data-about-save': '', className: 'mt-4 rounded-lg bg-action px-6 py-3 text-content-inverted hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong/70 focus:ring-offset-2 disabled:opacity-50' }, '저장'),
              h('div', { 'data-about-message': '', hidden: true, className: 'mt-4 text-sm' }),
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/about', async (request, reply) => {
    const author = await readAuthor(db, request.params.username);
    if (!author) return sendNotFound(reply);
    return sendRedirect(reply, authorPath(author.username));
  });

  app.get<{ Params: { username: string } }>('/@:username/posts', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username, '/posts')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const tagFilter = (query.get('tag') ?? '').trim();
    const conditions = ['post.author_id = ?'];
    const parameters: SqlValue[] = [author.id];
    if (searchText) {
      conditions.push(`(post.title LIKE ? OR EXISTS (SELECT 1 FROM board_postcontent AS content
        WHERE content.post_id = post.id AND content.content_html LIKE ?))`);
      parameters.push(`%${searchText}%`, `%${searchText}%`);
    }
    if (tagFilter) {
      conditions.push(`EXISTS (SELECT 1 FROM board_post_tags AS post_tag
        JOIN board_tag AS tag ON tag.id = post_tag.tag_id
       WHERE post_tag.post_id = post.id AND tag.value = ?)`);
      parameters.push(tagFilter);
    }
    const count = await readPublicPostCount(db, conditions, parameters);
    const checkedPage = validPublicPage(reply, page, count, PAGE_SIZE);
    if (checkedPage === null) return reply;
    const posts = await readPublicPosts(db, {
      conditions,
      parameters,
      limit: PAGE_SIZE,
      offset: (checkedPage - 1) * PAGE_SIZE,
    });
    const tagOptions = await db.$queryRaw< Array<{ value: string }> >`
      SELECT DISTINCT tag.value AS value
        FROM board_tag AS tag
        JOIN board_post_tags AS post_tag ON post_tag.tag_id = tag.id
        JOIN board_post AS post ON post.id = post_tag.post_id
        LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
       WHERE post.author_id = ${author.id}
         AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
         AND post.published_date <= ${databaseNow()} AND COALESCE(post_config.hide, 0) = 0
       ORDER BY tag.value ASC
    `;
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const [socialLinks, subscription] = await Promise.all([readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer)]);
    const pages = totalPages(count, PAGE_SIZE);
    const path = authorPath(author.username, '/posts');
    const likes = await readCardLikes(db, request, viewer, posts);
    const noindex = hasUnexpected(query, ['page', 'q', 'tag']) || Boolean(searchText || tagFilter);
    const meta: PageMeta = {
      authorFeed: authorFeed(siteUrl, author.username),
      title: `포스트 - ${author.username} | ${siteName}`,
      description: `${author.username}님이 공개한 글을 모아봅니다.`,
      canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
      siteName,
      brand,
      viewer,
      robots: noindex ? 'noindex,follow' : undefined,
      ...makePaginationMeta(siteUrl, path, query, ['q', 'tag'], checkedPage, pages),
    };
    return renderHtml(reply, PageLayout({
      meta,
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        authorTabs(author, 'posts'),
        h('section', { className: 'mx-auto w-full max-w-6xl px-4 sm:px-6' },
          h('div', { className: 'mb-8' }, h('h1', { className: 'text-3xl font-bold tracking-tight text-content' }, '포스트')),
          h('div', { className: 'mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60' },
            h('div', { className: 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between' },
              h('div', { className: 'w-full lg:max-w-md' },
                h('label', { htmlFor: 'author-post-query', className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '검색'),
                QueryFilter({ path, search: query, placeholder: '포스트 검색', id: 'author-post-query' }),
              ),
              h('div', { className: 'w-full lg:w-44' },
                h('p', { className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '태그'),
                DropdownFilter({ path, search: query, param: 'tag', current: tagFilter,
                  options: [{ value: '', label: '전체 태그' }, ...tagOptions.map((tag) => ({ value: tag.value, label: tag.value }))] }),
              ),
            ),
          ),
          h('div', { className: 'grid grid-cols-1 gap-8 md:grid-cols-3' },
            h('div', { className: 'md:col-span-3' },
              posts.length ? PostGrid({ posts, showAuthor: false, likes }) : EmptyState({
                title: searchText || tagFilter ? '조건에 맞는 포스트가 없습니다' : '아직 공개된 포스트가 없습니다.',
                message: searchText || tagFilter ? '검색어나 태그를 다시 확인해주세요.' : '새 포스트가 발행되면 이곳에 표시됩니다.',
                icon: 'file-text',
              }),
              h('div', { className: 'mt-12 mb-12' }, Pagination({ path, search: query, preserve: ['q', 'tag'], page: checkedPage, pages })),
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string } }>('/@:username/series', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    if (author.username !== requestedUsername) return sendRedirect(reply, `${authorPath(author.username, '/series')}${new URL(request.url, siteUrl).search}`);
    if (!isEditor(author)) return sendRedirect(reply, authorPath(author.username, '/about'));

    const url = new URL(request.url, siteUrl);
    const query = url.searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const searchText = (query.get('q') ?? '').trim();
    const requestedSort = query.get('sort') ?? 'custom';
    const sort = ['custom', 'newest', 'oldest', 'posts'].includes(requestedSort) ? requestedSort : 'custom';
    const searchClause = searchText ? 'AND (series.name LIKE ? OR series.text_md LIKE ?)' : '';
    const seriesCountRows = await db.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*) AS count FROM (
        SELECT series.id
          FROM board_series AS series
         WHERE COALESCE(series.hide, 0) = 0 AND series.owner_id = ? ${searchClause}
           AND EXISTS (SELECT 1 FROM board_post AS post
             LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
            WHERE post.series_id = series.id AND ${PUBLIC_POST_WHERE})
      ) AS public_series
    `, author.id, ...(searchText ? [`%${searchText}%`, `%${searchText}%`] : []), databaseNow());
    const count = Number(seriesCountRows[0]?.count ?? 0);
    const checkedPage = validPublicPage(reply, page, count, 12);
    if (checkedPage === null) return reply;
    const orderBy = sort === 'newest' ? 'series.created_date DESC, series.id DESC'
      : sort === 'oldest' ? 'series.created_date ASC, series.id ASC'
        : sort === 'posts' ? 'postCount DESC, series."order" ASC'
          : 'series."order" ASC, series.id ASC';
    const seriesRows = await db.$queryRawUnsafe<SeriesRow[]>(`
      SELECT series.id AS id,
             series.url AS url,
             series.name AS name,
             series.text_md AS textMarkdown,
             series.text_html AS textHtml,
             CAST(series.created_date AS TEXT) AS createdDate,
             CAST(series.updated_date AS TEXT) AS updatedDate,
             COUNT(DISTINCT post.id) AS postCount,
             (SELECT thumb.image FROM board_post AS thumb
               LEFT JOIN board_postconfig AS thumb_config ON thumb_config.post_id = thumb.id
              WHERE thumb.series_id = series.id AND ${rawPublicPostWhere('thumb', 'thumb_config')}
              ORDER BY thumb.id ASC LIMIT 1) AS thumbnail
        FROM board_series AS series
        JOIN board_post AS post ON post.series_id = series.id
        LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
       WHERE COALESCE(series.hide, 0) = 0 AND series.owner_id = ?
         AND ${PUBLIC_POST_WHERE} ${searchClause}
       GROUP BY series.id
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?
    `, author.id, databaseNow(), ...(searchText ? [`%${searchText}%`, `%${searchText}%`] : []), 12, (checkedPage - 1) * 12);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const [socialLinks, subscription] = await Promise.all([readAuthorSocialLinks(db, author.id), subscriptionState(db, author, viewer)]);
    const pages = totalPages(count, 12);
    const path = authorPath(author.username, '/series');
    const noindex = hasUnexpected(query, ['page', 'q', 'sort']) || Boolean(searchText) || requestedSort !== 'custom';
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: authorFeed(siteUrl, author.username),
        title: `${author.username}님의 시리즈 - ${siteName}`,
        description: `${author.username}님이 공개한 시리즈를 둘러보세요.`,
        canonical: noindex ? makeAbsolute(siteUrl, path) : canonicalPageUrl(siteUrl, path, checkedPage),
        siteName,
        brand,
        viewer,
        robots: noindex ? 'noindex,follow' : undefined,
        ...makePaginationMeta(siteUrl, path, query, ['q', 'sort'], checkedPage, pages),
      },
      children: h(ReactFragment, null,
        profileHeader(author, false, subscription, viewer, csrfCookie(request), socialLinks, path),
        authorTabs(author, 'series'),
        h('section', { className: 'mx-auto w-full max-w-6xl px-4 sm:px-6' },
          h('div', { className: 'mb-8' }, h('h1', { className: 'text-3xl font-bold tracking-tight text-content' }, '시리즈')),
          h('div', { className: 'mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60' },
            h('div', { className: 'flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between' },
              h('div', { className: 'w-full lg:max-w-md' },
                h('label', { htmlFor: 'author-series-query', className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '검색'),
                QueryFilter({ path, search: query, placeholder: '시리즈 검색', id: 'author-series-query' }),
              ),
              h('div', { className: 'w-full lg:w-44' },
                h('p', { className: 'mb-2 ml-1 block text-xs font-semibold text-content-secondary' }, '정렬'),
                DropdownFilter({ path, search: query, param: 'sort', current: sort, options: [
                  { value: 'custom', label: '작가 지정 순' },
                  { value: 'newest', label: '최신순' },
                  { value: 'oldest', label: '오래된순' },
                  { value: 'posts', label: '포스트 많은 순' },
                ] }),
              ),
            ),
          ),
          h('div', { className: 'grid grid-cols-1 gap-8 md:grid-cols-3' },
            h('div', { className: 'md:col-span-3' },
              seriesRows.length ? h('div', { className: 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3' }, ...seriesRows.map((series) =>
                h('a', { className: 'group block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]', key: series.id, href: `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}` },
                  h('div', { className: 'flex h-full flex-col p-5' },
                    h('h2', { className: 'mb-2.5 line-clamp-2 text-lg font-bold leading-snug text-content transition-colors group-hover:text-content-secondary' }, series.name),
                    h('p', { className: 'mb-4 line-clamp-3 text-sm leading-relaxed text-content-secondary' }, series.textMarkdown),
                    h('div', { className: 'mt-auto flex items-center justify-between border-t border-line-light pt-4 text-xs font-medium text-content-secondary' },
                      h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'file-text', className: 'text-content-hint' }), `${series.postCount}개 포스트`),
                      h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock', className: 'text-content-hint' }), h('time', { dateTime: dateValue(series.updatedDate) ?? undefined }, dateLabel(series.updatedDate))),
                    ),
                  ),
                ),
              )) : EmptyState({
                title: searchText ? '조건에 맞는 시리즈가 없습니다' : '아직 공개된 시리즈가 없습니다',
                message: searchText ? '검색어를 다시 확인해주세요.' : '시리즈가 공개되면 이곳에 표시됩니다.',
                icon: 'stack-2',
              }),
              seriesRows.length ? h('div', { className: 'mt-12 mb-12' }, Pagination({ path, search: query, preserve: ['q', 'sort'], page: checkedPage, pages })) : null,
            ),
          ),
        ),
      ),
    }));
  });

  app.get<{ Params: { username: string; seriesUrl: string } }>('/@:username/series/:seriesUrl', async (request, reply) => {
    const requestedUsername = request.params.username;
    const author = await readAuthor(db, requestedUsername);
    if (!author) return sendNotFound(reply);
    const query = new URL(request.url, siteUrl).searchParams;
    const page = pageFrom(query);
    if (page === null) return sendNotFound(reply);
    const sortOrder = query.get('sort') === 'asc' ? 'asc' : 'desc';
    const now = databaseNow();
    const seriesRows = await db.$queryRaw<SeriesDetailRow[]>`
      SELECT series.id AS id,
             series.url AS url,
             series.name AS name,
             series.text_md AS textMarkdown,
             series.text_html AS textHtml,
             CAST(series.created_date AS TEXT) AS createdDate,
             CAST(series.updated_date AS TEXT) AS updatedDate,
             series.owner_id AS authorId,
             author.username AS authorUsername,
             profile.avatar AS authorAvatar,
             (SELECT COUNT(*) FROM board_post AS post
               LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
              WHERE post.series_id = series.id
                AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
                AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0) AS postCount,
             (SELECT thumb.image FROM board_post AS thumb
               LEFT JOIN board_postconfig AS thumb_config ON thumb_config.post_id = thumb.id
              WHERE thumb.series_id = series.id
                AND thumb.deleted_date IS NULL AND thumb.published_date IS NOT NULL
                AND thumb.published_date <= ${now} AND COALESCE(thumb_config.hide, 0) = 0
              ORDER BY thumb.id ASC LIMIT 1) AS thumbnail
        FROM board_series AS series
        JOIN auth_user AS author ON author.id = series.owner_id
        LEFT JOIN board_profile AS profile ON profile.user_id = author.id
       WHERE series.owner_id = ${author.id}
         AND series.url = ${request.params.seriesUrl}
         AND COALESCE(series.hide, 0) = 0
         AND EXISTS (SELECT 1 FROM board_post AS post
           LEFT JOIN board_postconfig AS post_config ON post_config.post_id = post.id
          WHERE post.series_id = series.id
            AND post.deleted_date IS NULL AND post.published_date IS NOT NULL
            AND post.published_date <= ${now} AND COALESCE(post_config.hide, 0) = 0)
       LIMIT 1
    `;
    const series = seriesRows[0];
    if (!series) return sendNotFound(reply);
    const seriesPath = `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}`;
    if (author.username !== requestedUsername) return sendRedirect(reply, seriesPath);
    const count = Number(series.postCount);
    const checkedPage = validPublicPage(reply, page, count, 10);
    if (checkedPage === null) return reply;
    const orderBy = sortOrder === 'asc' ? 'post.published_date ASC, post.id ASC' : 'post.published_date DESC, post.id DESC';
    const posts = await readPublicPosts(db, {
      conditions: ['post.series_id = ?'],
      parameters: [series.id],
      orderBy,
      limit: 10,
      offset: (checkedPage - 1) * 10,
    });
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const pages = totalPages(count, 10);
    const metaDescription = description(series.textHtml || series.textMarkdown, `${author.username}님의 ${siteName} 시리즈: ${series.name}`);
    const canonicalQuery = new URLSearchParams();
    if (sortOrder === 'asc' && checkedPage > 1) canonicalQuery.set('sort', 'asc');
    if (checkedPage > 1) canonicalQuery.set('page', String(checkedPage));
    const canonical = makeAbsolute(siteUrl, canonicalQuery.size ? `${seriesPath}?${canonicalQuery}` : seriesPath);
    const authorUrl = makeAbsolute(siteUrl, authorPath(author.username));
    const structuredData: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: series.name,
      headline: series.name,
      description: metaDescription,
      url: canonical,
      author: { '@type': 'Person', name: author.username, url: authorUrl },
      isPartOf: { '@type': 'WebSite', name: siteName, url: makeAbsolute(siteUrl, '/') },
      mainEntity: {
        '@type': 'ItemList',
        itemListOrder: sortOrder === 'desc' ? 'https://schema.org/ItemListOrderDescending' : 'https://schema.org/ItemListOrderAscending',
        numberOfItems: count,
        itemListElement: posts.map((post, index) => ({
          '@type': 'ListItem',
          position: sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1,
          item: {
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description || post.title,
            url: makeAbsolute(siteUrl, postPath(post)),
            datePublished: dateValue(post.publishedDate),
            author: { '@type': 'Person', name: author.username, url: authorUrl },
          },
        })),
      },
      dateModified: dateValue(series.updatedDate),
    };
    const previous = checkedPage > 1 ? new URLSearchParams({ ...(sortOrder === 'asc' ? { sort: 'asc' } : {}), ...(checkedPage > 2 ? { page: String(checkedPage - 1) } : {}) }).toString() : '';
    const next = checkedPage < pages ? new URLSearchParams({ ...(sortOrder === 'asc' ? { sort: 'asc' } : {}), page: String(checkedPage + 1) }).toString() : '';
    const seriesMarkdown = await advertiseMarkdown(reply, db, siteUrl, seriesPath);
    return renderHtml(reply, PageLayout({
      meta: {
        authorFeed: authorFeed(siteUrl, author.username),
        markdownUrl: seriesMarkdown,
        title: `${series.name} - ${author.username} | ${siteName}`,
        description: metaDescription,
        canonical,
        siteName,
        brand,
        viewer,
        structuredData,
        previous: previous ? makeAbsolute(siteUrl, `${seriesPath}?${previous}`) : undefined,
        next: next ? makeAbsolute(siteUrl, `${seriesPath}?${next}`) : undefined,
      },
      children: h('div', { className: 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12' },
        h('header', { className: 'mb-12 text-center' },
          h('span', { className: 'mb-4 inline-block rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-content-secondary' }, '시리즈'),
          h('h1', { className: 'mb-4 text-3xl font-bold leading-tight tracking-tight text-content sm:text-4xl' }, series.name),
          series.textHtml ? h('div', { className: 'mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-content-secondary', dangerouslySetInnerHTML: { __html: sanitizePostHtml(series.textHtml) } }) : null,
          h('div', { className: 'flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary' },
            h('a', { href: authorPath(author.username), className: 'flex items-center gap-2 transition-colors hover:text-content' },
              h('img', { className: 'size-6 rounded-full object-cover ring-2 ring-line-light', src: avatarUrl(series.authorAvatar), alt: author.username }),
              h('span', { className: 'font-semibold text-content' }, author.username),
            ),
            h('span', { className: 'size-1 rounded-full bg-content-hint/70', 'aria-hidden': true }),
            h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'file-text', className: 'text-xs' }), `${count}개 포스트`),
            h('span', { className: 'size-1 rounded-full bg-content-hint/70', 'aria-hidden': true }),
            h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock', className: 'text-xs' }), `${dateLabel(series.updatedDate)} 수정됨`),
          ),
          viewer?.id === author.id ? h('div', { className: 'mt-8' },
            h('a', { href: `/settings/series/edit/${series.id}`, className: 'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-[0.98]' },
              h(SiteIcon, { name: 'edit', className: 'text-xs' }), h('span', null, '시리즈 편집'),
            ),
          ) : null,
        ),
        posts.length ? h('div', { className: 'mb-6 flex justify-end' },
          h('nav', { className: 'inline-flex rounded-xl bg-surface-subtle/80 p-1 backdrop-blur-sm ring-1 ring-line/60', 'aria-label': '포스트 정렬' },
            h('a', { href: `${seriesPath}?sort=asc`, 'aria-current': sortOrder === 'asc' ? 'page' : undefined,
              className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'asc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` }, '오래된순'),
            h('a', { href: seriesPath, 'aria-current': sortOrder === 'desc' ? 'page' : undefined,
              className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'desc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}` }, '최신순'),
          ),
        ) : null,
        posts.length ? h('div', { className: 'space-y-4' }, ...posts.map((post, index) => {
          const number = sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1;
          return h('article', { className: 'group relative rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]', key: post.id },
            h('a', { className: 'flex items-start gap-5', href: postPath(post) },
              h('span', { className: 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-sm font-bold text-content-hint transition-colors duration-150 group-hover:bg-action group-hover:text-content-inverted' }, String(number)),
              h('div', { className: 'min-w-0 flex-1 pt-1' },
                h('h2', { className: 'mb-2 block text-lg font-bold leading-snug text-content transition-colors group-hover:text-content' }, post.title),
                h('span', { className: 'flex flex-wrap items-center gap-4 text-xs font-medium text-content-hint' },
                  h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'calendar' }), formatPostDate(post)),
                  h('span', { className: 'flex items-center gap-1.5' }, h(SiteIcon, { name: 'clock' }), `${post.readTime}분`),
                  h('span', { className: 'ml-auto flex items-center gap-3' },
                    h('span', { className: 'flex items-center gap-1.5 transition-colors hover:text-danger' }, h(SiteIcon, { name: 'heart' }), String(Number(post.likeCount ?? 0))),
                    h('span', { className: 'flex items-center gap-1.5 transition-colors hover:text-content' }, h(SiteIcon, { name: 'message-circle' }), String(Number(post.commentCount ?? 0))),
                  ),
                ),
              ),
            ),
          );
        })) : EmptyState({ title: '아직 포스트가 없어요', message: '이 시리즈에는 아직 포스트가 추가되지 않았습니다.', icon: 'stack-2', framed: true }),
        posts.length ? h('div', { className: 'mt-12' }, Pagination({
          path: seriesPath,
          search: new URLSearchParams(sortOrder === 'asc' ? 'sort=asc' : ''),
          preserve: ['sort'],
          page: checkedPage,
          pages,
        })) : null,
      ),
    }));
  });

  app.get<{ Params: { slug: string } }>('/static/:slug', async (request, reply) => {
    const slug = request.params.slug;
    if (slug.endsWith('.md')) return sendNotFound(reply);
    const [page] = await db.$queryRaw<StaticPageRow[]>`
      SELECT page.title AS title,
             page.content AS content,
             page.meta_description AS metaDescription,
             CAST(page.created_date AS TEXT) AS createdDate,
             CAST(page.updated_date AS TEXT) AS updatedDate,
             author.username AS authorUsername
        FROM board_staticpage AS page
        LEFT JOIN auth_user AS author ON author.id = page.author_id
       WHERE page.slug = ${slug} AND COALESCE(page.is_published, 0) = 1
       LIMIT 1
    `;
    if (!page) return sendNotFound(reply);
    const { brand, siteName, viewer } = await getLayoutContext(request, reply, db, options);
    const path = `/static/${encodeURIComponent(slug)}`;
    const canonical = makeAbsolute(siteUrl, path);
    const metaDescription = description(page.metaDescription || page.content, page.title);
    const structuredData = safeStructuredPageData(
      siteName,
      canonical,
      page.title,
      metaDescription,
      page.createdDate,
      page.updatedDate,
      page.authorUsername,
      siteUrl,
    );
    const pageMarkdown = await advertiseMarkdown(reply, db, siteUrl, path);
    return renderHtml(reply, PageLayout({
      meta: {
        markdownUrl: pageMarkdown,
        title: `${page.title} - ${siteName}`,
        description: metaDescription,
        canonical,
        siteName,
        brand,
        viewer,
        structuredData,
      },
      children: h('article', { className: 'rich-content' },
        h('div', { dangerouslySetInnerHTML: { __html: `${staticPageStyles(page.content)}${sanitizePostHtml(page.content)}` } }),
      ),
    }));
  });
}

/** Static pages are written by administrators and may carry their own stylesheet, as they did in 3.x. */
function staticPageStyles(content: string): string {
  return [...content.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => `<style>${match[1]}</style>`).join('');
}
