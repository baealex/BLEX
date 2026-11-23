import { ui } from '../i18n/public-ui.js';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState } from '~/features/discovery/post-list';
import { SearchPagination, SearchResultCard, searchForm } from '~/features/discovery/search-ui';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({
    meta,
    searchText,
    username,
    posts,
    count,
    checkedPage,
    pages
}: PageProps['search']): string {
    return PageLayout({
        meta,
        children: (
            <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
                <section>
                    <h1 className="mb-4 text-2xl font-bold tracking-tight text-content sm:text-3xl">
                        {ui('Search posts')}
                    </h1>
                    {searchForm(searchText, username)}
                </section>
                {searchText ? (
                    posts.length ? (
                        <section className="space-y-4">
                            <div className="rounded-2xl border border-line bg-surface-subtle px-4 py-3">
                                <h2 className="text-lg font-semibold text-content">
                                    <strong className="text-content">
                                        {ui('{count, plural, one{# result} other{# results}}', { count })}
                                    </strong>
                                    <span className="ml-2 text-xs font-normal text-content-hint">
                                        {ui('Search for “{value0}”', { value0: searchText })}
                                    </span>
                                </h2>
                            </div>
                            <div className="space-y-4">
                                {posts.map((post) => (
                                    <SearchResultCard key={post.id} post={post} query={searchText} />
                                ))}
                            </div>
                            <SearchPagination page={checkedPage} pages={pages} query={searchText} username={username} />
                        </section>
                    ) : (
                        <EmptyState
                            title={ui('No results')}
                            message={ui('Try a different search query or author name.')}
                            icon="search"
                            framed={true}
                        />
                    )
                ) : (
                    <EmptyState
                        title={ui('What are you looking for?')}
                        message={ui('Search public posts by title, description, tags, or content.')}
                        icon="search"
                        framed={true}
                    />
                )}
            </div>
        )
    });
}
