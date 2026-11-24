import { Suspense, use } from 'react';
import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { AboutEditor as AboutEditorComponent } from './about-editor';
import { AuthorActivitySection } from './activity-ui';
import { authorAboutMarkdownSelector, authorAboutSelector } from './author-markup';
import type { AuthorMountContext, AuthorNoticeView, AuthorOverviewData } from './author-page-data';
import { FeaturedPostsSection } from './featured-posts';
import { AuthorTabs, ProfileHeader } from './profile-ui';

type AboutEditorType = typeof AboutEditorComponent;

interface AboutContent {
    html: string;
    markdown: string;
    /** Only the owner's copy of the page uses the editor. A promise means it hydrates once the code arrives. */
    editor?: AboutEditorType | Promise<AboutEditorType>;
}

type AboutEditorProps = Parameters<AboutEditorType>[0];

function DeferredAboutEditor({ loading, ...props }: AboutEditorProps & { loading: Promise<AboutEditorType> }) {
    const Editor = use(loading);
    return <Editor {...props} />;
}

function AboutHeading() {
    return (
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-content">{ui('Bio')}</h2>
        </div>
    );
}

function NoticeBody({ notice, position }: { notice: AuthorNoticeView; position: string | null }) {
    return (
        <div className="flex items-center justify-between gap-4 px-1">
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold leading-snug text-content">{notice.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-content-hint">
                {position ? <span className="text-[11px] font-medium tabular-nums">{position}</span> : null}
                <SiteIcon name="arrow-right" className="text-xs" />
            </div>
        </div>
    );
}

function NoticeSection({ notices }: { notices: AuthorNoticeView[] }) {
    if (!notices.length) return null;
    const className =
        'group block py-3.5 transition-colors duration-150 hover:bg-surface-subtle/50 active:bg-surface-subtle/70';
    return (
        <section className="mb-14" aria-label={ui('Author notices')}>
            <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold tracking-tight text-content">{ui('Notices')}</h2>
                {notices.length > 1 ? (
                    <span className="pb-1 text-xs font-medium tabular-nums text-content-hint">
                        {ui('{value0, plural, one{# notice} other{# notices}}', { value0: notices.length })}
                    </span>
                ) : null}
            </div>
            <div className="divide-y divide-line-light border-y border-line-light">
                {notices.map((notice, index) => {
                    const position = notices.length > 1 ? `${index + 1}/${notices.length}` : null;
                    return notice.href ? (
                        <a key={notice.key} className={className} href={notice.href}>
                            <NoticeBody notice={notice} position={position} />
                        </a>
                    ) : (
                        <div key={notice.key} className={className}>
                            <NoticeBody notice={notice} position={position} />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

function AboutEditorSlot({ Editor, ...props }: AboutEditorProps & { Editor: AboutEditorType }) {
    return <Editor {...props} />;
}

function AboutSection({ about, content }: { about: AuthorOverviewData['about']; content: AboutContent }) {
    if (!about) return null;
    const { editor } = content;
    if (!about.editable || !editor)
        return (
            <section>
                <AboutHeading />
                <div className="prose blog-post-content" dangerouslySetInnerHTML={{ __html: content.html }} />
            </section>
        );
    const editorProps = { aboutHtml: content.html, aboutMarkdown: content.markdown, editPath: about.editPath };
    return (
        <section data-about-editor="" data-about-url={about.editPath}>
            <AboutHeading />
            {/* Its own boundary lets the rest of the page hydrate while the editor code is still on its way. */}
            <Suspense fallback={null}>
                {editor instanceof Promise ? (
                    <DeferredAboutEditor loading={editor} {...editorProps} />
                ) : (
                    <AboutEditorSlot Editor={editor} {...editorProps} />
                )}
            </Suspense>
        </section>
    );
}

export function AuthorOverviewPage({ data, about }: { data: AuthorOverviewData; about: AboutContent }) {
    return (
        <>
            <main>
                <div>
                    <ProfileHeader profile={data.profile} isHeading={true} />
                    <AuthorTabs profile={data.profile} active="overview" />
                    <div
                        className={`${data.profile.tabs ? 'max-w-4xl' : 'max-w-7xl'} mx-auto mb-20 w-full px-4 sm:px-6`}
                    >
                        <div className="space-y-14">
                            <NoticeSection notices={data.notices} />
                            <AboutSection about={data.about} content={about} />
                            {data.featured ? <FeaturedPostsSection view={data.featured} /> : null}
                            <AuthorActivitySection days={data.activity.days} recent={data.activity.recent} />
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

/**
 * Authored HTML and the owner's Markdown come back from the server markup rather than the page data.
 * A first load keeps the server's editor markup until the code arrives; a navigation waits for the code.
 */
export async function mountPage(data: AuthorOverviewData, content: Element, { hydrating }: AuthorMountContext) {
    if (!data.about) return <AuthorOverviewPage data={data} about={{ html: '', markdown: '' }} />;
    const html = content.querySelector(authorAboutSelector);
    const source = content.querySelector<HTMLTextAreaElement>(authorAboutMarkdownSelector);
    if (!html || (data.about.editable && !source)) throw new Error('The introduction is missing from the page.');
    let editor: AboutContent['editor'];
    if (data.about.editable) {
        const loading = import('./about-editor').then(({ AboutEditor }) => AboutEditor);
        editor = hydrating
            ? loading.catch((error: unknown) => {
                  // Its edit links still lead to the edit page, so the server markup stays usable.
                  console.error('The introduction editor could not be loaded.', error);
                  return new Promise<AboutEditorType>(() => {});
              })
            : await loading;
    }
    return (
        <AuthorOverviewPage
            data={data}
            about={{ html: html.innerHTML, markdown: source?.defaultValue ?? '', editor }}
        />
    );
}
