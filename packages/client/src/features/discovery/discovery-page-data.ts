import type { PageProps } from '@blex/contracts/pages';
import type { CardLikes, PageMeta } from '@blex/contracts/public';
import { type PostCardLikes, type PostCardView, postCardView } from './post-list';
import { noticeLink } from './view-helpers';

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

export type DiscoveryPageData = HomePageData | TagsPageData | TagPageData;

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
