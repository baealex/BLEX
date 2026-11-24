import type { PageProps } from '@blex/contracts/pages';
import type { CardLikes, PageMeta, PostRow } from '@blex/contracts/public';
import { type PostCardLikes, type PostCardView, postCardView, postPath } from './post-list';
import { avatarUrl, dateLabel, dateValue, mediaUrl, noticeLink } from './view-helpers';

export interface NoticeSlide {
    id: number;
    title: string;
    href: string | null;
}

export interface DiscoveryPagination {
    path: string;
    search: string;
    preserve: string[];
    page: number;
    pages: number;
}

/**
 * Everything the browser needs to hydrate a discovery page.
 * It is public in the HTML, so each field is listed by hand.
 */
interface DiscoveryPageBase {
    brand?: {
        siteName: string;
        logoUrl: string | null;
        darkLogoUrl: string | null;
        footerPages: Array<{ title: string; slug: string }>;
    };
    copyrightYear: number;
    pagination: DiscoveryPagination;
}

export interface HomePageData extends DiscoveryPageBase {
    page: 'home';
    signedIn: boolean;
    canWrite: boolean;
    notices: NoticeSlide[];
    posts: PostCardView[];
    likes?: PostCardLikes;
}

export interface TagsPageData extends DiscoveryPageBase {
    page: 'tags';
    sort: string;
    searched: boolean;
    tags: Array<{ name: string; count: number }>;
}

export interface TagPageData extends DiscoveryPageBase {
    page: 'tag';
    tagName: string;
    posts: PostCardView[];
    likes?: PostCardLikes;
}

/** The signed-in reader's liked posts. Every card is one they liked. */
export interface InterestsPageData extends DiscoveryPageBase {
    page: 'interests';
    posts: PostCardView[];
    likes: PostCardLikes;
}

export interface SearchResultView {
    href: string;
    title: string;
    image: string | null;
    author: { username: string; avatar: string };
    date: { iso: string | null; text: string } | null;
    readTime: number;
    description: string;
    matched: Array<'title' | 'description' | 'tag' | 'content'>;
}

/** The search page the server renders when the search screen is not installed. It loads its own module. */
export interface SearchPageData extends DiscoveryPageBase {
    page: 'search';
    searchText: string;
    username: string;
    count: number;
    results: SearchResultView[];
}

export type DiscoveryPageData = HomePageData | TagsPageData | TagPageData | InterestsPageData;

export function publicBrand({ brand }: Pick<PageMeta, 'brand'>): DiscoveryPageBase['brand'] {
    return (
        brand && {
            siteName: brand.siteName,
            logoUrl: brand.logoUrl,
            darkLogoUrl: brand.darkLogoUrl,
            footerPages: brand.footerPages.map(({ title, slug }) => ({ title, slug }))
        }
    );
}

function pageBase(meta: PageMeta, pagination: DiscoveryPagination): DiscoveryPageBase {
    return {
        brand: publicBrand(meta),
        copyrightYear: new Date().getFullYear(),
        pagination
    };
}

// Signed-out readers post nothing, so their copy of the page carries no token.
export function publicLikes(meta: PageMeta, likes: CardLikes | undefined): PostCardLikes | undefined {
    return likes && { csrfToken: meta.viewer ? likes.csrfToken : '', returnTo: likes.returnTo };
}

export function createHomePageData({
    meta,
    viewer,
    globalNotices,
    posts,
    likes,
    path,
    checkedPage,
    pages
}: PageProps['index']): HomePageData {
    return {
        ...pageBase(meta, { path, search: '', preserve: [], page: checkedPage, pages }),
        page: 'home',
        signedIn: Boolean(viewer),
        canWrite: Boolean(viewer?.hasEditorRole),
        notices: globalNotices.map(({ id, title, url }) => ({ id, title, href: noticeLink(url) })),
        posts: posts.map((post) => postCardView(post, { likes, relativeDate: true })),
        likes: publicLikes(meta, likes)
    };
}

export function createTagsPageData({
    meta,
    query,
    sort,
    tags,
    searchText,
    path,
    preserve,
    checkedPage,
    pages
}: PageProps['tags']): TagsPageData {
    return {
        ...pageBase(meta, { path, search: query.toString(), preserve, page: checkedPage, pages }),
        page: 'tags',
        sort,
        searched: searchText.length > 0,
        tags: tags.map(({ name, count }) => ({ name, count }))
    };
}

export function createTagPageData({
    meta,
    tagName,
    posts,
    likes,
    path,
    checkedPage,
    pages
}: PageProps['tag/$name']): TagPageData {
    return {
        ...pageBase(meta, { path, search: '', preserve: [], page: checkedPage, pages }),
        page: 'tag',
        tagName,
        posts: posts.map((post) => postCardView(post, { likes })),
        likes: publicLikes(meta, likes)
    };
}

export function createInterestsPageData({
    meta,
    posts,
    csrfToken,
    path,
    checkedPage,
    pages
}: PageProps['interests']): InterestsPageData {
    const likes = { csrfToken, returnTo: path, likedIds: new Set(posts.map((post) => post.id)) };
    return {
        ...pageBase(meta, { path, search: '', preserve: [], page: checkedPage, pages }),
        page: 'interests',
        posts: posts.map((post) => postCardView(post, { likes, relativeDate: true })),
        likes: { csrfToken, returnTo: path }
    };
}

const matchedFields = [
    ['title', 'titleScore'],
    ['description', 'descriptionScore'],
    ['tag', 'tagScore'],
    ['content', 'contentScore']
] as const;

function searchResultView(post: PostRow): SearchResultView {
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    return {
        href: postPath(post),
        title: post.title,
        image: hasImage ? mediaUrl(post.image) : null,
        author: { username: post.authorUsername, avatar: avatarUrl(post.authorAvatar) },
        date: post.publishedDate ? { iso: dateValue(post.publishedDate), text: dateLabel(post.publishedDate) } : null,
        readTime: post.readTime,
        description: post.description,
        matched: matchedFields.filter(([, score]) => (post[score] ?? 0) > 0).map(([field]) => field)
    };
}

export function createSearchPageData({
    meta,
    searchText,
    username,
    posts,
    count,
    checkedPage,
    pages
}: PageProps['search']): SearchPageData {
    return {
        ...pageBase(meta, { path: '/search', search: '', preserve: [], page: checkedPage, pages }),
        page: 'search',
        searchText,
        username,
        count,
        results: posts.map(searchResultView)
    };
}
