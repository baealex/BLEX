import { ui } from '../i18n/public-ui.js';
import { SiteIcon } from '~/appearance/icons';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    posts,
    csrfToken,
    path,
    query,
    checkedPage,
    pages
}: PageProps['interests']): string {
    return PageLayout({
        meta,
        children: (
            <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
                <div className="mb-6 flex justify-end">
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content"
                    >
                        <SiteIcon name="arrow-left" className="text-xs text-content-hint" />
                        {ui('All posts')}
                    </a>
                </div>
                <header className="mb-8">
                    <p className="mb-2 text-sm font-semibold text-action">{ui('Posts you want to revisit')}</p>
                    <h1 className="text-3xl font-bold tracking-tight text-content md:text-4xl">{ui('Liked posts')}</h1>
                    <p className="mt-3 max-w-2xl leading-relaxed text-content-secondary">
                        {ui('Browse the posts you have liked, most recently liked first.')}
                    </p>
                </header>
                {posts.length ? (
                    <ReactFragment>
                        <PostGrid
                            posts={posts}
                            className="mb-16 gap-6"
                            relativeDate={true}
                            likes={{
                                csrfToken,
                                returnTo: path,
                                likedIds: new Set(posts.map((post) => post.id))
                            }}
                        />
                        <div className="mt-16 mb-12">
                            <Pagination path={path} search={query} preserve={[]} page={checkedPage} pages={pages} />
                        </div>
                    </ReactFragment>
                ) : (
                    <EmptyState
                        title={ui('No liked posts yet')}
                        message={ui('Posts you like will appear here.')}
                        icon="heart"
                        actionUrl="/"
                        actionLabel={ui('Browse posts')}
                        actionIcon="compass"
                    />
                )}
            </div>
        )
    });
}
