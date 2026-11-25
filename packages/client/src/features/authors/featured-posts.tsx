import type { ReactNode } from 'react';
import { SiteIcon } from '../../appearance/icons';
import { ui } from '../../i18n/public-ui.js';
import { PostRows } from '../discovery/list-rows';
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
                    <PostRows posts={view.posts} />
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
