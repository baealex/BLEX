import { SiteIcon, type SiteIconName } from '~/appearance/icons';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument, scriptJson } from '~/application/document';
import type { ReaderPostView } from '~/contracts/engagement';
import type {
    PostPresentation,
    PostSeriesEntry,
    PostSeriesNavigation,
    PublicPost,
    RelatedPost
} from '~/contracts/pages';
import { PostComments } from '~/features/engagement/ui';
import { loginPromptProps } from '~/features/engagement/ui/login-prompt';
import { publicPostPath } from '~/features/posts/paths';
import { storedDateText } from '~/lib/date-format';
import type { ReactNode } from 'react';
import type { PageProps } from '~/contracts/pages';

function articleImage(path: string): string | undefined {
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

const coverRatios = new Map([
    ['16:9', '16 / 9'],
    ['4:3', '4 / 3'],
    ['1:1', '1'],
    ['3:4', '3 / 4']
]);

type Outline = Array<{ id: string; text: string; level: number }>;

const publicationDate = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeZone: 'Asia/Seoul'
});

function formatDate(iso: string): string {
    return publicationDate.format(new Date(iso));
}

function PostCover({
    post,
    presentation,
    cover,
    image,
    authorPath,
    published,
    updated,
    seriesLink,
    timelapsePath
}: {
    post: PublicPost;
    presentation: PostPresentation;
    cover: string;
    image?: string;
    authorPath: string;
    published?: string;
    updated?: string;
    seriesLink?: string;
    timelapsePath?: string;
}) {
    const inverted = cover === 'overlay';
    const large = inverted || cover === 'split';
    const avatar = articleImage(post.authorAvatar) ?? '/resources/assets/images/default-avatar.jpg';
    const metadataColor = inverted ? 'text-white/80' : 'text-content-secondary';
    const separator = inverted ? 'text-white/55' : 'text-line-strong';
    const heading = (
        <>
            {seriesLink && (
                <div className="mb-6 flex items-center gap-2">
                    <a
                        href={seriesLink}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${inverted ? 'bg-white/90 text-neutral-950 hover:bg-white' : 'bg-action text-content-inverted hover:bg-action-hover'}`}
                    >
                        <SiteIcon name="stack-2" className="size-3 opacity-70" />
                        {presentation.seriesName}
                    </a>
                </div>
            )}
            <h1
                itemProp="headline"
                className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl lg:text-4xl'} ${inverted ? 'text-white' : 'text-content'} ${post.subtitle ? (large ? 'mb-4' : 'mb-3') : inverted ? 'mb-6' : 'mb-8'} font-bold leading-tight break-words`}
            >
                {post.title}
            </h1>
            {post.subtitle && (
                <p
                    className={`text-lg font-medium leading-relaxed sm:text-xl ${inverted ? 'mb-6 text-white/85' : 'mb-8 text-content-secondary'}`}
                >
                    {post.subtitle}
                </p>
            )}
            <div
                className={`flex items-center gap-4 text-sm ${large ? '' : 'border-b border-line-light pb-8'}`}
                itemProp="author"
                itemScope
                itemType="https://schema.org/Person"
            >
                <a href={authorPath} className="group shrink-0">
                    <img
                        src={avatar}
                        alt={post.username}
                        className={`size-10 rounded-full object-cover ring-2 transition-all ${inverted ? 'ring-white/60 group-hover:ring-white' : 'ring-line-light group-hover:ring-line-strong'}`}
                    />
                </a>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                        href={authorPath}
                        className={`font-semibold transition-colors ${inverted ? 'text-white hover:text-white/80' : 'text-content hover:text-content-secondary'}`}
                        itemProp="name"
                    >
                        {post.username}
                    </a>
                    {published && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={published}>
                                {formatDate(published)} {post.visibility === 'draft' ? '미리보기' : '발행'}
                            </time>
                        </>
                    )}
                    {updated && published && formatDate(updated) !== formatDate(published) && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={updated}>
                                {formatDate(updated)} 수정
                            </time>
                        </>
                    )}
                    <span className={separator}>·</span>
                    <span className={metadataColor}>
                        <span className="sr-only">읽는 시간: </span>
                        {post.readTime}분 소요
                    </span>
                    {timelapsePath && (
                        <>
                            <span className={separator}>·</span>
                            <a href={timelapsePath} className={`${metadataColor} underline-offset-2 hover:underline`}>
                                쓰인 과정 보기
                            </a>
                        </>
                    )}
                </div>
            </div>
        </>
    );
    const ratio = coverRatios.get(post.coverImageRatio);
    const picture = image && (
        <div
            className="overflow-hidden rounded-2xl ring-1 ring-line/60"
            style={ratio ? { aspectRatio: ratio } : undefined}
        >
            <img
                className={ratio ? 'h-full w-full object-cover' : 'w-full'}
                src={image}
                alt={post.title}
                itemProp="image"
            />
        </div>
    );
    if (cover === 'split') {
        const left = post.coverImagePosition === 'left';
        return (
            <section className={`post-cover-split px-4 md:px-6${left ? ' cover-left' : ''}`}>
                <div className="post-detail-frame grid gap-8 pt-10 sm:pt-14 lg:grid-cols-2 lg:items-center lg:py-14">
                    <div className={left ? 'lg:order-2' : undefined}>{heading}</div>
                    <div className={left ? 'lg:order-1' : undefined}>{picture}</div>
                </div>
            </section>
        );
    }
    if (inverted)
        return (
            <section className="post-cover-overlay relative isolate flex min-h-[clamp(20rem,44vh,32rem)] items-end overflow-hidden">
                <img className="absolute inset-0 -z-10 h-full w-full object-cover" src={image} alt={post.title} />
                <div className="post-cover-overlay-shade absolute inset-0 -z-10" />
                <div className="w-full px-4 pt-28 pb-10 sm:pb-14 md:px-6">
                    <div className="post-detail-layout">
                        <div className="post-cover-overlay-copy">{heading}</div>
                    </div>
                </div>
            </section>
        );
    return (
        <>
            <div className={`post-cover-${cover} mb-12 sm:mb-16`}>{heading}</div>
            {cover !== 'none' && picture && <div className="mb-12 sm:mb-16">{picture}</div>}
        </>
    );
}

