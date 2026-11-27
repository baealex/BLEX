import type { PageProps } from '@blex/contracts/pages';
import type {
    AuthorRow,
    AuthorSocialLink,
    NoticeRow,
    PageMeta,
    PostRow,
    PublicPageViewer,
    SubscriptionState
} from '@blex/contracts/public';
import { type DiscoveryPagination, publicBrand } from '../discovery/discovery-page-data';
import type { AboutDraft } from './about-draft';
import { isLongIntroduction } from './introduction-length';
import type { PostRowView } from '../discovery/list-rows';
import { postPath } from '../discovery/post-list';
import { getDocumentLocale } from '../../i18n/locale.js';
import { avatarUrl, dateLabel, dateValue, mediaUrl, noticeLink, safeExternalUrl } from '../discovery/view-helpers';

export interface AuthorSubscriptionView {
    action: string;
    returnTo: string;
    subscribed: boolean;
    /** Null for signed-out readers, whose copy of the page carries no token. */
    csrfToken: string | null;
}

export interface AuthorTabsView {
    overview: string;
    posts: string;
    series: string;
    postCount: number;
    seriesCount: number;
}

export interface AuthorProfileView {
    username: string;
    avatar: string;
    cover: string | null;
    bio: string;
    homepage: { href: string; label: string } | null;
    socialLinks: Array<{ key: string; name: string; href: string }>;
    isOwner: boolean;
    subscription: AuthorSubscriptionView | null;
    /** Only editors have public post and series tabs. */
    tabs: AuthorTabsView | null;
}

export interface FeaturedPostsView {
    kind: 'featured' | 'recent';
    partialUrl: string;
    canManage: boolean;
    /** The posts tab, for authors who have public posts. */
    allPosts: { href: string; count: number } | null;
    posts: PostRowView[];
}

export interface AuthorNoticeView {
    key: string;
    title: string;
    href: string | null;
}

export interface AuthorActivityView {
    /** Public posts, comments, and likes over the past year. */
    total: number;
    /** Seven-day spans, oldest first; the newest one ends today. */
    weeks: Array<{ key: string; label: string; count: number }>;
    /** Where each month starts among the weeks. */
    months: Array<{ index: number; label: string }>;
    recent: Array<{
        key: string;
        type: 'post' | 'series' | 'comment' | 'like';
        title: string;
        url: string;
        date: string;
    }>;
}

/**
 * Everything the browser needs to hydrate an author page.
 * It is public in the HTML, so each field is listed by hand.
 * Authored HTML and the owner's Markdown stay out: hydration reads them back from the server markup.
 */
interface AuthorPageBase {
    brand?: ReturnType<typeof publicBrand>;
    copyrightYear: number;
}

export interface AuthorOverviewData extends AuthorPageBase {
    page: 'overview';
    profile: AuthorProfileView;
    notices: AuthorNoticeView[];
    /** `collapsible` starts a long introduction folded; the server decides it so the first paint does not move. */
    about: { editable: boolean; editPath: string; collapsible: boolean } | null;
    featured: FeaturedPostsView | null;
    /** The first public series in the author's own order; null for authors who are not editors. */
    series: Array<{ href: string; name: string; postCount: number }> | null;
    activity: AuthorActivityView;
}

export interface AuthorPostsData extends AuthorPageBase {
    page: 'posts';
    profile: AuthorProfileView;
    tagFilter: string;
    tagOptions: string[];
    filtered: boolean;
    posts: PostRowView[];
    pagination: DiscoveryPagination;
}

export interface AuthorSeriesListData extends AuthorPageBase {
    page: 'series';
    profile: AuthorProfileView;
    sort: string;
    searched: boolean;
    series: Array<{
        href: string;
        name: string;
        summary: string;
        postCount: number;
        updated: { iso: string | null; text: string };
        /** The first public post's image, or null when no post has one. */
        image: string | null;
    }>;
    pagination: DiscoveryPagination;
}

export interface AuthorSeriesData extends AuthorPageBase {
    page: 'series-detail';
    name: string;
    hasDescription: boolean;
    author: { username: string; href: string; avatar: string };
    count: number;
    updated: string;
    editHref: string | null;
    /** The first public post, where a reader starts the series. */
    startHref: string | null;
    seriesPath: string;
    sortOrder: 'asc' | 'desc';
    posts: Array<{
        href: string;
        number: number;
        title: string;
        subtitle: string;
        date: { iso: string; text: string } | null;
    }>;
    pagination: DiscoveryPagination;
}

export interface AuthorAboutEditData extends AuthorPageBase {
    page: 'about-edit';
    profile: AuthorProfileView;
    saveUrl: string;
    returnPath: string;
}

export type AuthorPageData =
    | AuthorOverviewData
    | AuthorPostsData
    | AuthorSeriesListData
    | AuthorSeriesData
    | AuthorAboutEditData;

/** What the application client hands a route module when it takes over the page. */
export interface AuthorMountContext {
    hydrating: boolean;
    draft?: AboutDraft;
    /** Resolves when the editor may hydrate without disturbing the writer. */
    ready(): Promise<void>;
}

