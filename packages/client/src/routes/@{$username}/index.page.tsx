import { AuthorActivitySection } from '~/features/authors/activity-ui';
import { AboutSection, authorTabs, featuredPostsSection, profileHeader } from '~/features/authors/profile-ui';
import { NoticeSection, PageLayout } from '~/features/discovery/layout';
import { ReactFragment } from '~/features/discovery/search-ui';
import type { PageProps } from '@blex/contracts/pages';

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
        children: (
            <ReactFragment>
                {profileHeader(author, true, subscription, viewer, csrfToken, socialLinks)}
                {authorTabs(author, 'overview')}
                <div className={`${isAuthorEditor ? 'max-w-4xl' : 'max-w-7xl'} mx-auto mb-20 w-full px-4 sm:px-6`}>
                    <div className="space-y-14">
                        {isAuthorEditor ? <NoticeSection notices={userNotices} scope="user" /> : null}
                        <AboutSection author={author} aboutHtml={aboutHtml} isOwner={isOwner} />
                        {isAuthorEditor ? featuredPostsSection(author, featured, viewer?.id === author.id) : null}
                        <AuthorActivitySection {...activity} />
                    </div>
                </div>
            </ReactFragment>
        )
    });
}
