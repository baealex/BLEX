import type { ReactNode } from 'react';
import { getDocumentLocale } from '../../i18n/locale.js';
import { SiteHeader, SiteTheme } from '../../appearance/shell';
import { pageDataScript, renderApplicationDocument } from '../../application/document';
import { workLogPageDataId } from '../../application/route-data';
import type { PageChrome } from '@blex/contracts/work-logs';
import type { WorkLogPageData } from './page-data';

interface DocumentHead {
    title: string;
    shareMeta?: {
        title: string;
        description: string;
        url: string;
        imageUrl?: string;
    };
}

/** A work log page that hydrates in the application tree from its data script. */
export function renderWorkLogDocument(
    head: DocumentHead,
    { brand, viewer }: PageChrome,
    page: ReactNode,
    data: WorkLogPageData
): string {
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="referrer" content="strict-origin" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <meta name="color-scheme" content="light dark" />
                <title>{head.title}</title>
                <SiteTheme />
                {head.shareMeta && (
                    <>
                        <meta property="og:type" content="article" />
                        <meta property="og:title" content={head.shareMeta.title} />
                        <meta property="og:description" content={head.shareMeta.description} />
                        <meta property="og:url" content={head.shareMeta.url} />
                        <meta
                            name="twitter:card"
                            content={head.shareMeta.imageUrl ? 'summary_large_image' : 'summary'}
                        />
                        {head.shareMeta.imageUrl && <meta property="og:image" content={head.shareMeta.imageUrl} />}
                    </>
                )}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} />
                {page}
                {pageDataScript(workLogPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
