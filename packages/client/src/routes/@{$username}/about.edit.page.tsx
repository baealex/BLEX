import { ui } from '../../i18n/public-ui.js';
import { AboutPageEditor } from '~/features/authors/about-editor';
import { authorPath, authorTabs, profileHeader } from '~/features/authors/profile-ui';
import { PageLayout } from '~/features/discovery/layout';
import { ReactFragment } from '~/features/discovery/search-ui';
import type { PageProps } from '@blex/contracts/pages';

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
        children: (
            <ReactFragment>
                {profileHeader(author, false, subscription, viewer, csrfToken, socialLinks, path)}
                <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
                    {authorTabs(author, 'about')}
                    <div className="mb-8">
                        <div className="mb-6">
                            <h1 className="mb-3 text-lg font-bold text-content">{ui('Tell us about yourself.')}</h1>
                            <p className="text-md text-content-secondary">
                                {ui('Write an introduction about yourself.')}
                            </p>
                        </div>
                        <div
                            className="mb-6"
                            data-about-page=""
                            data-about-url={path}
                            data-about-return={authorPath(author.username)}
                        >
                            <AboutPageEditor
                                aboutMarkdown={author.aboutMarkdown ?? ''}
                                saveUrl={path}
                                returnPath={authorPath(author.username)}
                            />
                        </div>
                    </div>
                </div>
            </ReactFragment>
        )
    });
}
