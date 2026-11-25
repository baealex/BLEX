import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState } from '../discovery/post-list';
import type { FeaturedPostsView } from './author-page-data';
import { authorSectionTitle, authorTextLink } from './profile-ui';

/** Pinned posts keep the author's order and recent posts stay newest first, so every row has the same weight. */
export function FeaturedPostsSection({ view }: { view: FeaturedPostsView }): ReactNode {
    return (
        <section className="featured-section" data-featured-posts-section={true} data-partial-url={view.partialUrl}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4">
                <h2 className={authorSectionTitle}>
                    {view.kind === 'featured' ? ui('Recommended posts') : ui('Recent posts')}
                </h2>
                {view.canManage ? (
                    <a href="/settings/pinned-posts" className={authorTextLink}>
                        <SiteIcon name="pin" className="text-xs" />
                        {ui('Manage pinned posts')}
                    </a>
                ) : null}
            </div>
            {view.posts.length ? (
                <>
                    <ul className="border-t border-line-light">
                        {view.posts.map((post) => (
                            <li key={post.href} className="border-b border-line-light">
                                <a href={post.href} className="group flex items-center gap-4 py-5 sm:gap-8 sm:py-6">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-content transition-colors duration-150 group-hover:text-content-secondary sm:text-lg">
                                            {post.title}
                                        </h3>
                                        {post.subtitle ? (
                                            <p className="mt-1.5 hidden truncate text-sm text-content-secondary sm:block">
                                                {post.subtitle}
                                            </p>
                                        ) : null}
                                        <p className="mt-2.5 flex items-center gap-2 text-[13px] text-content-secondary">
                                            {post.date ? <time dateTime={post.date.iso}>{post.date.text}</time> : null}
                                            {post.date ? (
                                                <span
                                                    aria-hidden="true"
                                                    className="size-1 rounded-full bg-content-hint"
                                                />
                                            ) : null}
                                            <span>{ui('{value0} min', { value0: post.readTime })}</span>
                                        </p>
                                    </div>
                                    {post.image ? (
                                        <div className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-xl bg-surface-subtle ring-1 ring-line/60 sm:w-36">
                                            <img
                                                className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
                                                src={post.image}
                                                alt=""
                                                loading="lazy"
                                            />
                                        </div>
                                    ) : null}
                                </a>
                            </li>
                        ))}
                    </ul>
                    {view.allPosts ? (
                        <a href={view.allPosts.href} className={`${authorTextLink} mt-3`}>
                            {ui('{count, plural, one{See # post} other{See all # posts}}', {
                                count: view.allPosts.count
                            })}
                            <SiteIcon name="arrow-right" className="text-xs" />
                        </a>
                    ) : null}
                </>
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
