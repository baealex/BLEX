import { ui } from '../i18n/public-ui.js';
import { SiteIcon } from '~/appearance/icons';
import { NoticeSection, PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    viewer,
    globalNotices,
    posts,
    likes,
    path,
    query,
    checkedPage,
    pages
}: PageProps['index']): string {
    return PageLayout({
        meta,
        children: (
            <ReactFragment>
                <div className="mx-auto mt-6 max-w-7xl px-4 md:px-6">
                    <h1 className="sr-only">{ui('Latest posts')}</h1>
                    {viewer ? (
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
                    <NoticeSection notices={globalNotices} scope="global" />
                    {posts.length ? (
                        <ReactFragment>
                            <PostGrid posts={posts} className="mb-16 gap-6" likes={likes} relativeDate={true} />
                            <div className="mt-16 mb-12">
                                <Pagination path={path} search={query} preserve={[]} page={checkedPage} pages={pages} />
                            </div>
                        </ReactFragment>
                    ) : (
                        <EmptyState
                            title={ui('No posts yet')}
                            message={ui('Published posts will appear here.')}
                            icon="writing"
                            actionUrl={viewer?.hasEditorRole ? '/write' : undefined}
                            actionLabel={viewer?.hasEditorRole ? ui('Write a post') : undefined}
                            actionIcon={viewer?.hasEditorRole ? 'edit' : undefined}
                        />
                    )}
                </div>
            </ReactFragment>
        )
    });
}
