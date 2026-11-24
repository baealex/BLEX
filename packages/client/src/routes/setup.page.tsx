import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { authFormPageDataId } from '~/application/route-data';
import { createSetupPageData } from '~/features/auth/ui/form-page-data';
import { SetupPage } from '~/features/auth/ui/setup-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['setup']): string {
    const data = createSetupPageData(props);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Set up BLEX')}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader hideAuthLinks />
                <SetupPage data={data} setupToken={props.token} footer={<SiteFooter />} />
                {pageDataScript(authFormPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
