import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState } from '../discovery/post-list';
import type { FeaturedPostsView } from './author-page-data';

export function FeaturedPostsSection({ view }: { view: FeaturedPostsView }): ReactNode {
    return (
        <section className="featured-section" data-featured-posts-section={true} data-partial-url={view.partialUrl}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-bold tracking-tight text-content">
                    {view.kind === 'featured' ? ui('Recommended posts') : ui('Recent posts')}
                </h2>
                {view.canManage ? (
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
            {view.posts.length ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {view.posts.map((post) => (
                        <a href={post.href} className="group block h-full" key={post.href}>
                            <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.99]">
                                <div className="aspect-[16/9] overflow-hidden bg-surface-subtle">
                                    <img
                                        className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                                        src={post.cover}
                                        alt={post.title}
                                        loading="lazy"
                                    />
                                </div>
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="line-clamp-2 text-md font-bold leading-snug text-content transition-colors group-hover:text-content-secondary">
                                        {post.title}
                                    </h3>
                                    <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-content-hint">
                                        {post.date ? <time dateTime={post.date.iso}>{post.date.text}</time> : null}
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
