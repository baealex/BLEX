import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState, PageNavigation } from '../discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '../discovery/search-ui';
import type { AuthorSeriesListData } from './author-page-data';
import { AuthorTabs, ProfileStrip } from './profile-ui';

export function AuthorSeriesPage({ data }: { data: AuthorSeriesListData }) {
    const { path } = data.pagination;
    const search = new URLSearchParams(data.pagination.search);
    return (
        <>
            <main>
                <ReactFragment>
                    <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
                        <ProfileStrip profile={data.profile} />
                        <div className="mt-5">
                            <AuthorTabs profile={data.profile} active="series" />
                        </div>
                    </div>
                    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight text-content">{ui('Series')}</h1>
                        </div>
                        <div className="mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="w-full lg:max-w-md">
                                    <label
                                        htmlFor="author-series-query"
                                        className="mb-2 ml-1 block text-xs font-semibold text-content-secondary"
                                    >
                                        {ui('Search')}
                                    </label>
                                    <QueryFilter
                                        path={path}
                                        search={search}
                                        placeholder={ui('Search series')}
                                        id="author-series-query"
                                    />
                                </div>
                                <div className="w-full lg:w-44">
                                    <p className="mb-2 ml-1 block text-xs font-semibold text-content-secondary">
                                        {ui('Sort')}
                                    </p>
                                    <DropdownFilter
                                        path={path}
                                        search={search}
                                        param="sort"
                                        current={data.sort}
                                        options={[
                                            {
                                                value: 'custom',
                                                label: ui("Author's order")
                                            },
                                            {
                                                value: 'newest',
                                                label: ui('Newest first')
                                            },
                                            {
                                                value: 'oldest',
                                                label: ui('Oldest first')
                                            },
                                            {
                                                value: 'posts',
                                                label: ui('Most posts')
                                            }
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            <div className="md:col-span-3">
                                {data.series.length ? (
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {data.series.map((series) => (
                                            <a
                                                className="group block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]"
                                                key={series.href}
                                                href={series.href}
                                            >
                                                <div className="flex h-full flex-col p-5">
                                                    <h2 className="mb-2.5 line-clamp-2 text-lg font-bold leading-snug text-content transition-colors group-hover:text-content-secondary">
                                                        {series.name}
                                                    </h2>
                                                    <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-content-secondary">
                                                        {series.summary}
                                                    </p>
                                                    <div className="mt-auto flex items-center justify-between border-t border-line-light pt-4 text-xs font-medium text-content-secondary">
                                                        <span className="flex items-center gap-1.5">
                                                            <SiteIcon name="file-text" className="text-content-hint" />
                                                            {ui('{value0, plural, one{# post} other{# posts}}', {
                                                                value0: series.postCount
                                                            })}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <SiteIcon name="clock" className="text-content-hint" />
                                                            <time dateTime={series.updated.iso ?? undefined}>
                                                                {series.updated.text}
                                                            </time>
                                                        </span>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState
                                        title={
                                            data.searched
                                                ? ui('No series match your search')
                                                : ui('No public series yet')
                                        }
                                        message={
                                            data.searched
                                                ? ui('Check your search query.')
                                                : ui('Public series will appear here.')
                                        }
                                        icon="stack-2"
                                    />
                                )}
                                {data.series.length ? (
                                    <div className="mt-12 mb-12">
                                        <PageNavigation pagination={data.pagination} />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>
                </ReactFragment>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export function mountPage(data: AuthorSeriesListData) {
    return <AuthorSeriesPage data={data} />;
}
