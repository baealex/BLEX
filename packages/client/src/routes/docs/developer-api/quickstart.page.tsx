import { DeveloperQuickstartPage } from '~/features/developer-api/quickstart';
import { createDeveloperQuickstartData } from '~/features/developer-api/quickstart-data';
import { t } from '@lingui/core/macro';
import { SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { contentPageDataId } from '~/application/route-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['docs/developer-api/quickstart']): string {
    const { brand, viewer, locale } = props;
    const data = createDeveloperQuickstartData(props);
    return renderApplicationDocument(
        <html lang={locale}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{`${t({ id: 'developer.quickstart.title', message: 'Developer API quickstart' })} | ${brand.siteName}`}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} viewer={viewer} />
                <DeveloperQuickstartPage data={data} />
                {pageDataScript(contentPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
