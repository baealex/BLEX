import { createHash } from 'node:crypto';
import { createElement, type ReactNode } from 'react';
import type { PostRow, StoredDate } from '../../contracts/public';

export const h = createElement;

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
  const index = Number.parseInt(digest.slice(0, 8), 16) % 6 + 1;
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
    return new Intl.DateTimeFormat('ko-KR', {
 dateStyle: 'long',
timeZone: 'Asia/Seoul'
}).format(date);
  }
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
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

export function formatPostDate(post: PostRow): ReactNode {
  if (!post.publishedDate) return null;
  return h('time', { dateTime: dateValue(post.publishedDate) ?? undefined }, dateLabel(post.publishedDate));
}
