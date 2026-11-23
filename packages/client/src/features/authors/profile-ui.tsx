import { ui } from '../../i18n/public-ui.js';
import { createHash } from 'node:crypto';
import type { ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import { LoginPromptLink } from '../engagement/ui/login-prompt-link';
import type { AuthorRow, AuthorSocialLink, PostRow, PublicPageViewer, SubscriptionState } from '@blex/contracts/public';
import { avatarUrl, dateLabel, dateValue, mediaUrl, resourceUrl, safeExternalUrl } from '../discovery/view-helpers';
import { EmptyState, postPath } from '../discovery/post-list';
import { AboutEditor, AboutHeading } from './about-editor';

function postCover(post: PostRow): string {
    if (post.image) return mediaUrl(post.image) ?? resourceUrl('assets/images/default-cover-1.jpg');
    const digest = createHash('md5').update(post.slug).digest('hex');
    const index = (Number.parseInt(digest.slice(0, 8), 16) % 6) + 1;
    return resourceUrl(`assets/images/default-cover-${index}.jpg`);
}

export function isEditor(author: AuthorRow): boolean {
    return author.isActive && author.role === 'EDITOR';
}

export function authorPath(username: string, suffix = ''): string {
    return `/@${encodeURIComponent(username)}${suffix}`;
}

function subscriptionControl(
    author: AuthorRow,
    state: SubscriptionState,
    viewer: PublicPageViewer | null,
    csrfToken: string,
    path: string
): ReactNode {
    if (!state.canSubscribe) return null;
    const subscribeLabel = ui('Subscribe to new posts by {value0}', { value0: author.username });
    if (!viewer) {
        return (
            <LoginPromptLink
                returnTo={path}
                action="subscribe"
                aria-label={subscribeLabel}
                className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]"
            >
                <SiteIcon name="bell" className="text-xs" />
                {ui('Subscribe')}
            </LoginPromptLink>
        );
    }
    return (
        <form className="mb-0" method="post" action={`/v1/users/@${encodeURIComponent(author.username)}/subscription`}>
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
            <input type="hidden" name="returnTo" value={path} />
            {state.isSubscribed ? <input type="hidden" name="action" value="unsubscribe" /> : null}
            <button
                type="submit"
                aria-pressed={state.isSubscribed}
                aria-label={subscribeLabel}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${state.isSubscribed ? 'border-line bg-surface text-content-secondary hover:border-line-strong hover:text-content' : 'border-transparent bg-action text-content-inverted hover:bg-action-hover active:scale-95'}`}
            >
                <SiteIcon name={state.isSubscribed ? 'check' : 'bell'} className="text-xs" />
                {state.isSubscribed ? ui('Subscribed') : ui('Subscribe')}
            </button>
        </form>
    );
}

export function featuredPostsSection(
    author: AuthorRow,
    featured: { kind: 'featured' | 'recent'; posts: PostRow[] },
    isOwner: boolean
): ReactNode {
    if (!featured.posts.length && !isOwner) return null;
    return (
        <section
            className="featured-section"
            data-featured-posts-section={true}
            data-partial-url={`${authorPath(author.username)}/partials/featured-posts`}
        >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-content">
                    {featured.kind === 'featured' ? ui('Recommended posts') : ui('Recent posts')}
                </h2>
                {isOwner ? (
                    <nav className="flex flex-wrap gap-2" aria-label={ui('Manage author posts')}>
                        <a
                            href="/settings/pinned-posts"
                            className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content"
                        >
                            <SiteIcon name="pin" className="text-xs" />
                            {ui('Manage pinned posts')}
                        </a>
                    </nav>
                ) : null}
            </div>
            {featured.posts.length ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {featured.posts.map((post) => (
                        <a href={postPath(post)} className="group block h-full" key={post.id}>
                            <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.99]">
                                <div className="aspect-[16/9] overflow-hidden bg-surface-subtle">
                                    <img
                                        className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                                        src={postCover(post)}
                                        alt={post.title}
                                        loading="lazy"
                                    />
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="line-clamp-2 text-md font-bold leading-snug text-content transition-colors group-hover:text-content-secondary">
                                        {post.title}
                                    </h3>
                                    <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-content-hint">
                                        {post.publishedDate ? (
                                            <time dateTime={dateValue(post.publishedDate) ?? undefined}>
                                                {dateLabel(post.publishedDate)}
                                            </time>
                                        ) : null}
                                        <span className="size-1 rounded-full bg-content-hint/70" />
                                        <span>{ui('{value0} min', { value0: post.readTime })}</span>
                                    </div>
                                </div>
                            </article>
                        </a>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title={ui('No public posts yet.')}
                    actionUrl="/write"
                    actionLabel={ui('Write a post')}
                    actionIcon="edit"
                />
            )}
        </section>
    );
}

export function profileHeader(
    author: AuthorRow,
    isHeading: boolean,
    subscription: SubscriptionState = {
        canSubscribe: false,
        isSubscribed: false
    },
    viewer: PublicPageViewer | null = null,
    csrfToken = '',
    socialLinks: AuthorSocialLink[] = [],
    returnTo = authorPath(author.username)
): ReactNode {
    const homepage = safeExternalUrl(author.homepage);
    const isOwner = viewer?.id === author.id;
    const cover = author.cover ? (
        <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-8">
            <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-line/60">
                <img
                    className="h-full w-full object-cover object-center"
                    src={mediaUrl(author.cover) ?? undefined}
                    alt={ui("{value0}'s cover", { value0: author.username })}
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-surface-page/5" />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-surface-page/35 sm:h-16 md:h-20" />
                {isOwner ? (
                    <a
                        href="/settings/profile"
                        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors duration-150 hover:border-white/50 hover:bg-black/35 hover:text-white"
                    >
                        <SiteIcon name="camera" className="text-[11px]" />
                        <span>{ui('Change cover')}</span>
                    </a>
                ) : null}
            </div>
        </div>
    ) : null;
    const displayUrl = homepage?.replace(/^https?:\/\//, '') ?? '';
    return (
        <div className="relative overflow-hidden pb-12 sm:pb-16">
            {cover}
            <div
                className={`relative mx-auto max-w-4xl px-4 sm:px-6 ${author.cover ? '-mt-14 sm:-mt-16 md:-mt-20' : 'pt-12'}`}
            >
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-6 sm:mb-8">
                        <img
                            className="relative size-28 rounded-full object-cover shadow-floating ring-4 ring-surface-page sm:size-32 md:size-40"
                            src={avatarUrl(author.avatar)}
                            alt={author.username}
                        />
                        {isOwner ? (
                            <a
                                href="/settings/profile"
                                title={ui('Change profile picture')}
                                aria-label={ui('Change profile picture')}
                                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-content-secondary shadow-subtle transition-colors duration-150 hover:border-line-strong hover:text-content"
                            >
                                <SiteIcon name="pencil" className="text-xs" />
                            </a>
                        ) : null}
                    </div>
                    {isHeading ? (
                        <h1 className="mb-2 text-2xl font-bold tracking-tight text-content">{author.username}</h1>
                    ) : (
                        <p className="mb-2 text-2xl font-bold tracking-tight text-content">{author.username}</p>
                    )}
                    {author.bio ? (
                        <p className="mx-auto mb-6 max-w-2xl px-4 text-md font-medium leading-relaxed text-content-secondary">
                            {author.bio}
                        </p>
                    ) : null}
                    {subscription.canSubscribe ? (
                        <div className="mb-6">
                            {subscriptionControl(author, subscription, viewer, csrfToken, returnTo)}
                        </div>
                    ) : null}
                    {homepage ? (
                        <div className="mb-8">
                            <a
                                href={homepage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content"
                            >
                                <SiteIcon
                                    name="link"
                                    className="text-xs text-content-hint transition-colors group-hover:text-content"
                                />
                                <span>{displayUrl.length > 30 ? `${displayUrl.slice(0, 29)}…` : displayUrl}</span>
                            </a>
                        </div>
                    ) : null}
                    {socialLinks.length ? (
                        <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-3">
                            {socialLinks.map((social) => {
                                const icon =
                                    (
                                        {
                                            github: 'brand-github',
                                            twitter: 'brand-x',
                                            x: 'brand-x',
                                            threads: 'brand-threads',
                                            telegram: 'brand-telegram',
                                            facebook: 'brand-facebook',
                                            instagram: 'brand-instagram',
                                            linkedin: 'brand-linkedin',
                                            youtube: 'brand-youtube',
                                            tiktok: 'brand-tiktok',
                                            discord: 'brand-discord'
                                        } as Record<string, SiteIconName>
                                    )[social.name.toLowerCase()] ?? 'link';
                                const label = social.name.toLowerCase() === 'twitter' ? 'X' : social.name;
                                return (
                                    <a
                                        key={social.id}
                                        href={social.value}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={label}
                                        className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content sm:size-11"
                                    >
                                        <SiteIcon name={icon} className="text-lg" />
                                        <span className="sr-only">{label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    ) : isOwner ? (
                        <a
                            href="/settings/social-links"
                            className="inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-content-hint transition-colors duration-150 hover:border-line hover:text-content-secondary"
                        >
                            <SiteIcon name="plus" className="text-xs" />
                            <span>{ui('Add a social link')}</span>
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function AboutSection({
    author,
    aboutHtml,
    isOwner
}: {
    author: AuthorRow;
    aboutHtml: string;
    isOwner: boolean;
}): ReactNode {
    if (!aboutHtml && !isOwner) return null;
    if (!isOwner)
        return (
            <section>
                <AboutHeading />
                <div className="prose blog-post-content" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
            </section>
        );
    const editPath = `${authorPath(author.username)}/about/edit`;
    return (
        <section data-about-editor="" data-about-url={editPath}>
            <AboutEditor aboutHtml={aboutHtml} aboutMarkdown={author.aboutMarkdown ?? ''} editPath={editPath} />
        </section>
    );
}

export function authorTabs(author: AuthorRow, activeTab: 'overview' | 'posts' | 'series' | 'about'): ReactNode {
    if (!isEditor(author)) return <div className="mb-8" />;
    const tabs: Array<{ key: 'overview' | 'posts' | 'series'; href: string; label: string; count?: number }> = [
        {
            key: 'overview',
            href: authorPath(author.username),
            label: ui('Overview')
        },
        {
            key: 'posts',
            href: authorPath(author.username, '/posts'),
            label: ui('Posts'),
            count: author.publicPostCount
        },
        {
            key: 'series',
            href: authorPath(author.username, '/series'),
            label: ui('Series'),
            count: author.publicSeriesCount
        }
    ];
    return (
        <div className="relative mb-10">
            <div className="hide-scrollbar flex justify-center overflow-x-auto pb-2 sm:pb-0">
                <nav
                    className="inline-flex min-w-fit rounded-xl bg-surface-subtle/80 p-1.5 backdrop-blur-sm"
                    aria-label={ui('Author menu')}
                >
                    {tabs.map((tab) => (
                        <a
                            href={tab.href}
                            key={tab.key}
                            aria-current={activeTab === tab.key ? 'page' : undefined}
                            className={`relative whitespace-nowrap rounded-lg px-6 py-2 text-sm font-bold transition-all duration-200 ${activeTab === tab.key ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                <span className="flex items-center gap-1.5">
                                    {tab.label}
                                    {tab.count !== undefined ? (
                                        <span
                                            className={`rounded-md px-1.5 py-0.5 text-[10px] ${activeTab === tab.key ? 'bg-action text-content-inverted' : 'bg-surface-elevated text-content-secondary ring-1 ring-line/80'}`}
                                        >
                                            {String(tab.count)}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </a>
                    ))}
                </nav>
            </div>
        </div>
    );
}
