import type { PageProps } from '@blex/contracts/pages';

type RevisionsProps = PageProps['@{$username}/{$slug}/revisions'];
type TimelapseProps = PageProps['@{$username}/{$slug}/timelapse'];
type ShareLinksProps = PageProps['@{$username}/{$slug}/share-links'];

/**
 * Everything the browser needs to hydrate a post's revision history, writing timeline, or share links.
 * Only the post's author receives these pages, and each field is listed by hand. Revision and frame
 * content stays out: hydration reads it back from the server markup, so the data only says whether it is there.
 */
export interface RevisionsPageData {
    page: 'revisions';
    postPath: string;
    title: string;
    totalCount: number;
    notice: string;
    csrfToken: string;
    updatedDate: string;
    pagination: { page: number; lastPage: number };
    revisions: Array<{
        id: number;
        title: string;
        changeType: string;
        actor: string | null;
        date: string | null;
        savedLabel: string;
        hasExcerpt: boolean;
        hasContent: boolean;
    }>;
}

export interface TimelapsePageData {
    page: 'timelapse';
    postPath: string;
    title: string;
    totalCount: number;
    frames: Array<{ savedAt: string; title: string; draft: boolean; savedLabel: string }>;
}

export interface ShareLinksPageData {
    page: 'share-links';
    title: string;
    postPath: string;
    error: string;
    create: boolean;
    action: string;
    csrfToken: string;
    links: Array<{
        id: number;
        label: string;
        url: string;
        isPaused: boolean;
        recentClicks: number;
        totalClicks: number;
    }>;
}

export type PostManagementPageData = RevisionsPageData | TimelapsePageData | ShareLinksPageData;

/** A revision's authored text, which the server passes and the browser reads back from the page. */
export interface RevisionBody {
    excerpt: string;
    html: string;
}

export function postManagementPath(username: string, slug: string): string {
    return `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
}

export function createRevisionsPageData(model: RevisionsProps): RevisionsPageData {
    return {
        page: 'revisions',
        postPath: postManagementPath(model.username, model.slug),
        title: model.title,
        totalCount: model.totalCount,
        notice: model.notice,
        csrfToken: model.csrfToken,
        updatedDate: model.updatedDate,
        pagination: { page: model.page, lastPage: model.lastPage },
        revisions: model.revisions.map(
            ({ id, title, changeType, actor, date, savedLabel, contentExcerpt, contentHtml }) => ({
                id,
                title,
                changeType,
                actor,
                date,
                savedLabel,
                hasExcerpt: Boolean(contentExcerpt),
                hasContent: Boolean(contentHtml)
            })
        )
    };
}

export function revisionBodies(model: RevisionsProps): RevisionBody[] {
    return model.revisions.map(({ contentExcerpt, contentHtml }) => ({
        excerpt: contentExcerpt ?? '',
        html: contentHtml
    }));
}

export function createTimelapsePageData(model: TimelapseProps): TimelapsePageData {
    return {
        page: 'timelapse',
        postPath: postManagementPath(model.username, model.slug),
        title: model.title,
        totalCount: model.totalCount,
        frames: model.frames.map(({ savedAt, title, stage, savedLabel }) => ({
            savedAt,
            title,
            draft: stage === 'draft',
            savedLabel
        }))
    };
}

export function createShareLinksPageData(model: ShareLinksProps): ShareLinksPageData {
    return {
        page: 'share-links',
        title: model.title,
        postPath: model.postPath,
        error: model.error,
        create: model.create,
        action: model.action,
        csrfToken: model.csrf,
        links: model.links.map(({ id, label, url, isPaused, recentClicks, totalClicks }) => ({
            id,
            label,
            url,
            isPaused,
            recentClicks,
            totalClicks
        }))
    };
}
