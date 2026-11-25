import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { contentPageDataId } from '~/application/route-data';
import type { ForbiddenPageData } from '~/features/discovery/content-page-data';
import { ForbiddenPage } from '~/features/discovery/forbidden-page';
import { floatStyles } from '~/features/discovery/not-found-parts';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({ brand, viewer }: PageProps['errors/forbidden']): string {
    const data: ForbiddenPageData = { page: 'forbidden', signedIn: Boolean(viewer) };
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{ui('403 - Access denied')}</title>
                <link rel="icon" href={brand.faviconUrl} />
                <SiteTheme />
                <style>{floatStyles}</style>
            </head>
            <body className="overflow-hidden bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} />
                <ForbiddenPage signedIn={data.signedIn} />
                {pageDataScript(contentPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
