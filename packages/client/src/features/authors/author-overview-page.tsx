import { Suspense, use, useEffect, useRef, useState } from 'react';
import { SiteIcon } from '../../appearance/icons.js';
import { SiteFooter } from '../../appearance/shell.js';
import { ui } from '../../i18n/public-ui.js';
import type { AboutEditor as AboutEditorComponent } from './about-editor';
import { AuthorActivitySection } from './activity-ui';
import { authorAboutMarkdownSelector, authorAboutSelector } from './author-markup';
import type { AuthorMountContext, AuthorNoticeView, AuthorOverviewData, AuthorTabsView } from './author-page-data';
import { FeaturedPostsSection } from './featured-posts';
import { AuthorTabs, ProfileHeader, authorSectionTitle, authorTextLink } from './profile-ui';

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
        <div className="mb-4">
            <h2 className={authorSectionTitle}>{ui('Bio')}</h2>
        </div>
    );
}

/**
 * A long introduction starts folded. Focusing a link inside it unfolds it,
 * so keyboard users never land on text the fold hides.
 */
function AboutText({ html, collapsible }: { html: string; collapsible: boolean }) {
    const [open, setOpen] = useState(!collapsible);
    const text = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = text.current;
        if (open || !node) return;
        const unfold = () => setOpen(true);
        node.addEventListener('focusin', unfold);
        return () => node.removeEventListener('focusin', unfold);
    }, [open]);
    return (
        <>
            <div
                ref={text}
                id="author-about"
                className={`prose blog-post-content${open ? '' : ' max-h-60 overflow-hidden [mask-image:linear-gradient(#000_55%,transparent)]'}`}
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {collapsible ? (
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls="author-about"
                    onClick={() => setOpen(!open)}
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-content transition-colors duration-150 hover:text-content-secondary"
                >
                    {open ? ui('Show less') : ui('Show the full introduction')}
                    <SiteIcon
                        name="chevron-down"
                        className={`text-xs transition-transform duration-150${open ? ' rotate-180' : ''}`}
                    />
                </button>
            ) : null}
        </>
    );
}

function NoticeBody({ notice, position }: { notice: AuthorNoticeView; position: string | null }) {
    return (
        <div className="flex items-center justify-between gap-4 px-1">
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold leading-snug text-content">{notice.title}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-content-secondary">
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
        <section aria-label={ui('Author notices')}>
            <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className={authorSectionTitle}>{ui('Notices')}</h2>
                {notices.length > 1 ? (
                    <span className="text-xs font-medium tabular-nums text-content-secondary">
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

function SeriesSection({ series, all }: { series: NonNullable<AuthorOverviewData['series']>; all: AuthorTabsView }) {
    return (
        <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4">
                <h2 className={authorSectionTitle}>{ui('Series')}</h2>
                <a href={all.series} className={authorTextLink}>
                    {ui('{count, plural, one{See # series} other{See all # series}}', { count: all.seriesCount })}
                    <SiteIcon name="arrow-right" className="text-xs" />
                </a>
            </div>
            <ul className="grid border-t border-line-light sm:grid-cols-2 sm:gap-x-8">
                {series.map((item) => (
                    <li key={item.href} className="border-b border-line-light">
                        <a href={item.href} className="group flex min-h-13 items-center justify-between gap-4 py-3">
                            <span className="truncate text-[15px] font-semibold text-content transition-colors duration-150 group-hover:text-content-secondary">
                                {item.name}
                            </span>
                            <span className="shrink-0 text-[13px] text-content-secondary">
                                {ui('{value0, plural, one{# post} other{# posts}}', { value0: item.postCount })}
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
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
                <AboutText html={content.html} collapsible={about.collapsible} />
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
                    <ProfileHeader profile={data.profile} brand={data.brand} isHeading={true} />
                    {data.profile.tabs ? (
                        <div className="mx-auto mt-12 w-full max-w-3xl px-4 sm:mt-16 sm:px-6">
                            <AuthorTabs profile={data.profile} active="overview" />
                        </div>
                    ) : null}
                    {/* Posts come before the introduction, so a long one never pushes them out of reach. */}
                    <div
                        className={`mx-auto mb-20 w-full max-w-3xl px-4 sm:px-6 ${data.profile.tabs ? 'mt-10 sm:mt-12' : 'mt-12 sm:mt-16'}`}
                    >
                        <div className="space-y-16">
                            <NoticeSection notices={data.notices} />
                            {data.featured ? <FeaturedPostsSection view={data.featured} /> : null}
                            <AboutSection about={data.about} content={about} />
                            <AuthorActivitySection days={data.activity.days} recent={data.activity.recent} />
                            {data.series && data.profile.tabs ? (
                                <SeriesSection series={data.series} all={data.profile.tabs} />
                            ) : null}
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
