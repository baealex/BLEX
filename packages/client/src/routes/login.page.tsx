import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { renderApplicationDocument } from '~/application/document';
import { LoginForm } from '~/features/auth/ui/login-form';
import type { PageProps } from '~/contracts/pages';

export default function renderPage({ brand, loginAssets, model }: PageProps['login']): string {
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
                <div id="blex-login" data-model={JSON.stringify(model)}>
                    <LoginForm model={model} />
                </div>
                <SiteFooter brand={brand} />
                <script type="module" src={loginAssets.script} data-blex-page-module="login" />
            </body>
        </html>,
        true
    );
}
