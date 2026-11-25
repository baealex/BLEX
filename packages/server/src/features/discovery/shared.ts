import { requestLocale } from '../../platform/request-locale.js';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sanitizePostHtml } from '../posts/post-html.js';
import { authorPath } from '../authors/services/profile.js';
import type {
  SiteBrand,
  NoticeRow,
  SubscriptionState,
  PostRow,
  AuthorRow,
  TagRow,
  SeriesRow,
  SeriesListRow,
  SeriesDetailRow,
  AuthorSocialLink,
  PageMeta,
  PublicPageViewer,
} from '@blex/contracts/public';

type StoredDate = string | Date;

export type {
  SiteBrand,
  NoticeRow,
  SubscriptionState,
  PostRow,
  AuthorRow,
  TagRow,
  SeriesRow,
  SeriesListRow,
  SeriesDetailRow,
  AuthorSocialLink,
  PageMeta,
  PublicPageViewer,
};

export interface PostQueryOptions {
  where?: Prisma.PostWhereInput;
  orderBy?: Prisma.PostOrderByWithRelationInput[];
  limit?: number;
  offset?: number;
}

export const PAGE_SIZE = 24;

export function makeAbsolute(siteUrl: URL, path: string): string {
  return new URL(path, siteUrl).href;
}

export function pageFrom(search: URLSearchParams): number | null {
  const raw = search.get('page');
  if (raw === null) return 1;
  if (!/^\+?\d+$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}

export function totalPages(count: number, size: number): number {
  return Math.max(1, Math.ceil(count / size));
}

export function pageUrl(path: string, params: URLSearchParams, keys: string[], page: number): string {
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null && value !== '') next.set(key, value);
  }
  if (page > 1) next.set('page', String(page));
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}

export function canonicalPageUrl(siteUrl: URL, path: string, page: number): string {
  return makeAbsolute(siteUrl, page > 1 ? `${path}?page=${page}` : path);
}

export function hasUnexpected(search: URLSearchParams, allowed: string[]): boolean {
  return [...search.keys()].some((key) => !allowed.includes(key));
}

export function validPublicPage(
  reply: FastifyReply,
  requestedPage: number | null,
  count: number,
  pageSize: number,
): number | null {
  if (requestedPage === null || requestedPage > totalPages(count, pageSize)) {
    reply.code(404).type('text/plain; charset=utf-8').send('Not found');
    return null;
  }
  return requestedPage;
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `/resources/media/${path.replace(/^\/+/, '')}`;
}

function resourceUrl(path: string): string {
  return `/resources/${path.replace(/^\/+/, '')}`;
}

export function postCover(post: PostRow): string {
  if (post.image) return mediaUrl(post.image) ?? resourceUrl('assets/images/default-cover-1.jpg');
  const digest = createHash('md5').update(post.slug).digest('hex');
  const index = (Number.parseInt(digest.slice(0, 8), 16) % 6) + 1;
  return resourceUrl(`assets/images/default-cover-${index}.jpg`);
}

export function avatarUrl(path: string | null | undefined): string {
  return mediaUrl(path) ?? resourceUrl('assets/images/default-avatar.jpg');
}

export function dateValue(value: StoredDate | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  let normalized = value.includes('T') ? value : value.replace(' ', 'T');
  if (!/(?:Z|[+-]\d\d:\d\d)$/i.test(normalized)) normalized += 'Z';
  return normalized.replace(/(\.\d{3})\d+(?=Z$)/, '$1');
}

export function dateLabel(value: StoredDate | null): string {
  if (!value) return '';
  const date = new Date(dateValue(value) ?? value);
  if (!Number.isNaN(date.valueOf())) {
    return new Intl.DateTimeFormat(requestLocale(), { dateStyle: 'long', timeZone: 'Asia/Seoul' }).format(date);
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

export function description(raw: string, fallback: string): string {
  const text = plainText(raw) || fallback;
  const characters = Array.from(text);
  return characters.length <= 160 ? text : `${characters.slice(0, 159).join('')}…`;
}

export function safeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function sendNotFound(reply: FastifyReply): FastifyReply {
  return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
}

export function sendRedirect(reply: FastifyReply, path: string): FastifyReply {
  return reply.code(302).header('location', path).send();
}

export function makePaginationMeta(
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

export function safeStructuredPageData(
  siteName: string,
  canonical: string,
  title: string,
  descriptionText: string,
  createdDate: StoredDate | null,
  updatedDate: StoredDate | null,
  authorUsername: string | null,
  siteUrl: URL,
): Record<string, unknown> {
  const author = authorUsername
    ? {
        '@type': 'Person',
        name: authorUsername,
        url: makeAbsolute(siteUrl, authorPath(authorUsername)),
      }
    : undefined;
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

export interface PublicPageOptions {
  currentUser?: (request: FastifyRequest) => Promise<PublicPageViewer | null>;
  requiresSetup?: () => Promise<boolean>;
}

/**
 * Administrator-written static pages may include their own stylesheet.
 * A style body ends at the first tag the HTML parser would close it with, including `</style/>` and `</style x>`.
 */
export function staticPageStyles(content: string): string {
  const styles: string[] = [];
  let bodyStart = -1;
  let tagEnd = -1;
  for (const { 0: tag, index } of content.matchAll(/<\/?style(?=[\s/>])/gi)) {
    if (tagEnd < index) tagEnd = content.indexOf('>', index);
    if (tagEnd < 0) break;
    const closing = tag[1] === '/';
    if (closing && bodyStart >= 0 && index >= bodyStart) {
      styles.push(`<style>${content.slice(bodyStart, index)}</style>`);
      bodyStart = -1;
    } else if (!closing && bodyStart < 0) {
      bodyStart = tagEnd + 1;
    }
  }
  return styles.join('');
}

/** The HTML a published static page shows; the editor preview uses it too so the two cannot drift. */
export function staticPageHtml(content: string): string {
  return `${staticPageStyles(content)}${sanitizePostHtml(content)}`;
}
