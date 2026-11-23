import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SiteIcon, type SiteIconName } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import type { PostSeriesEntry, PostSeriesNavigation } from '../../contracts/pages';
import { PostCommentsApp } from '../engagement/ui/comments.js';
import { loginPromptProps } from '../engagement/ui/login-prompt.js';
import { CodeBlockHeader } from './code-block-header';
import type { DecoratedCodeBlock } from './code-blocks-client';
import { publicPostPath } from './paths';
import type { PostPageData, RelatedPostView } from './post-page-data';
import { usePostPrompts } from './post-prompts';

function PostCover({ data }: { data: PostPageData }) {
    const { cover, image, avatar, authorPath, published, updated, seriesLink, timelapsePath } = data;
    const inverted = cover === 'overlay';
    const large = inverted || cover === 'split';
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
                        {data.seriesName}
                    </a>
                </div>
            )}
            <h1
                itemProp="headline"
                className={`${large ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl lg:text-4xl'} ${inverted ? 'text-white' : 'text-content'} ${data.subtitle ? (large ? 'mb-4' : 'mb-3') : inverted ? 'mb-6' : 'mb-8'} font-bold leading-tight break-words`}
            >
                {data.title}
            </h1>
            {data.subtitle && (
                <p
                    className={`text-lg font-medium leading-relaxed sm:text-xl ${inverted ? 'mb-6 text-white/85' : 'mb-8 text-content-secondary'}`}
                >
                    {data.subtitle}
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
                        alt={data.username}
                        className={`size-10 rounded-full object-cover ring-2 transition-all ${inverted ? 'ring-white/60 group-hover:ring-white' : 'ring-line-light group-hover:ring-line-strong'}`}
                    />
                </a>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <a
                        href={authorPath}
                        className={`font-semibold transition-colors ${inverted ? 'text-white hover:text-white/80' : 'text-content hover:text-content-secondary'}`}
                        itemProp="name"
                    >
                        {data.username}
                    </a>
                    {published && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={published.iso}>
                                {`${published.text} ${data.visibility === 'draft' ? '미리보기' : '발행'}`}
                            </time>
                        </>
                    )}
                    {updated && published && updated.text !== published.text && (
                        <>
                            <span className={separator}>·</span>
                            <time className={metadataColor} dateTime={updated.iso}>
                                {`${updated.text} 수정`}
                            </time>
                        </>
                    )}
                    <span className={separator}>·</span>
                    <span className={metadataColor}>
                        <span className="sr-only">읽는 시간: </span>
                        {`${data.readTime}분 소요`}
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
    const ratio = data.coverRatio;
    const picture = image && (
        <div
            className="overflow-hidden rounded-2xl ring-1 ring-line/60"
            style={ratio ? { aspectRatio: ratio } : undefined}
        >
            <img
                className={ratio ? 'h-full w-full object-cover' : 'w-full'}
                src={image}
                alt={data.title}
                itemProp="image"
            />
        </div>
    );
    if (cover === 'split') {
        const left = data.coverImagePosition === 'left';
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
                <img className="absolute inset-0 -z-10 h-full w-full object-cover" src={image} alt={data.title} />
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

function OutlineLinks({ headings, mobile }: { headings: PostPageData['headings']; mobile?: boolean }) {
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
                {`${navigation.index} / ${navigation.total}`}
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

function ArticleInfo({ data }: { data: PostPageData }) {
    const { postPath, authorPath, published, updated, csrfToken, subscription: author } = data;
    const bio = data.authorBio;
    const homepage = data.authorHomepage;
    const subscription =
        author &&
        (data.viewerAuthenticated ? (
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
                        {data.username}
                    </a>
                    {bio && <p className="mt-1 leading-relaxed text-content-secondary">{bio}</p>}
                </div>
                {subscription}
            </div>
        ]
    ];
    if (published)
        entries.push([
            data.visibility === 'draft' ? '미리보기 기준' : '최초 발행',
            <time dateTime={published.iso}>{published.text}</time>
        ]);
    if (updated && published && updated.text !== published.text)
        entries.push(['수정일', <time dateTime={updated.iso}>{updated.text}</time>]);
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

function RelatedPosts({ posts, username }: { posts: RelatedPostView[]; username: string }) {
    if (!posts.length)
        return (
            <div className="py-12 text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-surface-subtle">
                    <SiteIcon name="compass" className="text-2xl text-content-hint" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{`${username}의 다른 포스트 둘러보기`}</h3>
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
                {posts.map((post) => {
                    const { href, image, date } = post;
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
                                    {date && <time dateTime={date.iso}>{date.text}</time>}
                                    <span>{`${post.readTime}분`}</span>
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
                                        src={post.avatar}
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

function PostDock({ data }: { data: PostPageData }) {
    const { postPath, canonical, csrfToken, canManage, headings, like } = data;
    const markdown = data.markdownUrl;
    const share: Array<[string, string, SiteIconName, string]> = [
        [
            'X에 공유',
            '새 창에서 공유 포스트 작성',
            'brand-x',
            `https://twitter.com/intent/tweet?${new URLSearchParams({
                text: data.title,
                url: canonical
            })}`
        ],
        [
            'Threads에 공유',
            'Threads 팔로워에게 공유',
            'brand-threads',
            `https://www.threads.com/intent/post?${new URLSearchParams({
                text: data.title,
                url: canonical
            })}`
        ],
        [
            'Bluesky에 공유',
            'Bluesky 팔로워에게 공유',
            'brand-bluesky',
            `https://bsky.app/intent/compose?${new URLSearchParams({ text: `${data.title} ${canonical}` })}`
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
                    {data.visibility === 'public' && (
                        <>
                            {like?.canLike ? (
                                <form method="post" action={`/like/${encodeURIComponent(data.slug)}`}>
                                    <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                                    <input type="hidden" name="returnTo" value={postPath} />
                                    <button
                                        type="submit"
                                        className={`${dockButton} px-2 text-sm font-medium`}
                                        aria-label={`${like.isLiked ? '좋아요 취소' : '좋아요'} (${like.countLikes})`}
                                        aria-pressed={like.isLiked}
                                    >
                                        <SiteIcon
                                            name="heart"
                                            className={like.isLiked ? 'size-4 fill-current text-danger' : 'size-4'}
                                        />
                                        {like.countLikes}
                                    </button>
                                </form>
                            ) : (
                                <a
                                    {...loginPromptProps(postPath, 'like')}
                                    className={`${dockButton} px-2 text-sm font-medium`}
                                    aria-label={`좋아요 (${like?.countLikes ?? 0})`}
                                >
                                    <SiteIcon name="heart" className="size-4" />
                                    {like?.countLikes ?? 0}
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
                    {data.visibility !== 'draft' && (
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

const highlightedBlock = 'pre > code[class*="language-"]';

/** The body is sanitized server HTML. Code block controls render into it through portals. */
function PostBody({ html }: { html: string }) {
    const body = useRef<HTMLDivElement>(null);
    const [blocks, setBlocks] = useState<DecoratedCodeBlock[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: new HTML replaces the blocks this effect decorated.
    useEffect(() => {
        const element = body.current;
        if (!element?.querySelector(highlightedBlock)) return;
        const controller = new AbortController();
        void import('./code-blocks-client')
            .then(({ decorateCodeBlocks }) => decorateCodeBlocks(element, controller.signal))
            .then(
                (decorated) => {
                    if (!controller.signal.aborted) setBlocks(decorated);
                },
                (error: unknown) => console.warn('Could not load the code block controls.', error)
            );
        return () => {
            controller.abort();
            setBlocks([]);
        };
    }, [html]);

    return (
        <>
            <div
                ref={body}
                className="blog-post-content mb-16 max-w-none break-words"
                itemProp="articleBody"
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {blocks.map(({ code, header, label }, index) =>
                createPortal(<CodeBlockHeader code={code} label={label} />, header, String(index))
            )}
        </>
    );
}

export function PostPage({
    data,
    bodyHtml,
    revision = 0
}: {
    data: PostPageData;
    bodyHtml: string;
    /** Changes with each server document, so state seeded from the previous one starts over. */
    revision?: number;
}) {
    const { visibility, cover, banners: allBanners, headings, canManage } = data;
    const fullCover = cover === 'split' || cover === 'overlay';
    const hasDock = visibility === 'public' || headings.length > 0 || (canManage && visibility !== 'draft');
    const prompts = usePostPrompts(revision, hasDock);
    const banners = (position: string) =>
        allBanners
            .filter((banner) => banner.position === position)
            .map((banner) => (
                <div
                    key={banner.id}
                    className="article-banner"
                    dangerouslySetInnerHTML={{ __html: banner.contentHtml }}
                />
            ));
    const hasBanner = (position: string) => allBanners.some((banner) => banner.position === position);
    const coverSection = <PostCover data={data} />;

    return (
        <>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: this only observes activation of the links inside. */}
            <main className="min-h-[calc(100vh-10.5rem)]" data-blex-post-page="" onClick={prompts.onClick}>
                {fullCover && coverSection}
                <div className={`post-detail-body px-4 md:px-6${fullCover ? ' post-detail-body--after-cover' : ''}`}>
                    <div className="post-detail-layout">
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">{banners('left')}</div>
                        </aside>
                        <div className="post-detail-main mt-6">
                            <article itemScope itemType="https://schema.org/BlogPosting">
                                {visibility !== 'public' && (
                                    <PostStatusNotice
                                        visibility={visibility}
                                        editPath={canManage ? `${data.postPath}/edit` : undefined}
                                    />
                                )}
                                {!fullCover && coverSection}
                                {hasBanner('top') && <div className="mb-16 space-y-4">{banners('top')}</div>}
                                <PostBody html={bodyHtml} />
                                {data.tags.length > 0 && (
                                    <div className="mb-16 flex flex-wrap gap-2" itemProp="keywords">
                                        {data.tags.map((tag) => (
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
                                {hasBanner('bottom') && <div className="mb-16 space-y-4">{banners('bottom')}</div>}
                                <ArticleInfo data={data} />
                            </article>
                            {visibility !== 'draft' && data.seriesLink && data.seriesName && (
                                <PostSeriesCard
                                    name={data.seriesName}
                                    seriesPath={data.seriesLink}
                                    author={data.username}
                                    navigation={data.seriesNavigation}
                                />
                            )}
                            {data.comments && (
                                <div data-blex-post-comments="">
                                    <PostCommentsApp key={revision} model={data.comments} />
                                </div>
                            )}
                        </div>
                        <aside className="post-detail-sidebar">
                            <div className="sticky top-28 space-y-4">
                                {headings.length > 0 && (
                                    <div className="max-h-[400px] overscroll-contain overflow-y-auto rounded-2xl bg-surface ring-1 ring-line/60">
                                        <div className="sticky top-0 z-10 border-b border-line-light bg-surface px-6 py-4">
                                            <h2 className="text-sm font-bold tracking-wider">목차</h2>
                                        </div>
                                        <OutlineLinks headings={headings} />
                                    </div>
                                )}
                                {banners('right')}
                            </div>
                        </aside>
                    </div>
                    {visibility === 'public' && (
                        <div className="mx-auto my-16 max-w-7xl">
                            <RelatedPosts posts={data.related} username={data.username} />
                        </div>
                    )}
                </div>
                {hasDock && <PostDock data={data} />}
            </main>
            <div className="post-detail-footer-action-space">
                <SiteFooter brand={data.brand} year={data.copyrightYear} />
            </div>
            {prompts.dialogs}
        </>
    );
}
