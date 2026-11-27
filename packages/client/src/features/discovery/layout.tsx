import { getDocumentLocale } from '../../i18n/locale.js';
import { Fragment, type ReactNode } from 'react';
import { SiteHeader, SiteTheme } from '../../appearance/shell';
import { type ContentMode, pageDataScript, renderApplicationDocument, scriptJson } from '../../application/document';
import { discoveryPageDataId } from '../../application/route-data';
import type { PageMeta } from '@blex/contracts/public';
import { DiscoveryPage } from './discovery-page';
import type { DiscoveryPageData } from './discovery-page-data';

/** A page that hydrates in the application tree from a JSON script directly under `<body>`. */
export function renderTreeDocument(meta: PageMeta, page: ReactNode, dataId: string, data: unknown): string {
    return renderPublicDocument(meta, [<Fragment key="page">{page}</Fragment>, pageDataScript(dataId, data)], 'tree');
}

export function renderDiscoveryPage(meta: PageMeta, data: DiscoveryPageData): string {
    return renderTreeDocument(meta, <DiscoveryPage data={data} />, discoveryPageDataId, data);
}

function renderPublicDocument(meta: PageMeta, content: ReactNode, mode?: ContentMode): string {
    const robots = meta.brand?.seoEnabled === false ? 'noindex,nofollow' : meta.robots;
    const structuredData = meta.structuredData ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(meta.structuredData) }} />
    ) : null;

    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <title>{meta.title}</title>
                <meta name="description" content={meta.description} />
                <meta property="og:type" content="website" />
                <meta property="og:title" content={meta.title} />
                <meta property="og:description" content={meta.description} />
                <meta property="og:url" content={meta.canonical} />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content={meta.title} />
                <meta name="twitter:description" content={meta.description} />
                <link rel="icon" href={meta.brand?.faviconUrl ?? '/favicon.ico'} />
                <link rel="canonical" href={meta.canonical} />
                {meta.markdownUrl ? <link rel="alternate" type="text/markdown" href={meta.markdownUrl} /> : null}
                {meta.brand?.seoEnabled === false ? null : (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={`${meta.siteName} RSS`}
                        href={new URL('/rss', meta.canonical).href}
                    />
                )}
                {meta.brand?.seoEnabled !== false && meta.authorFeed ? (
                    <link
                        rel="alternate"
                        type="application/rss+xml"
                        title={meta.authorFeed.title}
                        href={meta.authorFeed.url}
                    />
                ) : null}
                {robots ? <meta name="robots" content={robots} /> : null}
                {robots ? <meta name="googlebot" content={robots} /> : null}
                {meta.previous ? <link rel="prev" href={meta.previous} /> : null}
                {meta.next ? <link rel="next" href={meta.next} /> : null}
                <SiteTheme />
                {structuredData}
            </head>
            <body>
                <SiteHeader brand={meta.brand} viewer={meta.viewer} searchPage={meta.searchPage} />
                {content}
            </body>
        </html>,
        mode
    );
}
