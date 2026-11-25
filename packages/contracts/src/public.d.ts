export type StoredDate = string | Date;

export interface SiteBrand {
    siteName: string;
    logoUrl: string | null;
    darkLogoUrl: string | null;
    faviconUrl: string;
    seoEnabled: boolean;
    footerPages: Array<{ title: string; slug: string }>;
}

export interface NoticeRow {
    id: number;
    title: string;
    url: string;
}

export interface SubscriptionState {
    canSubscribe: boolean;
    isSubscribed: boolean;
}

export interface PostRow {
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
    likeCount?: number;
    commentCount?: number;
    titleScore?: number;
    descriptionScore?: number;
    tagScore?: number;
    contentScore?: number;
}

export interface AuthorRow {
    id: number;
    username: string;
    firstName: string;
    isActive: boolean;
    bio: string;
    avatar: string;
    cover: string;
    homepage: string;
    aboutHtml: string;
    aboutMarkdown: string;
    role: string;
    publicPostCount: number;
    publicSeriesCount: number;
}

export interface TagRow {
    id: number;
    name: string;
    count: number;
}

export interface SeriesRow {
    id: number;
    url: string;
    name: string;
    textMarkdown: string;
    textHtml: string;
    createdDate: StoredDate;
    updatedDate: StoredDate;
    postCount: number;
}

/** A row on an author's series list. `image` is the first public post's image in reading order, or empty. */
export interface SeriesListRow extends SeriesRow {
    image: string;
}

export interface SeriesDetailRow extends SeriesRow {
    authorId: number;
    authorUsername: string;
    authorAvatar: string | null;
}

export interface AuthorSocialLink {
    id: number;
    name: string;
    value: string;
}

export interface PageMeta {
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

export interface CardLikes {
    csrfToken: string;
    returnTo: string;
    likedIds: Set<number>;
}
