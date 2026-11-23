import { timeSince } from '../../lib/date-format';
import { Fragment, type ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import { loginPromptProps } from '../engagement/ui/login-prompt';
import type { CardLikes, PostRow } from '../../contracts/public';
import { avatarUrl, dateLabel, dateValue, h, mediaUrl, pageUrl } from './view-helpers';

export function postPath(post: Pick<PostRow, 'authorUsername' | 'slug'>): string {
    return `/@${encodeURIComponent(post.authorUsername)}/${encodeURIComponent(post.slug)}`;
}

function PostCardLike({ post, likes }: { post: PostRow; likes?: CardLikes }): ReactNode {
    const liked = likes?.likedIds.has(post.id) ?? false;
    const count = post.likeCount ?? 0;
    const className = `inline-flex h-7 min-w-[51px] items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-300 active:scale-95 ${
        liked
            ? 'border-danger-line bg-danger-surface text-danger'
            : 'border-line bg-surface-elevated text-content-hint hover:border-line-strong hover:bg-surface-subtle hover:text-content-secondary'
    }`;
    const label = `${liked ? '좋아요 취소' : '좋아요'} (${count})`;
    const content = h(Fragment, null, h(SiteIcon, { name: 'heart' }), h('span', null, String(count)));
    if (!likes?.csrfToken)
        return h(
            'a',
            {
                ...loginPromptProps(likes?.returnTo ?? postPath(post), 'like'),
                className,
                'aria-label': label
            },
            content
        );
    return h(
        'form',
        {
            method: 'post',
            action: `/like/${encodeURIComponent(post.slug)}`
        },
        h('input', {
            type: 'hidden',
            name: 'csrfmiddlewaretoken',
            value: likes.csrfToken
        }),
        h('input', {
            type: 'hidden',
            name: 'returnTo',
            value: likes.returnTo
        }),
        h(
            'button',
            {
                type: 'submit',
                className: `cursor-pointer ${className}`,
                'aria-label': label,
                'aria-pressed': liked
            },
            content
        )
    );
}

function PostCard({
    post,
    showAuthor,
    priority = false,
    likes,
    relativeDate = false
}: {
    post: PostRow;
    showAuthor: boolean;
    priority?: boolean;
    relativeDate?: boolean;
    likes?: CardLikes;
}): ReactNode {
    const titleHref = postPath(post);
    const authorHref = `/@${encodeURIComponent(post.authorUsername)}`;
    const hasImage = Boolean(post.image && post.image !== 'None' && post.image !== 'null');
    const series = post.seriesUrl
        ? h(
              'a',
              {
                  href: `${authorHref}/series/${encodeURIComponent(post.seriesUrl)}`,
                  className:
                      'inline-flex max-w-32 items-center truncate rounded-full bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-content transition-all duration-150 hover:bg-line-light'
              },
              h(SiteIcon, {
                  name: 'stack-2',
                  className: 'mr-1.5'
              }),
              h('span', { className: 'truncate' }, post.seriesName ?? '시리즈')
          )
        : null;
    return h(
        'article',
        {
            className:
                'group flex flex-col overflow-hidden rounded-2xl bg-surface ring-1 ring-line/60 transition-all duration-150 hover:ring-line-strong/70 active:scale-[0.98]',
            key: post.id
        },
        hasImage
            ? h(
                  'div',
                  { className: 'aspect-[16/9] overflow-hidden' },
                  h(
                      'a',
                      {
                          href: titleHref,
                          className: 'block h-full'
                      },
                      h('img', {
                          className:
                              'h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105',
                          src: mediaUrl(post.image) ?? undefined,
                          alt: post.title,
                          loading: priority ? 'eager' : 'lazy'
                      })
                  )
              )
            : null,
        h(
            'div',
            { className: 'flex flex-grow flex-col p-5' },
            h(
                'h2',
                { className: 'mb-3 line-clamp-2 text-md font-bold leading-snug text-content' },
                h(
                    'a',
                    {
                        href: titleHref,
                        className: 'transition-colors duration-150 hover:text-content-secondary'
                    },
                    post.title
                )
            ),
            h(
                'div',
                { className: 'mb-3 flex items-center gap-3 text-xs text-content-secondary' },
                h(
                    'div',
                    { className: 'flex items-center gap-1.5' },
                    h(SiteIcon, {
                        name: 'calendar',
                        className: 'text-content-hint'
                    }),
                    post.publishedDate
                        ? h(
                              'time',
                              { dateTime: dateValue(post.publishedDate) ?? undefined },
                              relativeDate ? timeSince(post.publishedDate) : dateLabel(post.publishedDate)
                          )
                        : null
                ),
                h(
                    'div',
                    { className: 'flex items-center gap-1.5' },
                    h(SiteIcon, {
                        name: 'clock',
                        className: 'text-content-hint'
                    }),
                    h('span', null, `${post.readTime}분`)
                )
            ),
            h(
                'p',
                {
                    className: `mb-4 text-sm leading-relaxed text-content-secondary ${hasImage ? 'line-clamp-3' : 'flex-grow'}`
                },
                h('a', { href: titleHref }, post.description || post.subtitle)
            ),
            h(
                'footer',
                { className: 'mt-auto flex items-center justify-between border-t border-line-light pt-4' },
                showAuthor
                    ? h(
                          'div',
                          { className: 'flex min-w-0 items-center gap-2' },
                          h(
                              'a',
                              {
                                  href: authorHref,
                                  className: 'shrink-0'
                              },
                              h('img', {
                                  className: 'size-6 rounded-full object-cover ring-2 ring-line-light',
                                  src: avatarUrl(post.authorAvatar),
                                  alt: post.authorUsername,
                                  loading: 'lazy'
                              })
                          ),
                          h(
                              'a',
                              {
                                  href: authorHref,
                                  className:
                                      'truncate text-xs font-semibold text-content transition-colors hover:text-content-secondary'
                              },
                              post.authorUsername
                          )
                      )
                    : (series ?? h('div')),
                h(
                    'div',
                    { className: 'flex items-center gap-4 text-content-secondary' },
                    h(
                        'span',
                        {
                            className: 'flex items-center gap-1.5 text-xs',
                            'aria-label': `댓글 ${post.commentCount ?? 0}개`
                        },
                        h(SiteIcon, { name: 'message-circle' }),
                        h('span', null, String(post.commentCount ?? 0))
                    ),
                    PostCardLike({
                        post,
                        likes
                    })
                )
            )
        )
    );
}

export function EmptyState({
    title,
    message,
    icon = 'writing',
    framed = false,
    actionUrl,
    actionLabel,
    actionIcon
}: {
    title: string;
    message?: string;
    icon?: SiteIconName;
    framed?: boolean;
    actionUrl?: string;
    actionLabel?: string;
    actionIcon?: SiteIconName;
}): ReactNode {
    return h(
        'div',
        { className: `py-10 text-center ${framed ? 'rounded-2xl border border-line-light bg-surface-subtle' : ''}` },
        h(
            'div',
            { className: `mx-auto ${framed ? 'max-w-sm px-5' : 'max-w-sm'}` },
            icon
                ? h(
                      'div',
                      {
                          className: `mb-4 inline-flex size-12 items-center justify-center rounded-xl ${framed ? 'bg-surface-elevated' : 'bg-surface-subtle'}`
                      },
                      h(SiteIcon, {
                          name: icon,
                          className: 'text-lg text-content-hint'
                      })
                  )
                : null,
            h('h2', { className: 'mb-2 text-lg font-semibold text-content' }, title),
            message
                ? h(
                      'p',
                      {
                          className: `text-sm leading-relaxed text-content-secondary ${actionUrl && actionLabel ? 'mb-6' : ''}`
                      },
                      message
                  )
                : null,
            actionUrl && actionLabel
                ? h(
                      'a',
                      {
                          href: actionUrl,
                          className:
                              'inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-medium text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]'
                      },
                      actionIcon
                          ? h(SiteIcon, {
                                name: actionIcon,
                                className: 'text-sm'
                            })
                          : null,
                      h('span', null, actionLabel)
                  )
                : null
        )
    );
}

export function PostGrid({
    posts,
    showAuthor = true,
    priorityFirst = true,
    className = '',
    likes,
    relativeDate = false
}: {
    posts: PostRow[];
    showAuthor?: boolean;
    priorityFirst?: boolean;
    className?: string;
    likes?: CardLikes;
    relativeDate?: boolean;
}): ReactNode {
    if (!posts.length)
        return EmptyState({
            title: '아직 공개된 포스트가 없습니다.',
            message: '공개된 포스트가 발행되면 이곳에 표시됩니다.'
        });
    return h(
        'div',
        { className: `masonry-grid ${className}`.trim() },
        ...posts.map((post, index) =>
            PostCard({
                post,
                showAuthor,
                priority: priorityFirst && index === 0,
                likes,
                relativeDate
            })
        )
    );
}

export function Pagination({
    path,
    search,
    preserve,
    page,
    pages,
    always = false
}: {
    path: string;
    search: URLSearchParams;
    preserve: string[];
    page: number;
    pages: number;
    always?: boolean;
}): ReactNode {
    if (pages <= 1 && !always) return null;
    const item = (
        targetPage: number,
        label: string,
        active = false,
        disabled = false,
        rel?: string,
        ariaLabel?: string
    ) =>
        h(
            'div',
            {
                className:
                    `pagination-item ${active ? 'pagination-active' : ''} ${disabled ? 'pagination-disabled' : ''}`.trim(),
                key: label
            },
            disabled
                ? h(
                      'span',
                      {
                          className: 'pagination-link',
                          ...(ariaLabel ? { 'aria-label': ariaLabel } : {})
                      },
                      h(SiteIcon, { name: label as SiteIconName })
                  )
                : h(
                      'a',
                      {
                          className: 'pagination-link',
                          href: pageUrl(path, search, preserve, targetPage),
                          rel,
                          'aria-label': ariaLabel
                      },
                      label.startsWith('chevron') ? h(SiteIcon, { name: label as SiteIconName }) : label
                  )
        );
    const start = pages <= 5 ? 1 : page <= 2 ? 1 : Math.min(Math.max(1, page - 2), pages - 4);
    const end = pages <= 5 ? pages : page <= 2 ? 5 : Math.min(pages, start + 4);
    const numbers = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    return h(
        'nav',
        {
            className: 'pagination-nav',
            'aria-label': '페이지 탐색'
        },
        h(
            'div',
            { className: 'pagination-action prev' },
            item(1, 'chevrons-left', false, page <= 1, undefined, '첫 페이지'),
            item(page - 1, 'chevron-left', false, page <= 1, 'prev', '이전 페이지')
        ),
        h(
            'div',
            { className: 'pagination-pages' },
            ...numbers.map((number) => item(number, String(number), number === page))
        ),
        h(
            'div',
            { className: 'pagination-action next' },
            item(page + 1, 'chevron-right', false, page >= pages, 'next', '다음 페이지'),
            item(pages, 'chevrons-right', false, page >= pages, undefined, '마지막 페이지')
        )
    );
}

export type { CardLikes };
