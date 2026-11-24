import type { DeveloperCommands } from './developer-api.js';
import type { CommentPayload, ReaderAuthorHeader, ReaderPostLikeState, ReaderPostView } from './engagement.js';
import type { HeaderViewer, LoginModel } from './views.js';
import type { WorkLogDeleteProps, WorkLogDetailProps, WorkLogIndexProps, WorkLogSharedProps } from './work-logs.js';
import type {
    AuthorRow,
    AuthorSocialLink,
    CardLikes,
    NoticeRow,
    PageMeta,
    PostRow,
    PublicPageViewer,
    SeriesDetailRow,
    SeriesRow,
    SiteBrand,
    SubscriptionState,
    TagRow
} from './public.js';

export type {
    CommentPayload,
    ReaderAuthorHeader,
    ReaderPostLikeState,
    ReaderPostView,
    AuthorRow,
    AuthorSocialLink,
    NoticeRow,
    PageMeta,
    PostRow,
    PublicPageViewer,
    SeriesDetailRow,
    SeriesRow,
    SiteBrand,
    SubscriptionState,
    TagRow
};

export type PublicPost = {
    id: number;
    authorId: number;
    username: string;
    slug: string;
    title: string;
    subtitle: string;
    description: string;
    contentHtml: string;
    image: string;
    readTime: number;
    authorAvatar: string;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    publishedDate: string;
    updatedDate: string;
    visibility: 'hidden' | 'draft' | 'public' | 'scheduled';
};
export type PostPresentation = {
    aeoEnabled: boolean;
    seriesName: null | string;
    seriesUrl: null | string;
    seriesAuthor: null | string;
    seriesNavigation?: PostSeriesNavigation | null;
    tags: Array<string>;
    banners: Array<{ id: number; position: string; contentHtml: string }>;
    siteName: string;
    logoUrl: null | string;
    darkLogoUrl: null | string;
    faviconUrl: string;
    seoEnabled: boolean;
    footerPages: Array<{ title: string; slug: string }>;
};
export type PostSeriesNavigation = {
    index: number;
    total: number;
    entries: Array<PostSeriesEntry>;
    previous: null | PostSeriesEntry;
    next: null | PostSeriesEntry;
};
export type PostSeriesEntry = { url: string; title: string; index: number };
export type RelatedPost = {
    slug: string;
    title: string;
    image: string;
    description: string;
    readTime: number;
    published: Date;
    username: string;
    name: string;
    avatar: string;
};

