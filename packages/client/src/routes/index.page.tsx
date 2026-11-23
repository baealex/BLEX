import { SiteIcon } from '~/appearance/icons';
import { NoticeSection, PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, PostGrid } from '~/features/discovery/post-list';
import { ReactFragment } from '~/features/discovery/search-ui';
import { h } from '~/features/discovery/view-helpers';
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
        children: h(
            ReactFragment,
            null,
            h(
                'div',
                { className: 'mx-auto mt-6 max-w-7xl px-4 md:px-6' },
                h('h1', { className: 'sr-only' }, '최신 포스트'),
                viewer
                    ? h(
                          'div',
                          { className: 'mb-6 flex justify-end' },
                          h(
                              'a',
                              {
                                  href: '/interests',
                                  className:
                                      'inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-content-secondary ring-1 ring-line/60 transition-colors duration-150 hover:bg-surface-subtle hover:text-content'
                              },
                              h(SiteIcon, {
                                  name: 'heart',
                                  className: 'text-xs text-content-hint'
                              }),
                              h('span', null, '관심 포스트')
                          )
                      )
                    : null,
                NoticeSection({
                    notices: globalNotices,
                    scope: 'global'
                }),
                posts.length
                    ? h(
                          ReactFragment,
                          null,
                          PostGrid({
                              posts,
                              className: 'mb-16 gap-6',
                              likes,
                              relativeDate: true
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
                          title: '아직 포스트가 없어요',
                          message: '공개된 포스트가 발행되면 이곳에 표시됩니다.',
                          icon: 'writing',
                          actionUrl: viewer?.hasEditorRole ? '/write' : undefined,
                          actionLabel: viewer?.hasEditorRole ? '포스트 작성하기' : undefined,
                          actionIcon: viewer?.hasEditorRole ? 'edit' : undefined
                      })
            )
        )
    });
}
