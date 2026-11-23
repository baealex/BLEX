import type { CommentPayload, ReaderPostLikeState } from '../../contracts/engagement';
import type { PageProps, PostSeriesNavigation, PublicPost, RelatedPost } from '../../contracts/pages';
import { storedDateText } from '../../lib/date-format';
import type { PostCommentsModel } from '../engagement/ui/comments.js';
import { publicPostPath } from './paths';

export type PostPageProps = PageProps['@{$username}/{$slug}/index'];

export interface PostDate {
    iso: string;
    text: string;
}

export interface RelatedPostView {
    href: string;
    title: string;
    description: string;
    image?: string;
    avatar: string;
    date?: PostDate;
    readTime: number;
    username: string;
}

/**
 * Everything the browser needs to hydrate a post. It is public in the HTML, so each field is listed by hand.
 * The body stays out: hydration reads it back from the server-rendered DOM.
 */
export interface PostPageData {
    username: string;
    slug: string;
    title: string;
    subtitle: string;
    visibility: PublicPost['visibility'];
    readTime: number;
    cover: 'default' | 'none' | 'split' | 'overlay';
    coverImagePosition: string;
    coverRatio?: string;
    image?: string;
    avatar: string;
    postPath: string;
    authorPath: string;
    canonical: string;
    markdownUrl?: string;
    published?: PostDate;
    updated?: PostDate;
    timelapsePath?: string;
    seriesName: string | null;
    seriesLink?: string;
    seriesNavigation: PostSeriesNavigation | null;
    tags: string[];
    banners: Array<{ id: number; position: string; contentHtml: string }>;
    brand: {
        siteName: string;
        logoUrl: string | null;
        darkLogoUrl: string | null;
        footerPages: Array<{ title: string; slug: string }>;
    };
    copyrightYear: number;
    headings: Array<{ id: string; text: string; level: number }>;
    canManage: boolean;
    csrfToken: string;
    viewerAuthenticated: boolean;
    like: ReaderPostLikeState | null;
    authorBio?: string;
    authorHomepage?: string;
    subscription: { username: string; isSubscribed: boolean } | null;
    comments: PostCommentsModel | null;
    related: RelatedPostView[];
}

const coverRatios = new Map([
    ['16:9', '16 / 9'],
    ['4:3', '4 / 3'],
    ['1:1', '1'],
    ['3:4', '3 / 4']
]);

const publicationDate = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Seoul'
});

export function articleImage(path: string): string | undefined {
    if (!path || /[\\\u0000-\u001f\u007f]/.test(path) || path.startsWith('//')) return;
    const external = URL.parse(path);
    if (external) return ['http:', 'https:'].includes(external.protocol) ? external.href : undefined;
    if (path.startsWith('/resources/media/')) return path;
    const parts = path.split('/');
    if (parts.some((part) => !part || part === '..' || part === '.')) return;
    return `/resources/media/${parts.map(encodeURIComponent).join('/')}`;
}

function isoDate(text: string): string | undefined {
    const date = new Date(`${text.replace(' ', 'T')}Z`);
    if (Number.isFinite(date.valueOf())) return date.toISOString();
}

// Dates are formatted once on the server, so a browser with different locale data cannot break hydration.
function postDate(text: string): PostDate | undefined {
    const iso = isoDate(text);
    return iso ? { iso, text: publicationDate.format(new Date(iso)) } : undefined;
}

function clientComment(comment: CommentPayload): CommentPayload {
    return {
        id: comment.id,
        author: comment.author,
        authorImage: comment.authorImage,
        isMine: comment.isMine,
        isEdited: comment.isEdited,
        isDeleted: comment.isDeleted,
        renderedContent: comment.renderedContent,
        createdDate: comment.createdDate,
        countLikes: comment.countLikes,
        isLiked: comment.isLiked,
        permissions: {
            canEdit: comment.permissions.canEdit,
            canDelete: comment.permissions.canDelete,
            canLike: comment.permissions.canLike,
            canReply: comment.permissions.canReply
        },
        ...(comment.parentId === undefined ? {} : { parentId: comment.parentId }),
        ...(comment.replies ? { replies: comment.replies.map(clientComment) } : {})
    };
}

