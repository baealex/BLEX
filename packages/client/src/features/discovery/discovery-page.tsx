import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { DiscoveryPageData, HomePageData, TagPageData, TagsPageData } from './discovery-page-data';
import { NoticeCarousel } from './notice-carousel';
import { EmptyState, PageNavigation, PostCardGrid } from './post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from './search-ui';

function HomeContent({ data }: { data: HomePageData }) {
    return (
        <ReactFragment>
            <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
                <h1 className="sr-only">{ui('Latest posts')}</h1>
                {data.signedIn ? (
                    <div className="mb-6 flex justify-end">
                        <a
                            href="/interests"
                            className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors duration-150 hover:bg-surface-subtle hover:text-content"
                        >
                            <SiteIcon name="heart" className="text-xs text-content-hint" />
                            <span>{ui('Liked posts')}</span>
                        </a>
                    </div>
                ) : null}
                {data.notices.length ? <NoticeCarousel notices={data.notices} /> : null}
                {data.posts.length ? (
                    <ReactFragment>
                        <PostCardGrid cards={data.posts} className="mb-16 gap-6" likes={data.likes} />
                        <div className="mt-16 mb-12">
                            <PageNavigation pagination={data.pagination} />
                        </div>
                    </ReactFragment>
                ) : (
                    <EmptyState
                        title={ui('No posts yet')}
                        message={ui('Published posts will appear here.')}
                        icon="writing"
                        actionUrl={data.canWrite ? '/write' : undefined}
                        actionLabel={data.canWrite ? ui('Write a post') : undefined}
                        actionIcon={data.canWrite ? 'edit' : undefined}
                    />
                )}
            </div>
        </ReactFragment>
    );
}

function TagsContent({ data }: { data: TagsPageData }) {
    const search = new URLSearchParams(data.pagination.search);
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
            <header className="mb-10 text-center">
                <h1 className="mb-3 text-3xl font-bold tracking-tight text-content sm:text-4xl">{ui('Tag cloud')}</h1>
                <p className="text-content-secondary">{ui('Explore all tags and their posts')}</p>
            </header>
            <div className="mb-12 flex flex-col items-end justify-between gap-6 sm:flex-row sm:items-center">
                <div className="w-full sm:max-w-md sm:flex-1">
                    <label
                        htmlFor="tag-query"
                        className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary"
                    >
                        {ui('Search tags')}
                    </label>
                    <QueryFilter path="/tags" search={search} placeholder={ui('Enter a search term.')} id="tag-query" />
                </div>
                <div className="w-full sm:w-auto">
                    <p className="mb-2 ml-1 block text-xs font-bold uppercase tracking-wider text-content-secondary">
                        {ui('Sort order')}
                    </p>
                    <DropdownFilter
                        path="/tags"
                        search={search}
                        param="sort"
                        current={data.sort}
                        options={[
                            {
                                value: 'popular',
                                label: ui('Most popular')
                            },
                            {
                                value: 'name',
                                label: ui('Name')
                            },
                            {
                                value: 'recent',
                                label: ui('Newest first')
                            }
                        ]}
                    />
                </div>
            </div>
            {data.tags.length ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
                    {data.tags.map((tag) => (
                        <a
                            className="group block rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]"
                            key={tag.name}
                            href={`/tag/${encodeURIComponent(tag.name)}`}
                        >
                            <div className="flex h-full flex-col">
                                <div className="mb-4 flex items-center justify-between">
                                    <span className="flex size-8 items-center justify-center rounded-full bg-surface-subtle text-content-hint transition-colors duration-300 group-hover:bg-action group-hover:text-content-inverted">
                                        <SiteIcon name="hash" className="text-sm" />
                                    </span>
                                    <span className="rounded-md bg-surface-subtle px-2 py-1 text-xs font-bold text-content-hint transition-colors group-hover:bg-line-light">
                                        {String(tag.count)}
                                    </span>
                                </div>
                                <h2 className="mb-1 truncate text-lg font-bold text-content transition-colors duration-200 group-hover:text-content">
                                    {tag.name}
                                </h2>
                                <p className="line-clamp-2 text-sm text-content-secondary">
                                    {ui('Tagged in {value0} posts', { value0: tag.count })}
                                </p>
                            </div>
                        </a>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title={ui('No tags')}
                    message={
                        data.searched ? ui('No tags match your search.') : ui('Tags added to posts will appear here.')
                    }
                    icon="tags"
                    framed={true}
                />
            )}
            {data.tags.length ? (
                <div className="mt-12">
                    <PageNavigation pagination={data.pagination} />
                </div>
            ) : null}
        </div>
    );
}

function TagContent({ data }: { data: TagPageData }) {
    return (
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
                <h1 className="mb-4 text-3xl font-bold tracking-tight text-content">{data.tagName}</h1>
            </header>
            {data.posts.length ? (
                <ReactFragment>
                    <PostCardGrid cards={data.posts} likes={data.likes} />
                    <div className="mt-16 mb-8">
                        <PageNavigation pagination={data.pagination} />
                    </div>
                </ReactFragment>
            ) : (
                <EmptyState
                    title={ui('No posts')}
                    message={ui('No posts have the #{value0} tag yet.', { value0: data.tagName })}
                    icon="hash"
                    framed={true}
                />
            )}
        </div>
    );
}

function DiscoveryContent({ data }: { data: DiscoveryPageData }) {
    if (data.page === 'home') return <HomeContent data={data} />;
    if (data.page === 'tags') return <TagsContent data={data} />;
    return <TagContent data={data} />;
}

export function DiscoveryPage({ data }: { data: DiscoveryPageData }) {
    return (
        <>
            <main>
                <DiscoveryContent data={data} />
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}
