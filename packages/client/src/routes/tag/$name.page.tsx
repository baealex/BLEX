import { ui } from '../../i18n/public-ui.js';
import { SiteIcon } from '~/appearance/icons';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    tagName,
    posts,
    likes,
    path,
    query,
    checkedPage,
    pages
}: PageProps['tag/$name']): string {
    return PageLayout({
        meta,
        children: (
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
                <nav className="mb-8">
                    <a
                        href="/tags"
                        className="group inline-flex items-center text-sm font-medium text-content-secondary transition-colors duration-200 hover:text-content"
                    >
                        <SiteIcon
                            name="arrow-left"
                            className="mr-2 text-xs transition-transform duration-200 group-hover:-translate-x-0.5"
                        />
                        {ui('All tags')}
                    </a>
                </nav>
                <header className="mb-12 text-center sm:mb-16">
                    <h1 className="mb-4 text-3xl font-bold tracking-tight text-content">{tagName}</h1>
                </header>
                {posts.length ? (
                    <ReactFragment>
                        <PostGrid posts={posts} likes={likes} />
                        <div className="mt-16 mb-8">
                            <Pagination path={path} search={query} preserve={[]} page={checkedPage} pages={pages} />
                        </div>
                    </ReactFragment>
                ) : (
                    <EmptyState
                        title={ui('No posts')}
                        message={ui('No posts have the #{value0} tag yet.', { value0: tagName })}
                        icon="hash"
                        framed={true}
                    />
                )}
            </div>
        )
    });
}
