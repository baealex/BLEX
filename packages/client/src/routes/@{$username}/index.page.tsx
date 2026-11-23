import { AuthorActivitySection } from '~/features/authors/activity-ui';
import { AboutSection, authorTabs, featuredPostsSection, profileHeader } from '~/features/authors/profile-ui';
import { NoticeSection, PageLayout } from '~/features/discovery/layout';
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
    isAuthorEditor,
    userNotices,
    aboutHtml,
    isOwner,
    featured,
    activity
}: PageProps['@{$username}/index']): string {
    return PageLayout({
        meta,
        children: h(
            ReactFragment,
            null,
            profileHeader(author, true, subscription, viewer, csrfToken, socialLinks),
            authorTabs(author, 'overview'),
            h(
                'div',
                { className: `${isAuthorEditor ? 'max-w-4xl' : 'max-w-7xl'} mx-auto mb-20 w-full px-4 sm:px-6` },
                h(
                    'div',
                    { className: 'space-y-14' },
                    isAuthorEditor
                        ? NoticeSection({
                              notices: userNotices,
                              scope: 'user'
                          })
                        : null,
                    AboutSection({
                        author,
                        aboutHtml,
                        isOwner
                    }),
                    isAuthorEditor ? featuredPostsSection(author, featured, viewer?.id === author.id) : null,
                    h(AuthorActivitySection, activity)
                )
            )
        )
    });
}
