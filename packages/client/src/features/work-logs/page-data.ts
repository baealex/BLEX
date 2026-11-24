import type {
    PageChrome,
    PagerView,
    WorkLogDeleteProps,
    WorkLogDetailProps,
    WorkLogEntryView,
    WorkLogIndexProps,
    WorkLogSharedProps
} from '@blex/contracts/work-logs';
import { koreanDate, koreanDateTime } from '../../lib/date-format';
import { pageFields } from './fields';

/**
 * Everything the browser needs to hydrate a work log page. It is in the HTML, so each field is listed by hand.
 * What the writer wrote, such as log titles, entries, and share headlines, stays out: hydration reads it back
 * from the server markup. Ids appear only where the page already shows them in a link, form, or media address.
 */
interface WorkLogPageBase {
    brand?: {
        siteName: string;
        logoUrl: string | null;
        darkLogoUrl: string | null;
        footerPages: Array<{ title: string; slug: string }>;
    };
    copyrightYear: number;
}

/** Dates are formatted once on the server, so the browser's time zone cannot change the text. */
export interface DateView {
    iso: string;
    text: string;
}

export interface MediaView {
    url: string;
    video: boolean;
}

export interface WorkLogIndexData extends WorkLogPageBase {
    page: 'index';
    canWrite: boolean;
    csrfToken: string;
    error: string;
    logs: Array<{ id: number; entryCount: number }>;
    links: PagerView;
}

export interface WorkLogDetailData extends WorkLogPageBase {
    page: 'detail';
    logId: number;
    canWrite: boolean;
    csrfToken: string;
    error: string;
    shareError: string;
    timeline: Array<{ id: number; date: DateView; media: MediaView | null }>;
    selector: Array<{ id: number; checked: boolean }>;
    savedSelection: string;
    selectedCount: number;
    shares: Array<{ token: string }>;
    timelineLinks: PagerView;
    shareLinks: PagerView;
    timelinePage: number;
    selectionPage: number;
    linksPage: number;
    previousSelectionPage: string | null;
    nextSelectionPage: string | null;
}

export interface WorkLogDeleteData extends WorkLogPageBase {
    page: 'delete';
    logId: number;
    csrfToken: string;
    entry: { id: number; date: DateView; hasExcerpt: boolean } | null;
}

export interface WorkLogSharedData extends WorkLogPageBase {
    page: 'shared';
    ownerUsername: string;
    sharedAt: DateView | null;
    cover: { media: MediaView; hasTitle: boolean } | null;
    entries: Array<{ key: string; date: DateView; media: MediaView | null }>;
    timelineLinks: PagerView;
    /** The owner's preview before the link exists. */
    preview: {
        logId: number;
        csrfToken: string;
        selectedIds: string;
        timelinePage: number;
        selectionPage: number;
        linksPage: number;
        previousPage: string | null;
        nextPage: string | null;
    } | null;
    /** Shown once to the owner right after the link is created. */
    newLinkUrl: string | null;
}

export type WorkLogPageData = WorkLogIndexData | WorkLogDetailData | WorkLogDeleteData | WorkLogSharedData;

/** What the writer wrote, in the order the page shows it. The server passes it, and the browser reads it back. */
export interface EntryText {
    title: string;
    text: string;
}

/** Typed values are absent on a fresh form, which renders without a value attribute. */
export interface WorkLogIndexText {
    titles: string[];
    typedTitle?: string;
}

export interface WorkLogDetailText {
    logTitle: string;
    timeline: EntryText[];
    selectorLabels: string[];
    shareHeadlines: string[];
    typedEntryTitle?: string;
    typedEntryText?: string;
    typedHeadline?: string;
}

export interface WorkLogDeleteText {
    logTitle: string;
    excerpt: string;
}

export interface WorkLogSharedText {
    logTitle: string;
    headline: string;
    coverTitle: string;
    entries: EntryText[];
}

function pageBase({ brand }: PageChrome): WorkLogPageBase {
    return {
        brand: brand && {
            siteName: brand.siteName,
            logoUrl: brand.logoUrl ?? null,
            darkLogoUrl: brand.darkLogoUrl ?? null,
            footerPages: (brand.footerPages ?? []).map(({ title, slug }) => ({ title, slug }))
        },
        copyrightYear: new Date().getFullYear()
    };
}

function pager({ previous, next }: PagerView): PagerView {
    return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}

function dateView(value: string): DateView {
    return { iso: value, text: koreanDate(value) };
}

function mediaView(entry: WorkLogEntryView, url: (entry: WorkLogEntryView) => string): MediaView | null {
    return entry.attachment ? { url: url(entry), video: entry.mediaType.startsWith('video/') } : null;
}

export function truncateChars(text: string, limit: number): string {
    const characters = Array.from(text);
    return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : text;
}

function pageParameter(link: string | undefined, name: string): string | null {
    return link ? new URL(link, 'https://work-log.invalid').searchParams.get(name) : null;
}

