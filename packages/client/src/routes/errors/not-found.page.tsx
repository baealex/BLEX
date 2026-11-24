import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { contentPageDataId } from '~/application/route-data';
import type { ErrorPageData } from '~/features/discovery/content-page-data';
import { NotFoundPage } from '~/features/discovery/not-found-page';
import { floatStyles } from '~/features/discovery/not-found-parts';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({ brand, viewer }: PageProps['errors/not-found']): string {
    const data: ErrorPageData = { page: 'not-found' };
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('404 - Page not found')}</title>
                <link rel="icon" href={brand.faviconUrl} />
                <SiteTheme />
                <style>{floatStyles}</style>
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} />
                <NotFoundPage />
                {pageDataScript(contentPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
