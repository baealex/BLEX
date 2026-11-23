import { SiteIcon } from '~/appearance/icons';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import { h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    posts,
    csrfToken,
    path,
    query,
    checkedPage,
    pages
}: PageProps['interests']): string {
    return PageLayout({
        meta,
        children: h(
            'div',
            { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
            h(
                'div',
                { className: 'mb-6 flex justify-end' },
                h(
                    'a',
                    {
                        href: '/',
                        className:
                            'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors hover:bg-surface-subtle hover:text-content'
                    },
                    h(SiteIcon, {
                        name: 'arrow-left',
                        className: 'text-xs text-content-hint'
                    }),
                    '전체 포스트'
                )
            ),
            h(
                'header',
                { className: 'mb-8' },
                h('p', { className: 'mb-2 text-sm font-semibold text-action' }, '내가 다시 보고 싶은 포스트'),
                h('h1', { className: 'text-3xl font-bold tracking-tight text-content md:text-4xl' }, '관심 포스트'),
                h(
                    'p',
                    { className: 'mt-3 max-w-2xl leading-relaxed text-content-secondary' },
                    '추천으로 관심 표시한 포스트를 최신 관심순으로 모아볼 수 있어요.'
                )
            ),
            posts.length
                ? h(
                      ReactFragment,
                      null,
                      PostGrid({
                          posts,
                          className: 'mb-16 gap-6',
                          relativeDate: true,
                          likes: {
                              csrfToken,
                              returnTo: path,
                              likedIds: new Set(posts.map((post) => post.id))
                          }
                      }),
                      h(
                          'div',
                          { className: 'mt-16 mb-12' },
                          Pagination({
                              path,
                              search: query,
                              preserve: [],
                              page: checkedPage,
                              pages
                          })
                      )
                  )
                : EmptyState({
                      title: '아직 관심 포스트가 없어요',
                      message: '추천 버튼을 눌러둔 포스트가 여기에 모입니다.',
                      icon: 'heart',
                      actionUrl: '/',
                      actionLabel: '포스트 둘러보기',
                      actionIcon: 'compass'
                  })
        )
    });
}
