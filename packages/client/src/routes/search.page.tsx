import { PageLayout } from '~/features/discovery/layout';
import { EmptyState } from '~/features/discovery/post-list';
import { SearchPagination, SearchResultCard, searchForm } from '~/features/discovery/search-ui';
import type { PageProps } from '~/contracts/pages';

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
                    <h1 className="mb-4 text-2xl font-bold tracking-tight text-content sm:text-3xl">포스트 검색</h1>
                    {searchForm(searchText, username)}
                </section>
                {searchText ? (
                    posts.length ? (
                        <section className="space-y-4">
                            <div className="rounded-2xl border border-line bg-surface-subtle px-4 py-3">
                                <h2 className="text-lg font-semibold text-content">
                                    <strong className="text-content">{count.toLocaleString('ko-KR')}</strong>개의 결과
                                    <span className="ml-2 text-xs font-normal text-content-hint">{`“${searchText}” 검색`}</span>
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
                            title="검색 결과가 없습니다"
                            message="다른 검색어 또는 작성자 이름으로 다시 검색해 보세요."
                            icon="search"
                            framed={true}
                        />
                    )
                ) : (
                    <EmptyState
                        title="무엇을 찾고 있나요?"
                        message="검색어를 입력하면 제목, 설명, 태그, 본문에서 공개 글을 찾습니다."
                        icon="search"
                        framed={true}
                    />
                )}
            </div>
        )
    });
}