/** Sanitized authored HTML and the owner's Markdown, which the browser reads from the server markup. */
export interface AuthorContent {
    html: string;
    markdown: string;
}

function authorPath(username: string, suffix = ''): string {
    return `/@${encodeURIComponent(username)}${suffix}`;
}

function isEditor(author: AuthorRow): boolean {
    return author.isActive && author.role === 'EDITOR';
}

/** React keys for rows that may repeat, without publishing their database ids. */
function occurrenceKeys<T>(rows: T[], base: (row: T) => string): Array<{ key: string; row: T }> {
    const seen = new Map<string, number>();
    return rows.map((row) => {
        const value = base(row);
        const count = seen.get(value) ?? 0;
        seen.set(value, count + 1);
        return { key: `${value}:${count}`, row };
    });
}

function dateView(value: PostRow['publishedDate']): { iso: string; text: string } | null {
    const iso = dateValue(value);
    return value && iso ? { iso, text: dateLabel(value) } : null;
}

function pageBase(meta: PageMeta): AuthorPageBase {
    return {
        brand: publicBrand(meta),
        copyrightYear: new Date().getFullYear()
    };
}

function profileView(
    author: AuthorRow,
    subscription: SubscriptionState,
    viewer: PublicPageViewer | null,
    csrfToken: string,
    socialLinks: AuthorSocialLink[],
    returnTo = authorPath(author.username)
): AuthorProfileView {
    const homepage = safeExternalUrl(author.homepage);
    const homepageText = homepage?.replace(/^https?:\/\//, '') ?? '';
    return {
        username: author.username,
        avatar: avatarUrl(author.avatar),
        cover: author.cover ? mediaUrl(author.cover) : null,
        bio: author.bio,
        homepage: homepage
            ? {
                  href: homepage,
                  label: homepageText.length > 30 ? `${homepageText.slice(0, 29)}…` : homepageText
              }
            : null,
        socialLinks: occurrenceKeys(socialLinks, (link) => `${link.name}:${link.value}`).map(({ key, row }) => ({
            key,
            name: row.name,
            href: row.value
        })),
        isOwner: viewer?.id === author.id,
        subscription: subscription.canSubscribe
            ? {
                  action: `/v1/users/@${encodeURIComponent(author.username)}/subscription`,
                  returnTo,
                  subscribed: subscription.isSubscribed,
                  csrfToken: viewer ? csrfToken : null
              }
            : null,
        tabs: isEditor(author)
            ? {
                  overview: authorPath(author.username),
                  posts: authorPath(author.username, '/posts'),
                  series: authorPath(author.username, '/series'),
                  postCount: author.publicPostCount,
                  seriesCount: author.publicSeriesCount
              }
            : null
    };
}

function postImage(post: Pick<PostRow, 'image'>): string | null {
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    return hasImage ? mediaUrl(post.image) : null;
}

function postRowView(post: PostRow, summary: string): PostRowView {
    return {
        href: postPath(post),
        title: post.title,
        summary,
        image: postImage(post),
        date: dateView(post.publishedDate),
        readTime: post.readTime
    };
}

export function featuredPostsView(
    author: AuthorRow,
    featured: { kind: 'featured' | 'recent'; posts: PostRow[] },
    isOwner: boolean
): FeaturedPostsView | null {
    if (!featured.posts.length && !isOwner) return null;
    return {
        kind: featured.kind,
        partialUrl: `${authorPath(author.username)}/partials/featured-posts`,
        canManage: isOwner,
        allPosts:
            author.publicPostCount > 0
                ? { href: authorPath(author.username, '/posts'), count: author.publicPostCount }
                : null,
        posts: featured.posts.map((post) => postRowView(post, post.subtitle))
    };
}

const dayLength = 86_400_000;
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / dayLength;
const dayKey = (day: number) => new Date(day * dayLength).toISOString().slice(0, 10);

/**
 * Groups the year's days into seven-day spans that end on its last day, so the newest span is always whole.
 * The server names the days in the site's calendar, so the labels come from those days rather than a clock.
 */
function activityWeeks(
    days: Record<string, number>,
    range: { start: string; end: string }
): Pick<AuthorActivityView, 'total' | 'weeks' | 'months'> {
    const first = dayNumber(range.start);
    const last = dayNumber(range.end);
    const locale = getDocumentLocale();
    const span = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
    const weeks: AuthorActivityView['weeks'] = [];
    const months: AuthorActivityView['months'] = [];
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return { total: 0, weeks, months };
    for (let end = last; end >= first; end -= 7) {
        const start = Math.max(first, end - 6);
        let count = 0;
        for (let day = start; day <= end; day += 1) count += days[dayKey(day)] ?? 0;
        weeks.unshift({
            key: dayKey(start),
            label:
                start === end
                    ? span.format(new Date(start * dayLength))
                    : `${span.format(new Date(start * dayLength))} – ${span.format(new Date(end * dayLength))}`,
            count
        });
    }
    weeks.forEach((week, index) => {
        const current = week.key.slice(0, 7);
        if (index > 0 && current !== weeks[index - 1].key.slice(0, 7) && index < weeks.length - 2)
            months.push({ index, label: month.format(new Date(`${current}-01T00:00:00Z`)) });
    });
    return { total: weeks.reduce((sum, week) => sum + week.count, 0), weeks, months };
}

function noticeViews(notices: NoticeRow[]): AuthorNoticeView[] {
    return occurrenceKeys(notices, (notice) => `${notice.title}:${notice.url}`).map(({ key, row }) => ({
        key,
        title: row.title,
        href: noticeLink(row.url)
    }));
}

export function createAuthorOverviewData({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    isAuthorEditor,
    userNotices,
    aboutHtml,
    isOwner,
    featured,
    seriesPreview,
    activity
}: PageProps['@{$username}/index']): AuthorOverviewData {
    return {
        ...pageBase(meta),
        page: 'overview',
        profile: profileView(author, subscription, viewer, csrfToken, socialLinks),
        notices: isAuthorEditor ? noticeViews(userNotices) : [],
        about:
            aboutHtml || isOwner
                ? {
                      editable: isOwner,
                      editPath: isOwner ? `${authorPath(author.username)}/about/edit` : '',
                      collapsible: isLongIntroduction(aboutHtml)
                  }
                : null,
        featured: isAuthorEditor ? featuredPostsView(author, featured, viewer?.id === author.id) : null,
        series:
            isAuthorEditor && seriesPreview.length
                ? seriesPreview.map((series) => ({
                      href: `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}`,
                      name: series.name,
                      postCount: series.postCount
                  }))
                : null,
        activity: {
            ...activityWeeks(activity.days, activity.range),
            recent: occurrenceKeys(activity.recent, (entry) => `${entry.type}:${entry.url}`).map(({ key, row }) => ({
                key,
                type: row.type,
                title: row.title,
                url: row.url,
                date: row.date
            }))
        }
    };
}

export function createAuthorPostsData({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    path,
    query,
    tagFilter,
    tagOptions,
    posts,
    searchText,
    checkedPage,
    pages
}: PageProps['@{$username}/posts']): AuthorPostsData {
    return {
        ...pageBase(meta),
        page: 'posts',
        profile: profileView(author, subscription, viewer, csrfToken, socialLinks, path),
        tagFilter,
        tagOptions: tagOptions.map((tag) => tag.name),
        filtered: Boolean(searchText || tagFilter),
        posts: posts.map((post) => postRowView(post, post.description || post.subtitle)),
        pagination: { path, search: query.toString(), preserve: ['q', 'tag'], page: checkedPage, pages }
    };
}

export function createAuthorSeriesListData({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    path,
    query,
    sort,
    seriesRows,
    searchText,
    checkedPage,
    pages
}: PageProps['@{$username}/series/index']): AuthorSeriesListData {
    return {
        ...pageBase(meta),
        page: 'series',
        profile: profileView(author, subscription, viewer, csrfToken, socialLinks, path),
        sort,
        searched: Boolean(searchText),
        series: seriesRows.map((series) => ({
            href: `${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}`,
            name: series.name,
            summary: series.textMarkdown,
            postCount: series.postCount,
            updated: { iso: dateValue(series.updatedDate), text: dateLabel(series.updatedDate) },
            image: postImage(series)
        })),
        pagination: { path, search: query.toString(), preserve: ['q', 'sort'], page: checkedPage, pages }
    };
}

export function createAuthorSeriesData({
    meta,
    series,
    author,
    count,
    viewer,
    posts,
    firstPostSlug,
    seriesPath,
    sortOrder,
    checkedPage,
    pages
}: PageProps['@{$username}/series/$seriesSlug']): AuthorSeriesData {
    return {
        ...pageBase(meta),
        page: 'series-detail',
        name: series.name,
        hasDescription: Boolean(series.textHtml),
        author: {
            username: author.username,
            href: authorPath(author.username),
            avatar: avatarUrl(series.authorAvatar)
        },
        count,
        updated: dateLabel(series.updatedDate),
        editHref: viewer?.id === author.id ? `/settings/series/edit/${series.id}` : null,
        startHref: firstPostSlug ? postPath({ authorUsername: author.username, slug: firstPostSlug }) : null,
        seriesPath,
        sortOrder,
        posts: posts.map((post, index) => ({
            href: postPath(post),
            number: sortOrder === 'desc' ? count - (checkedPage - 1) * 10 - index : (checkedPage - 1) * 10 + index + 1,
            title: post.title,
            subtitle: post.subtitle,
            date: dateView(post.publishedDate)
        })),
        pagination: {
            path: seriesPath,
            search: sortOrder === 'asc' ? 'sort=asc' : '',
            preserve: ['sort'],
            page: checkedPage,
            pages
        }
    };
}

export function createAuthorAboutEditData({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    path
}: PageProps['@{$username}/about.edit']): AuthorAboutEditData {
    return {
        ...pageBase(meta),
        page: 'about-edit',
        profile: profileView(author, subscription, viewer, csrfToken, socialLinks, path),
        saveUrl: path,
        returnPath: authorPath(author.username)
    };
}
