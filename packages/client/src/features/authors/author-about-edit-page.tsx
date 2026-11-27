import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { AboutDraft } from './about-draft';
import { AboutPageEditor } from './about-editor';
import { authorEditMarkdownSelector } from './author-markup';
import type { AuthorAboutEditData, AuthorMountContext } from './author-page-data';
import { AuthorTabs, ProfileStrip } from './profile-ui';

export function AuthorAboutEditPage({
    data,
    markdown,
    draft
}: {
    data: AuthorAboutEditData;
    markdown: string;
    draft?: AboutDraft;
}) {
    return (
        <>
            <main>
                <div>
                    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
                        <ProfileStrip profile={data.profile} />
                        <div className="mt-5 mb-10">
                            <AuthorTabs profile={data.profile} active="about" />
                        </div>
                        <div className="mb-8">
                            <div className="mb-6">
                                <h1 className="mb-3 text-lg font-bold text-content">{ui('Tell us about yourself.')}</h1>
                                <p className="text-base text-content-secondary">
                                    {ui('Write an introduction about yourself.')}
                                </p>
                            </div>
                            <div
                                className="mb-6"
                                data-about-page=""
                                data-about-url={data.saveUrl}
                                data-about-return={data.returnPath}
                            >
                                <AboutPageEditor
                                    aboutMarkdown={markdown}
                                    saveUrl={data.saveUrl}
                                    returnPath={data.returnPath}
                                    draft={draft}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export async function mountPage(data: AuthorAboutEditData, content: Element, { draft, ready }: AuthorMountContext) {
    const source = content.querySelector<HTMLTextAreaElement>(authorEditMarkdownSelector);
    if (!source) throw new Error('The introduction editor is missing from the page.');
    await ready();
    return <AuthorAboutEditPage data={data} markdown={source.defaultValue} draft={draft} />;
}
