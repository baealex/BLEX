import { SiteFooter } from '../../appearance/shell.js';
import type { StaticPageData } from './content-page-data';

// The child chain starts at the route content, so the authored HTML inside it cannot match.
const staticPageBodySelector = ':scope > main > article > div';

/** `pageHtml` is the sanitized page with its stylesheets, which the server put ahead of it. */
export function StaticPage({ data, pageHtml }: { data: StaticPageData; pageHtml: string }) {
    return (
        <>
            <main>
                <article className="rich-content">
                    <div dangerouslySetInnerHTML={{ __html: pageHtml }} />
                </article>
            </main>
            <SiteFooter brand={data.brand} year={data.copyrightYear} />
        </>
    );
}

export function mountPage(data: StaticPageData, content: Element) {
    const body = content.querySelector(staticPageBodySelector);
    if (!body) throw new Error('The static page content is missing from the page.');
    return <StaticPage data={data} pageHtml={body.innerHTML} />;
}
