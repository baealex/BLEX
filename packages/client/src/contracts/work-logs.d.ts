import type { HeaderViewer, SiteHeaderProps } from './views.js';

export interface WorkLogView {
    id: number;
    title: string;
    createdAt: string;
    entryCount?: number;
}

export interface WorkLogEntryView {
    id: number;
    title: string;
    text: string;
    mediaType: string;
    attachment: string;
    createdAt: string;
}

export interface WorkLogShareView {
    id: number;
    token: string;
    headline: string;
    createdAt: string;
}

export interface PagerView {
    previous?: string;
    next?: string;
    anchor?: string;
}

export interface PageChrome {
    brand?: SiteHeaderProps['brand'];
    viewer?: HeaderViewer;
}

export type WorkLogIndexProps = PageChrome & {
    logs: WorkLogView[];
    canWrite: boolean;
    csrfToken: string;
    error?: string;
    title?: string;
    links: PagerView;
};

export type WorkLogDetailProps = PageChrome & {
    log: WorkLogView;
    canWrite: boolean;
    csrfToken: string;
    timeline: WorkLogEntryView[];
    selector: WorkLogEntryView[];
    selectedIds: number[];
    shares: WorkLogShareView[];
    timelineLinks: PagerView;
    selectionLinks: PagerView;
    shareLinks: PagerView;
    timelinePage: number;
    selectionPage: number;
    linksPage: number;
    mediaUrl: (entry: WorkLogEntryView) => string;
    error?: string;
    shareError?: string;
    entryTitle?: string;
    entryText?: string;
    headline?: string;
};

export type WorkLogDeleteProps = PageChrome & {
    log: WorkLogView;
    entry?: WorkLogEntryView;
    csrfToken: string;
};

export type WorkLogSharedProps = PageChrome & {
    log: WorkLogView;
    ownerUsername: string;
    headline: string;
    entries: WorkLogEntryView[];
    cover: WorkLogEntryView | null;
    imageUrl: string | null;
    shareUrl: string;
    sharedAt?: string;
    timelineLinks: PagerView;
    newLink: boolean;
    preview?: boolean;
    selectedIds?: number[];
    csrfToken: string;
    timelinePage?: number;
    selectionPage?: number;
    linksPage?: number;
    mediaUrl: (entry: WorkLogEntryView) => string;
};