/** Everything the server passes to each server-rendered route. */
export interface PageProps {
    'screen-host': {
        movesInApplication: boolean;
        lang: string;
        robots: string;
        title: string;
        canonical?: string;
        faviconUrl: string;
        rssUrl?: string;
        brand: SiteBrand;
        documentStyleHref: string;
        configurationJson: string;
        globalsJson?: string;
        captcha: boolean;
        csrf: string;
        searchPage?: boolean;
        editorPage: boolean;
        viewer: HeaderViewer | null;
        contentClass?: string;
        screen: string;
        footer: boolean;
        loaderHref: string;
    };
    'docs/developer-api/reference': { assetRoot: string; settingsJson: string; locale: 'ko' | 'en' };
    'work-logs/index': WorkLogIndexProps;
    'work-logs/$id/index': WorkLogDetailProps;
    'work-logs/$id/delete': WorkLogDeleteProps;
    'work-logs/share/$token': WorkLogSharedProps;
    '@{$username}/partials/featured-posts': {
        author: AuthorRow;
        featured: { kind: 'featured' | 'recent'; posts: Array<PostRow> };
        isOwner: boolean;
    };
    index: {
        meta: PageMeta;
        viewer: null | PublicPageViewer;
        globalNotices: Array<NoticeRow>;
        posts: Array<PostRow>;
        likes: CardLikes | undefined;
        path: '/';
        query: URLSearchParams;
        checkedPage: number;
        pages: number;
    };
    interests: {
        meta: PageMeta;
        posts: Array<PostRow>;
        csrfToken: string;
        path: '/interests';
        query: URLSearchParams;
        checkedPage: number;
        pages: number;
    };
    'static/$slug': { meta: PageMeta; pageHtml: string };
    tags: {
        meta: PageMeta;
        query: URLSearchParams;
        sort: string;
        tags: Array<TagRow>;
        searchText: string;
        path: '/tags';
        preserve: Array<string>;
        checkedPage: number;
        pages: number;
    };
    'tag/$name': {
        meta: PageMeta;
        tagName: string;
        posts: Array<PostRow>;
        likes: CardLikes | undefined;
        path: string;
        query: URLSearchParams;
        checkedPage: number;
        pages: number;
    };
    search: {
        meta: PageMeta;
        searchText: string;
        username: string;
        posts: Array<PostRow>;
        count: number;
        checkedPage: number;
        pages: number;
    };
    '@{$username}/index': {
        meta: PageMeta;
        author: AuthorRow;
        subscription: SubscriptionState;
        viewer: null | PublicPageViewer;
        csrfToken: string;
        socialLinks: Array<AuthorSocialLink>;
        isAuthorEditor: boolean;
        userNotices: Array<NoticeRow>;
        aboutHtml: string;
        isOwner: boolean;
        featured: { kind: 'recent' | 'featured'; posts: Array<PostRow> };
        activity: {
            days: Record<string, number>;
            recent: Array<{
                type: 'post' | 'series' | 'comment' | 'like';
                title: string;
                url: string;
                date: string;
                sortDate: number;
            }>;
        };
    };
    '@{$username}/about.edit': {
        meta: PageMeta;
        author: AuthorRow;
        subscription: SubscriptionState;
        viewer: PublicPageViewer;
        csrfToken: string;
        socialLinks: Array<AuthorSocialLink>;
        path: string;
    };
    '@{$username}/posts': {
        meta: PageMeta;
        author: AuthorRow;
        subscription: SubscriptionState;
        viewer: null | PublicPageViewer;
        csrfToken: string;
        socialLinks: Array<AuthorSocialLink>;
        path: string;
        query: URLSearchParams;
        tagFilter: string;
        tagOptions: Array<{ name: string }>;
        posts: Array<PostRow>;
        likes: CardLikes | undefined;
        searchText: string;
        checkedPage: number;
        pages: number;
    };
    '@{$username}/series/index': {
        meta: PageMeta;
        author: AuthorRow;
        subscription: SubscriptionState;
        viewer: null | PublicPageViewer;
        csrfToken: string;
        socialLinks: Array<AuthorSocialLink>;
        path: string;
        query: URLSearchParams;
        sort: string;
        seriesRows: Array<SeriesRow>;
        searchText: string;
        checkedPage: number;
        pages: number;
    };
    '@{$username}/series/$seriesSlug': {
        meta: PageMeta;
        series: SeriesDetailRow;
        seriesHtml: string;
        author: AuthorRow;
        count: number;
        viewer: null | PublicPageViewer;
        posts: Array<PostRow>;
        seriesPath: string;
        sortOrder: 'desc' | 'asc';
        checkedPage: number;
        pages: number;
    };
    '@{$username}/{$slug}/related': {
        source: { title: string; id: number; authorId: number };
        username: string;
        slug: string;
        items: Array<RelatedPost>;
    };
    login: { brand: SiteBrand; loginAssets: { css: Array<string> }; model: LoginModel };
    'password-reset/$token': {
        brand: SiteBrand;
        view:
            | { state: 'form'; username: string; csrf: string; action: string; error?: string }
            | { state: 'done' }
            | { state: 'invalid' };
        linkClass: 'mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-action px-4 text-content-inverted hover:bg-action-hover active:scale-95';
        fieldClass: 'block h-12 w-full rounded-lg border border-line bg-surface px-3';
    };
    reauthenticate: {
        brand: SiteBrand;
        account: { username: string; hasSecondFactor: boolean };
        viewer: null | { role: null | 'READER' | 'EDITOR'; isStaff: boolean; unreadCount: number };
        csrf: string;
        error: string;
        showForm: boolean;
        next: string;
        pendingFactor: boolean;
        fieldClass: 'block h-12 w-full rounded-lg border border-line bg-surface px-3';
        visibleProviders: Array<{ key: 'google' | 'github'; name: string; clientId: string }>;
    };
    setup: { error: string; csrf: string; token: string };
    sign: {
        brand: SiteBrand;
        siteKey: string;
        social: Array<string>;
        params: string;
        error: string;
        csrf: string;
        invite: string;
    };
    'docs/developer-api/quickstart': {
        brand: SiteBrand;
        viewer:
            | undefined
            | { username: string; hasEditorRole: boolean; isStaff: boolean; unreadCount: number; csrfToken: string };
        locale: 'ko' | 'en';
        siteOrigin: string;
        commands: DeveloperCommands;
    };
    'errors/not-found': {
        brand: SiteBrand;
        viewer:
            | undefined
            | { username: string; hasEditorRole: boolean; isStaff: boolean; unreadCount: number; csrfToken: string };
    };
    'errors/forbidden': {
        brand: SiteBrand;
        viewer:
            | undefined
            | { username: string; hasEditorRole: boolean; isStaff: boolean; unreadCount: number; csrfToken: string };
    };
    '@{$username}/{$slug}/revisions': {
        username: string;
        slug: string;
        title: string;
        updatedDate: string;
        csrfToken: string;
        page: number;
        lastPage: number;
        totalCount: number;
        notice: string;
        revisions: Array<{
            id: number;
            title: string;
            changeType: string;
            actor: string | null;
            contentExcerpt: string | null;
            contentHtml: string;
            date: string | null;
            savedLabel: string;
        }>;
    };
    '@{$username}/{$slug}/timelapse': {
        username: string;
        slug: string;
        title: string;
        totalCount: number;
        frames: Array<{ savedAt: string; title: string; stage: string; savedLabel: string; contentHtml: string }>;
    };
    '@{$username}/{$slug}/share-links': {
        title: string;
        postPath: string;
        error: string;
        create: boolean;
        action: string;
        csrf: string;
        links: Array<{
            id: number;
            label: string;
            url: string;
            isPaused: boolean;
            recentClicks: number;
            totalClicks: number;
        }>;
    };
    '@{$username}/{$slug}/index': {
        post: PublicPost;
        siteUrl: URL;
        presentation: PostPresentation;
        hasTimelapse: boolean;
        viewer: null | {
            username?: string;
            hasEditorRole?: boolean;
            isStaff?: boolean;
            csrfToken?: string;
            unreadCount?: number;
        };
        csrfToken: string;
        canManage: boolean;
        reader: null | ReaderPostView;
        previewAuthor: undefined | { bio: string; homepage: string };
        related: Array<RelatedPost>;
        outline: { html: string; headings: Array<{ id: string; text: string; level: number }> };
    };
}
