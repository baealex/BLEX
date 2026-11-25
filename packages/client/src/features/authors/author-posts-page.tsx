import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import { PostRows } from '../discovery/list-rows';
import { EmptyState, PageNavigation } from '../discovery/post-list';
import { DropdownFilter, QueryFilter, ReactFragment } from '../discovery/search-ui';
import type { AuthorPostsData } from './author-page-data';
import { AuthorTabs, ProfileStrip } from './profile-ui';

/** The author's posts as rows, in the same column as their overview and series. */
export function AuthorPostsPage({ data }: { data: AuthorPostsData }) {
    const { path } = data.pagination;
    const search = new URLSearchParams(data.pagination.search);
    return (
        <>
            <main>
                <ReactFragment>
                    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8">
                        <ProfileStrip profile={data.profile} />
                        <div className="mt-5">
                            <AuthorTabs profile={data.profile} active="posts" />
                        </div>
                    </div>
                    <section className="mx-auto mt-8 mb-20 w-full max-w-3xl px-4 sm:px-6">
                        <h1 className="sr-only">{ui('Posts')}</h1>
                        <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                                <label htmlFor="author-post-query" className="sr-only">
                                    {ui('Search')}
                                </label>
                                <QueryFilter
                                    path={path}
                                    search={search}
                                    placeholder={ui('Search posts')}
                                    id="author-post-query"
                                />
                            </div>
                            {data.tagOptions.length ? (
                                <div className="w-36 shrink-0 sm:w-44">
                                    <DropdownFilter
                                        path={path}
                                        search={search}
                                        param="tag"
                                        current={data.tagFilter}
                                        options={[
                                            { value: '', label: ui('All tags') },
                                            ...data.tagOptions.map((tag) => ({ value: tag, label: tag }))
                                        ]}
                                    />
                                </div>
                            ) : null}
                        </div>
                        {data.posts.length ? (
                            <>
                                <PostRows posts={data.posts} heading="h2" className="mt-6" />
                                {data.pagination.pages > 1 ? (
                                    <div className="mt-10">
                                        <PageNavigation pagination={data.pagination} />
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <EmptyState
                                title={data.filtered ? ui('No posts match your search') : ui('No public posts yet.')}
                                message={
                                    data.filtered
                                        ? ui('Check your search query or tags.')
                                        : ui('New posts will appear here.')
                                }
                                icon="file-text"
                            />
                        )}
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