function OutlineLinks({ headings, mobile }: { headings: Outline; mobile?: boolean }) {
    return (
        <nav className="px-4 py-4" aria-label="목차" data-site-outline>
            <ul className="space-y-1">
                {headings.map((heading, index) => (
                    <li key={`${heading.id}:${index}`}>
                        <a
                            href={`#${encodeURIComponent(heading.id)}`}
                            className={`toc-item block rounded-lg px-3 text-sm text-content-secondary transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95 ${mobile ? 'py-3' : 'py-2'}`}
                            style={{ paddingInlineStart: heading.level * 12 + (mobile ? 16 : -6) }}
                        >
                            {heading.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

function PostSeriesCard({
    name,
    seriesPath,
    author,
    navigation
}: {
    name: string;
    seriesPath: string;
    author: string;
    navigation: PostSeriesNavigation | null;
}) {
    const allPosts = 'text-sm font-medium text-content-secondary hover:text-content';
    if (!navigation) {
        return (
            <section
                className="mb-16 mt-16 rounded-2xl bg-surface p-6 text-center ring-1 ring-line/60 sm:p-8"
                aria-labelledby="post-series-heading"
            >
                <h2 id="post-series-heading" className="mb-2 text-lg font-bold text-content">
                    <a href={seriesPath}>{name}</a>
                </h2>
                <p className="mb-6 text-sm text-content-secondary">
                    이 포스트는 숨김 처리되어 시리즈 목록에 표시되지 않습니다.
                </p>
                <a href={seriesPath} className={allPosts}>
                    시리즈 전체 보기
                </a>
            </section>
        );
    }
    const link = (entry: PostSeriesEntry) => publicPostPath(author, entry.url);
    const step = (entry: PostSeriesEntry | null, label: string) =>
        entry ? (
            <a href={link(entry)} rel={label === '이전' ? 'prev' : 'next'} className={allPosts}>
                {label}
            </a>
        ) : (
            <span className="text-sm font-medium text-line-strong">{label}</span>
        );
    return (
        <section
            className="mb-16 mt-16 rounded-2xl bg-surface p-6 ring-1 ring-line/60 sm:p-8"
            aria-labelledby="post-series-heading"
        >
            <p className="mb-3 text-sm font-medium text-content-secondary">
                {navigation.index} / {navigation.total}
            </p>
            <h2 id="post-series-heading" className="mb-2 text-2xl font-bold text-content">
                <a href={seriesPath}>{name}</a>
            </h2>
            <ol className="mt-6 space-y-2">
                {navigation.entries.map((entry) => (
                    <li
                        key={entry.url}
                        className={`flex items-center gap-4 rounded-xl p-3${entry.index === navigation.index ? ' bg-surface-subtle' : ''}`}
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-sm font-bold text-content-secondary">
                            {entry.index}
                        </span>
                        {entry.index === navigation.index ? (
                            <>
                                <span className="flex-1 font-semibold text-content" aria-current="page">
                                    {entry.title}
                                </span>
                                <span className="rounded-md bg-action px-2.5 py-1 text-xs font-bold text-content-inverted">
                                    읽는 중
                                </span>
                            </>
                        ) : (
                            <a
                                href={link(entry)}
                                className="flex-1 font-medium text-content-secondary hover:text-content"
                            >
                                {entry.title}
                            </a>
                        )}
                    </li>
                ))}
            </ol>
            {navigation.total > 1 && (
                <nav
                    aria-label="시리즈 이동"
                    className="mt-8 flex items-center justify-between gap-4 border-t border-line-light pt-6"
                >
                    {step(navigation.previous, '이전')}
                    <a href={seriesPath} className={allPosts}>
                        전체 포스트
                    </a>
                    {step(navigation.next, '다음')}
                </nav>
            )}
        </section>
    );
}

function ArticleInfo({
    reader,
    post,
    postPath,
    authorPath,
    published,
    updated,
    csrfToken,
    previewAuthor
}: {
    reader: ReaderPostView | null;
    post: PublicPost;
    postPath: string;
    authorPath: string;
    published?: string;
    updated?: string;
    csrfToken: string;
    previewAuthor?: { bio: string; homepage: string };
}) {
    const author = reader?.author;
    const bio = author?.bio ?? previewAuthor?.bio;
    const homepage =
        author?.homepage ?? (/^https?:\/\//i.test(previewAuthor?.homepage ?? '') ? previewAuthor?.homepage : undefined);
    const subscription =
        author?.canSubscribe &&
        (reader?.viewerAuthenticated ? (
            <form action={`/v1/users/@${encodeURIComponent(author.username)}/subscription`} method="post">
                <input type="hidden" name="returnTo" value={postPath} />
                <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                {author.isSubscribed && <input type="hidden" name="action" value="unsubscribe" />}
                <button
                    type="submit"
                    className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-subtle"
                    aria-label={`${author.username}님의 새 글 구독`}
                    aria-pressed={author.isSubscribed}
                >
                    {author.isSubscribed ? '구독 중' : '구독'}
                </button>
            </form>
        ) : (
            <a
                {...loginPromptProps(postPath, 'subscribe')}
                aria-label={`${author.username}님의 새 글 구독`}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold hover:bg-surface-subtle"
            >
                구독
            </a>
        ));
    const entries: Array<[string, ReactNode]> = [
        [
            '작성자',
            <div className="flex items-start justify-between gap-4">
                <div>
                    <a href={authorPath} className="font-semibold hover:text-content-secondary">
                        {post.username}
                    </a>
                    {bio && <p className="mt-1 leading-relaxed text-content-secondary">{bio}</p>}
                </div>
                {subscription}
            </div>
        ]
    ];
    if (published)
        entries.push([
            post.visibility === 'draft' ? '미리보기 기준' : '최초 발행',
            <time dateTime={published}>{formatDate(published)}</time>
        ]);
    if (updated && published && formatDate(updated) !== formatDate(published))
        entries.push(['수정일', <time dateTime={updated}>{formatDate(updated)}</time>]);
    if (homepage)
        entries.push([
            '저자 홈페이지',
            <a href={homepage} target="_blank" rel="noopener noreferrer" className="break-words hover:text-content">
                {homepage}
            </a>
        ]);
    return (
        <section
            className="my-16 rounded-2xl bg-surface p-6 ring-1 ring-line/60 sm:p-8"
            aria-labelledby="post-info-heading"
        >
            <h2
                id="post-info-heading"
                className="mb-6 border-b border-line-light pb-4 text-lg font-bold leading-snug text-content"
            >
                포스트 정보
            </h2>
            <dl className="grid gap-4 text-sm">
                {entries.map(([label, value]) => (
                    <div key={label} className="sm:flex sm:items-start sm:gap-6">
                        <dt className="text-xs font-medium text-content-hint sm:w-24 sm:shrink-0">{label}</dt>
                        <dd className="mt-1 min-w-0 flex-1 text-content-secondary sm:mt-0">{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

const dockButton =
    'inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full text-content-secondary transition-all duration-200 hover:bg-surface-subtle/80 hover:text-content active:scale-95';

function RelatedPosts({ posts, username }: { posts: RelatedPost[]; username: string }) {
    if (!posts.length)
        return (
            <div className="py-12 text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-surface-subtle">
                    <SiteIcon name="compass" className="text-2xl text-content-hint" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{username}의 다른 포스트 둘러보기</h3>
                <p className="mb-6 text-sm text-content-secondary">프로필에서 더 많은 포스트를 확인할 수 있습니다.</p>
                <a
                    href={`/@${encodeURIComponent(username)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted hover:bg-action-hover"
                >
                    <span>프로필 보기</span>
                    <SiteIcon name="arrow-right" className="text-xs opacity-70" />
                </a>
            </div>
        );
    return (
        <section aria-labelledby="related-post-heading">
            <div className="mb-8 flex items-center gap-3">
                <span className="h-6 w-1.5 rounded-full bg-action" />
                <h3 id="related-post-heading" className="text-xl font-bold sm:text-2xl">
                    관련 포스트
                </h3>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {posts.slice(0, 4).map((post) => {
                    const href = publicPostPath(post.username, post.slug);
                    const image = articleImage(post.image);
                    const date = isoDate(storedDateText(post.published));
                    return (
                        <article
                            key={href}
                            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70"
                        >
                            {image && (
                                <a href={href} className="block aspect-[16/9] overflow-hidden">
                                    <img
                                        className="size-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105"
                                        src={image}
                                        alt={post.title}
                                        loading="lazy"
                                    />
                                </a>
                            )}
                            <div className="flex flex-1 flex-col p-5">
                                <h4 className="mb-2 line-clamp-2 text-base font-bold leading-snug">
                                    <a href={href}>{post.title}</a>
                                </h4>
                                <div className="mb-3 flex gap-3 text-xs text-content-secondary">
                                    {date && <time dateTime={date}>{formatDate(date)}</time>}
                                    <span>{post.readTime}분</span>
                                </div>
                                <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-content-secondary">
                                    <a href={href}>{post.description}</a>
                                </p>
                                <a
                                    href={`/@${encodeURIComponent(post.username)}`}
                                    className="mt-auto flex items-center gap-2 border-t border-line-light pt-3 text-xs font-semibold"
                                >
                                    <img
                                        className="size-6 rounded-full object-cover"
                                        src={
                                            articleImage(post.avatar ?? '') ??
                                            '/resources/assets/images/default-avatar.jpg'
                                        }
                                        alt=""
                                        loading="lazy"
                                    />
                                    {post.username}
                                </a>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function ShareItem({ icon, label, hint }: { icon: SiteIconName; label: string; hint: string }) {
    return (
        <>
            <span className="flex size-8 items-center justify-center rounded-lg bg-surface-subtle text-xs">
                <SiteIcon name={icon} />
            </span>
            <span className="flex flex-col">
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-content-hint">{hint}</span>
            </span>
        </>
    );
}

const statusNotices: Record<string, [string, string]> = {
    draft: [
        '임시 포스트 미리보기입니다.',
        '마지막으로 저장된 내용을 실제 포스트 화면으로 표시합니다. 이 페이지는 작성자에게만 보이며 공개 목록과 검색에 노출되지 않습니다.'
    ],
    hidden: [
        '비공개 포스트입니다.',
        '이 포스트는 작성자만 볼 수 있습니다. 공개하려면 포스트 설정에서 비공개를 해제하세요.'
    ],
    scheduled: [
        '예약 발행 포스트입니다.',
        '예약 시각 전에는 작성자만 볼 수 있습니다. 예약 시각이 되면 공개 URL, RSS, Sitemap, Markdown URL에 반영됩니다.'
    ]
};

function PostStatusNotice({ visibility, editPath }: { visibility: string; editPath?: string }) {
    const [title, message] = statusNotices[visibility];
    return (
        <section
            data-post-status-notice
            data-post-status-visibility={visibility}
            className="mb-8 rounded-lg border border-line bg-surface-subtle px-4 py-4 sm:px-5 sm:py-5"
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-content-hint">포스트 상태</p>
                    <h2 className="mt-1 text-lg font-semibold text-content">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-content-secondary">{message}</p>
                </div>
                {editPath && (
                    <a
                        href={editPath}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold text-content-secondary transition-all duration-150 hover:bg-surface hover:text-content active:scale-95"
                    >
                        수정하기
                    </a>
                )}
            </div>
        </section>
    );
}

function PostDock({
    reader,
    post,
    postPath,
    canonical,
    markdown,
    headings,
    csrfToken,
    canManage
}: {
    reader: ReaderPostView | null;
    post: PublicPost;
    postPath: string;
    canonical: string;
    markdown?: string;
    headings: Outline;
    csrfToken: string;
    canManage: boolean;
}) {
    const share: Array<[string, string, SiteIconName, string]> = [
        [
            'X에 공유',
            '새 창에서 공유 포스트 작성',
            'brand-x',
            `https://twitter.com/intent/tweet?${new URLSearchParams({
                text: post.title,
                url: canonical
            })}`
        ],
        [
            'Threads에 공유',
            'Threads 팔로워에게 공유',
            'brand-threads',
            `https://www.threads.com/intent/post?${new URLSearchParams({
                text: post.title,
                url: canonical
            })}`
        ],
        [
            'Bluesky에 공유',
            'Bluesky 팔로워에게 공유',
            'brand-bluesky',
            `https://bsky.app/intent/compose?${new URLSearchParams({ text: `${post.title} ${canonical}` })}`
        ],
        [
            'LinkedIn에 공유',
            '전문 네트워크에 공유',
            'brand-linkedin',
            `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: canonical })}`
        ],
        [
            'Facebook에 공유',
            '피드 또는 메시지로 공유',
            'brand-facebook',
            `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: canonical })}`
        ]
    ];
    return (
        <>
            <div className="post-action-dock pointer-events-none fixed inset-x-0 z-30 flex justify-center">
                <div className="post-action-bar pointer-events-auto">
                    {post.visibility === 'public' && (
                        <>
                            {reader?.postLike.canLike ? (
                                <form method="post" action={`/like/${encodeURIComponent(post.slug)}`}>
                                    <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                                    <input type="hidden" name="returnTo" value={postPath} />
                                    <button
                                        type="submit"
                                        className={`${dockButton} px-2 text-sm font-medium`}
                                        aria-label={`${reader.postLike.isLiked ? '좋아요 취소' : '좋아요'} (${reader.postLike.countLikes})`}
                                        aria-pressed={reader.postLike.isLiked}
                                    >
                                        <SiteIcon
                                            name="heart"
                                            className={
                                                reader.postLike.isLiked ? 'size-4 fill-current text-danger' : 'size-4'
                                            }
                                        />
                                        {reader.postLike.countLikes}
                                    </button>
                                </form>
                            ) : (
                                <a
                                    {...loginPromptProps(postPath, 'like')}
                                    className={`${dockButton} px-2 text-sm font-medium`}
                                    aria-label={`좋아요 (${reader?.postLike.countLikes ?? 0})`}
                                >
                                    <SiteIcon name="heart" className="size-4" />
                                    {reader?.postLike.countLikes ?? 0}
                                </a>
                            )}
                            <div className="post-action-divider" />
                        </>
                    )}
                    {headings.length > 0 && (
                        <button
                            type="button"
                            className={`${dockButton} xl:hidden`}
                            data-open-dialog="post-toc"
                            aria-label="목차 보기"
                        >
                            <SiteIcon name="list" className="size-4" />
                        </button>
                    )}
                    {post.visibility !== 'draft' && (
                        <>
                            <details className="blex-user-menu relative" data-account-menu>
                                <summary
                                    className={`${dockButton} cursor-pointer`}
                                    aria-label="포스트 공유 또는 링크 복사"
                                >
                                    <SiteIcon name="share" className="size-4" />
                                </summary>
                                <div className="absolute bottom-full left-1/2 z-40 mb-3 w-72 -translate-x-1/2 rounded-xl border border-line bg-surface-elevated p-2 text-left shadow-floating">
                                    <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-content-hint">
                                        공유
                                    </div>
                                    <button
                                        type="button"
                                        data-copy-link={canonical}
                                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                    >
                                        <ShareItem icon="link" label="일반 링크" hint="브라우저에서 여는 주소" />
                                    </button>
                                    {share.map(([label, hint, icon, href]) => (
                                        <a
                                            key={label}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                        >
                                            <ShareItem icon={icon} label={label} hint={hint} />
                                        </a>
                                    ))}
                                    {markdown && (
                                        <>
                                            <div className="my-1 h-px bg-line-light" />
                                            <button
                                                type="button"
                                                data-copy-link={markdown}
                                                data-copy-message="에이전트용 링크가 복사되었습니다."
                                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-surface-subtle hover:text-content active:scale-[0.98]"
                                            >
                                                <ShareItem icon="code" label="에이전트용 링크" hint="*.md 참조 주소" />
                                            </button>
                                        </>
                                    )}
                                    <p className="px-3 text-xs text-content-hint" data-copy-status role="status" />
                                </div>
                            </details>
                        </>
                    )}
                    {canManage && (
                        <a href={`${postPath}/edit`} className={dockButton} aria-label="수정하기">
                            <SiteIcon name="pencil" className="size-4" />
                        </a>
                    )}
                </div>
            </div>
            {headings.length > 0 && (
                <dialog
                    id="post-toc"
                    className="blex-toc-sheet fixed inset-x-0 top-auto bottom-0 m-0 max-h-[70vh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-surface-elevated p-0 text-content shadow-xl"
                >
                    <div className="flex items-center justify-between border-b border-line-light px-6 py-3">
                        <h2 className="text-lg font-bold">목차</h2>
                        <form method="dialog">
                            <button type="submit" className={dockButton} aria-label="목차 닫기">
                                <SiteIcon name="x" className="size-4" />
                            </button>
                        </form>
                    </div>
                    <OutlineLinks headings={headings} mobile />
                </dialog>
            )}
        </>
    );
}

export default function renderPage({
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
}: PageProps['@{$username}/{$slug}/index']): string {
    const postPath = publicPostPath(post.username, post.slug);
    const canonical = new URL(postPath, siteUrl).href;
    const authorPath = `/@${encodeURIComponent(post.username)}`;
    const authorUrl = new URL(authorPath, siteUrl).href;
    const image = articleImage(post.image);
    const imageAbsolute = image ? new URL(image, siteUrl).href : undefined;
    const cover =
        post.coverLayout === 'none' || (image && ['split', 'overlay'].includes(post.coverLayout))
            ? post.coverLayout
            : 'default';
    const fullCover = cover === 'split' || cover === 'overlay';
    const published = isoDate(post.publishedDate);
    const updated = isoDate(post.updatedDate);

    const markdown = presentation.aeoEnabled && post.visibility === 'public' ? `${canonical}.md` : undefined;
    const robots =
        post.visibility !== 'public'
            ? 'noindex,nofollow,noarchive'
            : !presentation.seoEnabled
              ? 'noindex,nofollow'
              : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    const advertisesFeeds = post.visibility === 'public' && presentation.seoEnabled;
    const articleData =
        post.visibility === 'public'
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'BlogPosting',
                  mainEntityOfPage: {
                      '@type': 'WebPage',
                      '@id': canonical
                  },
                  headline: post.title,
                  description: post.description,
                  image: imageAbsolute,
                  author: {
                      '@type': 'Person',
                      name: post.username,
                      url: authorUrl
                  },
                  publisher: {
                      '@type': 'Organization',
                      name: presentation.siteName,
                      logo: {
                          '@type': 'ImageObject',
                          url: new URL(presentation.logoUrl ?? '/resources/logob.svg', siteUrl).href
                      }
                  },
                  datePublished: published,
                  dateModified: updated,
                  keywords: presentation.tags.length ? presentation.tags.join(', ') : undefined,
                  articleSection: presentation.seriesName ?? 'Blog'
              }
            : null;
    const seriesLink =
        presentation.seriesName && presentation.seriesAuthor && presentation.seriesUrl
            ? `/@${encodeURIComponent(presentation.seriesAuthor)}/series/${encodeURIComponent(presentation.seriesUrl)}`
            : undefined;
    const banners = (position: string) =>
        presentation.banners
            .filter((banner) => banner.position === position)
            .map((banner) => (
                <div
                    key={banner.id}
                    className="article-banner"
                    dangerouslySetInnerHTML={{ __html: banner.contentHtml }}
                />
            ));
    const coverSection = (
        <PostCover
            {...{
                post,
                presentation,
                cover,
                image,
                authorPath,
                published,
                updated,
                seriesLink
            }}
            timelapsePath={hasTimelapse ? `${postPath}/timelapse` : undefined}
        />
    );

    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <title>{`${post.title} - ${post.username} | ${presentation.siteName}`}</title>
                <meta name="description" content={post.description} />
                <meta name="author" content={post.username} />
                <meta name="robots" content={robots} />
                <meta name="googlebot" content={robots} />
                {presentation.tags.length > 0 && <meta name="keywords" content={presentation.tags.join(', ')} />}
                <meta property="og:type" content="article" />
                <meta property="og:title" content={post.title} />
                <meta property="og:description" content={post.description} />
                <meta property="og:url" content={canonical} />
                {imageAbsolute && <meta property="og:image" content={imageAbsolute} />}
                <meta property="article:published_time" content={published} />
                <meta property="article:modified_time" content={updated} />
                <meta property="article:author" content={authorUrl} />
                {presentation.tags.map((tag) => (
                    <meta key={tag} property="article:tag" content={tag} />
                ))}
                <meta name="twitter:card" content={imageAbsolute ? 'summary_large_image' : 'summary'} />
                <meta name="twitter:title" content={post.title} />
                <meta name="twitter:description" content={post.description} />
                {imageAbsolute && <meta name="twitter:image" content={imageAbsolute} />}
                <link rel="icon" href={presentation.faviconUrl} />
                <link rel="canonical" href={canonical} />
                {markdown && <link rel="alternate" type="text/markdown" href={markdown} />}
                {advertisesFeeds && (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${presentation.siteName} RSS`}
                        href={new URL('/rss', siteUrl).href}
                    />
                )}
                {advertisesFeeds && (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${post.username} RSS`}
                        href={new URL(`/rss/@${encodeURIComponent(post.username)}`, siteUrl).href}
                    />
                )}
                {articleData && (
                    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(articleData) }} />
                )}
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased selection:bg-action selection:text-content-inverted">
                <SiteHeader
                    brand={presentation}
                    viewer={
                        viewer
                            ? {
                                  ...viewer,
                                  csrfToken
                              }
                            : null
                    }
                />
                <main className="min-h-[calc(100vh-10.5rem)]">
                    {fullCover && coverSection}
                    <div
                        className={`post-detail-body px-4 md:px-6${fullCover ? ' post-detail-body--after-cover' : ''}`}
                    >
                        <div className="post-detail-layout">
                            <aside className="post-detail-sidebar">
                                <div className="sticky top-28 space-y-4">{banners('left')}</div>
                            </aside>
                            <div className="post-detail-main mt-6">
                                <article itemScope itemType="https://schema.org/BlogPosting">
                                    {post.visibility !== 'public' && (
                                        <PostStatusNotice
                                            visibility={post.visibility}
                                            editPath={canManage ? `${postPath}/edit` : undefined}
                                        />
                                    )}
                                    {!fullCover && coverSection}
                                    {presentation.banners.some((banner) => banner.position === 'top') && (
                                        <div className="mb-16 space-y-4">{banners('top')}</div>
                                    )}
                                    <div
                                        className="blog-post-content mb-16 max-w-none break-words"
                                        itemProp="articleBody"
                                        dangerouslySetInnerHTML={{ __html: outline.html }}
                                    />
                                    {outline.html.includes('class="language-') && (
                                        <script
                                            type="module"
                                            src="/assets/blex/code-blocks.js"
                                            data-blex-page-module="code-blocks"
                                        />
                                    )}
                                    {presentation.tags.length > 0 && (
                                        <div className="mb-16 flex flex-wrap gap-2" itemProp="keywords">
                                            {presentation.tags.map((tag) => (
                                                <a
                                                    key={tag}
                                                    href={`/tag/${encodeURIComponent(tag)}`}
                                                    className="inline-flex items-center rounded-full border border-line-light bg-surface-subtle px-4 py-2 text-sm font-medium text-content-secondary transition-all duration-150 hover:border-line hover:bg-line-light hover:text-content active:scale-95"
                                                >
                                                    <span className="mr-1 text-content-hint">#</span>
                                                    {tag}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {presentation.banners.some((banner) => banner.position === 'bottom') && (
                                        <div className="mb-16 space-y-4">{banners('bottom')}</div>
                                    )}
                                    <ArticleInfo
                                        {...{
                                            reader,
                                            post,
                                            postPath,
                                            authorPath,
                                            published,
                                            updated,
                                            csrfToken,
                                            previewAuthor
                                        }}
                                    />
                                </article>
                                {post.visibility !== 'draft' && seriesLink && presentation.seriesName && (
                                    <PostSeriesCard
                                        name={presentation.seriesName}
                                        seriesPath={seriesLink}
                                        author={post.username}
                                        navigation={presentation.seriesNavigation ?? null}
                                    />
                                )}
                                {reader && <PostComments view={reader} csrfToken={csrfToken} returnTo={postPath} />}
                            </div>
                            <aside className="post-detail-sidebar">
                                <div className="sticky top-28 space-y-4">
                                    {outline.headings.length > 0 && (
                                        <div className="max-h-[400px] overscroll-contain overflow-y-auto rounded-2xl bg-surface ring-1 ring-line/60">
                                            <div className="sticky top-0 z-10 border-b border-line-light bg-surface px-6 py-4">
                                                <h2 className="text-sm font-bold tracking-wider">목차</h2>
                                            </div>
                                            <OutlineLinks headings={outline.headings} />
                                        </div>
                                    )}
                                    {banners('right')}
                                </div>
                            </aside>
                        </div>
                        {post.visibility === 'public' && (
                            <div className="mx-auto my-16 max-w-7xl">
                                <RelatedPosts posts={related} username={post.username} />
                            </div>
                        )}
                    </div>
                    {(post.visibility === 'public' ||
                        outline.headings.length > 0 ||
                        (canManage && post.visibility !== 'draft')) && (
                        <PostDock
                            {...{
                                reader,
                                post,
                                postPath,
                                canonical,
                                markdown,
                                csrfToken,
                                canManage
                            }}
                            headings={outline.headings}
                        />
                    )}
                </main>
                <div className="post-detail-footer-action-space">
                    <SiteFooter brand={presentation} />
                </div>
            </body>
        </html>
    );
}
