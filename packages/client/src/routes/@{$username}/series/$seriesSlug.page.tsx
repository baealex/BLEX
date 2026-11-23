import { SiteIcon } from '~/appearance/icons';
import { authorPath } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { EmptyState, Pagination, postPath } from '~/features/discovery/post-list';
import { avatarUrl, dateLabel, formatPostDate, h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    series,
    seriesHtml,
    author,
    count,
    viewer,
    posts,
    seriesPath,
    sortOrder,
    checkedPage,
    pages
}: PageProps['@{$username}/series/$seriesSlug']): string {
    return PageLayout({
        meta,
        children: h(
            'div',
            { className: 'mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12' },
            h(
                'header',
                { className: 'mb-12 text-center' },
                h(
                    'span',
                    {
                        className:
                            'mb-4 inline-block rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-content-secondary'
                    },
                    '시리즈'
                ),
                h(
                    'h1',
                    { className: 'mb-4 text-3xl font-bold leading-tight tracking-tight text-content sm:text-4xl' },
                    series.name
                ),
                series.textHtml
                    ? h('div', {
                          className: 'mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-content-secondary',
                          dangerouslySetInnerHTML: { __html: seriesHtml }
                      })
                    : null,
                h(
                    'div',
                    { className: 'flex flex-wrap items-center justify-center gap-6 text-sm text-content-secondary' },
                    h(
                        'a',
                        {
                            href: authorPath(author.username),
                            className: 'flex items-center gap-2 transition-colors hover:text-content'
                        },
                        h('img', {
                            className: 'size-6 rounded-full object-cover ring-2 ring-line-light',
                            src: avatarUrl(series.authorAvatar),
                            alt: author.username
                        }),
                        h('span', { className: 'font-semibold text-content' }, author.username)
                    ),
                    h('span', {
                        className: 'size-1 rounded-full bg-content-hint/70',
                        'aria-hidden': true
                    }),
                    h(
                        'span',
                        { className: 'flex items-center gap-1.5' },
                        h(SiteIcon, {
                            name: 'file-text',
                            className: 'text-xs'
                        }),
                        `${count}개 포스트`
                    ),
                    h('span', {
                        className: 'size-1 rounded-full bg-content-hint/70',
                        'aria-hidden': true
                    }),
                    h(
                        'span',
                        { className: 'flex items-center gap-1.5' },
                        h(SiteIcon, {
                            name: 'clock',
                            className: 'text-xs'
                        }),
                        `${dateLabel(series.updatedDate)} 수정됨`
                    )
                ),
                viewer?.id === author.id
                    ? h(
                          'div',
                          { className: 'mt-8' },
                          h(
                              'a',
                              {
                                  href: `/settings/series/edit/${series.id}`,
                                  className:
                                      'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-[0.98]'
                              },
                              h(SiteIcon, {
                                  name: 'edit',
                                  className: 'text-xs'
                              }),
                              h('span', null, '시리즈 편집')
                          )
                      )
                    : null
            ),
            posts.length
                ? h(
                      'div',
                      { className: 'mb-6 flex justify-end' },
                      h(
                          'nav',
                          {
                              className:
                                  'inline-flex rounded-xl bg-surface-subtle/80 p-1 backdrop-blur-sm ring-1 ring-line/60',
                              'aria-label': '포스트 정렬'
                          },
                          h(
                              'a',
                              {
                                  href: `${seriesPath}?sort=asc`,
                                  'aria-current': sortOrder === 'asc' ? 'page' : undefined,
                                  className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'asc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`
                              },
                              '오래된순'
                          ),
                          h(
                              'a',
                              {
                                  href: seriesPath,
                                  'aria-current': sortOrder === 'desc' ? 'page' : undefined,
                                  className: `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-150 ${sortOrder === 'desc' ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`
                              },
                              '최신순'
                          )
                      )
                  )
                : null,
            posts.length
                ? h(
                      'div',
                      { className: 'space-y-4' },
                      ...posts.map((post, index) => {
                          const number =
                              sortOrder === 'desc'
                                  ? count - (checkedPage - 1) * 10 - index
                                  : (checkedPage - 1) * 10 + index + 1;
                          return h(
                              'article',
                              {
                                  className:
                                      'group relative rounded-2xl border border-line-light bg-surface-elevated p-6 transition-all duration-150 hover:ring-1 hover:ring-line/60 active:scale-[0.98]',
                                  key: post.id
                              },
                              h(
                                  'a',
                                  {
                                      className: 'flex items-start gap-5',
                                      href: postPath(post)
                                  },
                                  h(
                                      'span',
                                      {
                                          className:
                                              'flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-sm font-bold text-content-hint transition-colors duration-150 group-hover:bg-action group-hover:text-content-inverted'
                                      },
                                      String(number)
                                  ),
                                  h(
                                      'div',
                                      { className: 'min-w-0 flex-1 pt-1' },
                                      h(
                                          'h2',
                                          {
                                              className:
                                                  'mb-2 block text-lg font-bold leading-snug text-content transition-colors group-hover:text-content'
                                          },
                                          post.title
                                      ),
                                      h(
                                          'span',
                                          {
                                              className:
                                                  'flex flex-wrap items-center gap-4 text-xs font-medium text-content-hint'
                                          },
                                          h(
                                              'span',
                                              { className: 'flex items-center gap-1.5' },
                                              h(SiteIcon, { name: 'calendar' }),
                                              formatPostDate(post)
                                          ),
                                          h(
                                              'span',
                                              { className: 'flex items-center gap-1.5' },
                                              h(SiteIcon, { name: 'clock' }),
                                              `${post.readTime}분`
                                          ),
                                          h(
                                              'span',
                                              { className: 'ml-auto flex items-center gap-3' },
                                              h(
                                                  'span',
                                                  {
                                                      className:
                                                          'flex items-center gap-1.5 transition-colors hover:text-danger'
                                                  },
                                                  h(SiteIcon, { name: 'heart' }),
                                                  String(post.likeCount ?? 0)
                                              ),
                                              h(
                                                  'span',
                                                  {
                                                      className:
                                                          'flex items-center gap-1.5 transition-colors hover:text-content'
                                                  },
                                                  h(SiteIcon, { name: 'message-circle' }),
                                                  String(post.commentCount ?? 0)
                                              )
                                          )
                                      )
                                  )
                              )
                          );
                      })
                  )
                : EmptyState({
                      title: '아직 포스트가 없어요',
                      message: '이 시리즈에는 아직 포스트가 추가되지 않았습니다.',
                      icon: 'stack-2',
                      framed: true
                  }),
            posts.length
                ? h(
                      'div',
                      { className: 'mt-12' },
                      Pagination({
                          path: seriesPath,
                          search: new URLSearchParams(sortOrder === 'asc' ? 'sort=asc' : ''),
                          preserve: ['sort'],
                          page: checkedPage,
                          pages
                      })
                  )
                : null
        )
    });
}
