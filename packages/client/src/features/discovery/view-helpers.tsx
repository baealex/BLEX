import { getDocumentLocale } from '../../i18n/locale.js';
import type { ReactNode } from 'react';
import type { PostRow, StoredDate } from '@blex/contracts/public';

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

export function resourceUrl(path: string): string {
    return `/resources/${path.replace(/^\/+/, '')}`;
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
        return new Intl.DateTimeFormat(getDocumentLocale(), {
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

export function noticeLink(value: string): string | null {
    const candidate = value.trim();
    if (!candidate || /[\x00-\x20\x7f\\]/.test(candidate)) return null;
    const normalized = candidate.replace(/&(?:#0*58|#x0*3a|colon);/gi, ':').replace(/&(?:#0*47|#x0*2f|sol);/gi, '/');
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

export function formatPostDate(post: PostRow): ReactNode {
    if (!post.publishedDate) return null;
    return <time dateTime={dateValue(post.publishedDate) ?? undefined}>{dateLabel(post.publishedDate)}</time>;
}
