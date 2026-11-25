import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { ListRow, ListRows, MetaDot } from '../discovery/list-rows';
import { EmptyState, PageNavigation } from '../discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '../discovery/search-ui';
import type { AuthorSeriesListData } from './author-page-data';
import { AuthorTabs, ProfileStrip } from './profile-ui';

/** The author's series as rows like their posts, each with its first post's image as a cover. */
export function AuthorSeriesPage({ data }: { data: AuthorSeriesListData }) {
    const { path } = data.pagination;
    const search = new URLSearchParams(data.pagination.search);
    return (
        <>
            <main>
                <ReactFragment>
                    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
                        <ProfileStrip profile={data.profile} />
                        <div className="mt-5">
                            <AuthorTabs profile={data.profile} active="series" />
                        </div>
                    </div>
                    <section className="mx-auto mt-8 mb-20 w-full max-w-3xl px-4 sm:px-6">
                        <h1 className="sr-only">{ui('Series')}</h1>
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <label htmlFor="author-series-query" className="sr-only">
                                    {ui('Search')}
                                </label>
                                <QueryFilter
                                    path={path}
                                    search={search}
                                    placeholder={ui('Search series')}
                                    id="author-series-query"
                                />
                            </div>
                            <div className="w-36 shrink-0 sm:w-44">
                                <DropdownFilter
                                    path={path}
                                    search={search}
                                    param="sort"
                                    current={data.sort}
                                    options={[
                                        { value: 'custom', label: ui("Author's order") },
                                        { value: 'newest', label: ui('Newest first') },
                                        { value: 'oldest', label: ui('Oldest first') },
                                        { value: 'posts', label: ui('Most posts') }
                                    ]}
                                />
                            </div>
                        </div>
                        {data.series.length ? (
                            <>
                                <ListRows className="mt-6">
                                    {data.series.map((series) => (
                                        <ListRow
                                            key={series.href}
                                            href={series.href}
                                            title={series.name}
                                            summary={series.summary}
                                            image={series.image}
                                            heading="h2"
                                            meta={
                                                <>
                                                    <span>
                                                        {ui('{value0, plural, one{# post} other{# posts}}', {
                                                            value0: series.postCount
                                                        })}
                                                    </span>
                                                    <MetaDot />
                                                    <time dateTime={series.updated.iso ?? undefined}>
                                                        {ui('Updated {value0}', { value0: series.updated.text })}
                                                    </time>
                                                </>
                                            }
                                        />
                                    ))}
                                </ListRows>
                                {data.pagination.pages > 1 ? (
                                    <div className="mt-10">
                                        <PageNavigation pagination={data.pagination} />
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <EmptyState
                                title={data.searched ? ui('No series match your search') : ui('No public series yet')}
                                message={
                                    data.searched
                                        ? ui('Check your search query.')
                                        : ui('Public series will appear here.')
                                }
                                icon="stack-2"
                            />
                        )}
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
