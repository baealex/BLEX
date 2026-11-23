import { authorPath, authorTabs, profileHeader } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { ReactFragment } from '~/features/discovery/search-ui';
import { h } from '~/features/discovery/view-helpers';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({
    meta,
    author,
    subscription,
    viewer,
    csrfToken,
    socialLinks,
    path
}: PageProps['@{$username}/about.edit']): string {
    return PageLayout({
        meta,
        children: h(
            ReactFragment,
            null,
            profileHeader(author, false, subscription, viewer, csrfToken, socialLinks, path),
            h(
                'div',
                { className: 'mx-auto w-full max-w-5xl px-4 sm:px-6' },
                authorTabs(author, 'about'),
                h(
                    'div',
                    { className: 'mb-8' },
                    h(
                        'div',
                        { className: 'mb-6' },
                        h('h1', { className: 'mb-3 text-lg font-bold text-content' }, '자신을 소개해 보세요.'),
                        h('p', { className: 'text-md text-content-secondary' }, '자신을 소개하는 글을 작성해 보세요.')
                    ),
                    h(
                        'div',
                        {
                            className: 'mb-6',
                            'data-about-page': '',
                            'data-about-url': path,
                            'data-about-return': authorPath(author.username)
                        },
                        h('textarea', {
                            'data-about-input': '',
                            defaultValue: author.aboutMarkdown ?? '',
                            placeholder: '마크다운으로 작성해 보세요.',
                            'aria-label': '소개',
                            className:
                                'h-64 w-full rounded-lg border border-line p-4 focus:outline-none focus:ring-2 focus:ring-line-strong/70'
                        }),
                        h(
                            'button',
                            {
                                type: 'button',
                                'data-about-save': '',
                                className:
                                    'mt-4 rounded-lg bg-action px-6 py-3 text-content-inverted hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong/70 focus:ring-offset-2 disabled:opacity-50'
                            },
                            '저장'
                        ),
                        h('div', {
                            'data-about-message': '',
                            hidden: true,
                            className: 'mt-4 text-sm'
                        })
                    )
                )
            )
        )
    });
}