export function createIndexData(props: WorkLogIndexProps): WorkLogIndexData {
    return {
        ...pageBase(props),
        page: 'index',
        canWrite: props.canWrite,
        csrfToken: props.csrfToken,
        error: props.error ?? '',
        logs: props.logs.map(({ id, entryCount }) => ({ id, entryCount: entryCount ?? 0 })),
        links: pager(props.links)
    };
}

export function indexText(props: WorkLogIndexProps): WorkLogIndexText {
    return { titles: props.logs.map(({ title }) => title), typedTitle: props.title };
}

export function createDetailData(props: WorkLogDetailProps): WorkLogDetailData {
    const selectorIds = new Set(props.selector.map((entry) => entry.id));
    return {
        ...pageBase(props),
        page: 'detail',
        logId: props.log.id,
        canWrite: props.canWrite,
        csrfToken: props.csrfToken,
        error: props.error ?? '',
        shareError: props.shareError ?? '',
        timeline: props.timeline.map((entry) => ({
            id: entry.id,
            date: dateView(entry.createdAt),
            media: mediaView(entry, props.mediaUrl)
        })),
        selector: props.selector.map(({ id }) => ({ id, checked: props.selectedIds.includes(id) })),
        savedSelection: props.selectedIds
            .filter((id) => !selectorIds.has(id))
            .sort((a, b) => a - b)
            .join(','),
        selectedCount: props.selectedIds.length,
        shares: props.shares.map(({ token }) => ({ token })),
        timelineLinks: pager(props.timelineLinks),
        shareLinks: pager(props.shareLinks),
        timelinePage: props.timelinePage,
        selectionPage: props.selectionPage,
        linksPage: props.linksPage,
        previousSelectionPage: pageParameter(props.selectionLinks.previous, pageFields.selectionPage),
        nextSelectionPage: pageParameter(props.selectionLinks.next, pageFields.selectionPage)
    };
}

export function detailText(props: WorkLogDetailProps): WorkLogDetailText {
    return {
        logTitle: props.log.title,
        timeline: props.timeline.map(({ title, text }) => ({ title, text })),
        selectorLabels: props.selector.map(({ title, text }) => title || (text ? truncateChars(text, 52) : '')),
        shareHeadlines: props.shares.map(({ headline }) => headline),
        typedEntryTitle: props.entryTitle,
        typedEntryText: props.entryText,
        typedHeadline: props.headline
    };
}

export function createDeleteData(props: WorkLogDeleteProps): WorkLogDeleteData {
    const { entry } = props;
    return {
        ...pageBase(props),
        page: 'delete',
        logId: props.log.id,
        csrfToken: props.csrfToken,
        entry: entry
            ? {
                  id: entry.id,
                  date: { iso: entry.createdAt, text: koreanDateTime(entry.createdAt) },
                  hasExcerpt: Boolean(entry.title || entry.text)
              }
            : null
    };
}

export function deleteText(props: WorkLogDeleteProps): WorkLogDeleteText {
    const { entry } = props;
    return {
        logTitle: props.log.title,
        excerpt: entry && (entry.title || entry.text) ? truncateChars(entry.title || entry.text, 120) : ''
    };
}

export function createSharedData(props: WorkLogSharedProps): WorkLogSharedData {
    const cover = props.cover;
    return {
        ...pageBase(props),
        page: 'shared',
        ownerUsername: props.ownerUsername,
        sharedAt: props.sharedAt ? dateView(props.sharedAt) : null,
        cover: cover
            ? {
                  media: { url: props.mediaUrl(cover), video: cover.mediaType.startsWith('video/') },
                  hasTitle: Boolean(cover.title)
              }
            : null,
        // Text-only entries show no id, so their keys are positions.
        entries: props.entries.map((entry, position) => ({
            key: `${entry.createdAt}:${position}`,
            date: dateView(entry.createdAt),
            media: entry.attachment && entry.id !== cover?.id ? mediaView(entry, props.mediaUrl) : null
        })),
        timelineLinks: pager(props.timelineLinks),
        preview: props.preview
            ? {
                  logId: props.log.id,
                  csrfToken: props.csrfToken,
                  selectedIds: (props.selectedIds ?? []).join(','),
                  timelinePage: props.timelinePage ?? 1,
                  selectionPage: props.selectionPage ?? 1,
                  linksPage: props.linksPage ?? 1,
                  previousPage: pageParameter(props.timelineLinks.previous, 'page'),
                  nextPage: pageParameter(props.timelineLinks.next, 'page')
              }
            : null,
        newLinkUrl: !props.preview && props.newLink ? props.shareUrl : null
    };
}

export function sharedText(props: WorkLogSharedProps): WorkLogSharedText {
    return {
        logTitle: props.log.title,
        headline: props.headline,
        coverTitle: props.cover?.title ?? '',
        entries: props.entries.map(({ title, text }) => ({ title, text }))
    };
}