function relatedPostView(post: RelatedPost): RelatedPostView {
    return {
        href: publicPostPath(post.username, post.slug),
        title: post.title,
        description: post.description,
        image: articleImage(post.image),
        avatar: articleImage(post.avatar ?? '') ?? '/resources/assets/images/default-avatar.jpg',
        date: postDate(storedDateText(post.published)),
        readTime: post.readTime,
        username: post.username
    };
}

export function createPostPageData({
    post,
    siteUrl,
    presentation,
    hasTimelapse,
    viewer,
    csrfToken,
    canManage,
    reader,
    previewAuthor,
    related,
    outline
}: PostPageProps): PostPageData {
    const postPath = publicPostPath(post.username, post.slug);
    const canonical = new URL(postPath, siteUrl).href;
    const image = articleImage(post.image);
    const cover =
        post.coverLayout === 'none' || (image && (post.coverLayout === 'split' || post.coverLayout === 'overlay'))
            ? (post.coverLayout as PostPageData['cover'])
            : 'default';
    const author = reader?.author;
    const previewHomepage = previewAuthor?.homepage ?? '';
    // Signed-out readers post nothing, so their copy of the page carries no token.
    const pageCsrfToken = viewer ? csrfToken : '';
    return {
        username: post.username,
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        visibility: post.visibility,
        readTime: post.readTime,
        cover,
        coverImagePosition: post.coverImagePosition,
        coverRatio: coverRatios.get(post.coverImageRatio),
        image,
        avatar: articleImage(post.authorAvatar) ?? '/resources/assets/images/default-avatar.jpg',
        postPath,
        authorPath: `/@${encodeURIComponent(post.username)}`,
        canonical,
        markdownUrl: presentation.aeoEnabled && post.visibility === 'public' ? `${canonical}.md` : undefined,
        published: postDate(post.publishedDate),
        updated: postDate(post.updatedDate),
        timelapsePath: hasTimelapse ? `${postPath}/timelapse` : undefined,
        seriesName: presentation.seriesName,
        seriesLink:
            presentation.seriesName && presentation.seriesAuthor && presentation.seriesUrl
                ? `/@${encodeURIComponent(presentation.seriesAuthor)}/series/${encodeURIComponent(presentation.seriesUrl)}`
                : undefined,
        seriesNavigation: presentation.seriesNavigation ?? null,
        tags: presentation.tags,
        banners: presentation.banners.map(({ id, position, contentHtml }) => ({ id, position, contentHtml })),
        brand: {
            siteName: presentation.siteName,
            logoUrl: presentation.logoUrl,
            darkLogoUrl: presentation.darkLogoUrl,
            footerPages: presentation.footerPages.map(({ title, slug }) => ({ title, slug }))
        },
        copyrightYear: new Date().getFullYear(),
        headings: outline.headings.map(({ id, text, level }) => ({ id, text, level })),
        canManage,
        csrfToken: pageCsrfToken,
        viewerAuthenticated: reader?.viewerAuthenticated ?? false,
        like: reader
            ? {
                  countLikes: reader.postLike.countLikes,
                  isLiked: reader.postLike.isLiked,
                  canLike: reader.postLike.canLike
              }
            : null,
        authorBio: author?.bio ?? previewAuthor?.bio,
        authorHomepage: author?.homepage ?? (/^https?:\/\//i.test(previewHomepage) ? previewHomepage : undefined),
        subscription: author?.canSubscribe
            ? {
                  username: author.username,
                  isSubscribed: author.isSubscribed
              }
            : null,
        comments: reader
            ? {
                  slug: reader.slug,
                  postPath,
                  isLoggedIn: reader.viewerAuthenticated,
                  canComment: reader.canComment,
                  csrfToken: pageCsrfToken,
                  comments: reader.comments.map(clientComment),
                  totalComments: reader.totalComments,
                  olderCommentsCursor: reader.olderCommentsCursor
              }
            : null,
        related: related.slice(0, 4).map(relatedPostView)
    };
}
