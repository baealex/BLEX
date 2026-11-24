import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { authFormPageDataId } from '~/application/route-data';
import { createSignupPageData } from '~/features/auth/ui/form-page-data';
import { SignupPage } from '~/features/auth/ui/signup-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['sign']): string {
    const { brand, siteKey } = props;
    const data = createSignupPageData(props);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex" />
                <title>{ui('Sign up - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
                {siteKey && (
                    <script src="https://js.hcaptcha.com/1/api.js" async defer data-blex-trusted-script="hcaptcha" />
                )}
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader brand={brand} />
                <SignupPage data={data} footer={<SiteFooter brand={brand} />} />
                {pageDataScript(authFormPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
