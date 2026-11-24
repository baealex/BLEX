import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { loginPageDataId } from '~/application/route-data';
import { LoginPage } from '~/features/auth/ui/login-page';
import { createLoginPageData } from '~/features/auth/ui/login-page-data';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage({ brand, loginAssets, model }: PageProps['login']): string {
    const data = createLoginPageData(model);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Sign in - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
                {loginAssets.css.map((file) => (
                    <link key={file} rel="stylesheet" href={file} />
                ))}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <LoginPage data={data} footer={<SiteFooter brand={brand} />} />
                {pageDataScript(loginPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
