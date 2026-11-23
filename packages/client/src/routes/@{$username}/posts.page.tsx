import { authorTabs, profileHeader } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '~/features/discovery/search-ui';
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
    tagFilter,
    tagOptions,
    posts,
    likes,
    searchText,
    checkedPage,
    pages
}: PageProps['@{$username}/posts']): string {
    return PageLayout({
        meta,
        children: (
            <ReactFragment>
                {profileHeader(author, false, subscription, viewer, csrfToken, socialLinks, path)}
                {authorTabs(author, 'posts')}
                <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold tracking-tight text-content">포스트</h1>
                    </div>
                    <div className="mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="w-full lg:max-w-md">
                                <label
                                    htmlFor="author-post-query"
                                    className="mb-2 ml-1 block text-xs font-semibold text-content-secondary"
                                >
                                    검색
                                </label>
                                <QueryFilter
                                    path={path}
                                    search={query}
                                    placeholder="포스트 검색"
                                    id="author-post-query"
                                />
                            </div>
                            <div className="w-full lg:w-44">
                                <p className="mb-2 ml-1 block text-xs font-semibold text-content-secondary">태그</p>
                                <DropdownFilter
                                    path={path}
                                    search={query}
                                    param="tag"
                                    current={tagFilter}
                                    options={[
                                        {
                                            value: '',
                                            label: '전체 태그'
                                        },
                                        ...tagOptions.map((tag) => ({
                                            value: tag.name,
                                            label: tag.name
                                        }))
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="md:col-span-3">
                            {posts.length ? (
                                <PostGrid posts={posts} showAuthor={false} likes={likes} relativeDate={true} />
                            ) : (
                                <EmptyState
                                    title={
                                        searchText || tagFilter
                                            ? '조건에 맞는 포스트가 없습니다'
                                            : '아직 공개된 포스트가 없습니다.'
                                    }
                                    message={
                                        searchText || tagFilter
                                            ? '검색어나 태그를 다시 확인해주세요.'
                                            : '새 포스트가 발행되면 이곳에 표시됩니다.'
                                    }
                                    icon="file-text"
                                />
                            )}
                            <div className="mt-12 mb-12">
                                <Pagination
                                    path={path}
                                    search={query}
                                    preserve={['q', 'tag']}
                                    page={checkedPage}
                                    pages={pages}
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </ReactFragment>
        )
    });
}
