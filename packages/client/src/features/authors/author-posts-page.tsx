import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { EmptyState, PageNavigation, PostCardGrid } from '../discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '../discovery/search-ui';
import type { AuthorPostsData } from './author-page-data';
import { AuthorTabs, ProfileStrip } from './profile-ui';

export function AuthorPostsPage({ data }: { data: AuthorPostsData }) {
    const { path } = data.pagination;
    const search = new URLSearchParams(data.pagination.search);
    return (
        <>
            <main>
                <ReactFragment>
                    <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
                        <ProfileStrip profile={data.profile} />
                        <div className="mt-5">
                            <AuthorTabs profile={data.profile} active="posts" />
                        </div>
                    </div>
                    <section className="mx-auto mt-10 w-full max-w-6xl px-4 sm:px-6">
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight text-content">{ui('Posts')}</h1>
                        </div>
                        <div className="mb-12 rounded-2xl bg-surface p-4 ring-1 ring-line/60">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <div className="w-full lg:max-w-md">
                                    <label
                                        htmlFor="author-post-query"
                                        className="mb-2 ml-1 block text-xs font-semibold text-content-secondary"
                                    >
                                        {ui('Search')}
                                    </label>
                                    <QueryFilter
                                        path={path}
                                        search={search}
                                        placeholder={ui('Search posts')}
                                        id="author-post-query"
                                    />
                                </div>
                                <div className="w-full lg:w-44">
                                    <p className="mb-2 ml-1 block text-xs font-semibold text-content-secondary">
                                        {ui('Tag')}
                                    </p>
                                    <DropdownFilter
                                        path={path}
                                        search={search}
                                        param="tag"
                                        current={data.tagFilter}
                                        options={[
                                            {
                                                value: '',
                                                label: ui('All tags')
                                            },
                                            ...data.tagOptions.map((tag) => ({
                                                value: tag,
                                                label: tag
                                            }))
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            <div className="md:col-span-3">
                                {data.posts.length ? (
                                    <PostCardGrid cards={data.posts} likes={data.likes} />
                                ) : (
                                    <EmptyState
                                        title={
                                            data.filtered
                                                ? ui('No posts match your search')
                                                : ui('No public posts yet.')
                                        }
                                        message={
                                            data.filtered
                                                ? ui('Check your search query or tags.')
                                                : ui('New posts will appear here.')
                                        }
                                        icon="file-text"
                                    />
                                )}
                                <div className="mt-12 mb-12">
                                    <PageNavigation pagination={data.pagination} />
                                </div>
                            </div>
                        </div>
                    </section>
                </ReactFragment>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export function mountPage(data: AuthorPostsData) {
    return <AuthorPostsPage data={data} />;
}
