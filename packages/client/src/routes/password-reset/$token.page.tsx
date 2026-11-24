import { getDocumentLocale } from '../../i18n/locale.js';
import { ui } from '../../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { authFormPageDataId } from '~/application/route-data';
import { createPasswordResetPageData } from '~/features/auth/ui/form-page-data';
import { PasswordResetPage } from '~/features/auth/ui/password-reset-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['password-reset/$token']): string {
    const { brand, view } = props;
    const data = createPasswordResetPageData(props);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <meta name="referrer" content="no-referrer" />
                <title>{ui('Reset password - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <PasswordResetPage
                    data={data}
                    action={view.state === 'form' ? view.action : ''}
                    footer={<SiteFooter brand={brand} />}
                />
                {pageDataScript(authFormPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
