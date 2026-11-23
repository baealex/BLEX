import { SiteIcon } from '~/appearance/icons';
import { authorPath, authorTabs, profileHeader } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination } from '~/features/discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '~/features/discovery/search-ui';
import { dateLabel, dateValue } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    path,
    query,
    sort,
    seriesRows,
    searchText,
    checkedPage,
    pages
}: PageProps['@{$username}/series/index']): string {
    return PageLayout({
        meta,
        children: (
            <ReactFragment>
                {profileHeader(author, false, subscription, viewer, csrfToken, socialLinks, path)}
                {authorTabs(author, 'series')}
                <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-content">시리즈</h1>
                    </div>
                    <div className="mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="w-full lg:max-w-md">
                                <label
                                    htmlFor="author-series-query"
                                    className="mb-2 ml-1 block text-xs font-semibold text-content-secondary"
                                >
                                    검색
                                </label>
                                <QueryFilter
                                    path={path}
                                    search={query}
                                    placeholder="시리즈 검색"
                                    id="author-series-query"
                                />
                            </div>
                            <div className="w-full lg:w-44">
                                <p className="mb-2 ml-1 block text-xs font-semibold text-content-secondary">정렬</p>
                                <DropdownFilter
                                    path={path}
                                    search={query}
                                    param="sort"
                                    current={sort}
                                    options={[
                                        {
                                            value: 'custom',
                                            label: '작가 지정 순'
                                        },
                                        {
                                            value: 'newest',
                                            label: '최신순'
                                        },
                                        {
                                            value: 'oldest',
                                            label: '오래된순'
                                        },
                                        {
                                            value: 'posts',
                                            label: '포스트 많은 순'
                                        }
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="md:col-span-3">
                            {seriesRows.length ? (
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {seriesRows.map((series) => (
                                        <a
                                            className="group block overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]"
                                            key={series.id}
                                            href={`${authorPath(author.username, '/series')}/${encodeURIComponent(series.url)}`}
                                        >
                                            <div className="flex h-full flex-col p-5">
                                                <h2 className="mb-2.5 line-clamp-2 text-lg font-bold leading-snug text-content transition-colors group-hover:text-content-secondary">
                                                    {series.name}
                                                </h2>
                                                <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-content-secondary">
                                                    {series.textMarkdown}
                                                </p>
                                                <div className="mt-auto flex items-center justify-between border-t border-line-light pt-4 text-xs font-medium text-content-secondary">
                                                    <span className="flex items-center gap-1.5">
                                                        <SiteIcon name="file-text" className="text-content-hint" />
                                                        {`${series.postCount}개 포스트`}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <SiteIcon name="clock" className="text-content-hint" />
                                                        <time dateTime={dateValue(series.updatedDate) ?? undefined}>
                                                            {dateLabel(series.updatedDate)}
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
                                        searchText ? '조건에 맞는 시리즈가 없습니다' : '아직 공개된 시리즈가 없습니다'
                                    }
                                    message={
                                        searchText
                                            ? '검색어를 다시 확인해주세요.'
                                            : '시리즈가 공개되면 이곳에 표시됩니다.'
                                    }
                                    icon="stack-2"
                                />
                            )}
                            {seriesRows.length ? (
                                <div className="mt-12 mb-12">
                                    <Pagination
                                        path={path}
                                        search={query}
                                        preserve={['q', 'sort']}
                                        page={checkedPage}
                                        pages={pages}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
            </ReactFragment>
        )
    });
}
